//! Session registry module for persistent session storage.
//!
//! This module provides SQLite-based persistence for Claude CLI sessions,
//! enabling users to view and resume historical sessions across app restarts.

mod db;

pub use db::{DbError, SearchResult, SessionRecord, SessionStatus, WorktreeBinding};

use chrono::Utc;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

/// Global session database instance.
static SESSION_DB: OnceLock<SessionDb> = OnceLock::new();

/// Wrapper around the SQLite connection providing thread-safe access.
pub struct SessionDb {
    conn: Mutex<Connection>,
}

impl SessionDb {
    /// Creates a new SessionDb with a connection to the given path.
    fn new(path: &Path) -> Result<Self, DbError> {
        let conn = db::init_db(path)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

/// Gets the path to the session database.
/// Returns an error if the home directory cannot be determined.
fn get_db_path() -> Result<PathBuf, DbError> {
    let home = dirs::home_dir().ok_or_else(|| {
        DbError::DirectoryCreationFailed("Could not determine home directory".to_string())
    })?;
    Ok(home.join(".bmad-manager").join("sessions.db"))
}

/// Maximum age of sessions to keep (in days).
/// Sessions older than this will be pruned on startup.
const SESSION_MAX_AGE_DAYS: u32 = 90;

/// Initializes the global session database.
///
/// This should be called once at app startup.
/// Cleans up any stale "active" sessions from previous runs.
/// Prunes sessions older than SESSION_MAX_AGE_DAYS.
pub fn init_session_db() -> Result<(), DbError> {
    let db_path = get_db_path()?;
    let db = SessionDb::new(&db_path)?;

    // Clean up stale active sessions from previous app runs
    {
        let conn = db.conn.lock().unwrap();
        let count = db::mark_active_sessions_interrupted(&conn)?;
        if count > 0 {
            eprintln!(
                "Cleaned up {} stale active sessions from previous run",
                count
            );
        }

        // Prune old sessions to prevent unbounded database growth
        let pruned = db::prune_old_sessions(&conn, SESSION_MAX_AGE_DAYS)?;
        if pruned > 0 {
            eprintln!(
                "Pruned {} sessions older than {} days",
                pruned, SESSION_MAX_AGE_DAYS
            );
        }
    }

    SESSION_DB
        .set(db)
        .map_err(|_| DbError::ConnectionFailed("Session DB already initialized".to_string()))?;
    Ok(())
}

/// Gets a reference to the global session database.
fn get_db() -> Result<&'static SessionDb, DbError> {
    SESSION_DB
        .get()
        .ok_or_else(|| DbError::ConnectionFailed("Session DB not initialized".to_string()))
}

/// Saves a session to the database.
pub fn save_session(session: &SessionRecord) -> Result<(), DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::save_session(&conn, session)
}

/// Updates the status and last_active timestamp for a session.
pub fn update_session_status(id: &str, status: SessionStatus) -> Result<(), DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::update_session_status(&conn, id, status, Utc::now())
}

/// Gets sessions for a specific project.
pub fn get_sessions_for_project(
    project_path: &str,
    limit: u32,
) -> Result<Vec<SessionRecord>, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::get_sessions_for_project(&conn, project_path, limit)
}

/// Gets recent sessions across all projects.
pub fn get_recent_sessions(limit: u32) -> Result<Vec<SessionRecord>, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::get_recent_sessions(&conn, limit)
}

/// Searches sessions by agent, workflow, or project name.
pub fn search_sessions(query: &str, limit: u32) -> Result<Vec<SessionRecord>, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::fts_search_sessions(&conn, query, limit)
}

/// Enhanced search with optional project filter and metadata.
pub fn search_sessions_enhanced(
    query: &str,
    project_filter: Option<&str>,
    limit: u32,
) -> Result<SearchResult, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::search_sessions_enhanced(&conn, query, project_filter, limit)
}

/// Updates the last_active timestamp for a session.
pub fn touch_session(id: &str) -> Result<(), DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    // Get current status and update with new timestamp
    if let Some(session) = db::get_session_by_id(&conn, id)? {
        db::update_session_status(&conn, id, session.status, Utc::now())
    } else {
        Ok(()) // Session not found, nothing to update
    }
}

/// Marks a session as resumed - updates status to active, sets resumed_at.
/// Returns true if the session was found and updated.
pub fn resume_session(id: &str) -> Result<bool, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::resume_session(&conn, id)
}

// ============================================================================
// Worktree Binding Functions
// ============================================================================

/// Saves a worktree binding to the database.
pub fn save_worktree_binding(binding: &WorktreeBinding) -> Result<(), DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::save_worktree_binding(&conn, binding)
}

/// Gets a worktree binding by story ID.
pub fn get_worktree_binding(story_id: &str) -> Result<Option<WorktreeBinding>, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::get_worktree_binding(&conn, story_id)
}

/// Gets all worktree bindings from the database.
pub fn get_all_worktree_bindings() -> Result<Vec<WorktreeBinding>, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::get_all_worktree_bindings(&conn)
}

/// Gets a worktree binding by worktree path.
/// Used by Story 3-6 (worktree cleanup) - not yet called externally.
#[allow(dead_code)]
pub fn get_worktree_binding_by_path(
    worktree_path: &str,
) -> Result<Option<WorktreeBinding>, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::get_worktree_binding_by_path(&conn, worktree_path)
}

/// Removes a worktree binding by worktree path.
/// Returns true if a binding was removed.
/// Removes a worktree binding by path.
/// Returns true if a binding was removed.
pub fn remove_worktree_binding_by_path(worktree_path: &str) -> Result<bool, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::remove_worktree_binding_by_path(&conn, worktree_path)
}

/// Removes a worktree binding by story ID.
/// Returns true if a binding was removed.
pub fn remove_worktree_binding(story_id: &str) -> Result<bool, DbError> {
    let db = get_db()?;
    let conn = db.conn.lock().unwrap();
    db::remove_worktree_binding(&conn, story_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_db_path() {
        let path = get_db_path().expect("Should be able to determine home directory in test");
        assert!(path.ends_with("sessions.db"));
        assert!(path.to_string_lossy().contains(".bmad-manager"));
    }
}
