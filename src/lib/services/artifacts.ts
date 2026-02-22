/**
 * Service for artifact browser operations.
 * Provides API wrappers for artifact listing and viewing.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ArtifactGroups, ArtifactInfo } from '$lib/types/artifact';

/**
 * API for artifact browser operations.
 */
export const artifactBrowserApi = {
  /**
   * Lists all project artifacts organized by category.
   * @param projectPath - Absolute path to the project directory
   * @returns Artifact groups organized by category
   */
  listProjectArtifacts: (projectPath: string) =>
    invoke<ArtifactGroups>('list_project_artifacts', { projectPath }),

  /**
   * Gets a specific story artifact by its ID.
   * @param projectPath - Absolute path to the project directory
   * @param storyId - Story ID (e.g., "1-1", "2-3")
   * @returns Story artifact info or null if not found
   */
  getStoryArtifact: (projectPath: string, storyId: string) =>
    invoke<ArtifactInfo | null>('get_story_artifact', { projectPath, storyId }),

  /**
   * Gets a specific epic artifact by its ID.
   * @param projectPath - Absolute path to the project directory
   * @param epicId - Epic ID (e.g., "1", "2.5")
   * @returns Epic artifact info or null if not found
   */
  getEpicArtifact: (projectPath: string, epicId: string) =>
    invoke<ArtifactInfo | null>('get_epic_artifact', { projectPath, epicId }),

  /**
   * Reads the content of an artifact file.
   * @param filePath - Absolute path to the artifact file
   * @returns File content as string
   */
  readArtifactFile: (filePath: string) =>
    invoke<string>('read_artifact_file', { filePath }),

  /**
   * Opens an artifact file in the user's configured IDE.
   * @param filePath - Absolute path to the artifact file
   */
  openInIde: (filePath: string) =>
    invoke<void>('open_in_ide', { filePath }),
};

export default artifactBrowserApi;
