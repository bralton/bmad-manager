//! Types for worktree management.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// A Git worktree entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    /// Path to the worktree directory.
    pub path: PathBuf,
    /// Branch name checked out in the worktree.
    pub branch: String,
    /// HEAD commit hash.
    pub head: String,
    /// Associated story ID, if any.
    #[serde(default)]
    pub story_id: Option<String>,
    /// Whether the worktree is locked.
    #[serde(default)]
    pub locked: bool,
    /// Whether this is the main worktree (the original repository).
    #[serde(default)]
    pub is_main: bool,
}

/// Options for creating a new worktree.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorktreeOptions {
    /// Story ID (e.g., "3-3").
    pub story_id: String,
    /// Story slug for branch naming (e.g., "worktree-creation").
    pub story_slug: String,
    /// Base branch to create from (defaults to current branch).
    #[serde(default)]
    pub base_branch: Option<String>,
}

/// Errors that can occur during worktree operations.
#[derive(Debug, Error, Serialize)]
pub enum WorktreeError {
    #[error("Git command failed: {0}")]
    GitError(String),

    #[error("Worktree already exists at: {0}")]
    AlreadyExists(String),

    #[error("Branch already checked out in another worktree: {0}")]
    BranchInUse(String),

    /// Used by Story 3-6 (worktree cleanup) - not yet implemented
    #[allow(dead_code)]
    #[error("Worktree not found: {0}")]
    NotFound(String),

    /// Used by Story 3-6 (worktree cleanup) - not yet implemented
    #[allow(dead_code)]
    #[error("Worktree has uncommitted changes")]
    DirtyWorktree,

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("IO error: {0}")]
    IoError(String),
}

impl From<std::io::Error> for WorktreeError {
    fn from(err: std::io::Error) -> Self {
        WorktreeError::IoError(err.to_string())
    }
}
