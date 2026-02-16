// BMAD Manager - Tauri Backend

mod project;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            project::open_project,
            project::get_project_state,
            project::refresh_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
