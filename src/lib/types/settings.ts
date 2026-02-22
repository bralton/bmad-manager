/**
 * TypeScript types for settings and dependency checking.
 * Must match the Rust types in src-tauri/src/settings/.
 */

/** Workflow style preference */
export type WorkflowStyle = 'QuickFlow' | 'FullBMM';

/** User profile settings */
export interface UserSettings {
  name: string;
}

/** BMAD-specific settings */
export interface BmadSettings {
  default_workflow: WorkflowStyle;
}

/** Tool configuration settings */
export interface ToolSettings {
  ide_command: string;
}

/** Git-related settings (stub for future) */
export interface GitSettings {
  branch_pattern: string;
  worktree_location: string;
}

/** UI settings (stub for future) */
export interface UiSettings {
  theme: string;
  show_agent_icons: boolean;
}

/** Global application settings */
export interface GlobalSettings {
  wizard_completed: boolean;
  user: UserSettings;
  bmad: BmadSettings;
  tools: ToolSettings;
  git: GitSettings;
  ui: UiSettings;
}

/** Status of an external dependency */
export interface DependencyStatus {
  name: string;
  installed: boolean;
  version: string | null;
  installCommand: string | null;
  minVersion: string | null;
  versionOk: boolean;
}

/**
 * Project-specific settings that can override global defaults.
 * All fields are optional - when undefined, the global setting is used.
 */
export interface ProjectSettings {
  /** Override for git branch pattern (e.g., "feature/{story_id}-{slug}") */
  branchPattern?: string;
  /** Override for worktree location ("sibling" or "subdirectory") */
  worktreeLocation?: string;
  /** Override for IDE command (e.g., "cursor .") */
  ideCommand?: string;
}

/**
 * Effective settings after merging global and project-specific settings.
 * All values are resolved - project settings take precedence when present.
 */
export interface EffectiveSettings {
  /** User name from global settings */
  userName: string;
  /** Theme from global settings */
  theme: string;
  /** IDE command (project override or global) */
  ideCommand: string;
  /** Default workflow style from global settings */
  defaultWorkflow: string;
  /** Show agent icons from global settings */
  showAgentIcons: boolean;
  /** Branch pattern (project override or global) */
  branchPattern: string;
  /** Worktree location (project override or global) */
  worktreeLocation: string;
}
