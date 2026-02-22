/**
 * Conflict detection API service.
 * Provides type-safe wrappers around Tauri invoke calls.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ConflictWarning } from '$lib/types/conflict';

/**
 * API for conflict detection operations.
 */
export const conflictApi = {
  /**
   * Gets conflict warnings for active stories in a project.
   * @param projectPath - Absolute path to the project directory
   * @param activeStoryIds - List of story IDs to check for conflicts
   * @returns Array of conflict warnings
   */
  getStoryConflicts: (projectPath: string, activeStoryIds: string[]) =>
    invoke<ConflictWarning[]>('get_story_conflicts', { projectPath, activeStoryIds }),
};
