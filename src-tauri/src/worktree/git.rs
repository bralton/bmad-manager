//! Git worktree operations.
//!
//! Provides functions for creating, listing, and managing Git worktrees.

use std::path::Path;
use std::process::{Command, Output};

use super::types::{Worktree, WorktreeError};

/// Runs a git command in the specified directory.
///
/// Cross-platform: uses cmd /C fallback on Windows.
#[cfg(target_os = "windows")]
pub fn run_git(args: &[&str], cwd: &Path) -> Result<Output, WorktreeError> {
    Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .or_else(|_| {
            Command::new("cmd")
                .args(["/C", "git"])
                .args(args)
                .current_dir(cwd)
                .output()
        })
        .map_err(|e| WorktreeError::GitError(format!("Failed to execute git: {}", e)))
}

#[cfg(not(target_os = "windows"))]
pub fn run_git(args: &[&str], cwd: &Path) -> Result<Output, WorktreeError> {
    Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| WorktreeError::GitError(format!("Failed to execute git: {}", e)))
}

/// Creates a new Git worktree at the specified path with a new branch.
///
/// # Arguments
/// * `repo_path` - Path to the main repository
/// * `worktree_path` - Path where the worktree should be created
/// * `branch_name` - Name for the new branch
/// * `base_branch` - Base branch to create from (if None, uses current HEAD)
///
/// # Errors
/// * `AlreadyExists` - If the worktree directory already exists
/// * `BranchInUse` - If the branch is already checked out in another worktree
/// * `GitError` - For other git command failures
pub fn create_worktree(
    repo_path: &Path,
    worktree_path: &Path,
    branch_name: &str,
    base_branch: Option<&str>,
) -> Result<Worktree, WorktreeError> {
    // Check if directory already exists
    if worktree_path.exists() {
        return Err(WorktreeError::AlreadyExists(
            worktree_path.display().to_string(),
        ));
    }

    // Build the git worktree add command
    // git worktree add -b <branch> <path> [<base-branch>]
    let worktree_path_str = worktree_path
        .to_str()
        .ok_or_else(|| WorktreeError::InvalidPath(worktree_path.display().to_string()))?;

    let mut args = vec!["worktree", "add", "-b", branch_name, worktree_path_str];

    if let Some(base) = base_branch {
        args.push(base);
    }

    let output = run_git(&args, repo_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Check for specific error conditions
        if stderr.contains("already exists") || stderr.contains("already checked out") {
            // Branch is already in use
            return Err(WorktreeError::BranchInUse(branch_name.to_string()));
        }

        return Err(WorktreeError::GitError(format!(
            "git worktree add failed: {}",
            stderr.trim()
        )));
    }

    // Get the HEAD of the new worktree
    let head_output = run_git(&["rev-parse", "HEAD"], worktree_path)?;
    let head = if head_output.status.success() {
        String::from_utf8_lossy(&head_output.stdout).trim().to_string()
    } else {
        "unknown".to_string()
    };

    Ok(Worktree {
        path: worktree_path.to_path_buf(),
        branch: branch_name.to_string(),
        head,
        story_id: None,
        locked: false,
        is_main: false,
    })
}

