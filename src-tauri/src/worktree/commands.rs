//! Tauri commands for worktree management.

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
