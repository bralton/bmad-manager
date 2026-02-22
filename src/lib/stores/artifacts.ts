/**
 * Svelte stores for artifact browser state management.
 */

import { writable, derived, get } from 'svelte/store';
import type {
  ArtifactGroups,
  ArtifactInfo,
  ArtifactCategory,
} from '$lib/types/artifact';
import { getArtifactsByCategory, ARTIFACT_CATEGORIES } from '$lib/types/artifact';
import { artifactBrowserApi } from '$lib/services/artifacts';
import { currentProject } from '$lib/stores/project';

/**
 * Raw artifact groups loaded from backend.
 */
export const artifactGroups = writable<ArtifactGroups | null>(null);

/**
 * Loading state for artifact list.
 */
export const artifactsLoading = writable<boolean>(false);

/**
 * Error message if artifact loading fails.
 */
export const artifactsError = writable<string | null>(null);

/**
 * Currently selected artifact for viewing.
 */
export const selectedArtifact = writable<ArtifactInfo | null>(null);

/**
 * Content of the currently selected artifact.
 */
export const selectedArtifactContent = writable<string | null>(null);

/**
 * Loading state for artifact content.
 */
export const artifactContentLoading = writable<boolean>(false);

/**
 * Whether the artifact viewer panel is open.
 */
export const artifactViewerOpen = writable<boolean>(false);

/**
 * Collapsed state for each category (persisted in localStorage).
 */
export const collapsedCategories = writable<Set<ArtifactCategory>>(
  loadCollapsedCategories()
);

/**
 * Loads collapsed categories from localStorage.
 */
function loadCollapsedCategories(): Set<ArtifactCategory> {
  if (typeof localStorage === 'undefined') {
    return new Set();
  }
  try {
    const stored = localStorage.getItem('artifact-collapsed-categories');
    if (stored) {
      const parsed = JSON.parse(stored) as ArtifactCategory[];
      return new Set(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

/**
 * Saves collapsed categories to localStorage.
 */
function saveCollapsedCategories(categories: Set<ArtifactCategory>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      'artifact-collapsed-categories',
      JSON.stringify([...categories])
    );
  } catch {
    // Ignore storage errors
  }
}

// Subscribe to changes and save to localStorage
collapsedCategories.subscribe(saveCollapsedCategories);

/**
 * Toggles the collapsed state of a category.
 */
export function toggleCategoryCollapsed(category: ArtifactCategory) {
  collapsedCategories.update((set) => {
    const newSet = new Set(set);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    return newSet;
  });
}

/**
 * Derived store for non-empty categories with their artifacts.
 */
export const nonEmptyCategories = derived(
  artifactGroups,
  ($groups) => {
    if (!$groups) return [];
    return ARTIFACT_CATEGORIES.filter(
      (cat) => getArtifactsByCategory($groups, cat).length > 0
    );
  }
);

/**
 * Loads artifacts for the current project.
 */
export async function loadArtifacts() {
  const project = get(currentProject);
  if (!project) {
    artifactsError.set('No project loaded');
    return;
  }

  artifactsLoading.set(true);
  artifactsError.set(null);

  try {
    const groups = await artifactBrowserApi.listProjectArtifacts(project.path);
    artifactGroups.set(groups);
  } catch (error) {
    artifactsError.set(
      error instanceof Error ? error.message : 'Failed to load artifacts'
    );
  } finally {
    artifactsLoading.set(false);
  }
}

/**
 * Selects an artifact and loads its content.
 */
export async function selectArtifact(artifact: ArtifactInfo) {
  selectedArtifact.set(artifact);
  selectedArtifactContent.set(null);
  artifactViewerOpen.set(true);
  artifactContentLoading.set(true);

  try {
    const content = await artifactBrowserApi.readArtifactFile(artifact.path);
    selectedArtifactContent.set(content);
  } catch (error) {
    selectedArtifactContent.set(
      `Error loading content: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    artifactContentLoading.set(false);
  }
}

/**
 * Closes the artifact viewer.
 */
export function closeArtifactViewer() {
  artifactViewerOpen.set(false);
  selectedArtifact.set(null);
  selectedArtifactContent.set(null);
}

/**
 * Gets the index of the current artifact in its category.
 */
function getCurrentArtifactIndex(): { category: ArtifactCategory; index: number } | null {
  const artifact = get(selectedArtifact);
  const groups = get(artifactGroups);
  if (!artifact || !groups) return null;

  const categoryArtifacts = getArtifactsByCategory(groups, artifact.category);
  const index = categoryArtifacts.findIndex((a) => a.path === artifact.path);
  if (index === -1) return null;

  return { category: artifact.category, index };
}

/**
 * Navigates to the previous artifact in the same category.
 */
export async function navigateToPrevious() {
  const current = getCurrentArtifactIndex();
  const groups = get(artifactGroups);
  if (!current || !groups) return;

  const categoryArtifacts = getArtifactsByCategory(groups, current.category);
  if (current.index > 0) {
    await selectArtifact(categoryArtifacts[current.index - 1]);
  }
}

/**
 * Navigates to the next artifact in the same category.
 */
export async function navigateToNext() {
  const current = getCurrentArtifactIndex();
  const groups = get(artifactGroups);
  if (!current || !groups) return;

  const categoryArtifacts = getArtifactsByCategory(groups, current.category);
  if (current.index < categoryArtifacts.length - 1) {
    await selectArtifact(categoryArtifacts[current.index + 1]);
  }
}

/**
 * Derived store for navigation info (position in category).
 */
export const navigationInfo = derived(
  [selectedArtifact, artifactGroups],
  ([$artifact, $groups]) => {
    if (!$artifact || !$groups) {
      return { current: 0, total: 0, hasPrev: false, hasNext: false };
    }

    const categoryArtifacts = getArtifactsByCategory($groups, $artifact.category);
    const index = categoryArtifacts.findIndex((a) => a.path === $artifact.path);
    if (index === -1) {
      return { current: 0, total: 0, hasPrev: false, hasNext: false };
    }

    return {
      current: index + 1,
      total: categoryArtifacts.length,
      hasPrev: index > 0,
      hasNext: index < categoryArtifacts.length - 1,
    };
  }
);

/**
 * Opens the selected artifact in the user's IDE.
 */
export async function openSelectedInIde() {
  const artifact = get(selectedArtifact);
  if (!artifact) return;

  try {
    await artifactBrowserApi.openInIde(artifact.path);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to open in IDE:', error);
    // Import dynamically to avoid circular dependency
    const { showErrorToast } = await import('./ui');
    showErrorToast(`Failed to open in IDE: ${message}`);
  }
}

/**
 * Resets all artifact stores (for cleanup).
 */
export function resetArtifactStores() {
  artifactGroups.set(null);
  artifactsLoading.set(false);
  artifactsError.set(null);
  selectedArtifact.set(null);
  selectedArtifactContent.set(null);
  artifactContentLoading.set(false);
  artifactViewerOpen.set(false);
}
