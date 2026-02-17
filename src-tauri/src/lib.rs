// BMAD Manager - Tauri Backend

mod bmad_parser;
mod initializer;
mod process_manager;
mod project;
mod session_registry;
mod settings;

pub use process_manager::get_active_session_count;

use std::path::PathBuf;

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

/// Marks a session as resumed in the database.
#[tauri::command]
fn resume_session(session_id: String) -> Result<bool, session_registry::DbError> {
    session_registry::resume_session(&session_id)
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
            resume_session,
            get_settings,
            save_settings,
            is_wizard_completed,
            check_dependencies,
            get_artifacts,
            get_workflow_state,
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
