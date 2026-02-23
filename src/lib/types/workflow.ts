/**
 * Types for BMAD workflow artifacts and metadata.
 */

/**
 * Status of an artifact in the BMAD workflow.
 */
export type ArtifactStatus = 'draft' | 'approved' | 'deprecated';

/**
 * Parsed metadata from a BMAD artifact's YAML frontmatter.
 */
export interface ArtifactMeta {
  /** Absolute path to the artifact file */
  path: string;
  /** Title of the artifact */
  title: string;
  /** Creation date (ISO format) */
  created: string;
  /** Current status of the artifact */
  status: ArtifactStatus;
  /** Type of workflow that produced this artifact */
  workflowType: string;
  /** Array of completed step numbers */
  stepsCompleted: number[];
  /** List of input document filenames */
  inputDocuments: string[];
}

/**
 * Development phase in the BMAD workflow.
 */
export type Phase =
  | 'not-started'
  | 'discovery'
  | 'planning'
  | 'solutioning'
  | 'implementation';

/**
 * Currently active workflow being worked on.
 */
export interface ActiveWorkflow {
  /** Type of workflow (e.g., "prd", "tech-spec", "create-story") */
  workflowType: string;
  /** Path to the output artifact file */
  outputPath: string;
  /** Array of completed step numbers */
  stepsCompleted: number[];
  /** The highest completed step number (0 if none) */
  lastStep: number;
}

/**
 * Aggregated workflow state for the project.
 * Powers the workflow visualizer component.
 */
export interface WorkflowState {
  /** Current development phase based on artifact analysis */
  currentPhase: Phase;
  /** Currently active workflow (if any is in progress) */
  activeWorkflow?: ActiveWorkflow;
  /** List of completed (approved) artifacts, sorted by date descending */
  completedArtifacts: ArtifactMeta[];
}

/**
 * Represents a BMAD workflow from the workflow manifest.
 * Used by the command palette to display available workflows.
 */
export interface Workflow {
  /** Workflow name/identifier (e.g., "create-prd") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Module that provides this workflow (e.g., "bmm", "core") */
  module: string;
  /** Path to the workflow definition file */
  path: string;
}

// =====================================================================
// Workflow Dashboard Types (Story 4-8: Multi-Workflow Visualization)
// =====================================================================

/**
 * View mode for the workflow tab.
 * After Story 5-1 Tab Restructure, only 'phase' remains (Epic/Sprint moved to Dashboards).
 * Future stories may add 'epic-workflow' and 'story-workflow'.
 */
export type WorkflowViewMode = 'phase';

/**
 * View mode for the dashboard tab (Story 5-1: Tab Restructure).
 * Shows metric views separate from workflow visualizations.
 */
export type DashboardViewMode = 'epic' | 'sprint';

/**
 * Stats for an epic's progress.
 */
export interface EpicProgressStats {
  /** Total number of stories in the epic */
  total: number;
  /** Number of stories with 'done' status */
  done: number;
  /** Number of stories with 'in-progress' status */
  inProgress: number;
  /** Completion percentage (0-100) */
  percentage: number;
}

/**
 * Progress data for a single epic.
 */
export interface EpicProgress {
  /** Epic ID (e.g., "1", "2.5") */
  epicId: string;
  /** Epic title (from epic file frontmatter) */
  title: string;
  /** Epic status */
  status: 'backlog' | 'in-progress' | 'done';
  /** Progress statistics */
  stats: EpicProgressStats;
}

/**
 * Counts of stories by status for sprint overview.
 */
export interface SprintProgressCounts {
  /** Stories in backlog */
  backlog: number;
  /** Stories ready for development */
  ready: number;
  /** Stories in progress */
  inProgress: number;
  /** Stories in review */
  review: number;
  /** Stories completed */
  done: number;
}

/**
 * Aggregated sprint progress metrics.
 */
export interface SprintProgress {
  /** Story counts by status */
  counts: SprintProgressCounts;
  /** Total number of stories */
  total: number;
  /** Overall completion percentage (0-100) */
  percentage: number;
}

/**
 * A single task item from a story's task list.
 */
export interface StoryTask {
  /** Task text/description */
  text: string;
  /** Whether the task is completed */
  completed: boolean;
  /** Indentation level (0 for top-level tasks, 1 for subtasks) */
  level: number;
}

/**
 * Progress data for a story's tasks.
 */
export interface StoryProgress {
  /** Story ID */
  storyId: string;
  /** List of tasks parsed from the story */
  tasks: StoryTask[];
  /** Total number of tasks */
  total: number;
  /** Number of completed tasks */
  completed: number;
  /** Completion percentage (0-100) */
  percentage: number;
}
