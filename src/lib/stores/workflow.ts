/**
 * Svelte stores for workflow state management.
 * These persist across component mounts and provide reactive state.
 */

import { writable, derived, get } from 'svelte/store';
import type {
  WorkflowState,
  WorkflowViewMode,
  EpicProgress,
  SprintProgress,
} from '$lib/types/workflow';
import { artifactApi } from '$lib/services/tauri';
import { sprintStatus, epicTitles } from '$lib/stores/stories';

/**
 * The current workflow state, or null if not loaded.
 */
export const workflowState = writable<WorkflowState | null>(null);

/**
 * Whether a workflow state loading operation is in progress.
 */
export const workflowLoading = writable<boolean>(false);

/**
 * Error message from the last workflow operation, or null if successful.
 */
export const workflowError = writable<string | null>(null);

/**
 * Refreshes the workflow state for a given project path.
 * @param projectPath - Absolute path to the project directory
 */
export async function refreshWorkflowState(projectPath: string): Promise<void> {
  workflowLoading.set(true);
  workflowError.set(null);

  try {
    const state = await artifactApi.getWorkflowState(projectPath);
    workflowState.set(state);
  } catch (error) {
    // Tauri invoke errors can be strings, objects, or Error instances
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as { message: unknown }).message);
    } else {
      message = 'Failed to load workflow state';
    }
    workflowError.set(message);
    console.error('Failed to refresh workflow state:', error);
  } finally {
    workflowLoading.set(false);
  }
}

/**
 * Resets all workflow state to initial values.
 */
export function resetWorkflowState(): void {
  workflowState.set(null);
  workflowLoading.set(false);
  workflowError.set(null);
}

// =====================================================================
// Workflow Dashboard Stores (Story 4-8: Multi-Workflow Visualization)
// =====================================================================

const STORAGE_KEY = 'workflow-dashboard-view-mode';

/**
 * Loads the persisted view mode from localStorage.
 */
function loadPersistedViewMode(): WorkflowViewMode {
  if (typeof localStorage === 'undefined') {
    return 'phase';
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'phase' || stored === 'epic' || stored === 'sprint' || stored === 'story') {
    return stored;
  }
  return 'phase';
}

/**
 * The currently selected workflow dashboard view mode.
 * Persisted to localStorage.
 */
export const workflowViewMode = writable<WorkflowViewMode>(loadPersistedViewMode());

/**
 * Subscribes to workflowViewMode changes and persists to localStorage.
 */
workflowViewMode.subscribe((mode) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, mode);
  }
});

/**
 * Sets the workflow view mode and persists to localStorage.
 */
export function setWorkflowViewMode(mode: WorkflowViewMode): void {
  workflowViewMode.set(mode);
}

/**
 * Derived store for epic progress.
 * Combines sprintStatus and epicTitles to compute progress for each epic.
 */
export const epicProgress = derived(
  [sprintStatus, epicTitles],
  ([$status, $titles]): EpicProgress[] => {
    if (!$status) {
      return [];
    }

    return $status.epics.map((epic) => {
      // Get all stories for this epic
      const stories = $status.stories.filter((s) => s.epicId === epic.id);
      const doneCount = stories.filter((s) => s.status === 'done').length;
      const inProgressCount = stories.filter((s) => s.status === 'in-progress').length;
      const total = stories.length;
      const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      return {
        epicId: epic.id,
        title: $titles.get(epic.id) ?? `Epic ${epic.id}`,
        status: epic.status,
        stats: {
          total,
          done: doneCount,
          inProgress: inProgressCount,
          percentage,
        },
      };
    });
  }
);

/**
 * Derived store for sprint progress metrics.
 * Aggregates story counts by status from sprintStatus.
 */
export const sprintProgress = derived(sprintStatus, ($status): SprintProgress | null => {
  if (!$status) {
    return null;
  }

  const stories = $status.stories;
  const counts = {
    backlog: stories.filter((s) => s.status === 'backlog').length,
    ready: stories.filter((s) => s.status === 'ready-for-dev').length,
    inProgress: stories.filter((s) => s.status === 'in-progress').length,
    review: stories.filter((s) => s.status === 'review').length,
    done: stories.filter((s) => s.status === 'done').length,
  };

  const total = stories.length;
  const percentage = total > 0 ? Math.round((counts.done / total) * 100) : 0;

  return {
    counts,
    total,
    percentage,
  };
});
