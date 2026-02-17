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
