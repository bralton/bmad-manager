/**
 * Svelte stores for conflict detection state management.
 * Manages file conflicts between active stories.
 */

import { writable, derived, get } from 'svelte/store';
import type { ConflictWarning, StoryConflictSummary } from '$lib/types/conflict';
import { conflictApi } from '$lib/services/conflicts';
import { sprintStatus } from './stories';

/**
 * Active story statuses that should be checked for conflicts.
 */
const ACTIVE_STATUSES = ['ready-for-dev', 'in-progress', 'review'] as const;

/**
 * The current conflict warnings, or empty if not loaded.
 */
export const conflictWarnings = writable<ConflictWarning[]>([]);

/**
 * Whether a conflict detection operation is in progress.
 */
export const conflictsLoading = writable<boolean>(false);

/**
 * Error message from the last conflict detection, or null if successful.
 */
export const conflictsError = writable<string | null>(null);

/**
 * Derived store that groups conflicts by story ID.
 * Returns a Map where keys are story IDs and values are arrays of conflict warnings.
 */
export const conflictsByStory = derived(
  conflictWarnings,
  ($warnings): Map<string, ConflictWarning[]> => {
    const result = new Map<string, ConflictWarning[]>();

    for (const warning of $warnings) {
      const existing = result.get(warning.storyId);
      if (existing) {
        existing.push(warning);
      } else {
        result.set(warning.storyId, [warning]);
      }
    }

    return result;
  }
);

/**
 * Derived store that provides conflict summaries for each story.
 * Makes it easy to display conflict counts and details.
 */
export const conflictSummaries = derived(
  conflictsByStory,
  ($byStory): Map<string, StoryConflictSummary> => {
    const result = new Map<string, StoryConflictSummary>();

    for (const [storyId, conflicts] of $byStory) {
      result.set(storyId, {
        storyId,
        conflictCount: conflicts.length,
        conflicts,
      });
    }

    return result;
  }
);

/**
 * Checks if a story has any conflicts.
 * @param storyId - The story ID to check
 * @returns True if the story has conflicts
 */
export function hasConflicts(storyId: string): boolean {
  const summaries = get(conflictSummaries);
  return summaries.has(storyId);
}

/**
 * Gets conflict summary for a specific story.
 * @param storyId - The story ID to get summary for
 * @returns StoryConflictSummary or undefined if no conflicts
 */
export function getConflictSummary(storyId: string): StoryConflictSummary | undefined {
  const summaries = get(conflictSummaries);
  return summaries.get(storyId);
}

/**
 * Refreshes conflict detection for a given project path.
 * Automatically determines active stories from sprint status.
 * @param projectPath - Absolute path to the project directory
 */
export async function refreshConflicts(projectPath: string): Promise<void> {
  // Validate projectPath to avoid silent failures
  if (!projectPath || typeof projectPath !== 'string' || projectPath.trim() === '') {
    console.warn('refreshConflicts: Invalid projectPath provided');
    conflictWarnings.set([]);
    return;
  }

  const status = get(sprintStatus);

  // Get active story IDs from sprint status
  const activeStoryIds: string[] = [];
  if (status) {
    for (const story of status.stories) {
      if (ACTIVE_STATUSES.includes(story.status as (typeof ACTIVE_STATUSES)[number])) {
        // Extract short story ID from full ID (e.g., "4-3-conflict-detection" -> "4-3")
        const parts = story.id.split('-');
        if (parts.length >= 2) {
          activeStoryIds.push(`${parts[0]}-${parts[1]}`);
        }
      }
    }
  }

  // Skip if no active stories
  if (activeStoryIds.length === 0) {
    conflictWarnings.set([]);
    return;
  }

  conflictsLoading.set(true);
  conflictsError.set(null);

  try {
    const warnings = await conflictApi.getStoryConflicts(projectPath, activeStoryIds);
    conflictWarnings.set(warnings);
  } catch (error) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message);
    } else {
      message = 'Failed to detect conflicts';
    }
    conflictsError.set(message);
    console.error('Failed to refresh conflicts:', error);
  } finally {
    conflictsLoading.set(false);
  }
}

/**
 * Resets all conflict state to initial values.
 */
export function resetConflicts(): void {
  conflictWarnings.set([]);
  conflictsLoading.set(false);
  conflictsError.set(null);
}
