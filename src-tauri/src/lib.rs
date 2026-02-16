// BMAD Manager - Tauri Backend

mod bmad_parser;
mod process_manager;
mod project;

pub use process_manager::get_active_session_count;

use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
