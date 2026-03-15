//! Process manager module for Claude CLI sessions.
//!
//! This module handles spawning, managing, and terminating Claude CLI
//! sessions running in pseudo-terminals (PTY).

mod pty;
mod session;

pub use pty::{is_claude_cli_available, PtyManager};
pub use session::{ClaudeSession, SessionStatus, SpawnOptions};

use crate::session_registry;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Window};
use thiserror::Error;
use tokio::sync::RwLock;

/// Global session registry
static SESSIONS: std::sync::OnceLock<Arc<RwLock<SessionRegistry>>> = std::sync::OnceLock::new();

/// Debounce interval for updating last_active in the database (milliseconds).
/// We don't need sub-second precision for session tracking.
const LAST_ACTIVE_UPDATE_INTERVAL_MS: u64 = 5000;

/// Registry of active Claude sessions.
struct SessionRegistry {
    sessions: HashMap<String, ActiveSession>,
}

/// An active session with its PTY manager and metadata.
struct ActiveSession {
    session: ClaudeSession,
    pty: Arc<PtyManager>,
    /// Last time we updated the database (for debouncing).
    last_db_update: AtomicU64,
}

impl SessionRegistry {
    fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }
}

fn get_registry() -> &'static Arc<RwLock<SessionRegistry>> {
    SESSIONS.get_or_init(|| Arc::new(RwLock::new(SessionRegistry::new())))
}

/// Extracts the agent name from a session name.
/// Session name format: bmad-{project}-{agent}-{YYYYMMDD-HHmmss}
/// Timestamp is always 15 chars, so we parse from the end to handle project names with dashes.
fn extract_agent_from_session_name(session_name: &str) -> String {
    // Remove "bmad-" prefix
    let without_prefix = session_name.strip_prefix("bmad-").unwrap_or(session_name);

    // Timestamp is last 15 chars (YYYYMMDD-HHmmss) plus the dash before it
    // So we need to remove the last 16 chars to get "{project}-{agent}"
    if without_prefix.len() > 16 {
        let without_timestamp = &without_prefix[..without_prefix.len() - 16];
        // Agent is the last segment before timestamp
        without_timestamp
            .rsplit('-')
            .next()
            .unwrap_or("unknown")
            .to_string()
    } else {
        "unknown".to_string()
    }
}

