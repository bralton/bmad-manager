/**
 * Svelte stores for story board state management.
 * Manages sprint status data and provides derived stores for kanban display.
 */

import { writable, derived, get } from 'svelte/store';
import type { SprintStatus, Story, StoryStatus } from '$lib/types/stories';
import { storyApi } from '$lib/services/stories';

/**
 * The current sprint status, or null if not loaded.
 */
export const sprintStatus = writable<SprintStatus | null>(null);

/**
 * Epic titles map from epic ID to title.
 * E.g., "1" -> "Foundation", "2.5" -> "Prep Sprint"
 */
export const epicTitles = writable<Map<string, string>>(new Map());

/**
 * Whether a sprint status loading operation is in progress.
 */
export const sprintStatusLoading = writable<boolean>(false);

/**
 * Error message from the last sprint status operation, or null if successful.
 */
export const sprintStatusError = writable<string | null>(null);

/**
 * Currently selected story ID for the detail panel, or null if none selected.
 */
export const selectedStoryId = writable<string | null>(null);

/**
 * Sets the currently selected story ID.
 * @param storyId - The story ID to select, or null to clear selection
 */
export function setSelectedStoryId(storyId: string | null): void {
  selectedStoryId.set(storyId);
}

/**
 * Derived store that groups stories by their status for kanban columns.
 * Returns a Map where keys are StoryStatus and values are arrays of stories.
 */
export const storiesByStatus = derived(sprintStatus, ($status): Map<StoryStatus, Story[]> => {
  const result = new Map<StoryStatus, Story[]>();

  // Initialize all status buckets
  const statuses: StoryStatus[] = ['backlog', 'ready-for-dev', 'in-progress', 'review', 'done'];
  for (const status of statuses) {
    result.set(status, []);
  }

  if (!$status) {
    return result;
  }

  // Group stories by status
  for (const story of $status.stories) {
    const bucket = result.get(story.status);
    if (bucket) {
      bucket.push(story);
    }
  }

  return result;
});

/**
 * Derived store that groups stories by their epic ID.
 * Returns a Map where keys are epic IDs and values are arrays of stories.
 */
export const storiesByEpic = derived(sprintStatus, ($status): Map<string, Story[]> => {
  const result = new Map<string, Story[]>();

  if (!$status) {
    return result;
  }

  // Group stories by epic ID
  for (const story of $status.stories) {
    const existing = result.get(story.epicId);
    if (existing) {
      existing.push(story);
    } else {
      result.set(story.epicId, [story]);
    }
  }

  return result;
});

/**
 * Refreshes the sprint status for a given project path.
 * @param projectPath - Absolute path to the project directory
 */
export async function refreshSprintStatus(projectPath: string): Promise<void> {
  sprintStatusLoading.set(true);
  sprintStatusError.set(null);

  try {
    const status = await storyApi.getSprintStatus(projectPath);
    sprintStatus.set(status);
  } catch (error) {
    // Handle various error types from Tauri invoke
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message);
    } else {
      message = 'Failed to load sprint status';
    }
    sprintStatusError.set(message);
    console.error('Failed to refresh sprint status:', error);
  } finally {
    sprintStatusLoading.set(false);
  }
}

/**
 * Resets all sprint status state to initial values.
 */
export function resetSprintStatus(): void {
  sprintStatus.set(null);
  sprintStatusLoading.set(false);
  sprintStatusError.set(null);
  selectedStoryId.set(null);
  epicTitles.set(new Map());
}

/**
 * Refreshes epic titles from a project's epic files.
 * @param projectPath - Absolute path to the project directory
 */
export async function refreshEpicTitles(projectPath: string): Promise<void> {
  try {
    const titles = await storyApi.getEpicTitles(projectPath);
    epicTitles.set(new Map(Object.entries(titles)));
  } catch (error) {
    console.error('Failed to load epic titles:', error);
    // Don't throw - epic titles are optional enhancement
  }
}
