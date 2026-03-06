/**
 * Story API service for sprint status operations.
 * Provides type-safe wrappers around Tauri invoke calls.
 */

import { invoke } from '@tauri-apps/api/core';
import type { SprintStatus, StoryContent } from '$lib/types/stories';
import type { StoryProgress } from '$lib/types/workflow';

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

  /**
   * Gets epic titles from a project's epic files.
   * Parses YAML frontmatter from epic-*.md files (excluding retrospectives).
   * @param projectPath - Absolute path to the project directory
   * @returns Record mapping epic ID to title (e.g., "1" -> "Foundation")
   */
  getEpicTitles: (projectPath: string) =>
    invoke<Record<string, string>>('get_epic_titles', { projectPath }),

  /**
   * Gets story tasks from a story file.
   * Parses markdown task checkboxes to show task progress on kanban cards.
   * @param storyPath - Absolute path to the story markdown file
   * @returns Story tasks with progress info, or null if no tasks found
   */
  getStoryTasks: (storyPath: string) =>
    invoke<StoryProgress | null>('get_story_tasks', { storyPath }),

  /**
   * Gets story content sections from a story file.
   * Parses markdown into structured sections (Story, ACs, Tasks, Dev Notes).
   * @param storyPath - Absolute path to the story markdown file
   * @returns StoryContent with parsed sections
   */
  getStoryContent: (storyPath: string) =>
    invoke<StoryContent>('get_story_content', { storyPath }),
};
