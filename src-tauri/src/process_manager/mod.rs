//! Process manager module for Claude CLI sessions.
//!
//! This module handles spawning, managing, and terminating Claude CLI
//! sessions running in pseudo-terminals (PTY).

mod pty;
mod session;

pub use pty::{is_claude_cli_available, PtyManager};
pub use session::{ClaudeSession, SessionStatus, SpawnOptions};

use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, Window};
use thiserror::Error;
use tokio::sync::RwLock;

/// Global session registry
static SESSIONS: std::sync::OnceLock<Arc<RwLock<SessionRegistry>>> = std::sync::OnceLock::new();

/// Registry of active Claude sessions.
struct SessionRegistry {
    sessions: HashMap<String, ActiveSession>,
}

/// An active session with its PTY manager and metadata.
struct ActiveSession {
    session: ClaudeSession,
    pty: Arc<PtyManager>,
}

impl SessionRegistry {
    fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }
}

fn get_registry() -> &'static Arc<RwLock<SessionRegistry>> {
    SESSIONS.get_or_init(|| Arc::new(RwLock::new(SessionRegistry::new())))
}

/// Extracts the agent name from a session name.
/// Session name format: bmad-{project}-{agent}-{YYYYMMDD-HHmmss}
/// Timestamp is always 15 chars, so we parse from the end to handle project names with dashes.
fn extract_agent_from_session_name(session_name: &str) -> String {
    // Remove "bmad-" prefix
    let without_prefix = session_name.strip_prefix("bmad-").unwrap_or(session_name);

    // Timestamp is last 15 chars (YYYYMMDD-HHmmss) plus the dash before it
    // So we need to remove the last 16 chars to get "{project}-{agent}"
    if without_prefix.len() > 16 {
        let without_timestamp = &without_prefix[..without_prefix.len() - 16];
        // Agent is the last segment before timestamp
        without_timestamp
            .rsplit('-')
            .next()
            .unwrap_or("unknown")
            .to_string()
    } else {
        "unknown".to_string()
    }
}

