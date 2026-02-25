// BMAD Manager - Tauri Backend

mod bmad_parser;
mod conflict_detection;
mod file_watcher;
mod initializer;
mod process_manager;
mod project;
mod session_registry;
mod settings;
mod worktree;

pub use process_manager::get_active_session_count;

use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl};

// Artifact Tauri commands

/// Gets artifacts from a project's _bmad-output directory.
/// Scans both planning-artifacts and implementation-artifacts directories.
#[tauri::command]
fn get_artifacts(project_path: String) -> Vec<bmad_parser::ArtifactMeta> {
    let path = PathBuf::from(&project_path);
    bmad_parser::scan_all_project_artifacts(&path)
}

/// Gets the aggregated workflow state for a project.
/// Returns current phase, active workflow, and completed artifacts.
#[tauri::command]
fn get_workflow_state(project_path: String) -> bmad_parser::WorkflowState {
    let path = PathBuf::from(&project_path);
    bmad_parser::aggregate_workflow_state(&path)
}

/// Gets available BMAD workflows from the workflow manifest.
/// Reads _bmad/_config/workflow-manifest.csv from the project directory.
#[tauri::command]
fn get_workflows(project_path: String) -> Result<Vec<bmad_parser::Workflow>, String> {
    let path = PathBuf::from(&project_path);
    let manifest_path = path.join("_bmad/_config/workflow-manifest.csv");

    bmad_parser::parse_workflow_manifest(&manifest_path)
        .map_err(|e| e.to_string())
}

/// Gets the sprint status for a project.
/// Returns epics and stories with their statuses from sprint-status.yaml.
#[tauri::command]
fn get_sprint_status(project_path: String) -> bmad_parser::SprintStatus {
    let path = PathBuf::from(&project_path);
    bmad_parser::parse_sprint_status(&path)
}

/// Lists all project artifacts organized by category for the artifact browser.
#[tauri::command]
fn list_project_artifacts(project_path: String) -> bmad_parser::ArtifactGroups {
    let path = PathBuf::from(&project_path);
    bmad_parser::list_artifacts(&path)
}

/// Gets a specific story artifact by its ID (e.g., "1-1", "2-3").
#[tauri::command]
fn get_story_artifact(project_path: String, story_id: String) -> Option<bmad_parser::ArtifactInfo> {
    let path = PathBuf::from(&project_path);
    bmad_parser::get_story_artifact(&path, &story_id)
}

/// Gets a specific epic artifact by its ID (e.g., "1", "2.5").
#[tauri::command]
fn get_epic_artifact(project_path: String, epic_id: String) -> Option<bmad_parser::ArtifactInfo> {
    let path = PathBuf::from(&project_path);
    bmad_parser::get_epic_artifact(&path, &epic_id)
}

/// Gets artifacts grouped by workflow stage for a specific epic.
/// Returns planning artifacts, story counts, and retro document for the Epic Workflow view.
#[tauri::command]
fn get_epic_artifacts(project_path: String, epic_id: String) -> bmad_parser::EpicArtifacts {
    let path = PathBuf::from(&project_path);
    bmad_parser::get_epic_artifacts(&path, &epic_id)
}

/// Reads the content of an artifact file.
#[tauri::command]
fn read_artifact_file(file_path: String) -> Result<String, String> {
    bmad_parser::read_artifact_content(&file_path)
}

/// Gets epic titles from a project's epic files.
/// Parses YAML frontmatter from epic-*.md files (excluding retrospectives).
/// Returns a map of epic ID to title (e.g., "1" -> "Foundation").
#[tauri::command]
fn get_epic_titles(project_path: String) -> std::collections::HashMap<String, String> {
    let path = PathBuf::from(&project_path);
    bmad_parser::epic_parser::parse_epic_titles(&path)
}

/// Gets story tasks from a story file.
/// Parses markdown task checkboxes to show task progress in the workflow dashboard.
#[tauri::command]
fn get_story_tasks(story_path: String) -> Option<bmad_parser::story_tasks::StoryTasks> {
    let path = PathBuf::from(&story_path);
    bmad_parser::story_tasks::parse_story_tasks(&path)
}

// Conflict detection Tauri commands

/// Gets conflict warnings for active stories in a project.
///
/// Parses story files to extract files_to_modify, then detects
/// overlapping files between the given active stories.
#[tauri::command]
fn get_story_conflicts(
    project_path: String,
    active_story_ids: Vec<String>,
) -> Vec<conflict_detection::ConflictWarning> {
    let path = PathBuf::from(&project_path);
    conflict_detection::get_story_conflicts(&path, &active_story_ids)
}

