//! Settings module for persistent user settings and preferences.
//!
//! This module provides YAML-based persistence for user settings,
//! enabling first-run wizard state tracking and user preferences.

mod deps;
mod store;

pub use deps::{check_dependencies, DependencyStatus};
pub use store::{get_settings, is_wizard_completed, save_settings, GlobalSettings, SettingsError};
