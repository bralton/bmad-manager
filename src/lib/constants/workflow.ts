/**
 * Shared constants for workflow visualization.
 * Centralized to avoid duplication across components.
 */

import type { Phase } from '$lib/types/workflow';

/**
 * Total steps per workflow type for progress calculation.
 */
export const WORKFLOW_TOTAL_STEPS: Record<string, number> = {
  'product-brief': 5,
  'prd': 5,
  'ux-design': 4,
  'tech-spec': 5,
  'architecture': 5,
  'create-story': 6,
  'dev-story': 4,
  'sprint-planning': 3,
};

/**
 * Human-readable labels for each phase.
 */
export const PHASE_LABELS: Record<Phase, string> = {
  'not-started': 'Not Started',
  'discovery': 'Discovery',
  'planning': 'Planning',
  'solutioning': 'Solutioning',
  'implementation': 'Implementation',
};

/**
 * Human-readable display names for workflow types.
 */
export const WORKFLOW_DISPLAY_NAMES: Record<string, string> = {
  'product-brief': 'Product Brief',
  'prd': 'PRD',
  'ux-design': 'UX Design',
  'tech-spec': 'Tech Spec',
  'architecture': 'Architecture',
  'create-story': 'Create Story',
  'dev-story': 'Dev Story',
  'sprint-planning': 'Sprint Planning',
};

/**
 * Gets the total number of steps for a workflow type.
 * @param workflowType - The workflow type identifier
 * @returns Total steps (defaults to 5 if unknown)
 */
export function getTotalSteps(workflowType: string): number {
  return WORKFLOW_TOTAL_STEPS[workflowType.toLowerCase()] ?? 5;
}

/**
 * Gets the display name for a workflow type.
 * @param workflowType - The workflow type identifier
 * @returns Human-readable name (falls back to raw type if unknown)
 */
export function getWorkflowDisplayName(workflowType: string): string {
  return WORKFLOW_DISPLAY_NAMES[workflowType.toLowerCase()] ?? workflowType;
}