/// Opens a file in the user's configured IDE.
///
/// Uses the ide_command from settings (e.g., "code .", "cursor .").
/// Replaces "." with the file path.
#[tauri::command]
async fn open_in_ide(file_path: String) -> Result<(), String> {
    let settings = settings::get_settings().map_err(|e| e.to_string())?;
    let ide_command = settings.tools.ide_command;

    // Parse the IDE command (e.g., "code ." or "cursor .")
    let parts: Vec<&str> = ide_command.split_whitespace().collect();
    if parts.is_empty() {
        return Err("IDE command not configured".to_string());
    }

    let program = parts[0];

    // Build arguments - replace "." with the file path
    let args: Vec<&str> = parts[1..]
        .iter()
        .map(|&arg| if arg == "." { file_path.as_str() } else { arg })
        .collect();

    // If no "." in args, append the file path
    let args = if parts.iter().any(|&p| p == ".") {
        args
    } else {
        let mut new_args = args;
        new_args.push(&file_path);
        new_args
    };

    std::process::Command::new(program)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to open IDE: {}", e))?;

    Ok(())
}

/// Opens a terminal at the specified directory path.
///
/// Uses platform-specific commands to open the system terminal.
#[tauri::command]
async fn open_in_terminal(dir_path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Terminal", &dir_path])
            .spawn()
            .map_err(|e| format!("Failed to open Terminal: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/K", &format!("cd /d \"{}\"", dir_path)])
            .spawn()
            .map_err(|e| format!("Failed to open Command Prompt: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators in order of preference
        let terminals = ["gnome-terminal", "konsole", "xterm"];
        let mut opened = false;

        for terminal in terminals {
            let result = match terminal {
                "gnome-terminal" => std::process::Command::new(terminal)
                    .args(["--working-directory", &dir_path])
                    .spawn(),
                "konsole" => std::process::Command::new(terminal)
                    .args(["--workdir", &dir_path])
                    .spawn(),
                _ => std::process::Command::new(terminal)
                    .current_dir(&dir_path)
                    .spawn(),
            };

            if result.is_ok() {
                opened = true;
                break;
            }
        }

        if !opened {
            return Err("No supported terminal emulator found".to_string());
        }
    }

    Ok(())
}

use tauri::Emitter;

// Settings Tauri commands

/// Gets the current application settings.
#[tauri::command]
fn get_settings() -> Result<settings::GlobalSettings, settings::SettingsError> {
    settings::get_settings()
}

/// Saves application settings.
#[tauri::command]
fn save_settings(settings_data: settings::GlobalSettings) -> Result<(), settings::SettingsError> {
    settings::save_settings(&settings_data)
}

/// Checks if the first-run wizard has been completed.
#[tauri::command]
fn is_wizard_completed() -> Result<bool, settings::SettingsError> {
    settings::is_wizard_completed()
}

/// Checks all required external dependencies.
#[tauri::command]
fn check_dependencies() -> Vec<settings::DependencyStatus> {
    settings::check_dependencies()
}

/// Gets project-specific settings from the project directory.
/// Returns default (empty) settings if no project settings file exists.
#[tauri::command]
fn get_project_settings(project_path: String) -> Result<settings::ProjectSettings, settings::SettingsError> {
    let path = PathBuf::from(&project_path);
    settings::get_project_settings(&path)
}

/// Saves project-specific settings to the project directory.
/// Creates the .bmad-manager directory if it doesn't exist.
#[tauri::command]
fn save_project_settings(project_path: String, settings_data: settings::ProjectSettings) -> Result<(), settings::SettingsError> {
    let path = PathBuf::from(&project_path);
    settings::save_project_settings(&path, &settings_data)
}

/// Gets effective settings by merging global and project-specific settings.
/// Project settings take precedence over global settings when present.
#[tauri::command]
fn get_effective_settings(project_path: String) -> Result<settings::EffectiveSettings, settings::SettingsError> {
    let path = PathBuf::from(&project_path);
    let global = settings::get_settings()?;
    let project = settings::get_project_settings(&path)?;
    Ok(settings::get_effective_settings(&global, &project))
}

// Session registry Tauri commands

/// Gets recent sessions across all projects.
#[tauri::command]
fn get_recent_sessions(limit: u32) -> Result<Vec<session_registry::SessionRecord>, session_registry::DbError> {
    session_registry::get_recent_sessions(limit)
}

/// Gets sessions for a specific project.
#[tauri::command]
fn get_sessions_for_project(project_path: String, limit: u32) -> Result<Vec<session_registry::SessionRecord>, session_registry::DbError> {
    session_registry::get_sessions_for_project(&project_path, limit)
}

/// Searches sessions by agent, workflow, or project name.
#[tauri::command]
fn search_sessions(query: String, limit: u32) -> Result<Vec<session_registry::SessionRecord>, session_registry::DbError> {
    session_registry::search_sessions(&query, limit)
}

/// Enhanced search with optional project filter and metadata.
/// Returns SearchResult with sessions, match count, and search time.
#[tauri::command]
fn search_sessions_enhanced(
    query: String,
    project_filter: Option<String>,
    limit: u32,
) -> Result<session_registry::SearchResult, session_registry::DbError> {
    session_registry::search_sessions_enhanced(&query, project_filter.as_deref(), limit)
}

/// Marks a session as resumed in the database.
#[tauri::command]
fn resume_session(session_id: String) -> Result<bool, session_registry::DbError> {
    session_registry::resume_session(&session_id)
}

// Multi-window management commands

/// Sanitizes a project path into a valid window label.
/// Window labels can only contain alphanumeric characters, `-`, `/`, `:`, and `_`.
fn sanitize_window_label(path: &str) -> String {
    path.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// Extracts the project name from a path for use in window title.
fn project_name_from_path(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Project")
        .to_string()
}

/// Opens a new window for the specified project path.
///
/// If a window already exists for this project, focuses it instead.
/// Returns the window label.
#[tauri::command]
async fn open_project_window(
    project_path: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    let window_label = format!("project-{}", sanitize_window_label(&project_path));

    // Check if window already exists
    if let Some(window) = app_handle.get_webview_window(&window_label) {
        // Focus existing window
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(window_label);
    }

    // Build URL with project path parameter
    // Use root path "/" - works with both dev server and production build
    let url = format!("/?project={}", urlencoding::encode(&project_path));

    let project_name = project_name_from_path(&project_path);

    WebviewWindowBuilder::new(
        &app_handle,
        &window_label,
        WebviewUrl::App(url.into()),
    )
    .title(format!("BMAD Manager - {}", project_name))
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(window_label)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize session database on startup
    if let Err(e) = session_registry::init_session_db() {
        eprintln!("Warning: Failed to initialize session database: {}", e);
        // Continue running - session history won't be available but app should work
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(file_watcher::WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            project::open_project,
            project::get_project_state,
            project::refresh_project,
            process_manager::spawn_claude_session,
            process_manager::session_input,
            process_manager::terminate_session,
            process_manager::list_active_sessions,
            process_manager::resize_session,
            initializer::initialize_project,
            initializer::init_git_only,
            initializer::init_bmad_only,
            get_recent_sessions,
            get_sessions_for_project,
            search_sessions,
            search_sessions_enhanced,
            resume_session,
            get_settings,
            save_settings,
            is_wizard_completed,
            check_dependencies,
            get_project_settings,
            save_project_settings,
            get_effective_settings,
            get_artifacts,
            get_workflow_state,
            get_workflows,
            get_sprint_status,
            list_project_artifacts,
            get_story_artifact,
            get_epic_artifact,
            get_epic_artifacts,
            read_artifact_file,
            get_epic_titles,
            get_story_tasks,
            open_in_ide,
            open_in_terminal,
            get_story_conflicts,
            file_watcher::start_file_watcher,
            file_watcher::stop_file_watcher,
            worktree::commands::create_worktree,
            worktree::commands::list_worktrees,
            worktree::commands::get_worktree_for_story,
            worktree::commands::is_worktree_dirty,
            worktree::commands::get_worktree_binding,
            worktree::commands::get_all_worktree_bindings,
            worktree::commands::validate_worktree_bindings,
            worktree::commands::get_current_worktree_story_id,
            worktree::commands::cleanup_worktree,
            worktree::commands::get_dirty_files,
            worktree::commands::get_main_repo_branch,
            worktree::commands::check_worktree_merge_conflicts,
            worktree::commands::merge_worktree_branch,
            worktree::commands::cleanup_after_merge,
            open_project_window,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Check for active sessions using Tauri's async runtime
                // This is safe to call from the main thread event handler
                let active_count =
                    tauri::async_runtime::block_on(process_manager::get_active_session_count());

                if active_count > 0 {
                    // Prevent the close and emit an event to the frontend
                    api.prevent_close();
                    let _ = window.emit(
                        "close-warning",
                        serde_json::json!({
                            "activeSessionCount": active_count
                        }),
                    );
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_window_label_simple() {
        let result = sanitize_window_label("/Users/test/project");
        assert_eq!(result, "_Users_test_project");
    }

    #[test]
    fn test_sanitize_window_label_preserves_alphanumeric() {
        let result = sanitize_window_label("abc123XYZ");
        assert_eq!(result, "abc123XYZ");
    }

    #[test]
    fn test_sanitize_window_label_preserves_dash_and_underscore() {
        let result = sanitize_window_label("my-project_name");
        assert_eq!(result, "my-project_name");
    }

    #[test]
    fn test_sanitize_window_label_replaces_special_chars() {
        let result = sanitize_window_label("/path/with spaces/and.dots");
        assert_eq!(result, "_path_with_spaces_and_dots");
    }

    #[test]
    fn test_project_name_from_path_simple() {
        let result = project_name_from_path("/Users/test/my-project");
        assert_eq!(result, "my-project");
    }

    #[test]
    fn test_project_name_from_path_trailing_slash() {
        // PathBuf handles trailing slashes by ignoring them
        let result = project_name_from_path("/Users/test/project/");
        // This might be empty string due to trailing slash, but parent should work
        // Actually PathBuf handles this - let's verify
        assert!(!result.is_empty());
    }

    #[test]
    fn test_project_name_from_path_fallback() {
        // Root path has no file_name
        let result = project_name_from_path("/");
        assert_eq!(result, "Project");
    }

    #[test]
    fn test_project_name_from_path_worktree() {
        let result = project_name_from_path("/Users/test/bmad_manager-wt-3-4");
        assert_eq!(result, "bmad_manager-wt-3-4");
    }
}