/// Errors that can occur during process management.
#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code")]
    ClaudeNotFound,

    #[error("Failed to create PTY: {0}")]
    PtyCreationFailed(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session already terminated: {0}")]
    SessionAlreadyTerminated(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl serde::Serialize for ProcessError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Spawns a new Claude CLI session in a PTY.
///
/// This command creates a new PTY, spawns the Claude CLI, and sets up
/// output streaming via Tauri events.
#[tauri::command]
pub async fn spawn_claude_session(
    options: SpawnOptions,
    window: Window,
) -> Result<ClaudeSession, ProcessError> {
    // Check if Claude CLI is available
    if !is_claude_cli_available() {
        return Err(ProcessError::ClaudeNotFound);
    }

    // Determine Claude session UUID:
    // - For resume: use the provided claude_session_id
    // - For new sessions: generate a new UUID
    let claude_session_id = options
        .claude_session_id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // Build claude command arguments
    let mut args: Vec<String> = if options.resume {
        // Resume existing session by UUID
        vec!["--resume".to_string(), claude_session_id.clone()]
    } else {
        // New session with specified UUID
        vec!["--session-id".to_string(), claude_session_id.clone()]
    };

    // Add initial command as prompt argument if provided
    if let Some(ref cmd) = options.initial_command {
        args.push(cmd.clone());
    }

    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    // Spawn the PTY
    let pty = PtyManager::spawn("claude", &args_refs, &options.project_path, &[])?;
    let pty = Arc::new(pty);

    // Extract agent name from session name (format: bmad-{project}-{agent}-{YYYYMMDD-HHmmss})
    // Parse from the end since project names may contain dashes
    // Timestamp is always 15 chars: YYYYMMDD-HHmmss
    let agent = extract_agent_from_session_name(&options.session_name);

    // Create session metadata
    let session = ClaudeSession::new(&options, agent, claude_session_id.clone());
    let session_id = session.id.clone();

    // Store in registry
    {
        let mut registry = get_registry().write().await;
        registry.sessions.insert(
            session_id.clone(),
            ActiveSession {
                session: session.clone(),
                pty: Arc::clone(&pty),
                last_db_update: AtomicU64::new(0),
            },
        );
    }

    // Persist session to database
    if options.resume {
        // For resumed sessions, update the database to mark as active with new resumed_at
        // This is done atomically in backend to avoid tight coupling with frontend
        match session_registry::resume_session(&session.id) {
            Ok(true) => {
                // Session successfully marked as resumed in database
            }
            Ok(false) => {
                // Session ID not found in database - this can happen if the session
                // was created before database persistence was added, or if the DB was cleared.
                // Log warning but continue - in-memory tracking still works.
                eprintln!(
                    "Warning: Session {} not found in database for resume tracking (may be a legacy session)",
                    session.id
                );
            }
            Err(e) => {
                eprintln!(
                    "Warning: Failed to mark session as resumed in database: {}",
                    e
                );
                // Continue - in-memory tracking still works
            }
        }
    } else {
        // For new sessions, create a new record
        let db_record = session_registry::SessionRecord {
            id: session.id.clone(),
            claude_session_id: session.claude_session_id.clone(),
            project_path: session.project_path.to_string_lossy().to_string(),
            agent: session.agent.clone(),
            workflow: session.workflow.clone(),
            started_at: session.started_at,
            last_active: session.started_at,
            status: session_registry::SessionStatus::Active,
            resumed_at: None,
        };
        if let Err(e) = session_registry::save_session(&db_record) {
            eprintln!("Warning: Failed to persist session to database: {}", e);
            // Continue - in-memory tracking still works
        }
    }

    // Spawn output reader task
    let reader_session_id = session_id.clone();
    let reader_pty = Arc::clone(&pty);
    let reader_window = window.clone();

    tokio::spawn(async move {
        output_reader_task(reader_session_id, reader_pty, reader_window).await;
    });

    Ok(session)
}

/// Background task that reads PTY output and emits events.
async fn output_reader_task(session_id: String, pty: Arc<PtyManager>, window: Window) {
    loop {
        match pty.read_output().await {
            Ok(data) if !data.is_empty() => {
                // Emit output event
                let _ = window.emit(
                    &format!("session-output-{}", session_id),
                    String::from_utf8_lossy(&data).to_string(),
                );

                // Update last_active in database (debounced)
                let now_ms = Utc::now().timestamp_millis() as u64;
                let should_update = {
                    let registry = get_registry().read().await;
                    if let Some(active) = registry.sessions.get(&session_id) {
                        let last_update = active.last_db_update.load(Ordering::Relaxed);
                        now_ms - last_update > LAST_ACTIVE_UPDATE_INTERVAL_MS
                    } else {
                        false
                    }
                };

                if should_update {
                    // Update the timestamp atomically
                    {
                        let registry = get_registry().read().await;
                        if let Some(active) = registry.sessions.get(&session_id) {
                            active.last_db_update.store(now_ms, Ordering::Relaxed);
                        }
                    }
                    // Update database (non-blocking to output processing)
                    let _ = session_registry::touch_session(&session_id);
                }
            }
            Ok(_) => {
                // Empty read - check if process exited
                if pty.is_process_exited().await {
                    let exit_code = pty.exit_status().await;

                    // Determine final status: if already Interrupted (user-terminated), keep it
                    // Otherwise, mark as Completed (natural exit)
                    let final_status = {
                        let mut registry = get_registry().write().await;
                        let status = if let Some(active) = registry.sessions.get_mut(&session_id) {
                            if active.session.status == SessionStatus::Interrupted {
                                // User terminated - keep as interrupted
                                SessionStatus::Interrupted
                            } else {
                                // Natural exit - mark as completed
                                active.session.status = SessionStatus::Completed;
                                SessionStatus::Completed
                            }
                        } else {
                            // Session not in registry (shouldn't happen), assume completed
                            SessionStatus::Completed
                        };
                        // Remove session from registry to prevent memory leak
                        registry.sessions.remove(&session_id);
                        status
                    };

                    // Update database with final status
                    let db_status = match final_status {
                        SessionStatus::Interrupted => session_registry::SessionStatus::Interrupted,
                        _ => session_registry::SessionStatus::Completed,
                    };
                    let _ = session_registry::update_session_status(&session_id, db_status);

                    // Emit exit event with correct status
                    let status_str = match final_status {
                        SessionStatus::Interrupted => "interrupted",
                        _ => "completed",
                    };
                    let _ = window.emit(
                        &format!("session-exited-{}", session_id),
                        serde_json::json!({
                            "status": status_str,
                            "exitCode": exit_code
                        }),
                    );
                    break;
                }
                // Small delay before next read attempt
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
            Err(e) => {
                // Error reading - session likely terminated
                // Log the error for debugging
                eprintln!("Session {} read error: {}", session_id, e);

                // Clean up the session from registry
                {
                    let mut registry = get_registry().write().await;
                    if let Some(active) = registry.sessions.get_mut(&session_id) {
                        active.session.status = SessionStatus::Interrupted;
                    }
                    registry.sessions.remove(&session_id);
                }

                // Update database with interrupted status
                let _ = session_registry::update_session_status(
                    &session_id,
                    session_registry::SessionStatus::Interrupted,
                );

                let _ = window.emit(
                    &format!("session-exited-{}", session_id),
                    serde_json::json!({ "status": "interrupted" }),
                );
                break;
            }
        }
    }
}

/// Sends input data to an active session.
#[tauri::command]
pub async fn session_input(session_id: String, data: String) -> Result<(), ProcessError> {
    let registry = get_registry().read().await;
    let active = registry
        .sessions
        .get(&session_id)
        .ok_or_else(|| ProcessError::SessionNotFound(session_id.clone()))?;

    if active.session.status != SessionStatus::Active {
        return Err(ProcessError::SessionAlreadyTerminated(session_id));
    }

    active.pty.write_input(data.as_bytes()).await
}

/// Terminates an active session.
///
/// Lock strategy: mark-kill-cleanup pattern.
/// We mark as Interrupted BEFORE killing so output_reader_task knows this was user-initiated.
#[tauri::command]
pub async fn terminate_session(session_id: String) -> Result<(), ProcessError> {
    // Phase 1: Mark as Interrupted and get PTY reference (write lock)
    // This MUST happen before kill so output_reader_task sees the correct status
    let pty = {
        let mut registry = get_registry().write().await;
        let active = registry
            .sessions
            .get_mut(&session_id)
            .ok_or_else(|| ProcessError::SessionNotFound(session_id.clone()))?;

        if active.session.status != SessionStatus::Active {
            return Err(ProcessError::SessionAlreadyTerminated(session_id.clone()));
        }

        // Mark as interrupted BEFORE killing - this signals to output_reader_task
        // that this was a user-initiated termination
        active.session.status = SessionStatus::Interrupted;

        Arc::clone(&active.pty)
    }; // Write lock released here

    // Phase 2: Kill PTY (slow operation, no lock held)
    pty.kill().await?;

    // Phase 3: Update database with interrupted status
    let _ = session_registry::update_session_status(
        &session_id,
        session_registry::SessionStatus::Interrupted,
    );

    Ok(())
}

/// Lists all active sessions.
#[tauri::command]
pub async fn list_active_sessions() -> Vec<ClaudeSession> {
    let registry = get_registry().read().await;
    registry
        .sessions
        .values()
        .filter(|a| a.session.status == SessionStatus::Active)
        .map(|a| a.session.clone())
        .collect()
}

/// Resizes the PTY for a session.
#[tauri::command]
pub async fn resize_session(session_id: String, rows: u16, cols: u16) -> Result<(), ProcessError> {
    let registry = get_registry().read().await;
    let active = registry
        .sessions
        .get(&session_id)
        .ok_or_else(|| ProcessError::SessionNotFound(session_id.clone()))?;

    if active.session.status != SessionStatus::Active {
        return Err(ProcessError::SessionAlreadyTerminated(session_id));
    }

    active.pty.resize(rows, cols).await
}

/// Gets the count of active sessions.
pub async fn get_active_session_count() -> usize {
    let registry = get_registry().read().await;
    registry
        .sessions
        .values()
        .filter(|a| a.session.status == SessionStatus::Active)
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_error_serialization() {
        let error = ProcessError::ClaudeNotFound;
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("Claude CLI not found"));
    }

    #[test]
    fn test_session_not_found_error() {
        let error = ProcessError::SessionNotFound("test-session".to_string());
        let msg = error.to_string();
        assert!(msg.contains("test-session"));
    }

    #[test]
    fn test_extract_agent_simple_project_name() {
        // Simple project name without dashes
        let session = "bmad-myproject-architect-20260216-143052";
        assert_eq!(extract_agent_from_session_name(session), "architect");
    }

    #[test]
    fn test_extract_agent_project_name_with_dashes() {
        // Project name with dashes: "my-cool-project"
        let session = "bmad-my-cool-project-developer-20260216-143052";
        assert_eq!(extract_agent_from_session_name(session), "developer");
    }

    #[test]
    fn test_extract_agent_complex_project_name() {
        // Very complex project name with multiple dashes
        let session = "bmad-my-super-cool-app-pm-20260216-143052";
        assert_eq!(extract_agent_from_session_name(session), "pm");
    }

    #[test]
    fn test_extract_agent_invalid_format() {
        // Invalid format should return "unknown"
        let session = "invalid";
        assert_eq!(extract_agent_from_session_name(session), "unknown");
    }

    #[tokio::test]
    async fn test_terminate_nonexistent_session() {
        // Terminating a non-existent session should return SessionNotFound
        let result = terminate_session("nonexistent-session-id".to_string()).await;
        assert!(result.is_err());
        match result {
            Err(ProcessError::SessionNotFound(id)) => {
                assert_eq!(id, "nonexistent-session-id");
            }
            _ => panic!("Expected SessionNotFound error"),
        }
    }

    #[tokio::test]
    async fn test_concurrent_terminate_no_deadlock() {
        // This test verifies that concurrent termination attempts don't deadlock.
        // We test with non-existent sessions since we can't easily create mock PTYs,
        // but this still exercises the lock acquisition patterns.
        use tokio::time::{timeout, Duration};

        let session_ids: Vec<String> = (0..5)
            .map(|i| format!("concurrent-test-session-{}", i))
            .collect();

        // Spawn concurrent termination attempts
        let handles: Vec<_> = session_ids
            .iter()
            .map(|id| {
                let id = id.clone();
                tokio::spawn(async move { terminate_session(id).await })
            })
            .collect();

        // All should complete within a reasonable time (no deadlock)
        // Using 5 seconds as a generous timeout
        let results = timeout(Duration::from_secs(5), async {
            let mut results = Vec::new();
            for handle in handles {
                results.push(handle.await);
            }
            results
        })
        .await;

        // Verify we didn't timeout (which would indicate a deadlock)
        assert!(
            results.is_ok(),
            "Concurrent terminations should complete without deadlock"
        );

        // All should have returned SessionNotFound (since sessions don't exist)
        let results = results.unwrap();
        for result in results {
            assert!(result.is_ok(), "tokio::spawn should not panic");
            let inner_result = result.unwrap();
            assert!(
                matches!(inner_result, Err(ProcessError::SessionNotFound(_))),
                "Expected SessionNotFound for non-existent session"
            );
        }
    }
}
