//! Type definitions for project detection and configuration.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// Represents a loaded project with its state and configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub path: PathBuf,
    pub name: String,
    pub state: ProjectState,
    pub config: Option<BmadConfig>,
}

/// The initialization state of a project directory.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectState {
    /// Both .git and _bmad directories present
    FullyInitialized,
    /// Only .git directory present
    GitOnly,
    /// Only _bmad directory present (unusual)
    BmadOnly,
    /// Neither .git nor _bmad present
    Empty,
}

/// BMAD configuration parsed from config.yaml.
/// Fields use defaults if not present in the config file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BmadConfig {
    pub project_name: String,
    pub user_name: String,
    pub output_folder: String,
    pub communication_language: String,
}

impl Default for BmadConfig {
    fn default() -> Self {
        Self {
            project_name: String::new(),
            user_name: "Developer".to_string(),
            output_folder: "_bmad-output".to_string(),
            communication_language: "English".to_string(),
        }
    }
}

/// Errors that can occur during project operations.
#[derive(Debug, Error, Serialize)]
pub enum ProjectError {
    #[error("Path does not exist: {0}")]
    PathNotFound(String),
    #[error("Path is not a directory: {0}")]
    NotADirectory(String),
    #[error("Failed to read config: {0}")]
    ConfigReadError(String),
    #[error("Invalid config format: {0}")]
    ConfigParseError(String),
}

impl From<serde_yaml::Error> for ProjectError {
    fn from(e: serde_yaml::Error) -> Self {
        ProjectError::ConfigParseError(e.to_string())
    }
}

impl From<std::io::Error> for ProjectError {
    fn from(e: std::io::Error) -> Self {
        ProjectError::ConfigReadError(e.to_string())
    }
}
