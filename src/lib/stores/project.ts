/**
 * Svelte stores for global project state.
 * These persist across component mounts and provide reactive state.
 */

import { writable } from 'svelte/store';
import type { Project } from '$lib/types/project';

/**
 * The currently loaded project, or null if no project is open.
 */
export const currentProject = writable<Project | null>(null);

/**
 * Whether a project loading operation is in progress.
 */
export const projectLoading = writable<boolean>(false);

/**
 * Error message from the last project operation, or null if successful.
 */
export const projectError = writable<string | null>(null);

/**
 * Resets all project state to initial values.
 */
export function resetProjectState() {
  currentProject.set(null);
  projectLoading.set(false);
  projectError.set(null);
}
