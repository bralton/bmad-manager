/**
 * Tauri IPC service for invoking backend commands.
 * Provides type-safe wrappers around Tauri invoke calls.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Project, ProjectState, InitOptions } from '$lib/types/project';
import type { GlobalSettings, DependencyStatus } from '$lib/types/settings';

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

  /**
   * Initializes a project with both Git and BMAD.
   * Emits 'init-progress' events during initialization.
   * @param path - Absolute path to the project directory
   * @param options - Initialization options
   */
  initializeProject: (path: string, options: InitOptions) =>
    invoke<Project>('initialize_project', { path, options }),

  /**
   * Initializes only Git in the specified directory.
   * Emits 'init-progress' events during initialization.
   * @param path - Absolute path to the project directory
   */
  initGitOnly: (path: string) =>
    invoke<Project>('init_git_only', { path }),

  /**
   * Initializes only BMAD in the specified directory.
   * Emits 'init-progress' events during initialization.
   * @param path - Absolute path to the project directory
   * @param options - Initialization options
   */
  initBmadOnly: (path: string, options: InitOptions) =>
    invoke<Project>('init_bmad_only', { path, options }),
};

/**
 * API for settings and wizard operations.
 */
export const settingsApi = {
  /**
   * Gets the current application settings.
   */
  getSettings: () => invoke<GlobalSettings>('get_settings'),

  /**
   * Saves application settings.
   * @param settings - Settings to save
   */
  saveSettings: (settings: GlobalSettings) =>
    invoke<void>('save_settings', { settings_data: settings }),

  /**
   * Checks if the first-run wizard has been completed.
   */
  isWizardCompleted: () => invoke<boolean>('is_wizard_completed'),

  /**
   * Checks all required external dependencies.
   */
  checkDependencies: () => invoke<DependencyStatus[]>('check_dependencies'),
};
