/**
 * Types for conflict detection between stories.
 * Maps to Rust types in conflict_detection/mod.rs
 */

/**
 * Files associated with a story.
 * Used internally for conflict detection.
 */
export interface StoryFiles {
  /** Story ID (e.g., "4-3") */
  storyId: string;
  /** List of file paths this story modifies */
  files: string[];
}

/**
 * A conflict warning between two stories sharing files.
 */
export interface ConflictWarning {
  /** Story ID that has conflicts */
  storyId: string;
  /** Story ID it conflicts with */
  conflictsWith: string;
  /** List of shared file paths */
  sharedFiles: string[];
}

/**
 * Aggregated conflicts for a single story.
 * Groups all conflicts for easier display.
 */
export interface StoryConflictSummary {
  /** Story ID with conflicts */
  storyId: string;
  /** Total count of conflicting stories */
  conflictCount: number;
  /** All conflict warnings for this story */
  conflicts: ConflictWarning[];
}
