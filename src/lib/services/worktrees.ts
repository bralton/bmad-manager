/**
 * Worktree API service for Git worktree operations.
 * Provides type-safe wrappers around Tauri invoke calls.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Worktree,
  WorktreeBinding,
  CreateWorktreeOptions,
} from '$lib/types/worktree';

/**
 * Parses a worktree error into a user-friendly message.
 * Centralizes error handling to avoid duplication across components.
 *
 * @param error - The error from a worktree operation (string, Error, or unknown)
 * @returns A user-friendly error message
 */
export function parseWorktreeError(error: unknown): string {
  if (typeof error === 'string') {
    // Handle Rust enum serialization format: "BranchInUse(\"branch-name\")"
    if (error.includes('BranchInUse')) {
      return 'Branch in use by another worktree';
    }
    if (error.includes('AlreadyExists')) {
      const pathMatch = error.match(/AlreadyExists\("([^"]+)"\)/);
      return pathMatch
        ? `Directory already exists at ${pathMatch[1]}`
        : 'Directory already exists';
    }
    if (error.includes('InvalidPath')) {
      return 'Invalid path specified';
    }
    if (error.includes('DatabaseError')) {
      return 'Failed to save worktree binding';
    }
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return 'Failed to create worktree';
}

/**
 * API for worktree operations.
 */
export const worktreeApi = {
  /**
   * Creates a new worktree for a story.
   * The worktree is created at ../{project-name}-wt-{story-id}/
   * with a new branch story/{story-id}-{slug}.
   *
   * @param repoPath - Absolute path to the repository
   * @param options - Creation options including storyId and storySlug
   * @returns The created Worktree
   * @throws WorktreeError on failure (AlreadyExists, BranchInUse, etc.)
   */
  createWorktree: (repoPath: string, options: CreateWorktreeOptions) =>
    invoke<Worktree>('create_worktree', { repoPath, options }),

  /**
   * Lists all worktrees for a repository.
   * Enriches worktrees with story IDs from database bindings.
   *
   * @param repoPath - Absolute path to the repository
   * @returns Array of Worktree entries
   */
  listWorktrees: (repoPath: string) =>
    invoke<Worktree[]>('list_worktrees', { repoPath }),

  /**
   * Gets the worktree for a specific story, if one exists.
   *
   * @param repoPath - Absolute path to the repository
   * @param storyId - The story ID to look up
   * @returns The Worktree if found, null otherwise
   */
  getWorktreeForStory: (repoPath: string, storyId: string) =>
    invoke<Worktree | null>('get_worktree_for_story', { repoPath, storyId }),

  /**
   * Checks if a worktree has uncommitted changes.
   *
   * @param worktreePath - Absolute path to the worktree
   * @returns true if the worktree has uncommitted changes
   */
  isWorktreeDirty: (worktreePath: string) =>
    invoke<boolean>('is_worktree_dirty', { worktreePath }),

  /**
   * Gets a worktree binding from the database by story ID.
   *
   * @param storyId - The story ID to look up
   * @returns The WorktreeBinding if found, null otherwise
   */
  getWorktreeBinding: (storyId: string) =>
    invoke<WorktreeBinding | null>('get_worktree_binding', { storyId }),

  /**
   * Gets all worktree bindings from the database.
   *
   * @returns Array of all WorktreeBinding entries
   */
  getAllWorktreeBindings: () => invoke<WorktreeBinding[]>('get_all_worktree_bindings'),

  /**
   * Validates worktree bindings against actual worktrees on disk.
   *
   * Compares database bindings against actual worktrees and removes
   * orphaned bindings. Also runs `git worktree prune` to clean up
   * Git metadata for stale worktrees.
   *
   * @param repoPath - Absolute path to the repository
   * @returns Array of story IDs that were orphaned and cleaned up
   */
  validateWorktreeBindings: (repoPath: string) =>
    invoke<string[]>('validate_worktree_bindings', { repoPath }),

  /**
   * Gets the story ID for the current worktree, if the project IS a worktree.
   *
   * Returns null if the project is the main repository (not a worktree)
   * or if the branch doesn't follow the story/{id}-{slug} pattern.
   *
   * @param projectPath - Absolute path to the project directory
   * @returns Story ID (e.g., "3-4") if this is a worktree, null otherwise
   */
  getCurrentWorktreeStoryId: (projectPath: string) =>
    invoke<string | null>('get_current_worktree_story_id', { projectPath }),
};
