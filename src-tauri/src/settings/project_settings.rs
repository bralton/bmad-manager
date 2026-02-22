//! Project-specific settings stored in {project_path}/.bmad-manager/settings.yaml
//!
//! These settings override global settings when present, allowing per-project
//! customization of branch patterns, worktree locations, and IDE commands.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use super::store::{GlobalSettings, SettingsError};

/// Project-specific settings that can override global defaults.
///
/// All fields are optional - when None, the global setting is used.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    /// Override for git branch pattern (e.g., "feature/{story_id}-{slug}")
    #[serde(default)]
    pub branch_pattern: Option<String>,

    /// Override for worktree location ("sibling" or "subdirectory")
    #[serde(default)]
    pub worktree_location: Option<String>,

    /// Override for IDE command (e.g., "cursor .")
    #[serde(default)]
    pub ide_command: Option<String>,
}

/// Effective settings after merging global and project-specific settings.
///
/// This struct contains all resolved settings values, with project settings
/// taking precedence over global settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectiveSettings {
    /// User name from global settings
    pub user_name: String,

    /// Theme from global settings
    pub theme: String,

    /// IDE command (project override or global)
    pub ide_command: String,

    /// Default workflow style from global settings
    pub default_workflow: String,

    /// Show agent icons from global settings
    pub show_agent_icons: bool,

    /// Branch pattern (project override or global)
    pub branch_pattern: String,

    /// Worktree location (project override or global)
    pub worktree_location: String,
}

/// Gets the path to the project settings directory ({project_path}/.bmad-manager).
fn get_project_settings_dir(project_path: &Path) -> PathBuf {
    project_path.join(".bmad-manager")
}

/// Gets the path to the project settings file ({project_path}/.bmad-manager/settings.yaml).
fn get_project_settings_path(project_path: &Path) -> PathBuf {
    get_project_settings_dir(project_path).join("settings.yaml")
}

/// Reads project-specific settings from the project directory.
///
/// Returns default (empty) settings if the file doesn't exist.
pub fn get_project_settings(project_path: &Path) -> Result<ProjectSettings, SettingsError> {
    let path = get_project_settings_path(project_path);

    if !path.exists() {
        return Ok(ProjectSettings::default());
    }

    let content =
        std::fs::read_to_string(&path).map_err(|e| SettingsError::ReadError(e.to_string()))?;

    // Handle empty files gracefully
    if content.trim().is_empty() {
        return Ok(ProjectSettings::default());
    }

    serde_yaml::from_str(&content).map_err(|e| SettingsError::ParseError(e.to_string()))
}

/// Saves project-specific settings to the project directory.
///
/// Creates the .bmad-manager directory if it doesn't exist.
pub fn save_project_settings(
    project_path: &Path,
    settings: &ProjectSettings,
) -> Result<(), SettingsError> {
    let dir = get_project_settings_dir(project_path);
    let path = get_project_settings_path(project_path);

    // Create directory if it doesn't exist
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| SettingsError::WriteError(e.to_string()))?;
    }

    // Add a header comment to the YAML
    let yaml =
        serde_yaml::to_string(settings).map_err(|e| SettingsError::WriteError(e.to_string()))?;

    let content = format!(
        "# BMAD Manager Project Settings\n# These settings override global defaults for this project\n\n{}",
        yaml
    );

    std::fs::write(&path, content).map_err(|e| SettingsError::WriteError(e.to_string()))
}

