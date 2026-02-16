/**
 * Type definitions for project detection and configuration.
 * These mirror the Rust types in src-tauri/src/project/types.rs
 */

/**
 * Represents a loaded project with its state and configuration.
 */
export interface Project {
  path: string;
  name: string;
  state: ProjectState;
  config: BmadConfig | null;
}

/**
 * The initialization state of a project directory.
 * Uses kebab-case to match Rust serde serialization.
 */
export type ProjectState =
  | 'fully-initialized'
  | 'git-only'
  | 'bmad-only'
  | 'empty';

/**
 * BMAD configuration parsed from config.yaml.
 * Note: Both Rust and TypeScript use snake_case for these fields
 * to match the YAML config file format.
 */
export interface BmadConfig {
  project_name: string;
  user_name: string;
  output_folder: string;
  communication_language: string;
}

/**
 * Error returned from project operations.
 */
export interface ProjectError {
  PathNotFound?: string;
  NotADirectory?: string;
  ConfigReadError?: string;
  ConfigParseError?: string;
}

/**
 * Helper to get a human-readable label for project state.
 */
export function getStateLabel(state: ProjectState): string {
  switch (state) {
    case 'fully-initialized':
      return 'Fully Initialized';
    case 'git-only':
      return 'Git Only';
    case 'bmad-only':
      return 'BMAD Only';
    case 'empty':
      return 'Empty';
  }
}

/**
 * Helper to get a description for each project state.
 */
export function getStateDescription(state: ProjectState): string {
  switch (state) {
    case 'fully-initialized':
      return 'This project has both Git and BMAD initialized.';
    case 'git-only':
      return 'This project has Git but no BMAD setup. Initialize BMAD to get started.';
    case 'bmad-only':
      return 'This project has BMAD but no Git repository.';
    case 'empty':
      return 'This folder is empty. Initialize both Git and BMAD to get started.';
  }
}
