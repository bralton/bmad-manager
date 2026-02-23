/**
 * Worktree API service for Git worktree operations.
 * Provides type-safe wrappers around Tauri invoke calls.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Worktree,
  WorktreeBinding,
  CreateWorktreeOptions,
  MergeResult,
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
    if (error.includes('DirtyWorktree')) {
      return 'Worktree has uncommitted changes. Use Force Remove to proceed.';
    }
    if (error.includes('NotFound')) {
      return 'Worktree not found. It may have been deleted manually.';
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

  /**
   * Gets the list of dirty (changed) files in a worktree.
   *
   * @param worktreePath - Absolute path to the worktree
   * @returns Array of file paths in git status --porcelain format
   */
  getDirtyFiles: (worktreePath: string) =>
    invoke<string[]>('get_dirty_files', { worktreePath }),

  /**
   * Cleans up a worktree by removing it and optionally deleting the branch.
   *
   * @param repoPath - Absolute path to the main repository
   * @param worktreePath - Absolute path to the worktree to remove
   * @param deleteBranch - Whether to also delete the branch
   * @param force - Whether to force removal even if worktree is dirty
   */
  cleanupWorktree: (
    repoPath: string,
    worktreePath: string,
    deleteBranch: boolean,
    force: boolean
  ) => invoke<void>('cleanup_worktree', { repoPath, worktreePath, deleteBranch, force }),
};

/**
 * API for merge operations.
 */
export const mergeApi = {
  /**
   * Gets the current branch name for the main repository.
   *
   * @param repoPath - Absolute path to the main repository
   * @returns The current branch name
   * @throws WorktreeError if repo is in detached HEAD state
   */
  getMainRepoBranch: (repoPath: string) =>
    invoke<string>('get_main_repo_branch', { repoPath }),

  /**
   * Checks if merging a worktree branch would result in conflicts.
   *
   * @param repoPath - Absolute path to the main repository
   * @param worktreeBranch - The branch to merge from
   * @returns Array of conflicting file paths (empty if no conflicts)
   */
  checkMergeConflicts: (repoPath: string, worktreeBranch: string) =>
    invoke<string[]>('check_worktree_merge_conflicts', { repoPath, worktreeBranch }),

  /**
   * Merges a worktree branch into the current branch of the main repository.
   *
   * @param repoPath - Absolute path to the main repository
   * @param worktreeBranch - The branch to merge from
   * @param storyId - Optional story ID to include in commit message
   * @returns The merge result
   */
  mergeWorktreeBranch: (repoPath: string, worktreeBranch: string, storyId?: string) =>
    invoke<MergeResult>('merge_worktree_branch', { repoPath, worktreeBranch, storyId }),

  /**
   * Cleans up after a successful merge.
   *
   * @param repoPath - Absolute path to the main repository
   * @param worktreePath - Absolute path to the worktree to remove
   * @param branchName - Name of the branch to delete
   */
  cleanupAfterMerge: (repoPath: string, worktreePath: string, branchName: string) =>
    invoke<void>('cleanup_after_merge', { repoPath, worktreePath, branchName }),
};

/**
 * Parses a merge error into a user-friendly message.
 *
 * @param error - The error from a merge operation
 * @returns A user-friendly error message
 */
export function parseMergeError(error: unknown): string {
  if (typeof error === 'string') {
    if (error.includes('uncommitted changes')) {
      return 'Target repository has uncommitted changes. Please commit or stash them first.';
    }
    if (error.includes('detached HEAD')) {
      return 'Target repository is in detached HEAD state. Please checkout a branch first.';
    }
    if (error.includes('Merge failed')) {
      return error;
    }
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return 'Merge operation failed';
}
