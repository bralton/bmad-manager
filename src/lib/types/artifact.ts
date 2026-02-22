/**
 * Type definitions for artifact browser functionality.
 * These mirror the Rust types in src-tauri/src/bmad_parser/artifact_browser.rs
 */

/**
 * Category of a BMAD artifact for display grouping.
 * Uses kebab-case to match Rust serde serialization.
 */
export type ArtifactCategory =
  | 'epic'
  | 'story'
  | 'retrospective'
  | 'design'
  | 'planning'
  | 'other';

/**
 * Artifact information for the browser UI.
 * Uses camelCase to match Rust serde serialization.
 */
export interface ArtifactInfo {
  /** Absolute path to the artifact file */
  path: string;
  /** Display title (from H1 heading or filename) */
  title: string;
  /** Category for grouping */
  category: ArtifactCategory;
  /** Epic ID if this is an epic-related artifact (e.g., "1", "2", "2.5") */
  epicId?: string;
  /** Story ID if this is a story (e.g., "1-1", "2-3") */
  storyId?: string;
  /** Last modified timestamp (ISO 8601) */
  modifiedAt: string;
  /** Status from file content (if available) */
  status?: string;
}

/**
 * Groups of artifacts organized by category.
 * Uses camelCase to match Rust serde serialization.
 */
export interface ArtifactGroups {
  epics: ArtifactInfo[];
  stories: ArtifactInfo[];
  retrospectives: ArtifactInfo[];
  design: ArtifactInfo[];
  planning: ArtifactInfo[];
  other: ArtifactInfo[];
}

/**
 * Returns a display-friendly name for an artifact category.
 */
export function getCategoryDisplayName(category: ArtifactCategory): string {
  switch (category) {
    case 'epic':
      return 'Epics';
    case 'story':
      return 'Stories';
    case 'retrospective':
      return 'Retrospectives';
    case 'design':
      return 'Design Docs';
    case 'planning':
      return 'Planning Docs';
    case 'other':
      return 'Other';
  }
}

/**
 * Returns all artifact categories in display order.
 */
export const ARTIFACT_CATEGORIES: ArtifactCategory[] = [
  'epic',
  'story',
  'retrospective',
  'design',
  'planning',
  'other',
];

/**
 * Returns the total count of all artifacts in groups.
 */
export function getTotalArtifactCount(groups: ArtifactGroups): number {
  return (
    groups.epics.length +
    groups.stories.length +
    groups.retrospectives.length +
    groups.design.length +
    groups.planning.length +
    groups.other.length
  );
}

/**
 * Gets artifacts from a specific category in groups.
 */
export function getArtifactsByCategory(
  groups: ArtifactGroups,
  category: ArtifactCategory
): ArtifactInfo[] {
  switch (category) {
    case 'epic':
      return groups.epics;
    case 'story':
      return groups.stories;
    case 'retrospective':
      return groups.retrospectives;
    case 'design':
      return groups.design;
    case 'planning':
      return groups.planning;
    case 'other':
      return groups.other;
  }
}

/**
 * Returns an icon name for a category.
 */
export function getCategoryIcon(category: ArtifactCategory): string {
  switch (category) {
    case 'epic':
      return 'folder';
    case 'story':
      return 'file-text';
    case 'retrospective':
      return 'clock';
    case 'design':
      return 'palette';
    case 'planning':
      return 'clipboard';
    case 'other':
      return 'file';
  }
}

/**
 * Formats a status string for display.
 */
export function formatStatus(status: string | undefined): string {
  if (!status) return '';
  return status.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Gets a status badge color class.
 */
export function getStatusColor(status: string | undefined): string {
  if (!status) return '';
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'done':
    case 'approved':
      return 'bg-green-600';
    case 'in-progress':
      return 'bg-blue-600';
    case 'review':
      return 'bg-yellow-600';
    case 'ready-for-dev':
      return 'bg-purple-600';
    case 'backlog':
      return 'bg-gray-600';
    case 'draft':
      return 'bg-orange-600';
    default:
      return 'bg-gray-600';
  }
}
