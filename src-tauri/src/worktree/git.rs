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
        String::from_utf8_lossy(&head_output.stdout)
            .trim()
            .to_string()
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
                let branch = current_branch
                    .take()
                    .unwrap_or_else(|| "detached".to_string());
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

/// Checks if the given path is a worktree (vs main repo).
///
/// Worktrees have `.git` as a FILE containing a path reference,
/// while main repositories have `.git` as a DIRECTORY.
pub fn is_worktree(project_path: &Path) -> bool {
    let git_path = project_path.join(".git");
    git_path.is_file()
}

/// Gets the current branch name for a repository or worktree.
pub fn get_current_branch(project_path: &Path) -> Result<Option<String>, WorktreeError> {
    let output = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], project_path)?;

    if !output.status.success() {
        return Ok(None);
    }

    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if branch.is_empty() || branch == "HEAD" {
        // Detached HEAD state
        Ok(None)
    } else {
        Ok(Some(branch))
    }
}

/// Extracts story ID from a worktree branch name.
///
/// Branch pattern: `story/{epic}-{story}-{slug}` -> returns Some("{epic}-{story}")
/// Examples:
/// - "story/3-4-worktree-binding" -> Some("3-4")
/// - "story/1-5-2-terminal-fix" -> Some("1-5-2")
/// - "main" -> None
/// - "feature/something" -> None
pub fn extract_story_id_from_branch(branch: &str) -> Option<String> {
    let prefix = "story/";
    if !branch.starts_with(prefix) {
        return None;
    }

    let after_prefix = &branch[prefix.len()..];
    // Find the parts: could be "3-4-slug" or "1-5-2-slug"
    // We need to extract the numeric prefix (epic-story or epic-story-substory)
    let parts: Vec<&str> = after_prefix.split('-').collect();

    if parts.len() < 2 {
        return None;
    }

    // Check if we have a sub-story (3 numeric parts) or regular story (2 numeric parts)
    // Format: {epic}-{story}[-{substory}]-{slug...}
    let mut numeric_parts = Vec::new();
    for part in &parts {
        if part.chars().all(|c| c.is_ascii_digit()) {
            numeric_parts.push(*part);
        } else {
            break;
        }
    }

    if numeric_parts.len() >= 2 {
        Some(numeric_parts.join("-"))
    } else {
        None
    }
}

