/**
 * Story API service for sprint status operations.
 * Provides type-safe wrappers around Tauri invoke calls.
 */

import { invoke } from '@tauri-apps/api/core';
import type { SprintStatus } from '$lib/types/stories';

/**
 * API for story and sprint status operations.
 */
export const storyApi = {
  /**
   * Gets the sprint status for a project.
   * Returns epics and stories with their statuses from sprint-status.yaml.
   * @param projectPath - Absolute path to the project directory
   * @returns SprintStatus containing epics and stories
   */
  getSprintStatus: (projectPath: string) =>
    invoke<SprintStatus>('get_sprint_status', { projectPath }),
};
