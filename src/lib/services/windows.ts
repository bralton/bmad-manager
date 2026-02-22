/**
 * Window management service for multi-window support.
 * Provides functions to open projects in new windows.
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Opens a project in a new window.
 *
 * If a window already exists for this project, focuses it instead of creating a new one.
 *
 * @param projectPath - Absolute path to the project directory
 * @returns The window label of the opened/focused window
 */
export async function openProjectInNewWindow(projectPath: string): Promise<string> {
  return invoke<string>('open_project_window', { projectPath });
}

/**
 * Opens a worktree in a new window.
 *
 * This is a convenience alias for openProjectInNewWindow since worktrees
 * are independent projects from the multi-window perspective.
 *
 * @param worktreePath - Absolute path to the worktree directory
 * @returns The window label of the opened/focused window
 */
export async function openWorktreeInNewWindow(worktreePath: string): Promise<string> {
  return openProjectInNewWindow(worktreePath);
}
