/**
 * Svelte stores for workflow state management.
 * These persist across component mounts and provide reactive state.
 */

import { writable, get } from 'svelte/store';
import type { WorkflowState } from '$lib/types/workflow';
import { artifactApi } from '$lib/services/tauri';

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
