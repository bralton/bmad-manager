//! Git worktree management module.
//!
//! Provides functionality to create, list, and manage Git worktrees
//! for story-based development workflows.
//!
//! # Usage
//!
//! Tauri commands are registered via `worktree::commands::*` in lib.rs.
//! Types are available via `worktree::types::*`.

pub mod commands;
mod git;
pub mod types;