/// Lists all worktrees for a repository.
///
/// Parses the output of `git worktree list --porcelain`.
pub fn list_worktrees(repo_path: &Path) -> Result<Vec<Worktree>, WorktreeError> {
    let output = run_git(&["worktree", "list", "--porcelain"], repo_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(WorktreeError::GitError(format!(
            "git worktree list failed: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_worktree_list(&stdout)
}

/// Parses the porcelain output of `git worktree list`.
///
/// Format (each worktree separated by blank line):
/// ```text
/// worktree /path/to/worktree
/// HEAD <commit-hash>
/// branch refs/heads/<branch-name>
/// [locked [<reason>]]
///
/// worktree /another/worktree
/// ...
/// ```
fn parse_worktree_list(output: &str) -> Result<Vec<Worktree>, WorktreeError> {
    let mut worktrees = Vec::new();
    let mut current_path: Option<String> = None;
    let mut current_head: Option<String> = None;
    let mut current_branch: Option<String> = None;
    let mut current_locked = false;
    let mut is_first = true;

    for line in output.lines() {
        if line.is_empty() {
            // End of a worktree entry - save if we have data
            if let (Some(path), Some(head)) = (current_path.take(), current_head.take()) {
                let branch = current_branch.take().unwrap_or_else(|| "detached".to_string());
                worktrees.push(Worktree {
                    path: path.into(),
                    branch,
                    head,
                    story_id: None,
                    locked: current_locked,
                    is_main: is_first,
                });
                is_first = false;
            }
            current_locked = false;
        } else if let Some(path) = line.strip_prefix("worktree ") {
            current_path = Some(path.to_string());
        } else if let Some(head) = line.strip_prefix("HEAD ") {
            current_head = Some(head.to_string());
        } else if let Some(branch_ref) = line.strip_prefix("branch ") {
            // Extract branch name from refs/heads/<branch>
            let branch = branch_ref
                .strip_prefix("refs/heads/")
                .unwrap_or(branch_ref)
                .to_string();
            current_branch = Some(branch);
        } else if line.starts_with("locked") {
            current_locked = true;
        }
        // Ignore "bare" and other lines
    }

    // Don't forget the last entry (no trailing blank line)
    if let (Some(path), Some(head)) = (current_path, current_head) {
        let branch = current_branch.unwrap_or_else(|| "detached".to_string());
        worktrees.push(Worktree {
            path: path.into(),
            branch,
            head,
            story_id: None,
            locked: current_locked,
            is_main: is_first,
        });
    }

    Ok(worktrees)
}

/// Checks if a worktree has uncommitted changes.
///
/// Returns true if the worktree has staged or unstaged changes.
pub fn is_worktree_dirty(worktree_path: &Path) -> Result<bool, WorktreeError> {
    // git status --porcelain returns empty output if clean
    let output = run_git(&["status", "--porcelain"], worktree_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(WorktreeError::GitError(format!(
            "git status failed: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(!stdout.trim().is_empty())
}

/// Gets the default branch for a repository.
///
/// Tries to detect the default branch (main, master, etc.) by checking
/// the symbolic-ref of origin/HEAD or falling back to common names.
///
/// Reserved for future use when implementing worktree cleanup (Story 3-6).
#[allow(dead_code)]
pub fn get_default_branch(repo_path: &Path) -> Result<String, WorktreeError> {
    // Try to get the default branch from origin/HEAD
    let output = run_git(&["symbolic-ref", "refs/remotes/origin/HEAD"], repo_path)?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(branch) = stdout.trim().strip_prefix("refs/remotes/origin/") {
            return Ok(branch.to_string());
        }
    }

    // Fall back to checking for common branch names
    for branch in ["main", "master", "develop"] {
        let output = run_git(&["rev-parse", "--verify", branch], repo_path)?;
        if output.status.success() {
            return Ok(branch.to_string());
        }
    }

    // Last resort: use current branch
    let output = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], repo_path)?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Ok(stdout.trim().to_string());
    }

    Err(WorktreeError::GitError(
        "Could not determine default branch".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
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
        fs::write(path.join("README.md"), "# Test").unwrap();
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

    #[test]
    fn test_run_git_basic() {
        let dir = create_test_repo();
        let output = run_git(&["status"], dir.path()).unwrap();
        assert!(output.status.success());
    }

    #[test]
    fn test_list_worktrees_main_only() {
        let dir = create_test_repo();
        let worktrees = list_worktrees(dir.path()).unwrap();

        assert_eq!(worktrees.len(), 1);
        assert!(worktrees[0].is_main);
        assert!(!worktrees[0].locked);
    }

    #[test]
    fn test_create_worktree() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("test-worktree");

        let result = create_worktree(
            dir.path(),
            &worktree_path,
            "feature/test-branch",
            None,
        );

        assert!(result.is_ok());
        let wt = result.unwrap();
        assert_eq!(wt.branch, "feature/test-branch");
        assert!(!wt.is_main);
        assert!(worktree_path.exists());

        // Clean up
        Command::new("git")
            .args(["worktree", "remove", worktree_path.to_str().unwrap()])
            .current_dir(dir.path())
            .output()
            .unwrap();
    }

    #[test]
    fn test_create_worktree_directory_exists() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("existing-dir");
        fs::create_dir(&worktree_path).unwrap();

        let result = create_worktree(
            dir.path(),
            &worktree_path,
            "feature/test",
            None,
        );

        assert!(matches!(result, Err(WorktreeError::AlreadyExists(_))));

        // Clean up
        fs::remove_dir(&worktree_path).unwrap();
    }

    #[test]
    fn test_list_worktrees_with_additional() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("test-wt-list");

        // Create a worktree
        create_worktree(
            dir.path(),
            &worktree_path,
            "feature/list-test",
            None,
        )
        .unwrap();

        let worktrees = list_worktrees(dir.path()).unwrap();
        assert_eq!(worktrees.len(), 2);

        // First should be main
        assert!(worktrees[0].is_main);

        // Second should be our new worktree
        assert!(!worktrees[1].is_main);
        assert_eq!(worktrees[1].branch, "feature/list-test");

        // Clean up
        Command::new("git")
            .args(["worktree", "remove", worktree_path.to_str().unwrap()])
            .current_dir(dir.path())
            .output()
            .unwrap();
    }

    #[test]
    fn test_is_worktree_dirty_clean() {
        let dir = create_test_repo();
        let dirty = is_worktree_dirty(dir.path()).unwrap();
        assert!(!dirty);
    }

    #[test]
    fn test_is_worktree_dirty_with_changes() {
        let dir = create_test_repo();

        // Create an untracked file
        fs::write(dir.path().join("new-file.txt"), "content").unwrap();

        let dirty = is_worktree_dirty(dir.path()).unwrap();
        assert!(dirty);
    }

    #[test]
    fn test_parse_worktree_list_single() {
        let output = "worktree /home/user/project\nHEAD abc123\nbranch refs/heads/main\n";
        let worktrees = parse_worktree_list(output).unwrap();

        assert_eq!(worktrees.len(), 1);
        assert_eq!(worktrees[0].path.to_string_lossy(), "/home/user/project");
        assert_eq!(worktrees[0].branch, "main");
        assert_eq!(worktrees[0].head, "abc123");
        assert!(worktrees[0].is_main);
    }

    #[test]
    fn test_parse_worktree_list_multiple() {
        let output = "worktree /home/user/project\nHEAD abc123\nbranch refs/heads/main\n\nworktree /home/user/project-wt\nHEAD def456\nbranch refs/heads/feature\n";
        let worktrees = parse_worktree_list(output).unwrap();

        assert_eq!(worktrees.len(), 2);
        assert!(worktrees[0].is_main);
        assert!(!worktrees[1].is_main);
        assert_eq!(worktrees[1].branch, "feature");
    }

    #[test]
    fn test_parse_worktree_list_locked() {
        let output = "worktree /home/user/project\nHEAD abc123\nbranch refs/heads/main\nlocked\n";
        let worktrees = parse_worktree_list(output).unwrap();

        assert_eq!(worktrees.len(), 1);
        assert!(worktrees[0].locked);
    }

    #[test]
    fn test_create_worktree_branch_in_use() {
        let dir = create_test_repo();
        let worktree1_path = dir.path().parent().unwrap().join("wt-branch-use-1");
        let worktree2_path = dir.path().parent().unwrap().join("wt-branch-use-2");

        // Create first worktree with a branch
        create_worktree(
            dir.path(),
            &worktree1_path,
            "feature/shared-branch",
            None,
        )
        .unwrap();

        // Try to create second worktree with same branch name
        let result = create_worktree(
            dir.path(),
            &worktree2_path,
            "feature/shared-branch",
            None,
        );

        assert!(matches!(result, Err(WorktreeError::BranchInUse(_))));

        // Clean up
        Command::new("git")
            .args(["worktree", "remove", worktree1_path.to_str().unwrap()])
            .current_dir(dir.path())
            .output()
            .unwrap();
    }
}
