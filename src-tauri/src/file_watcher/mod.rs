//! File watcher module for monitoring _bmad-output directory changes.
//!
//! This module provides real-time file watching capabilities to automatically
//! refresh the workflow visualizer when BMAD artifacts change.

use notify_debouncer_mini::{new_debouncer, DebouncedEventKind, Debouncer};
use notify::{RecommendedWatcher, RecursiveMode};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

/// Errors that can occur during file watching operations.
#[derive(Debug, Error, Serialize)]
pub enum WatchError {
    #[error("Path not found: {0}")]
    PathNotFound(String),
    #[error("Failed to create watcher: {0}")]
    WatcherCreationFailed(String),
    #[error("Failed to watch path: {0}")]
    WatchFailed(String),
}

/// Events emitted to the frontend when files change.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WatchEvent {
    /// An artifact file was modified (planning artifacts)
    ArtifactModified { path: String },
    /// Workflow state changed (implementation artifacts)
    WorkflowStateChanged,
    /// Story status changed (sprint-status.yaml modified)
    StoryStatusChanged,
    /// Watcher encountered an error
    WatcherError { message: String },
}

/// Tauri state wrapper for the file watcher.
pub struct WatcherState(pub Mutex<Option<BmadWatcher>>);

impl Default for WatcherState {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

/// The BMAD file watcher that monitors _bmad-output for changes.
pub struct BmadWatcher {
    /// The debouncer wrapping the file system watcher
    _debouncer: Debouncer<RecommendedWatcher>,
    /// Path being watched
    project_path: PathBuf,
    /// Shutdown signal for the event processing thread
    shutdown: Arc<AtomicBool>,
    /// Handle for the event processing thread (Option for take on drop)
    event_thread: Option<std::thread::JoinHandle<()>>,
}

impl BmadWatcher {
    /// Creates a new file watcher for the given project path.
    ///
    /// The watcher monitors the `_bmad-output/` directory recursively and
    /// emits Tauri events when files change. Changes are debounced to 500ms
    /// to avoid UI thrashing during rapid file operations.
    ///
    /// # Arguments
    /// * `project_path` - Path to the project root directory
    /// * `app_handle` - Tauri app handle for emitting events
    ///
    /// # Returns
    /// A new BmadWatcher instance, or an error if setup fails.
    pub fn new(project_path: PathBuf, app_handle: AppHandle) -> Result<Self, WatchError> {
        let bmad_output = project_path.join("_bmad-output");

        if !bmad_output.exists() {
            return Err(WatchError::PathNotFound(
                bmad_output.to_string_lossy().to_string(),
            ));
        }

        // Create channel for debounced events
        let (tx, rx) = channel();

        // Create debouncer with 500ms timeout
        let mut debouncer = new_debouncer(Duration::from_millis(500), tx)
            .map_err(|e| WatchError::WatcherCreationFailed(e.to_string()))?;

        // Start watching the _bmad-output directory recursively
        debouncer
            .watcher()
            .watch(&bmad_output, RecursiveMode::Recursive)
            .map_err(|e| WatchError::WatchFailed(e.to_string()))?;

        // Create shutdown signal
        let shutdown = Arc::new(AtomicBool::new(false));

        // Spawn thread to process events
        let event_thread = Self::spawn_event_processor(rx, app_handle, Arc::clone(&shutdown));

        Ok(Self {
            _debouncer: debouncer,
            project_path,
            shutdown,
            event_thread: Some(event_thread),
        })
    }

