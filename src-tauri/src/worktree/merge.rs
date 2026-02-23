//! Git merge operations for worktree branches.
//!
//! Provides functions for checking merge conflicts and performing merges
//! from worktree branches back into the main repository branch.

use std::path::Path;

use serde::{Deserialize, Serialize};

use super::git::run_git;
use super::types::WorktreeError;

/// Result of a merge operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeResult {
    /// Whether the merge was successful.
    pub success: bool,
    /// Human-readable message about the merge result.
    pub message: String,
    /// List of conflicting file paths (empty if no conflicts).
    pub conflicts: Vec<String>,
    /// The merge commit hash (first 7 characters) if successful.
    pub merge_commit: Option<String>,
}

/// Gets the current branch name for a repository.
///
/// Returns an error if the repository is in a detached HEAD state
/// or if the branch cannot be determined.
pub fn get_current_branch_name(repo_path: &Path) -> Result<String, WorktreeError> {
    let output = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], repo_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(WorktreeError::GitError(format!(
            "Failed to get current branch: {}",
            stderr.trim()
        )));
    }

    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if branch.is_empty() || branch == "HEAD" {
        return Err(WorktreeError::GitError(
            "Repository is in detached HEAD state".to_string(),
        ));
    }

    Ok(branch)
}

/// Checks if the repository has uncommitted changes.
///
/// Returns true if there are staged or unstaged changes.
pub fn has_uncommitted_changes(repo_path: &Path) -> Result<bool, WorktreeError> {
    let output = run_git(&["status", "--porcelain"], repo_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(WorktreeError::GitError(format!(
            "Failed to check status: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(!stdout.trim().is_empty())
}

/// Checks if merging a branch would result in conflicts.
///
/// Performs a dry-run merge with `--no-commit --no-ff` and then aborts
/// to restore the original state. Returns a list of conflicting files.
///
/// # Arguments
/// * `repo_path` - Path to the repository where the merge will happen
/// * `source_branch` - The branch to merge from (e.g., "story/3-4-feature")
///
/// # Returns
/// * `Ok(Vec<String>)` - Empty vec if no conflicts, otherwise list of conflicting files
/// * `Err(WorktreeError)` - If the git commands fail
pub fn check_merge_conflicts(
    repo_path: &Path,
    source_branch: &str,
) -> Result<Vec<String>, WorktreeError> {
    // First, check if repo has uncommitted changes
    if has_uncommitted_changes(repo_path)? {
        return Err(WorktreeError::GitError(
            "Target repository has uncommitted changes. Please commit or stash them first."
                .to_string(),
        ));
    }

    // Try merge with --no-commit --no-ff
    let output = run_git(
        &["merge", "--no-commit", "--no-ff", source_branch],
        repo_path,
    )?;

    if output.status.success() {
        // Clean merge possible - abort to restore state
        let _ = run_git(&["merge", "--abort"], repo_path);
        return Ok(Vec::new());
    }

    // Get conflicting files from status
    let status_output = run_git(&["status", "--porcelain"], repo_path)?;
    let stdout = String::from_utf8_lossy(&status_output.stdout);

    // Parse conflict markers: UU (both modified), AA (both added), DD (both deleted)
    // Also AU (added by us), UA (added by them), DU (deleted by us), UD (deleted by them)
    let conflicts: Vec<String> = stdout
        .lines()
        .filter(|line| {
            let bytes = line.as_bytes();
            if bytes.len() < 2 {
                return false;
            }
            // Check for conflict status codes
            let x = bytes[0];
            let y = bytes[1];
            // UU, AA, DD are the main conflict indicators
            // Also check for AU, UA, DU, UD
            matches!(
                (x, y),
                (b'U', b'U')
                    | (b'A', b'A')
                    | (b'D', b'D')
                    | (b'A', b'U')
                    | (b'U', b'A')
                    | (b'D', b'U')
                    | (b'U', b'D')
            )
        })
        .map(|line| {
            // Extract file path (everything after the two-character status and space)
            line[3..].to_string()
        })
        .collect();

    // Abort the merge attempt to restore state
    let _ = run_git(&["merge", "--abort"], repo_path);

    Ok(conflicts)
}

/// Performs a merge from a source branch into the current branch.
///
/// Uses `--no-ff` to always create a merge commit, with a commit message
/// that includes the story ID if provided.
///
/// # Arguments
/// * `repo_path` - Path to the repository where the merge will happen
/// * `source_branch` - The branch to merge from (e.g., "story/3-4-feature")
/// * `story_id` - Optional story ID to include in commit message
///
/// # Returns
/// * `Ok(MergeResult)` - The result of the merge operation
/// * `Err(WorktreeError)` - If the merge fails for unexpected reasons
pub fn merge_branch(
    repo_path: &Path,
    source_branch: &str,
    story_id: Option<&str>,
) -> Result<MergeResult, WorktreeError> {
    // First check for conflicts
    let conflicts = check_merge_conflicts(repo_path, source_branch)?;

    if !conflicts.is_empty() {
        return Ok(MergeResult {
            success: false,
            message: format!(
                "Merge would result in {} conflict(s)",
                conflicts.len()
            ),
            conflicts,
            merge_commit: None,
        });
    }

    // Build commit message
    let commit_message = match story_id {
        Some(id) => format!(
            "Merge branch '{}' into current branch\n\nStory: {}",
            source_branch, id
        ),
        None => format!("Merge branch '{}' into current branch", source_branch),
    };

    // Perform the merge
    let output = run_git(
        &["merge", "--no-ff", "-m", &commit_message, source_branch],
        repo_path,
    )?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(WorktreeError::GitError(format!(
            "Merge failed: {}",
            stderr.trim()
        )));
    }

    // Get the merge commit hash (short form)
    let head_output = run_git(&["rev-parse", "--short", "HEAD"], repo_path)?;
    let commit_hash = if head_output.status.success() {
        Some(
            String::from_utf8_lossy(&head_output.stdout)
                .trim()
                .to_string(),
        )
    } else {
        None
    };

    Ok(MergeResult {
        success: true,
        message: format!("Successfully merged '{}' into current branch", source_branch),
        conflicts: Vec::new(),
        merge_commit: commit_hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    /// Creates a test git repository with an initial commit.
    fn create_test_repo() -> tempfile::TempDir {
        let dir = tempdir().unwrap();
        let path = dir.path();

        // Initialize git repo
        Command::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .unwrap();

        // Configure git user for commits
        Command::new("git")
            .args(["config", "user.email", "test@test.com"])
            .current_dir(path)
            .output()
            .unwrap();

        Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(path)
            .output()
            .unwrap();

        // Create initial commit
        fs::write(path.join("README.md"), "# Test\n").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Initial commit"])
            .current_dir(path)
            .output()
            .unwrap();

        dir
    }

    /// Creates a test repo with a feature branch that has changes.
    fn create_repo_with_feature_branch() -> (tempfile::TempDir, String) {
        let dir = create_test_repo();
        let path = dir.path();

        // Create and checkout feature branch
        Command::new("git")
            .args(["checkout", "-b", "story/3-4-feature"])
            .current_dir(path)
            .output()
            .unwrap();

        // Make changes on feature branch
        fs::write(path.join("feature.txt"), "Feature content\n").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Add feature"])
            .current_dir(path)
            .output()
            .unwrap();

        // Go back to main/master
        // First get the default branch name
        let output = Command::new("git")
            .args(["branch", "--list"])
            .current_dir(path)
            .output()
            .unwrap();
        let stdout = String::from_utf8_lossy(&output.stdout);
        let main_branch = if stdout.contains("main") {
            "main"
        } else {
            "master"
        };

        Command::new("git")
            .args(["checkout", main_branch])
            .current_dir(path)
            .output()
            .unwrap();

        (dir, main_branch.to_string())
    }

    #[test]
    fn test_get_current_branch_name() {
        let dir = create_test_repo();
        let result = get_current_branch_name(dir.path());
        assert!(result.is_ok());
        let branch = result.unwrap();
        assert!(branch == "main" || branch == "master");
    }

    #[test]
    fn test_get_current_branch_name_feature_branch() {
        let dir = create_test_repo();

        // Create and checkout feature branch
        Command::new("git")
            .args(["checkout", "-b", "story/3-4-test"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        let result = get_current_branch_name(dir.path());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "story/3-4-test");
    }

    #[test]
    fn test_has_uncommitted_changes_clean() {
        let dir = create_test_repo();
        let result = has_uncommitted_changes(dir.path()).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_has_uncommitted_changes_dirty() {
        let dir = create_test_repo();
        fs::write(dir.path().join("new-file.txt"), "content").unwrap();

        let result = has_uncommitted_changes(dir.path()).unwrap();
        assert!(result);
    }

    #[test]
    fn test_check_merge_conflicts_clean() {
        let (dir, _main) = create_repo_with_feature_branch();

        let conflicts = check_merge_conflicts(dir.path(), "story/3-4-feature").unwrap();
        assert!(conflicts.is_empty());
    }

    #[test]
    fn test_check_merge_conflicts_with_conflicts() {
        let (dir, _main) = create_repo_with_feature_branch();
        let path = dir.path();

        // Create a conflicting change on main
        fs::write(path.join("feature.txt"), "Different content on main\n").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Conflicting change"])
            .current_dir(path)
            .output()
            .unwrap();

        let conflicts = check_merge_conflicts(path, "story/3-4-feature").unwrap();
        assert!(!conflicts.is_empty());
        assert!(conflicts.iter().any(|f| f.contains("feature.txt")));
    }

    #[test]
    fn test_check_merge_conflicts_rejects_dirty_repo() {
        let (dir, _main) = create_repo_with_feature_branch();
        let path = dir.path();

        // Make the repo dirty
        fs::write(path.join("uncommitted.txt"), "uncommitted").unwrap();

        let result = check_merge_conflicts(path, "story/3-4-feature");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("uncommitted changes"));
    }

    #[test]
    fn test_merge_branch_success() {
        let (dir, _main) = create_repo_with_feature_branch();

        let result = merge_branch(dir.path(), "story/3-4-feature", Some("3-4")).unwrap();

        assert!(result.success);
        assert!(result.merge_commit.is_some());
        assert!(result.conflicts.is_empty());

        // Verify feature.txt exists after merge
        assert!(dir.path().join("feature.txt").exists());
    }

    #[test]
    fn test_merge_branch_with_conflicts() {
        let (dir, _main) = create_repo_with_feature_branch();
        let path = dir.path();

        // Create conflicting change on main
        fs::write(path.join("feature.txt"), "Conflicting content\n").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Conflict"])
            .current_dir(path)
            .output()
            .unwrap();

        let result = merge_branch(path, "story/3-4-feature", Some("3-4")).unwrap();

        assert!(!result.success);
        assert!(result.merge_commit.is_none());
        assert!(!result.conflicts.is_empty());
    }

    #[test]
    fn test_merge_branch_without_story_id() {
        let (dir, _main) = create_repo_with_feature_branch();

        let result = merge_branch(dir.path(), "story/3-4-feature", None).unwrap();

        assert!(result.success);
        assert!(result.merge_commit.is_some());
    }
}
