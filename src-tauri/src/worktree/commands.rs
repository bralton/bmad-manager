//! Tauri commands for worktree management.

use std::collections::HashSet;
use std::path::PathBuf;

use super::types::{CreateWorktreeOptions, Worktree, WorktreeError};
use super::git;
use crate::session_registry::{self, WorktreeBinding};

/// Creates a new worktree for a story.
///
/// The worktree is created at `../{project-name}-wt-{story-id}/`
/// with a new branch `story/{story-id}-{slug}`.
#[tauri::command]
pub async fn create_worktree(
    repo_path: String,
    options: CreateWorktreeOptions,
) -> Result<Worktree, WorktreeError> {
    let repo_path = PathBuf::from(&repo_path);

    // Compute worktree path: ../{project-name}-wt-{story-id}/
    let project_name = repo_path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| WorktreeError::InvalidPath(repo_path.display().to_string()))?;

    let worktree_dir_name = format!("{}-wt-{}", project_name, options.story_id);
    let worktree_path = repo_path
        .parent()
        .ok_or_else(|| WorktreeError::InvalidPath("Cannot determine parent directory".to_string()))?
        .join(&worktree_dir_name);

    // Compute branch name: story/{story-id}-{slug}
    let branch_name = compute_branch_name(&options.story_id, &options.story_slug);

    // Get base branch
    let base_branch = options.base_branch.as_deref();

    // Run git worktree add in blocking task
    let repo_path_clone = repo_path.clone();
    let worktree_path_clone = worktree_path.clone();
    let branch_name_clone = branch_name.clone();
    let base_branch_owned = base_branch.map(|s| s.to_string());

    let mut worktree = tokio::task::spawn_blocking(move || {
        git::create_worktree(
            &repo_path_clone,
            &worktree_path_clone,
            &branch_name_clone,
            base_branch_owned.as_deref(),
        )
    })
    .await
    .map_err(|e| WorktreeError::GitError(format!("Task join error: {}", e)))??;

    // Set the story_id on the worktree
    worktree.story_id = Some(options.story_id.clone());

    // Save binding to database
    let binding = WorktreeBinding {
        story_id: options.story_id,
        worktree_path: worktree_path.display().to_string(),
        branch_name: branch_name.clone(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    session_registry::save_worktree_binding(&binding)
        .map_err(|e| WorktreeError::DatabaseError(e.to_string()))?;

    Ok(worktree)
}

/// Lists all worktrees for a repository.
#[tauri::command]
pub async fn list_worktrees(repo_path: String) -> Result<Vec<Worktree>, WorktreeError> {
    let repo_path = PathBuf::from(&repo_path);

    // Get worktrees from git
    let mut worktrees = tokio::task::spawn_blocking(move || git::list_worktrees(&repo_path))
        .await
        .map_err(|e| WorktreeError::GitError(format!("Task join error: {}", e)))??;

    // Enrich with story_id from database bindings
    if let Ok(bindings) = session_registry::get_all_worktree_bindings() {
        for worktree in &mut worktrees {
            let path_str = worktree.path.display().to_string();
            if let Some(binding) = bindings.iter().find(|b| b.worktree_path == path_str) {
                worktree.story_id = Some(binding.story_id.clone());
            }
        }
    }

    Ok(worktrees)
}

/// Gets the worktree for a specific story, if one exists.
#[tauri::command]
pub async fn get_worktree_for_story(
    repo_path: String,
    story_id: String,
) -> Result<Option<Worktree>, WorktreeError> {
    let worktrees = list_worktrees(repo_path).await?;
    Ok(worktrees.into_iter().find(|w| w.story_id.as_ref() == Some(&story_id)))
}

/// Checks if a worktree has uncommitted changes.
#[tauri::command]
pub async fn is_worktree_dirty(worktree_path: String) -> Result<bool, WorktreeError> {
    let path = PathBuf::from(&worktree_path);

    tokio::task::spawn_blocking(move || git::is_worktree_dirty(&path))
        .await
        .map_err(|e| WorktreeError::GitError(format!("Task join error: {}", e)))?
}

/// Gets worktree binding from database by story ID.
#[tauri::command]
pub async fn get_worktree_binding(
    story_id: String,
) -> Result<Option<WorktreeBinding>, WorktreeError> {
    session_registry::get_worktree_binding(&story_id)
        .map_err(|e| WorktreeError::DatabaseError(e.to_string()))
}

/// Gets all worktree bindings from database.
#[tauri::command]
pub async fn get_all_worktree_bindings() -> Result<Vec<WorktreeBinding>, WorktreeError> {
    session_registry::get_all_worktree_bindings()
        .map_err(|e| WorktreeError::DatabaseError(e.to_string()))
}

/// Gets the story ID for the current worktree, if the project IS a worktree.
///
/// Returns None if the project is the main repository (not a worktree)
/// or if the branch doesn't follow the story/{id}-{slug} pattern.
#[tauri::command]
pub async fn get_current_worktree_story_id(
    project_path: String,
) -> Result<Option<String>, WorktreeError> {
    let project_path = PathBuf::from(&project_path);

    // Run in blocking task since it involves filesystem and git operations
    tokio::task::spawn_blocking(move || {
        // Check if this is a worktree
        if !git::is_worktree(&project_path) {
            return Ok(None);
        }

        // Get the current branch
        let branch = git::get_current_branch(&project_path)?;

        // Extract story ID from branch name
        Ok(branch.and_then(|b| git::extract_story_id_from_branch(&b)))
    })
    .await
    .map_err(|e| WorktreeError::GitError(format!("Task join error: {}", e)))?
}

/// Validates worktree bindings against actual worktrees on disk.
///
/// Compares database bindings against actual worktrees from `git worktree list`.
/// Removes orphaned bindings where the worktree directory no longer exists.
/// Also runs `git worktree prune` to clean up Git metadata.
///
/// Returns the list of story IDs that were orphaned and cleaned up.
#[tauri::command]
pub async fn validate_worktree_bindings(
    repo_path: String,
) -> Result<Vec<String>, WorktreeError> {
    let repo_path_buf = PathBuf::from(&repo_path);

    // Get actual worktrees from git
    let actual_worktrees = list_worktrees(repo_path.clone()).await?;
    let actual_paths: HashSet<String> = actual_worktrees
        .iter()
        .map(|wt| wt.path.to_string_lossy().to_string())
        .collect();

    // Get bindings from database
    let bindings = session_registry::get_all_worktree_bindings()
        .map_err(|e| WorktreeError::DatabaseError(e.to_string()))?;

    let mut orphaned = Vec::new();

    for binding in bindings {
        if !actual_paths.contains(&binding.worktree_path) {
            orphaned.push(binding.story_id.clone());
            session_registry::remove_worktree_binding(&binding.story_id)
                .map_err(|e| WorktreeError::DatabaseError(e.to_string()))?;
        }
    }

    // Also prune git metadata for stale worktrees
    let repo_clone = repo_path_buf.clone();
    tokio::task::spawn_blocking(move || git::prune_worktrees(&repo_clone))
        .await
        .map_err(|e| WorktreeError::GitError(format!("Task join error: {}", e)))??;

    if !orphaned.is_empty() {
        eprintln!(
            "Cleaned up {} orphaned worktree bindings: {:?}",
            orphaned.len(),
            orphaned
        );
    }

    Ok(orphaned)
}

/// Cleans up a worktree by removing it and optionally deleting the branch.
///
/// This combines worktree removal with optional branch deletion and
/// removes the SQLite binding.
#[tauri::command]
pub async fn cleanup_worktree(
    repo_path: String,
    worktree_path: String,
    delete_branch: bool,
    force: bool,
) -> Result<(), WorktreeError> {
    let repo = PathBuf::from(&repo_path);
    let wt = PathBuf::from(&worktree_path);

    // Get branch name before removal if we need to delete it
    let branch_to_delete = if delete_branch {
        let worktrees = list_worktrees(repo_path.clone()).await?;
        worktrees
            .iter()
            .find(|w| w.path == wt)
            .map(|w| w.branch.clone())
    } else {
        None
    };

    // Remove worktree
    let repo_clone = repo.clone();
    let wt_clone = wt.clone();
    tokio::task::spawn_blocking(move || git::remove_worktree(&repo_clone, &wt_clone, force))
        .await
        .map_err(|e| WorktreeError::GitError(format!("Task join error: {}", e)))??;

    // Remove binding from SQLite
    if let Err(e) = session_registry::remove_worktree_binding_by_path(&worktree_path) {
        eprintln!("Warning: Failed to remove worktree binding: {}", e);
    }

    // Delete branch if requested
    if let Some(branch) = branch_to_delete {
        let repo_clone = repo.clone();
        tokio::task::spawn_blocking(move || git::delete_branch(&repo_clone, &branch, force))
            .await
            .map_err(|e| WorktreeError::GitError(format!("Branch delete failed: {}", e)))??;
    }

    Ok(())
}

/// Gets the list of dirty files in a worktree.
///
/// Returns a list of changed files in git status --porcelain format.
#[tauri::command]
pub async fn get_dirty_files(worktree_path: String) -> Result<Vec<String>, WorktreeError> {
    let wt = PathBuf::from(&worktree_path);
    tokio::task::spawn_blocking(move || git::get_dirty_files(&wt))
        .await
        .map_err(|e| WorktreeError::GitError(format!("Task join error: {}", e)))?
}

/// Computes the branch name for a worktree.
///
/// If story_id already ends with the slug, don't append the slug again
/// to avoid redundant names like "story/3-3-worktree-creation-worktree-creation".
pub fn compute_branch_name(story_id: &str, story_slug: &str) -> String {
    if story_id.ends_with(story_slug) {
        format!("story/{}", story_id)
    } else {
        format!("story/{}-{}", story_id, story_slug)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_branch_name_with_full_story_id() {
        // When story_id already contains the slug, don't duplicate it
        let branch = compute_branch_name("3-3-worktree-creation", "worktree-creation");
        assert_eq!(branch, "story/3-3-worktree-creation");
    }

    #[test]
    fn test_compute_branch_name_with_short_story_id() {
        // When story_id is just the number, append the slug
        let branch = compute_branch_name("3-3", "worktree-creation");
        assert_eq!(branch, "story/3-3-worktree-creation");
    }

    #[test]
    fn test_compute_branch_name_sub_story() {
        // Sub-story like 1-5-2
        let branch = compute_branch_name("1-5-2-terminate-lock", "terminate-lock");
        assert_eq!(branch, "story/1-5-2-terminate-lock");
    }

    #[test]
    fn test_compute_branch_name_different_slug() {
        // Story ID doesn't end with slug (edge case)
        let branch = compute_branch_name("3-3-old-name", "new-name");
        assert_eq!(branch, "story/3-3-old-name-new-name");
    }
}