/// Errors that can occur during process management.
#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code")]
    ClaudeNotFound,

    #[error("Failed to create PTY: {0}")]
    PtyCreationFailed(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session already terminated: {0}")]
    SessionAlreadyTerminated(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl serde::Serialize for ProcessError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Spawns a new Claude CLI session in a PTY.
///
/// This command creates a new PTY, spawns the Claude CLI, and sets up
/// output streaming via Tauri events.
#[tauri::command]
pub async fn spawn_claude_session(
    options: SpawnOptions,
    window: Window,
) -> Result<ClaudeSession, ProcessError> {
    // Check if Claude CLI is available
    if !is_claude_cli_available() {
        return Err(ProcessError::ClaudeNotFound);
    }

    // Build claude command arguments
    let mut args: Vec<&str> = Vec::new();

    // For resuming an existing session, use --continue with session name
    if options.resume {
        args.push("--continue");
        args.push(&options.session_name);
    }
    // For new sessions, Claude CLI will auto-generate a session ID
    // We track sessions internally using our own session_name

    // Spawn the PTY
    let pty = PtyManager::spawn("claude", &args, &options.project_path, &[])?;
    let pty = Arc::new(pty);

    // Extract agent name from session name (format: bmad-{project}-{agent}-{YYYYMMDD-HHmmss})
    // Parse from the end since project names may contain dashes
    // Timestamp is always 15 chars: YYYYMMDD-HHmmss
    let agent = extract_agent_from_session_name(&options.session_name);

    // Create session metadata
    let session = ClaudeSession::new(&options, agent);
    let session_id = session.id.clone();

    // Store in registry
    {
        let mut registry = get_registry().write().await;
        registry.sessions.insert(
            session_id.clone(),
            ActiveSession {
                session: session.clone(),
                pty: Arc::clone(&pty),
            },
        );
    }

    // Spawn output reader task
    let reader_session_id = session_id.clone();
    let reader_pty = Arc::clone(&pty);
    let reader_window = window.clone();

    tokio::spawn(async move {
        output_reader_task(reader_session_id, reader_pty, reader_window).await;
    });

    // Send initial command if provided
    if let Some(ref cmd) = options.initial_command {
        let input = format!("{}\n", cmd);
        pty.write_input(input.as_bytes()).await?;
    }

    Ok(session)
}

/// Background task that reads PTY output and emits events.
async fn output_reader_task(session_id: String, pty: Arc<PtyManager>, window: Window) {
    loop {
        match pty.read_output().await {
            Ok(data) if !data.is_empty() => {
                // Emit output event
                let _ = window.emit(
                    &format!("session-output-{}", session_id),
                    String::from_utf8_lossy(&data).to_string(),
                );
            }
            Ok(_) => {
                // Empty read - check if process exited
                if pty.is_process_exited().await {
                    // Update session status and then remove from registry to free memory
                    let exit_code = pty.exit_status().await;
                    {
                        let mut registry = get_registry().write().await;
                        if let Some(active) = registry.sessions.get_mut(&session_id) {
                            active.session.status = SessionStatus::Completed;
                        }
                        // Remove completed session from registry to prevent memory leak
                        registry.sessions.remove(&session_id);
                    }

                    // Emit exit event
                    let _ = window.emit(
                        &format!("session-exited-{}", session_id),
                        serde_json::json!({
                            "status": "completed",
                            "exitCode": exit_code
                        }),
                    );
                    break;
                }
                // Small delay before next read attempt
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
            Err(e) => {
                // Error reading - session likely terminated
                // Log the error for debugging
                eprintln!("Session {} read error: {}", session_id, e);

                // Clean up the session from registry
                {
                    let mut registry = get_registry().write().await;
                    if let Some(active) = registry.sessions.get_mut(&session_id) {
                        active.session.status = SessionStatus::Interrupted;
                    }
                    registry.sessions.remove(&session_id);
                }

                let _ = window.emit(
                    &format!("session-exited-{}", session_id),
                    serde_json::json!({ "status": "interrupted" }),
                );
                break;
            }
        }
    }
}

/// Sends input data to an active session.
#[tauri::command]
pub async fn session_input(session_id: String, data: String) -> Result<(), ProcessError> {
    let registry = get_registry().read().await;
    let active = registry
        .sessions
        .get(&session_id)
        .ok_or_else(|| ProcessError::SessionNotFound(session_id.clone()))?;

    if active.session.status != SessionStatus::Active {
        return Err(ProcessError::SessionAlreadyTerminated(session_id));
    }

    active.pty.write_input(data.as_bytes()).await
}

/// Terminates an active session.
///
/// Lock strategy: read-release-kill-write pattern to minimize lock contention.
/// This allows other operations (input, resize, list) to proceed while the
/// potentially slow PTY kill operation is in progress.
#[tauri::command]
pub async fn terminate_session(session_id: String) -> Result<(), ProcessError> {
    // Phase 1: Get PTY reference with read lock (fast, non-blocking to other reads)
    let pty = {
        let registry = get_registry().read().await;
        let active = registry
            .sessions
            .get(&session_id)
            .ok_or_else(|| ProcessError::SessionNotFound(session_id.clone()))?;

        if active.session.status != SessionStatus::Active {
            return Err(ProcessError::SessionAlreadyTerminated(session_id.clone()));
        }

        Arc::clone(&active.pty)
    }; // Read lock released here - other operations can proceed

    // Phase 2: Kill PTY outside of any lock (slow operation)
    // Other sessions can send input, resize, etc. during this time
    pty.kill().await?;

    // Phase 3: Update status with write lock (fast)
    {
        let mut registry = get_registry().write().await;
        if let Some(active) = registry.sessions.get_mut(&session_id) {
            active.session.status = SessionStatus::Interrupted;
        }
        // Note: If session not found here, it was already cleaned up by output_reader_task
        // which is fine - the kill already succeeded
    }

    Ok(())
}

/// Lists all active sessions.
#[tauri::command]
pub async fn list_active_sessions() -> Vec<ClaudeSession> {
    let registry = get_registry().read().await;
    registry
        .sessions
        .values()
        .filter(|a| a.session.status == SessionStatus::Active)
        .map(|a| a.session.clone())
        .collect()
}

/// Resizes the PTY for a session.
#[tauri::command]
pub async fn resize_session(session_id: String, rows: u16, cols: u16) -> Result<(), ProcessError> {
    let registry = get_registry().read().await;
    let active = registry
        .sessions
        .get(&session_id)
        .ok_or_else(|| ProcessError::SessionNotFound(session_id.clone()))?;

    if active.session.status != SessionStatus::Active {
        return Err(ProcessError::SessionAlreadyTerminated(session_id));
    }

    active.pty.resize(rows, cols).await
}

/// Gets the count of active sessions.
pub async fn get_active_session_count() -> usize {
    let registry = get_registry().read().await;
    registry
        .sessions
        .values()
        .filter(|a| a.session.status == SessionStatus::Active)
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_error_serialization() {
        let error = ProcessError::ClaudeNotFound;
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("Claude CLI not found"));
    }

    #[test]
    fn test_session_not_found_error() {
        let error = ProcessError::SessionNotFound("test-session".to_string());
        let msg = error.to_string();
        assert!(msg.contains("test-session"));
    }

    #[test]
    fn test_extract_agent_simple_project_name() {
        // Simple project name without dashes
        let session = "bmad-myproject-architect-20260216-143052";
        assert_eq!(extract_agent_from_session_name(session), "architect");
    }

    #[test]
    fn test_extract_agent_project_name_with_dashes() {
        // Project name with dashes: "my-cool-project"
        let session = "bmad-my-cool-project-developer-20260216-143052";
        assert_eq!(extract_agent_from_session_name(session), "developer");
    }

    #[test]
    fn test_extract_agent_complex_project_name() {
        // Very complex project name with multiple dashes
        let session = "bmad-my-super-cool-app-pm-20260216-143052";
        assert_eq!(extract_agent_from_session_name(session), "pm");
    }

    #[test]
    fn test_extract_agent_invalid_format() {
        // Invalid format should return "unknown"
        let session = "invalid";
        assert_eq!(extract_agent_from_session_name(session), "unknown");
    }

    #[tokio::test]
    async fn test_terminate_nonexistent_session() {
        // Terminating a non-existent session should return SessionNotFound
        let result = terminate_session("nonexistent-session-id".to_string()).await;
        assert!(result.is_err());
        match result {
            Err(ProcessError::SessionNotFound(id)) => {
                assert_eq!(id, "nonexistent-session-id");
            }
            _ => panic!("Expected SessionNotFound error"),
        }
    }

    #[tokio::test]
    async fn test_concurrent_terminate_no_deadlock() {
        // This test verifies that concurrent termination attempts don't deadlock.
        // We test with non-existent sessions since we can't easily create mock PTYs,
        // but this still exercises the lock acquisition patterns.
        use tokio::time::{timeout, Duration};

        let session_ids: Vec<String> = (0..5)
            .map(|i| format!("concurrent-test-session-{}", i))
            .collect();

        // Spawn concurrent termination attempts
        let handles: Vec<_> = session_ids
            .iter()
            .map(|id| {
                let id = id.clone();
                tokio::spawn(async move { terminate_session(id).await })
            })
            .collect();

        // All should complete within a reasonable time (no deadlock)
        // Using 5 seconds as a generous timeout
        let results = timeout(Duration::from_secs(5), async {
            let mut results = Vec::new();
            for handle in handles {
                results.push(handle.await);
            }
            results
        })
        .await;

        // Verify we didn't timeout (which would indicate a deadlock)
        assert!(
            results.is_ok(),
            "Concurrent terminations should complete without deadlock"
        );

        // All should have returned SessionNotFound (since sessions don't exist)
        let results = results.unwrap();
        for result in results {
            assert!(result.is_ok(), "tokio::spawn should not panic");
            let inner_result = result.unwrap();
            assert!(
                matches!(inner_result, Err(ProcessError::SessionNotFound(_))),
                "Expected SessionNotFound for non-existent session"
            );
        }
    }
}