/// Resolves effective settings by merging global and project-specific settings.
///
/// Project settings take precedence over global settings when present.
pub fn get_effective_settings(
    global: &GlobalSettings,
    project: &ProjectSettings,
) -> EffectiveSettings {
    EffectiveSettings {
        user_name: global.user.name.clone(),
        theme: global.ui.theme.clone(),
        ide_command: project
            .ide_command
            .clone()
            .unwrap_or_else(|| global.tools.ide_command.clone()),
        default_workflow: format!("{:?}", global.bmad.default_workflow),
        show_agent_icons: global.ui.show_agent_icons,
        branch_pattern: project
            .branch_pattern
            .clone()
            .unwrap_or_else(|| global.git.branch_pattern.clone()),
        worktree_location: project
            .worktree_location
            .clone()
            .unwrap_or_else(|| global.git.worktree_location.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    use crate::settings::store::{
        BmadSettings, GitSettings, GlobalSettings, ToolSettings, UiSettings, UserSettings,
        WorkflowStyle,
    };

    fn create_test_global_settings() -> GlobalSettings {
        GlobalSettings {
            wizard_completed: true,
            user: UserSettings {
                name: "TestUser".to_string(),
            },
            bmad: BmadSettings {
                default_workflow: WorkflowStyle::QuickFlow,
            },
            tools: ToolSettings {
                ide_command: "code .".to_string(),
            },
            git: GitSettings {
                branch_pattern: "story/{story_id}-{slug}".to_string(),
                worktree_location: "sibling".to_string(),
            },
            ui: UiSettings {
                theme: "dark".to_string(),
                show_agent_icons: true,
            },
        }
    }

    #[test]
    fn test_project_settings_default() {
        let settings = ProjectSettings::default();
        assert!(settings.branch_pattern.is_none());
        assert!(settings.worktree_location.is_none());
        assert!(settings.ide_command.is_none());
    }

    #[test]
    fn test_project_settings_serialization() {
        let settings = ProjectSettings {
            branch_pattern: Some("feature/{story_id}".to_string()),
            worktree_location: None,
            ide_command: Some("cursor .".to_string()),
        };

        let yaml = serde_yaml::to_string(&settings).unwrap();
        assert!(yaml.contains("branchPattern:"));
        assert!(yaml.contains("feature/{story_id}"));
        assert!(yaml.contains("ideCommand:"));
        assert!(yaml.contains("cursor ."));
    }

    #[test]
    fn test_project_settings_deserialization() {
        let yaml = r#"
branchPattern: "custom/{slug}"
worktreeLocation: "subdirectory"
"#;

        let settings: ProjectSettings = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(
            settings.branch_pattern,
            Some("custom/{slug}".to_string())
        );
        assert_eq!(
            settings.worktree_location,
            Some("subdirectory".to_string())
        );
        assert!(settings.ide_command.is_none());
    }

    #[test]
    fn test_get_project_settings_missing_file() {
        let temp_dir = TempDir::new().unwrap();
        let result = get_project_settings(temp_dir.path());
        assert!(result.is_ok());
        let settings = result.unwrap();
        assert!(settings.branch_pattern.is_none());
    }

    #[test]
    fn test_get_project_settings_empty_file() {
        let temp_dir = TempDir::new().unwrap();
        let settings_dir = temp_dir.path().join(".bmad-manager");
        fs::create_dir_all(&settings_dir).unwrap();
        fs::write(settings_dir.join("settings.yaml"), "").unwrap();

        let result = get_project_settings(temp_dir.path());
        assert!(result.is_ok());
        let settings = result.unwrap();
        assert!(settings.branch_pattern.is_none());
    }

    #[test]
    fn test_save_and_load_project_settings() {
        let temp_dir = TempDir::new().unwrap();
        let settings = ProjectSettings {
            branch_pattern: Some("test/{story_id}".to_string()),
            worktree_location: Some("subdirectory".to_string()),
            ide_command: None,
        };

        // Save settings
        let save_result = save_project_settings(temp_dir.path(), &settings);
        assert!(save_result.is_ok());

        // Verify directory was created
        assert!(temp_dir.path().join(".bmad-manager").exists());

        // Load settings back
        let loaded = get_project_settings(temp_dir.path()).unwrap();
        assert_eq!(loaded.branch_pattern, Some("test/{story_id}".to_string()));
        assert_eq!(loaded.worktree_location, Some("subdirectory".to_string()));
        assert!(loaded.ide_command.is_none());
    }

    #[test]
    fn test_effective_settings_no_overrides() {
        let global = create_test_global_settings();
        let project = ProjectSettings::default();

        let effective = get_effective_settings(&global, &project);

        assert_eq!(effective.user_name, "TestUser");
        assert_eq!(effective.theme, "dark");
        assert_eq!(effective.ide_command, "code .");
        assert_eq!(effective.branch_pattern, "story/{story_id}-{slug}");
        assert_eq!(effective.worktree_location, "sibling");
        assert!(effective.show_agent_icons);
    }

    #[test]
    fn test_effective_settings_with_overrides() {
        let global = create_test_global_settings();
        let project = ProjectSettings {
            branch_pattern: Some("feature/{slug}".to_string()),
            worktree_location: Some("subdirectory".to_string()),
            ide_command: Some("cursor .".to_string()),
        };

        let effective = get_effective_settings(&global, &project);

        // These should be from global (no project override available)
        assert_eq!(effective.user_name, "TestUser");
        assert_eq!(effective.theme, "dark");

        // These should be from project overrides
        assert_eq!(effective.ide_command, "cursor .");
        assert_eq!(effective.branch_pattern, "feature/{slug}");
        assert_eq!(effective.worktree_location, "subdirectory");
    }

    #[test]
    fn test_effective_settings_partial_overrides() {
        let global = create_test_global_settings();
        let project = ProjectSettings {
            branch_pattern: Some("custom/{story_id}".to_string()),
            worktree_location: None, // Use global
            ide_command: None,       // Use global
        };

        let effective = get_effective_settings(&global, &project);

        assert_eq!(effective.branch_pattern, "custom/{story_id}");
        assert_eq!(effective.worktree_location, "sibling"); // From global
        assert_eq!(effective.ide_command, "code .");        // From global
    }

    #[test]
    fn test_project_settings_path() {
        let project_path = PathBuf::from("/home/user/my-project");
        let settings_path = get_project_settings_path(&project_path);
        assert_eq!(
            settings_path,
            PathBuf::from("/home/user/my-project/.bmad-manager/settings.yaml")
        );
    }
}