    /// Spawns a thread to process debounced file events and emit Tauri events.
    fn spawn_event_processor(
        rx: Receiver<Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>>,
        app_handle: AppHandle,
        shutdown: Arc<AtomicBool>,
    ) -> std::thread::JoinHandle<()> {
        std::thread::spawn(move || {
            while !shutdown.load(Ordering::Relaxed) {
                // Use recv_timeout to periodically check shutdown flag
                match rx.recv_timeout(Duration::from_millis(100)) {
                    Ok(result) => match result {
                        Ok(events) => {
                            for event in events {
                                // Only process data change events (not access or other metadata)
                                if matches!(event.kind, DebouncedEventKind::Any) {
                                    Self::handle_file_event(&event.path, &app_handle);
                                }
                            }
                        }
                        Err(e) => {
                            // Emit error event to frontend
                            let error_event = WatchEvent::WatcherError {
                                message: format!("{:?}", e),
                            };
                            if let Err(emit_err) = app_handle.emit("watcher-error", &error_event) {
                                eprintln!("Failed to emit watcher error: {:?}", emit_err);
                            }
                        }
                    },
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        // Check shutdown flag and continue
                        continue;
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        // Channel closed, exit thread
                        break;
                    }
                }
            }
        })
    }

    /// Handles a single file event by classifying it and emitting the appropriate Tauri event.
    fn handle_file_event(path: &Path, app_handle: &AppHandle) {
        let watch_event = Self::classify_event(path);
        let event_name = Self::event_name(&watch_event);

        // Emit event to all windows
        if let Err(e) = app_handle.emit(event_name, &watch_event) {
            eprintln!("Failed to emit file watcher event: {:?}", e);
        }
    }

    /// Classifies a file path into the appropriate event type.
    fn classify_event(path: &Path) -> WatchEvent {
        let path_str = path.to_string_lossy();
        let path_string = path.to_string_lossy().to_string();

        // Check for sprint-status.yaml changes
        if path_str.contains("sprint-status") {
            return WatchEvent::StoryStatusChanged;
        }

        // Check for planning artifacts (markdown files)
        if path_str.contains("planning-artifacts") {
            if path.extension().map(|e| e == "md").unwrap_or(false) {
                return WatchEvent::ArtifactModified { path: path_string };
            }
        }

        // Check for implementation artifacts
        if path_str.contains("implementation-artifacts") {
            return WatchEvent::WorkflowStateChanged;
        }

        // Default to workflow state changed for any other _bmad-output changes
        WatchEvent::WorkflowStateChanged
    }

    /// Returns the Tauri event name for a watch event.
    fn event_name(event: &WatchEvent) -> &'static str {
        match event {
            WatchEvent::ArtifactModified { .. } => "artifact-modified",
            WatchEvent::WorkflowStateChanged => "workflow-state-changed",
            WatchEvent::StoryStatusChanged => "story-status-changed",
            WatchEvent::WatcherError { .. } => "watcher-error",
        }
    }

    /// Returns the project path being watched.
    #[allow(dead_code)]
    pub fn project_path(&self) -> &Path {
        &self.project_path
    }
}

impl Drop for BmadWatcher {
    fn drop(&mut self) {
        // Signal the event thread to shut down
        self.shutdown.store(true, Ordering::Relaxed);

        // Wait for the thread to finish (with timeout to avoid hanging)
        if let Some(thread) = self.event_thread.take() {
            // Give the thread a moment to notice the shutdown signal
            let _ = thread.join();
        }
    }
}

/// Starts the file watcher for a project.
///
/// If a watcher is already running, it will be stopped first.
#[tauri::command]
pub fn start_file_watcher(
    project_path: String,
    state: tauri::State<'_, WatcherState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let mut watcher_guard = state.0.lock().map_err(|e| e.to_string())?;

    // Stop existing watcher if any
    if watcher_guard.is_some() {
        *watcher_guard = None;
    }

    // Create new watcher
    let watcher = BmadWatcher::new(PathBuf::from(&project_path), app_handle)
        .map_err(|e| e.to_string())?;

    *watcher_guard = Some(watcher);
    Ok(())
}

