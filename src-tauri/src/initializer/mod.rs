//! Project initialization module.
//!
//! Provides functionality to initialize Git repositories and BMAD projects
//! directly from the app UI, eliminating the need to use CLI commands.

mod bmad;
mod git;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use thiserror::Error;

pub use bmad::init_bmad;
pub use git::init_git;

/// Default timeout for commands in seconds.
/// Reserved for future use when implementing command timeouts.
#[allow(dead_code)]
pub const COMMAND_TIMEOUT_SECS: u64 = 300; // 5 minutes for npx downloads

/// Runs a command and returns its output.
/// Handles cross-platform differences.
///
/// NOTE: The Windows fallback path (`cmd /C`) requires manual testing on Windows
/// before release, as it cannot be covered by CI running on Unix systems.
#[cfg(target_os = "windows")]
pub fn run_command(cmd: &str, args: &[&str], cwd: &Path) -> std::io::Result<Output> {
    Command::new(cmd)
        .args(args)
        .current_dir(cwd)
        .output()
        .or_else(|_| {
            Command::new("cmd")
                .args(["/C", cmd])
                .args(args)
                .current_dir(cwd)
                .output()
        })
}

#[cfg(not(target_os = "windows"))]
pub fn run_command(cmd: &str, args: &[&str], cwd: &Path) -> std::io::Result<Output> {
    Command::new(cmd).args(args).current_dir(cwd).output()
}

/// Options for project initialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitOptions {
    pub project_name: String,
    pub user_name: String,
    pub workflow_style: WorkflowStyle,
}

/// Workflow style selection for BMAD initialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WorkflowStyle {
    QuickFlow,
    FullBmm,
}

impl WorkflowStyle {
    /// Returns the CLI argument for the BMAD install command.
    /// Maps to bmad-method module names: "core" for QuickFlow, "bmm" for Full BMM.
    pub fn as_cli_arg(&self) -> &str {
        match self {
            WorkflowStyle::QuickFlow => "core",
            WorkflowStyle::FullBmm => "bmm",
        }
    }
}

/// Progress information emitted during initialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitProgress {
    pub step: String,
    pub status: InitStatus,
    pub message: String,
}

/// Status of an initialization step.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InitStatus {
    Running,
    Complete,
    Failed,
}

/// Errors that can occur during project initialization.
#[derive(Debug, Error, Serialize)]
pub enum InitError {
    #[error("Git initialization failed: {0}")]
    GitInitFailed(String),

    #[error("BMAD initialization failed: {0}")]
    BmadInitFailed(String),

    #[error("BMAD initialization failed (Git was initialized successfully - use 'Initialize BMAD' to retry): {0}")]
    BmadInitFailedAfterGit(String),

    #[error("Path does not exist: {0}")]
    PathNotFound(String),

    #[error("Not a directory: {0}")]
    NotADirectory(String),

    #[error("Git already initialized at: {0}")]
    GitAlreadyInitialized(String),

    #[error("BMAD already initialized at: {0}")]
    BmadAlreadyInitialized(String),

    #[error("Failed to emit progress event: {0}")]
    EventError(String),
}

/// Validates that a path exists and is a directory.
pub fn validate_path(path: &PathBuf) -> Result<(), InitError> {
    if !path.exists() {
        return Err(InitError::PathNotFound(path.display().to_string()));
    }
    if !path.is_dir() {
        return Err(InitError::NotADirectory(path.display().to_string()));
    }
    Ok(())
}

/// Helper to emit progress events.
fn emit_progress(
    window: &tauri::Window,
    step: &str,
    status: InitStatus,
    message: &str,
) -> Result<(), InitError> {
    use tauri::Emitter;

    let progress = InitProgress {
        step: step.to_string(),
        status,
        message: message.to_string(),
    };

    window
        .emit("init-progress", &progress)
        .map_err(|e| InitError::EventError(e.to_string()))
}

/// Initializes a project with both Git and BMAD.
///
/// Emits progress events for each step:
/// - "git" step: Git initialization
/// - "bmad" step: BMAD initialization
#[tauri::command]
pub async fn initialize_project(
    path: PathBuf,
    options: InitOptions,
    window: tauri::Window,
) -> Result<crate::project::Project, InitError> {
    validate_path(&path)?;

    // Step 1: Git initialization
    emit_progress(
        &window,
        "git",
        InitStatus::Running,
        "Initializing Git repository...",
    )?;

    // Run in blocking task to not block the async runtime
    let git_path = path.clone();
    let git_result = tokio::task::spawn_blocking(move || init_git(&git_path)).await;

    match git_result {
        Ok(Ok(())) => {
            emit_progress(
                &window,
                "git",
                InitStatus::Complete,
                "Git repository initialized",
            )?;
        }
        Ok(Err(e)) => {
            emit_progress(&window, "git", InitStatus::Failed, &e.to_string())?;
            return Err(e);
        }
        Err(e) => {
            let error = InitError::GitInitFailed(format!("Task join error: {}", e));
            emit_progress(&window, "git", InitStatus::Failed, &error.to_string())?;
            return Err(error);
        }
    }

    // Step 2: BMAD initialization
    emit_progress(&window, "bmad", InitStatus::Running, "Initializing BMAD...")?;

    let bmad_path = path.clone();
    let bmad_options = options.clone();
    let bmad_result =
        tokio::task::spawn_blocking(move || init_bmad(&bmad_path, &bmad_options)).await;

    match bmad_result {
        Ok(Ok(())) => {
            emit_progress(&window, "bmad", InitStatus::Complete, "BMAD initialized")?;
        }
        Ok(Err(e)) => {
            // Use special error variant that indicates Git was already initialized
            let error = InitError::BmadInitFailedAfterGit(e.to_string());
            emit_progress(&window, "bmad", InitStatus::Failed, &error.to_string())?;
            return Err(error);
        }
        Err(e) => {
            let error = InitError::BmadInitFailedAfterGit(format!("Task join error: {}", e));
            emit_progress(&window, "bmad", InitStatus::Failed, &error.to_string())?;
            return Err(error);
        }
    }

    // Refresh project state after initialization
    crate::project::refresh_project(path)
        .map_err(|e| InitError::BmadInitFailed(format!("Failed to refresh project state: {}", e)))
}

