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
