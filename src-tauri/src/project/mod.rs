//! Project detection and configuration module.
//!
//! This module provides Tauri commands for detecting project state,
//! loading BMAD configuration, and managing project lifecycle.

mod detection;
mod types;

pub use types::{BmadConfig, Project, ProjectError, ProjectState};

use std::fs;
use std::path::PathBuf;

use detection::{derive_project_name, detect_project_state, find_config_path};

/// Opens a project directory and returns its state and configuration.
///
/// Detects whether the directory has .git and _bmad directories,
/// and loads BMAD configuration if available.
#[tauri::command]
pub fn open_project(path: PathBuf) -> Result<Project, ProjectError> {
    let state = detect_project_state(&path)?;

    let config = if let Some(config_path) = find_config_path(&path) {
        let contents = fs::read_to_string(&config_path)?;
        Some(serde_yaml::from_str::<BmadConfig>(&contents)?)
    } else {
        None
    };

    let name = derive_project_name(config.as_ref().map(|c| c.project_name.as_str()), &path);

    Ok(Project {
        path,
        name,
        state,
        config,
    })
}

/// Gets the initialization state of a project directory.
#[tauri::command]
pub fn get_project_state(path: PathBuf) -> Result<ProjectState, ProjectError> {
    detect_project_state(&path)
}

/// Refreshes project information by re-reading the directory.
#[tauri::command]
pub fn refresh_project(path: PathBuf) -> Result<Project, ProjectError> {
    open_project(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_open_project_with_valid_config() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::create_dir_all(dir.path().join("_bmad/bmm")).unwrap();

        let config_content = r#"
project_name: test-project
user_name: TestUser
output_folder: _output
communication_language: English
"#;
        fs::write(dir.path().join("_bmad/bmm/config.yaml"), config_content).unwrap();

        let project = open_project(dir.path().to_path_buf()).unwrap();
        assert_eq!(project.name, "test-project");
        assert_eq!(project.state, ProjectState::FullyInitialized);
        assert!(project.config.is_some());
        let config = project.config.unwrap();
        assert_eq!(config.user_name, "TestUser");
    }

    #[test]
    fn test_open_project_with_invalid_yaml() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::create_dir_all(dir.path().join("_bmad/bmm")).unwrap();

        // Invalid YAML - unclosed quote
        fs::write(dir.path().join("_bmad/bmm/config.yaml"), "project_name: \"unclosed").unwrap();

        let result = open_project(dir.path().to_path_buf());
        assert!(matches!(result, Err(ProjectError::ConfigParseError(_))));
    }

    #[test]
    fn test_open_project_with_partial_config_uses_defaults() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::create_dir_all(dir.path().join("_bmad/bmm")).unwrap();

        // Only project_name provided - other fields should use defaults
        fs::write(dir.path().join("_bmad/bmm/config.yaml"), "project_name: test\n").unwrap();

        let project = open_project(dir.path().to_path_buf()).unwrap();
        let config = project.config.unwrap();
        assert_eq!(config.project_name, "test");
        assert_eq!(config.user_name, "Developer"); // default
        assert_eq!(config.output_folder, "_bmad-output"); // default
        assert_eq!(config.communication_language, "English"); // default
    }

    #[test]
    fn test_open_project_without_config() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::create_dir(dir.path().join("_bmad")).unwrap();
        // No config.yaml file

        let project = open_project(dir.path().to_path_buf()).unwrap();
        assert!(project.config.is_none());
        // Name should fall back to directory name
        assert!(!project.name.is_empty());
    }
}
