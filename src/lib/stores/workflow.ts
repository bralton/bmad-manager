/**
 * Svelte stores for workflow state management.
 * These persist across component mounts and provide reactive state.
 */

import { writable, derived, get } from 'svelte/store';
import type {
  WorkflowState,
  WorkflowViewMode,
  DashboardViewMode,
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
// Workflow View Mode Store (Story 5-6: Epic Workflow View)
// =====================================================================

const WORKFLOW_VIEW_STORAGE_KEY = 'workflow-view-mode';

/**
 * Loads the persisted workflow view mode from localStorage.
 */
function loadPersistedWorkflowViewMode(): WorkflowViewMode {
  if (typeof localStorage === 'undefined') {
    return 'phase';
  }
  const stored = localStorage.getItem(WORKFLOW_VIEW_STORAGE_KEY);
  if (stored === 'phase' || stored === 'epic-workflow' || stored === 'story-workflow') {
    return stored;
  }
  return 'phase';
}

/**
 * The currently selected workflow view mode.
 * - 'phase': BMAD Phase view showing discovery/planning/solutioning/implementation
 * - 'epic-workflow': Epic Workflow view showing planning/implementation/retro per-epic
 * - 'story-workflow': Story Workflow view showing backlog/ready/dev/review/done per-story
 * Persisted to localStorage.
 */
export const workflowViewMode = writable<WorkflowViewMode>(loadPersistedWorkflowViewMode());

/**
 * Subscribes to workflowViewMode changes and persists to localStorage.
 */
workflowViewMode.subscribe((mode) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WORKFLOW_VIEW_STORAGE_KEY, mode);
  }
});

/**
 * Sets the workflow view mode and persists to localStorage.
 */
export function setWorkflowViewMode(mode: WorkflowViewMode): void {
  workflowViewMode.set(mode);
}

// =====================================================================
// Dashboard View Mode Store (Story 5-1: Tab Restructure)
// =====================================================================

const DASHBOARD_STORAGE_KEY = 'dashboard-view-mode';

/**
 * Loads the persisted dashboard view mode from localStorage.
 */
function loadPersistedDashboardViewMode(): DashboardViewMode {
  if (typeof localStorage === 'undefined') {
    return 'epic';
  }
  const stored = localStorage.getItem(DASHBOARD_STORAGE_KEY);
  if (stored === 'epic' || stored === 'sprint') {
    return stored;
  }
  return 'epic';
}

/**
 * The currently selected dashboard view mode.
 * Persisted to localStorage.
 */
export const dashboardViewMode = writable<DashboardViewMode>(loadPersistedDashboardViewMode());

/**
 * Subscribes to dashboardViewMode changes and persists to localStorage.
 */
dashboardViewMode.subscribe((mode) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DASHBOARD_STORAGE_KEY, mode);
  }
});

/**
 * Sets the dashboard view mode and persists to localStorage.
 */
export function setDashboardViewMode(mode: DashboardViewMode): void {
  dashboardViewMode.set(mode);
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