/// Initializes only Git in the specified directory.
#[tauri::command]
pub async fn init_git_only(
    path: PathBuf,
    window: tauri::Window,
) -> Result<crate::project::Project, InitError> {
    validate_path(&path)?;

    emit_progress(
        &window,
        "git",
        InitStatus::Running,
        "Initializing Git repository...",
    )?;

    let git_path = path.clone();
    let git_result = tokio::task::spawn_blocking(move || init_git(&git_path)).await;

    match git_result {
        Ok(Ok(())) => {
            emit_progress(
                &window,
                "git",
                InitStatus::Complete,
                "Git repository initialized",
            )?;
        }
        Ok(Err(e)) => {
            emit_progress(&window, "git", InitStatus::Failed, &e.to_string())?;
            return Err(e);
        }
        Err(e) => {
            let error = InitError::GitInitFailed(format!("Task join error: {}", e));
            emit_progress(&window, "git", InitStatus::Failed, &error.to_string())?;
            return Err(error);
        }
    }

    crate::project::refresh_project(path)
        .map_err(|e| InitError::GitInitFailed(format!("Failed to refresh project state: {}", e)))
}

/// Initializes only BMAD in the specified directory.
#[tauri::command]
pub async fn init_bmad_only(
    path: PathBuf,
    options: InitOptions,
    window: tauri::Window,
) -> Result<crate::project::Project, InitError> {
    validate_path(&path)?;

    emit_progress(&window, "bmad", InitStatus::Running, "Initializing BMAD...")?;

    let bmad_path = path.clone();
    let bmad_result = tokio::task::spawn_blocking(move || init_bmad(&bmad_path, &options)).await;

    match bmad_result {
        Ok(Ok(())) => {
            emit_progress(&window, "bmad", InitStatus::Complete, "BMAD initialized")?;
        }
        Ok(Err(e)) => {
            emit_progress(&window, "bmad", InitStatus::Failed, &e.to_string())?;
            return Err(e);
        }
        Err(e) => {
            let error = InitError::BmadInitFailed(format!("Task join error: {}", e));
            emit_progress(&window, "bmad", InitStatus::Failed, &error.to_string())?;
            return Err(error);
        }
    }

    crate::project::refresh_project(path)
        .map_err(|e| InitError::BmadInitFailed(format!("Failed to refresh project state: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_workflow_style_cli_arg() {
        assert_eq!(WorkflowStyle::QuickFlow.as_cli_arg(), "core");
        assert_eq!(WorkflowStyle::FullBmm.as_cli_arg(), "bmm");
    }

    #[test]
    fn test_init_options_serialization() {
        let options = InitOptions {
            project_name: "test-project".to_string(),
            user_name: "Test User".to_string(),
            workflow_style: WorkflowStyle::QuickFlow,
        };

        let json = serde_json::to_string(&options).unwrap();
        assert!(json.contains("\"projectName\":\"test-project\""));
        assert!(json.contains("\"userName\":\"Test User\""));
        assert!(json.contains("\"workflowStyle\":\"quick-flow\""));
    }

    #[test]
    fn test_init_progress_serialization() {
        let progress = InitProgress {
            step: "git".to_string(),
            status: InitStatus::Running,
            message: "Initializing git...".to_string(),
        };

        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("\"step\":\"git\""));
        assert!(json.contains("\"status\":\"running\""));
    }

    #[test]
    fn test_validate_path_exists() {
        let dir = tempdir().unwrap();
        assert!(validate_path(&dir.path().to_path_buf()).is_ok());
    }

    #[test]
    fn test_validate_path_not_found() {
        let path = PathBuf::from("/nonexistent/path");
        let result = validate_path(&path);
        assert!(matches!(result, Err(InitError::PathNotFound(_))));
    }

    #[test]
    fn test_validate_path_not_directory() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        fs::write(&file_path, "test").unwrap();

        let result = validate_path(&file_path);
        assert!(matches!(result, Err(InitError::NotADirectory(_))));
    }

    #[test]
    fn test_init_error_serialization() {
        let error = InitError::GitInitFailed("test error".to_string());
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("GitInitFailed"));
    }

    #[test]
    fn test_bmad_init_failed_after_git_error() {
        let error = InitError::BmadInitFailedAfterGit("test error".to_string());
        let msg = error.to_string();
        assert!(msg.contains("Git was initialized successfully"));
        assert!(msg.contains("Initialize BMAD"));
    }

    #[test]
    fn test_run_command_basic() {
        let dir = tempdir().unwrap();
        // Test a simple command that should work on all platforms
        let result = run_command("echo", &["hello"], dir.path());
        assert!(result.is_ok());
        let output = result.unwrap();
        assert!(output.status.success());
    }

    #[test]
    fn test_run_command_nonexistent() {
        let dir = tempdir().unwrap();
        // Test with a command that doesn't exist
        let result = run_command("nonexistent_command_xyz123", &[], dir.path());
        // Should return an error or fail with non-zero exit
        assert!(result.is_err() || !result.unwrap().status.success());
    }
}
