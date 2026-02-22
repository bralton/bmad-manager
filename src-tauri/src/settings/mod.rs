//! Settings module for persistent user settings and preferences.
//!
//! This module provides YAML-based persistence for user settings,
//! enabling first-run wizard state tracking and user preferences.
//!
//! Settings are stored at two levels:
//! - Global: `~/.bmad-manager/settings.yaml`
//! - Project: `{project_path}/.bmad-manager/settings.yaml`

mod deps;
mod project_settings;
mod store;

pub use deps::{check_dependencies, DependencyStatus};
pub use project_settings::{
    get_effective_settings, get_project_settings, save_project_settings, EffectiveSettings,
    ProjectSettings,
};
pub use store::{get_settings, is_wizard_completed, save_settings, GlobalSettings, SettingsError};
