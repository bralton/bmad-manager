//! Pure detection logic for project state and configuration.
//! This module contains no Tauri dependencies for easy unit testing.

use std::path::{Path, PathBuf};

use super::types::{ProjectError, ProjectState};

/// Detects the initialization state of a project directory.
///
/// Validates that the path exists and is a directory, then checks for
/// the presence of `.git` and `_bmad` directories.
pub fn detect_project_state(path: &Path) -> Result<ProjectState, ProjectError> {
    if !path.exists() {
        return Err(ProjectError::PathNotFound(path.display().to_string()));
    }
    if !path.is_dir() {
        return Err(ProjectError::NotADirectory(path.display().to_string()));
    }

    // .git can be a directory (normal repo) or a file (worktree/submodule)
    let has_git = path.join(".git").exists();
    let has_bmad = path.join("_bmad").is_dir();

    Ok(match (has_git, has_bmad) {
        (true, true) => ProjectState::FullyInitialized,
        (true, false) => ProjectState::GitOnly,
        (false, true) => ProjectState::BmadOnly,
        (false, false) => ProjectState::Empty,
    })
}

/// Finds the BMAD config file path, preferring BMM module override.
///
/// Checks for config at:
/// 1. `_bmad/bmm/config.yaml` (BMM module override, preferred)
/// 2. `_bmad/core/config.yaml` (standard location)
pub fn find_config_path(project_root: &Path) -> Option<PathBuf> {
    let bmm_config = project_root.join("_bmad/bmm/config.yaml");
    let core_config = project_root.join("_bmad/core/config.yaml");

    if bmm_config.exists() {
        Some(bmm_config)
    } else if core_config.exists() {
        Some(core_config)
    } else {
        None
    }
}

/// Derives the project name using a fallback chain.
///
/// Priority:
/// 1. `config_name` - project_name from config.yaml
/// 2. Directory name from path
/// 3. "Untitled Project" as last resort
pub fn derive_project_name(config_name: Option<&str>, path: &Path) -> String {
    config_name
        .map(|s| s.to_string())
        .or_else(|| {
            path.file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "Untitled Project".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_detect_fully_initialized() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();
        fs::create_dir(dir.path().join("_bmad")).unwrap();

        let state = detect_project_state(dir.path()).unwrap();
        assert_eq!(state, ProjectState::FullyInitialized);
    }

    #[test]
    fn test_detect_git_only() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join(".git")).unwrap();

        let state = detect_project_state(dir.path()).unwrap();
        assert_eq!(state, ProjectState::GitOnly);
    }

    #[test]
    fn test_detect_bmad_only() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join("_bmad")).unwrap();

        let state = detect_project_state(dir.path()).unwrap();
        assert_eq!(state, ProjectState::BmadOnly);
    }

    #[test]
    fn test_detect_empty() {
        let dir = tempdir().unwrap();

        let state = detect_project_state(dir.path()).unwrap();
        assert_eq!(state, ProjectState::Empty);
    }

    #[test]
    fn test_detect_nonexistent_path() {
        let result = detect_project_state(Path::new("/nonexistent/path"));
        assert!(matches!(result, Err(ProjectError::PathNotFound(_))));
    }

    #[test]
    fn test_find_config_path_bmm_preferred() {
        let dir = tempdir().unwrap();
        let bmad_dir = dir.path().join("_bmad");
        fs::create_dir_all(bmad_dir.join("bmm")).unwrap();
        fs::create_dir_all(bmad_dir.join("core")).unwrap();
        fs::write(bmad_dir.join("bmm/config.yaml"), "test: true").unwrap();
        fs::write(bmad_dir.join("core/config.yaml"), "test: false").unwrap();

        let config_path = find_config_path(dir.path()).unwrap();
        assert!(config_path.ends_with("bmm/config.yaml"));
    }

    #[test]
    fn test_find_config_path_core_fallback() {
        let dir = tempdir().unwrap();
        let bmad_dir = dir.path().join("_bmad");
        fs::create_dir_all(bmad_dir.join("core")).unwrap();
        fs::write(bmad_dir.join("core/config.yaml"), "test: true").unwrap();

        let config_path = find_config_path(dir.path()).unwrap();
        assert!(config_path.ends_with("core/config.yaml"));
    }

    #[test]
    fn test_find_config_path_none() {
        let dir = tempdir().unwrap();

        let config_path = find_config_path(dir.path());
        assert!(config_path.is_none());
    }

    #[test]
    fn test_derive_project_name_from_config() {
        let name = derive_project_name(Some("My Project"), Path::new("/some/path"));
        assert_eq!(name, "My Project");
    }

    #[test]
    fn test_derive_project_name_from_path() {
        let name = derive_project_name(None, Path::new("/some/my-project"));
        assert_eq!(name, "my-project");
    }

    #[test]
    fn test_derive_project_name_fallback() {
        let name = derive_project_name(None, Path::new("/"));
        assert_eq!(name, "Untitled Project");
    }

    #[test]
    fn test_detect_file_not_directory() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("some_file.txt");
        fs::write(&file_path, "content").unwrap();

        let result = detect_project_state(&file_path);
        assert!(matches!(result, Err(ProjectError::NotADirectory(_))));
    }

    #[test]
    fn test_detect_git_worktree_file() {
        // In git worktrees, .git is a file not a directory
        let dir = tempdir().unwrap();
        fs::write(dir.path().join(".git"), "gitdir: /some/path").unwrap();
        fs::create_dir(dir.path().join("_bmad")).unwrap();

        let state = detect_project_state(dir.path()).unwrap();
        assert_eq!(state, ProjectState::FullyInitialized);
    }
}
