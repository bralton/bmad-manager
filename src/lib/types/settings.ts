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
