/**
 * Types for BMAD task definitions.
 * Tasks are standalone utilities like editorial reviews, help, and document utilities.
 */

/**
 * Represents a BMAD task from the task manifest.
 * Used by the command palette to display available tasks.
 */
export interface Task {
  /** Task name/identifier (e.g., "editorial-review-prose") */
  name: string;
  /** Human-readable display name (e.g., "Editorial Review - Prose") */
  displayName: string;
  /** Description of what the task does */
  description: string;
  /** Module that provides this task (e.g., "core") */
  module: string;
  /** Path to the task definition file */
  path: string;
  /** Whether this task can be invoked standalone by users */
  standalone: boolean;
}