/// Gets the list of dirty files in a worktree.
///
/// Returns a list of changed files in the format from `git status --porcelain`.
/// Each line has a two-character status prefix followed by the file path.
pub fn get_dirty_files(worktree_path: &Path) -> Result<Vec<String>, WorktreeError> {
    let output = run_git(&["status", "--porcelain"], worktree_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(WorktreeError::GitError(format!(
            "git status failed: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let files: Vec<String> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect();

    Ok(files)
}

/// Removes a worktree from the repository.
///
/// # Arguments
/// * `repo_path` - Path to the main repository
/// * `worktree_path` - Path to the worktree to remove
/// * `force` - If true, removes even if the worktree has uncommitted changes
pub fn remove_worktree(
    repo_path: &Path,
    worktree_path: &Path,
    force: bool,
) -> Result<(), WorktreeError> {
    let worktree_path_str = worktree_path
        .to_str()
        .ok_or_else(|| WorktreeError::InvalidPath(worktree_path.display().to_string()))?;

    let args = if force {
        vec!["worktree", "remove", "--force", worktree_path_str]
    } else {
        vec!["worktree", "remove", worktree_path_str]
    };

    let output = run_git(&args, repo_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stderr_trimmed = stderr.trim();

        // Check for specific error conditions
        if stderr_trimmed.contains("contains modified or untracked files") {
            return Err(WorktreeError::DirtyWorktree);
        }

        return Err(WorktreeError::GitError(format!(
            "git worktree remove failed: {}",
            stderr_trimmed
        )));
    }

    Ok(())
}

/// Deletes a branch from the repository.
///
/// # Arguments
/// * `repo_path` - Path to the repository
/// * `branch_name` - Name of the branch to delete
/// * `force` - If true, uses -D (force delete), otherwise uses -d
pub fn delete_branch(
    repo_path: &Path,
    branch_name: &str,
    force: bool,
) -> Result<(), WorktreeError> {
    let delete_flag = if force { "-D" } else { "-d" };
    let output = run_git(&["branch", delete_flag, branch_name], repo_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stderr_trimmed = stderr.trim();

        // Branch not found is not necessarily an error
        if stderr_trimmed.contains("not found") {
            return Ok(());
        }

        return Err(WorktreeError::GitError(format!(
            "git branch delete failed: {}",
            stderr_trimmed
        )));
    }

    Ok(())
}

/// Prunes stale worktree metadata from the repository.
///
/// Runs `git worktree prune` to clean up administrative files for worktrees
/// that no longer exist on disk.
pub fn prune_worktrees(repo_path: &Path) -> Result<(), WorktreeError> {
    let output = run_git(&["worktree", "prune"], repo_path)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(WorktreeError::GitError(format!(
            "git worktree prune failed: {}",
            stderr.trim()
        )));
    }

    Ok(())
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

        let result = create_worktree(dir.path(), &worktree_path, "feature/test-branch", None);

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

        let result = create_worktree(dir.path(), &worktree_path, "feature/test", None);

        assert!(matches!(result, Err(WorktreeError::AlreadyExists(_))));

        // Clean up
        fs::remove_dir(&worktree_path).unwrap();
    }

    #[test]
    fn test_list_worktrees_with_additional() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("test-wt-list");

        // Create a worktree
        create_worktree(dir.path(), &worktree_path, "feature/list-test", None).unwrap();

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
        create_worktree(dir.path(), &worktree1_path, "feature/shared-branch", None).unwrap();

        // Try to create second worktree with same branch name
        let result = create_worktree(dir.path(), &worktree2_path, "feature/shared-branch", None);

        assert!(matches!(result, Err(WorktreeError::BranchInUse(_))));

        // Clean up
        Command::new("git")
            .args(["worktree", "remove", worktree1_path.to_str().unwrap()])
            .current_dir(dir.path())
            .output()
            .unwrap();
    }

    #[test]
    fn test_prune_worktrees() {
        let dir = create_test_repo();

        // Prune should succeed on a clean repo
        let result = prune_worktrees(dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_prune_worktrees_cleans_stale_entries() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("wt-to-prune");

        // Create a worktree
        create_worktree(dir.path(), &worktree_path, "feature/prune-test", None).unwrap();

        // Manually delete the worktree directory (simulating manual deletion)
        fs::remove_dir_all(&worktree_path).unwrap();

        // Git should still list the worktree entry
        let _worktrees_before = list_worktrees(dir.path()).unwrap();
        // Note: git may still list it or may not depending on implementation details

        // Prune should clean up the stale entry
        let result = prune_worktrees(dir.path());
        assert!(result.is_ok());

        // After prune, only main worktree should remain
        let worktrees_after = list_worktrees(dir.path()).unwrap();
        assert_eq!(worktrees_after.len(), 1);
        assert!(worktrees_after[0].is_main);
    }

    #[test]
    fn test_is_worktree_main_repo() {
        let dir = create_test_repo();
        // Main repo has .git as a directory
        assert!(!is_worktree(dir.path()));
    }

    #[test]
    fn test_is_worktree_actual_worktree() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("wt-is-worktree-test");

        create_worktree(dir.path(), &worktree_path, "story/3-4-test", None).unwrap();

        // Worktree has .git as a file
        assert!(is_worktree(&worktree_path));

        // Clean up
        Command::new("git")
            .args(["worktree", "remove", worktree_path.to_str().unwrap()])
            .current_dir(dir.path())
            .output()
            .unwrap();
    }

    #[test]
    fn test_get_current_branch_main_repo() {
        let dir = create_test_repo();
        let branch = get_current_branch(dir.path()).unwrap();
        // Initial branch could be "main" or "master" depending on git config
        assert!(branch.is_some());
    }

    #[test]
    fn test_get_current_branch_worktree() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("wt-branch-test");

        create_worktree(dir.path(), &worktree_path, "story/3-4-test-feature", None).unwrap();

        let branch = get_current_branch(&worktree_path).unwrap();
        assert_eq!(branch, Some("story/3-4-test-feature".to_string()));

        // Clean up
        Command::new("git")
            .args(["worktree", "remove", worktree_path.to_str().unwrap()])
            .current_dir(dir.path())
            .output()
            .unwrap();
    }

    #[test]
    fn test_extract_story_id_from_branch_valid() {
        assert_eq!(
            extract_story_id_from_branch("story/3-4-worktree-binding"),
            Some("3-4".to_string())
        );
    }

    #[test]
    fn test_extract_story_id_from_branch_substory() {
        assert_eq!(
            extract_story_id_from_branch("story/1-5-2-terminal-fix"),
            Some("1-5-2".to_string())
        );
    }

    #[test]
    fn test_extract_story_id_from_branch_not_story() {
        assert_eq!(extract_story_id_from_branch("main"), None);
        assert_eq!(extract_story_id_from_branch("feature/something"), None);
        assert_eq!(extract_story_id_from_branch("develop"), None);
    }

    #[test]
    fn test_extract_story_id_from_branch_invalid_format() {
        // No slug after story ID
        assert_eq!(extract_story_id_from_branch("story/"), None);
        // Only one numeric part
        assert_eq!(extract_story_id_from_branch("story/3-slug"), None);
    }

    #[test]
    fn test_extract_story_id_from_branch_complex_slug() {
        assert_eq!(
            extract_story_id_from_branch("story/3-4-my-complex-feature-name"),
            Some("3-4".to_string())
        );
    }

    #[test]
    fn test_get_dirty_files_clean() {
        let dir = create_test_repo();
        let files = get_dirty_files(dir.path()).unwrap();
        assert!(files.is_empty());
    }

    #[test]
    fn test_get_dirty_files_with_changes() {
        let dir = create_test_repo();

        // Create untracked file
        fs::write(dir.path().join("new-file.txt"), "content").unwrap();

        let files = get_dirty_files(dir.path()).unwrap();
        assert_eq!(files.len(), 1);
        assert!(files[0].contains("new-file.txt"));
    }

    #[test]
    fn test_get_dirty_files_modified() {
        let dir = create_test_repo();

        // Modify existing file
        fs::write(dir.path().join("README.md"), "# Modified").unwrap();

        let files = get_dirty_files(dir.path()).unwrap();
        assert_eq!(files.len(), 1);
        assert!(files[0].contains("README.md"));
    }

    #[test]
    fn test_remove_worktree() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("wt-remove-test");

        // Create a worktree
        create_worktree(dir.path(), &worktree_path, "feature/remove-test", None).unwrap();

        assert!(worktree_path.exists());

        // Remove it
        remove_worktree(dir.path(), &worktree_path, false).unwrap();

        assert!(!worktree_path.exists());
    }

    #[test]
    fn test_remove_worktree_dirty_requires_force() {
        let dir = create_test_repo();
        let worktree_path = dir.path().parent().unwrap().join("wt-dirty-remove");

        // Create a worktree
        create_worktree(dir.path(), &worktree_path, "feature/dirty-remove", None).unwrap();

        // Make it dirty
        fs::write(worktree_path.join("dirty-file.txt"), "dirty content").unwrap();

        // Remove without force should fail
        let result = remove_worktree(dir.path(), &worktree_path, false);
        assert!(matches!(result, Err(WorktreeError::DirtyWorktree)));

        // Remove with force should succeed
        let result = remove_worktree(dir.path(), &worktree_path, true);
        assert!(result.is_ok());
        assert!(!worktree_path.exists());
    }

    #[test]
    fn test_delete_branch() {
        let dir = create_test_repo();

        // Create a branch
        Command::new("git")
            .args(["branch", "feature/to-delete"])
            .current_dir(dir.path())
            .output()
            .unwrap();

        // Delete it (not force, since it's merged with HEAD)
        let result = delete_branch(dir.path(), "feature/to-delete", false);
        assert!(result.is_ok());

        // Verify it's gone
        let output = Command::new("git")
            .args(["branch", "--list", "feature/to-delete"])
            .current_dir(dir.path())
            .output()
            .unwrap();
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(stdout.trim().is_empty());
    }

    #[test]
    fn test_delete_branch_not_found() {
        let dir = create_test_repo();

        // Deleting non-existent branch should succeed (no-op)
        let result = delete_branch(dir.path(), "nonexistent-branch", false);
        assert!(result.is_ok());
    }
}
