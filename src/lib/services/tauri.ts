/**
 * Tauri IPC service for invoking backend commands.
 * Provides type-safe wrappers around Tauri invoke calls.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Project, ProjectState } from '$lib/types/project';

/**
 * API for project-related operations.
 */
export const api = {
  /**
   * Opens a project directory and returns its state and configuration.
   * @param path - Absolute path to the project directory
   */
  openProject: (path: string) => invoke<Project>('open_project', { path }),

  /**
   * Gets only the initialization state of a project directory.
   * @param path - Absolute path to the project directory
   */
  getProjectState: (path: string) =>
    invoke<ProjectState>('get_project_state', { path }),

  /**
   * Refreshes project information by re-reading the directory.
   * @param path - Absolute path to the project directory
   */
  refreshProject: (path: string) => invoke<Project>('refresh_project', { path }),
};
