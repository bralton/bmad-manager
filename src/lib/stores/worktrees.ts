/**
 * Svelte stores for worktree state management.
 * Manages worktree data and provides derived stores for story-worktree mapping.
 */

import { writable, derived } from 'svelte/store';
import type { Worktree } from '$lib/types/worktree';
import { worktreeApi } from '$lib/services/worktrees';

/**
 * List of all worktrees for the current project.
 */
export const worktrees = writable<Worktree[]>([]);

/**
 * If the current project IS a worktree, this contains the story ID.
 * Used to highlight the current story in the story board.
 * Null if this is the main repository (not a worktree).
 */
export const currentWorktreeStoryId = writable<string | null>(null);

/**
 * Whether a worktree loading operation is in progress.
 */
export const worktreesLoading = writable<boolean>(false);

/**
 * Error message from the last worktree operation, or null if successful.
 */
export const worktreesError = writable<string | null>(null);

/**
 * Whether a worktree creation is in progress.
 * Maps story ID to loading state.
 */
export const worktreeCreating = writable<Map<string, boolean>>(new Map());

/**
 * Derived store that maps story IDs to their worktrees.
 * Returns a Map where keys are story IDs and values are Worktree objects.
 */
export const worktreesByStory = derived(worktrees, ($worktrees): Map<string, Worktree> => {
  const result = new Map<string, Worktree>();

  // Defensive check for test environments where store might not be initialized
  if (!$worktrees || !Array.isArray($worktrees)) {
    return result;
  }

  for (const worktree of $worktrees) {
    if (worktree.storyId) {
      result.set(worktree.storyId, worktree);
    }
  }

  return result;
});

/**
 * Refreshes the worktrees list for a given project path.
 * @param projectPath - Absolute path to the project directory
 */
export async function refreshWorktrees(projectPath: string): Promise<void> {
  worktreesLoading.set(true);
  worktreesError.set(null);

  try {
    const wtList = await worktreeApi.listWorktrees(projectPath);
    worktrees.set(wtList);
  } catch (error) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message);
    } else {
      message = 'Failed to load worktrees';
    }
    worktreesError.set(message);
    console.error('Failed to refresh worktrees:', error);
  } finally {
    worktreesLoading.set(false);
  }
}

/**
 * Validates worktree bindings and refreshes the worktrees list.
 *
 * This should be called on project initialization to clean up orphaned
 * bindings (where the worktree directory no longer exists).
 *
 * @param projectPath - Absolute path to the project directory
 */
export async function validateAndRefreshWorktrees(projectPath: string): Promise<void> {
  worktreesLoading.set(true);
  worktreesError.set(null);

  try {
    // First, validate and clean up orphaned bindings
    const orphaned = await worktreeApi.validateWorktreeBindings(projectPath);
    if (orphaned.length > 0) {
      console.log(`Cleaned up ${orphaned.length} orphaned worktree bindings:`, orphaned);
    }

    // Then refresh the worktrees list
    const wtList = await worktreeApi.listWorktrees(projectPath);
    worktrees.set(wtList);

    // Check if the current project IS a worktree and get its story ID
    const storyId = await worktreeApi.getCurrentWorktreeStoryId(projectPath);
    currentWorktreeStoryId.set(storyId);
  } catch (error) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message);
    } else {
      message = 'Failed to load worktrees';
    }
    worktreesError.set(message);
    console.error('Failed to refresh worktrees:', error);
  } finally {
    worktreesLoading.set(false);
  }
}

/**
 * Sets the creating state for a specific story ID.
 * @param storyId - The story ID
 * @param creating - Whether creation is in progress
 */
export function setWorktreeCreating(storyId: string, creating: boolean): void {
  worktreeCreating.update((map) => {
    const newMap = new Map(map);
    if (creating) {
      newMap.set(storyId, true);
    } else {
      newMap.delete(storyId);
    }
    return newMap;
  });
}

/**
 * Resets all worktree state to initial values.
 */
export function resetWorktrees(): void {
  worktrees.set([]);
  worktreesLoading.set(false);
  worktreesError.set(null);
  worktreeCreating.set(new Map());
  currentWorktreeStoryId.set(null);
}
