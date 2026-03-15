//! PTY (pseudo-terminal) allocation and management for Claude CLI.
//!
//! This module handles creating and managing PTY pairs for running
//! Claude CLI in an embedded terminal environment.

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::process_manager::ProcessError;

/// Writer handle for PTY input - must be cached since take_writer() can only be called once.
type PtyWriter = Box<dyn Write + Send>;

/// Manages a PTY pair (master/slave) for a Claude CLI process.
pub struct PtyManager {
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    child: Arc<Mutex<Box<dyn Child + Send>>>,
    /// Cached writer - initialized on first write since take_writer() consumes the writer
    writer: Arc<Mutex<Option<PtyWriter>>>,
}

impl PtyManager {
    /// Spawns a new process in a PTY.
    ///
    /// # Arguments
    /// * `command` - The command to run (e.g., "claude")
    /// * `args` - Command arguments
    /// * `working_dir` - Working directory for the process
    /// * `env` - Additional environment variables
    pub fn spawn(
        command: &str,
        args: &[&str],
        working_dir: &Path,
        env: &[(String, String)],
    ) -> Result<Self, ProcessError> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| ProcessError::PtyCreationFailed(e.to_string()))?;

        let mut cmd = CommandBuilder::new(command);
        cmd.args(args);
        cmd.cwd(working_dir);
        for (key, value) in env {
            cmd.env(key, value);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| ProcessError::PtyCreationFailed(e.to_string()))?;

        Ok(Self {
            master: Arc::new(Mutex::new(pair.master)),
            child: Arc::new(Mutex::new(child)),
            writer: Arc::new(Mutex::new(None)),
        })
    }

    /// Reads available output from the PTY.
    ///
    /// Returns the bytes read, or an empty vec if no data available.
    /// This is a blocking read that waits for data.
    pub async fn read_output(&self) -> Result<Vec<u8>, ProcessError> {
        let master = self.master.lock().await;
        let mut reader = master.try_clone_reader().map_err(|e| {
            ProcessError::IoError(std::io::Error::other(e))
        })?;

        // Read in a separate task to avoid blocking
        let result = tokio::task::spawn_blocking(move || {
            let mut buf = vec![0u8; 4096];
            match reader.read(&mut buf) {
                Ok(0) => Ok(Vec::new()), // EOF
                Ok(n) => {
                    buf.truncate(n);
                    Ok(buf)
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Ok(Vec::new()),
                Err(e) => Err(ProcessError::IoError(e)),
            }
        })
        .await
        .map_err(|e| ProcessError::IoError(std::io::Error::other(e)))?;

        result
    }

    /// Writes input data to the PTY.
    /// The writer is cached on first call since take_writer() can only be called once.
    pub async fn write_input(&self, data: &[u8]) -> Result<(), ProcessError> {
        let mut writer_guard = self.writer.lock().await;

        // Initialize writer on first call
        if writer_guard.is_none() {
            let master = self.master.lock().await;
            let new_writer = master.take_writer().map_err(|e| {
                ProcessError::IoError(std::io::Error::other(e))
            })?;
            *writer_guard = Some(new_writer);
        }

        // Use the cached writer
        let writer = writer_guard.as_mut().unwrap();
        writer.write_all(data).map_err(ProcessError::IoError)?;
        writer.flush().map_err(ProcessError::IoError)?;

        Ok(())
    }

    /// Checks if the child process has exited.
    pub async fn is_process_exited(&self) -> bool {
        let mut child = self.child.lock().await;
        match child.try_wait() {
            Ok(Some(_)) => true,
            Ok(None) => false,
            Err(_) => true, // Assume exited on error
        }
    }

    /// Gets the exit status if the process has exited.
    pub async fn exit_status(&self) -> Option<u32> {
        let mut child = self.child.lock().await;
        match child.try_wait() {
            Ok(Some(status)) => Some(status.exit_code()),
            _ => None,
        }
    }

    /// Terminates the child process.
    pub async fn kill(&self) -> Result<(), ProcessError> {
        let mut child = self.child.lock().await;
        child
            .kill()
            .map_err(|e| ProcessError::IoError(std::io::Error::other(e)))
    }

    /// Resizes the PTY window.
    pub async fn resize(&self, rows: u16, cols: u16) -> Result<(), ProcessError> {
        let master = self.master.lock().await;
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| ProcessError::PtyCreationFailed(e.to_string()))
    }
}

/// Checks if the Claude CLI is available in PATH.
/// Uses platform-specific command detection (where on Windows, which on Unix).
pub fn is_claude_cli_available() -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("where")
            .arg("claude")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("which")
            .arg("claude")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_cli_check() {
        // This just verifies the function runs without panicking
        let _available = is_claude_cli_available();
    }

    #[tokio::test]
    async fn test_pty_spawn_echo() {
        // Test spawning a simple echo command
        let temp_dir = std::env::temp_dir();
        let manager = PtyManager::spawn("echo", &["hello"], &temp_dir, &[]);

        assert!(manager.is_ok(), "Should be able to spawn echo command");

        if let Ok(pty) = manager {
            // Wait for process to exit with retries
            for _ in 0..50 {
                if pty.is_process_exited().await {
                    return; // Test passed
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
            }
            panic!("Process did not exit in time");
        }
    }
}