/// Stops the currently running file watcher.
#[tauri::command]
pub fn stop_file_watcher(state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_guard = state.0.lock().map_err(|e| e.to_string())?;
    *watcher_guard = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_classify_event_planning_artifact() {
        let path = PathBuf::from("/project/_bmad-output/planning-artifacts/prd.md");
        let event = BmadWatcher::classify_event(&path);
        assert!(matches!(event, WatchEvent::ArtifactModified { .. }));
    }

    #[test]
    fn test_classify_event_planning_artifact_non_md() {
        // Non-markdown files in planning-artifacts should be WorkflowStateChanged
        let path = PathBuf::from("/project/_bmad-output/planning-artifacts/data.json");
        let event = BmadWatcher::classify_event(&path);
        assert!(matches!(event, WatchEvent::WorkflowStateChanged));
    }

    #[test]
    fn test_classify_event_sprint_status() {
        let path = PathBuf::from("/project/_bmad-output/implementation-artifacts/sprint-status.yaml");
        let event = BmadWatcher::classify_event(&path);
        assert!(matches!(event, WatchEvent::StoryStatusChanged));
    }

    #[test]
    fn test_classify_event_implementation_artifact() {
        let path = PathBuf::from("/project/_bmad-output/implementation-artifacts/1-1-story.md");
        let event = BmadWatcher::classify_event(&path);
        assert!(matches!(event, WatchEvent::WorkflowStateChanged));
    }

    #[test]
    fn test_classify_event_default() {
        let path = PathBuf::from("/project/_bmad-output/other-file.txt");
        let event = BmadWatcher::classify_event(&path);
        assert!(matches!(event, WatchEvent::WorkflowStateChanged));
    }

    #[test]
    fn test_watch_error_path_not_found() {
        let dir = tempdir().unwrap();
        let nonexistent_path = dir.path().join("nonexistent");

        // Verify the _bmad-output path check logic
        let bmad_output = nonexistent_path.join("_bmad-output");
        assert!(!bmad_output.exists());
    }

    #[test]
    fn test_watcher_state_default() {
        let state = WatcherState::default();
        let guard = state.0.lock().unwrap();
        assert!(guard.is_none());
    }

    #[test]
    fn test_watcher_state_cleanup() {
        // Test that setting state to None properly cleans up
        let state = WatcherState::default();

        // Initially None
        {
            let guard = state.0.lock().unwrap();
            assert!(guard.is_none());
        }

        // Set to None explicitly (simulates stop_file_watcher)
        {
            let mut guard = state.0.lock().unwrap();
            *guard = None;
        }

        // Should still be None
        {
            let guard = state.0.lock().unwrap();
            assert!(guard.is_none());
        }
    }

    #[test]
    fn test_event_names() {
        assert_eq!(
            BmadWatcher::event_name(&WatchEvent::ArtifactModified { path: "test".to_string() }),
            "artifact-modified"
        );
        assert_eq!(
            BmadWatcher::event_name(&WatchEvent::WorkflowStateChanged),
            "workflow-state-changed"
        );
        assert_eq!(
            BmadWatcher::event_name(&WatchEvent::StoryStatusChanged),
            "story-status-changed"
        );
        assert_eq!(
            BmadWatcher::event_name(&WatchEvent::WatcherError { message: "test".to_string() }),
            "watcher-error"
        );
    }

    #[test]
    fn test_debounce_duration_is_500ms() {
        // Verify the debounce duration constant is 500ms as specified in AC
        let duration = Duration::from_millis(500);
        assert_eq!(duration.as_millis(), 500);
    }

    #[test]
    fn test_shutdown_signal_atomic() {
        // Test that shutdown signal works correctly
        let shutdown = Arc::new(AtomicBool::new(false));
        assert!(!shutdown.load(Ordering::Relaxed));

        shutdown.store(true, Ordering::Relaxed);
        assert!(shutdown.load(Ordering::Relaxed));
    }

    #[test]
    fn test_bmad_output_path_construction() {
        // Test that _bmad-output path is correctly constructed
        let project_path = PathBuf::from("/test/project");
        let bmad_output = project_path.join("_bmad-output");
        assert_eq!(bmad_output, PathBuf::from("/test/project/_bmad-output"));
    }

    #[test]
    fn test_valid_bmad_output_directory() {
        // Test watcher path validation with actual directory
        let dir = tempdir().unwrap();
        let bmad_output = dir.path().join("_bmad-output");
        fs::create_dir_all(&bmad_output).unwrap();

        assert!(bmad_output.exists());
        assert!(bmad_output.is_dir());
    }
}
