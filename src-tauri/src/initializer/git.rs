//! Git initialization functionality.
//!
//! Executes `git init` to create a new Git repository.

use std::path::Path;

use super::{run_command, InitError};

/// Initializes a Git repository in the specified directory.
///
/// Returns an error if:
/// - The directory already contains a `.git` directory or file
/// - The `git init` command fails
pub fn init_git(path: &Path) -> Result<(), InitError> {
    // Check if .git already exists (directory or file for worktrees)
    let git_path = path.join(".git");
    if git_path.exists() {
        return Err(InitError::GitAlreadyInitialized(path.display().to_string()));
    }

    // Run git init
    let output = run_command("git", &["init"], path)
        .map_err(|e| InitError::GitInitFailed(format!("Failed to execute git command: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(InitError::GitInitFailed(format!(
            "git init failed: {}",
            stderr.trim()
        )));
    }

    // Verify .git was created
    if !git_path.exists() {
        return Err(InitError::GitInitFailed(
            "git init succeeded but .git directory was not created".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    #[test]
    fn test_init_git_creates_repo() {
        let dir = tempdir().unwrap();
        init_git(dir.path()).unwrap();
        assert!(dir.path().join(".git").exists());
    }

    #[test]
    fn test_init_git_already_initialized_directory() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();

        let result = init_git(dir.path());
        assert!(matches!(result, Err(InitError::GitAlreadyInitialized(_))));
    }

    #[test]
    fn test_init_git_already_initialized_file() {
        // In git worktrees, .git is a file not a directory
        let dir = tempdir().unwrap();
        fs::write(dir.path().join(".git"), "gitdir: /some/path").unwrap();

        let result = init_git(dir.path());
        assert!(matches!(result, Err(InitError::GitAlreadyInitialized(_))));
    }

    #[test]
    fn test_init_git_creates_valid_repo() {
        let dir = tempdir().unwrap();
        init_git(dir.path()).unwrap();

        // Verify git status works (confirms valid repo)
        let output = Command::new("git")
            .args(["status"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        assert!(output.status.success());
    }
}
