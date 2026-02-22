//! Database operations for session persistence.
//!
//! This module provides SQLite-based storage for session records,
//! enabling session persistence across app restarts.

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, Result as SqliteResult};
use std::path::Path;
use thiserror::Error;

/// Errors that can occur during database operations.
#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Query failed: {0}")]
    QueryFailed(String),

    #[error("Failed to create database directory: {0}")]
    DirectoryCreationFailed(String),
}

impl serde::Serialize for DbError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<rusqlite::Error> for DbError {
    fn from(err: rusqlite::Error) -> Self {
        DbError::QueryFailed(err.to_string())
    }
}

/// Status of a persisted session.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Completed,
    Interrupted,
}

impl SessionStatus {
    fn as_str(&self) -> &'static str {
        match self {
            SessionStatus::Active => "active",
            SessionStatus::Completed => "completed",
            SessionStatus::Interrupted => "interrupted",
        }
    }

    fn from_str(s: &str) -> Self {
        match s {
            "active" => SessionStatus::Active,
            "completed" => SessionStatus::Completed,
            "interrupted" => SessionStatus::Interrupted,
            _ => SessionStatus::Interrupted, // Default to interrupted for unknown
        }
    }
}

/// A session record stored in the database.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub id: String,
    /// Claude CLI's session UUID (used for --session-id and --resume)
    pub claude_session_id: String,
    pub project_path: String,
    pub agent: String,
    pub workflow: Option<String>,
    pub started_at: DateTime<Utc>,
    pub last_active: DateTime<Utc>,
    pub status: SessionStatus,
    /// When the session was last resumed (if ever)
    pub resumed_at: Option<DateTime<Utc>>,
}

/// Initializes the database at the given path.
///
/// Creates the sessions table if it doesn't exist.
pub fn init_db(path: &Path) -> Result<Connection, DbError> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| DbError::DirectoryCreationFailed(e.to_string()))?;
    }

    let conn =
        Connection::open(path).map_err(|e| DbError::ConnectionFailed(e.to_string()))?;

    // Create sessions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            claude_session_id TEXT NOT NULL,
            project_path TEXT NOT NULL,
            agent TEXT NOT NULL,
            workflow TEXT,
            started_at TEXT NOT NULL,
            last_active TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'interrupted')),
            resumed_at TEXT
        )",
        [],
    )?;

    // Migration: add columns if they don't exist (for existing databases)
    let _ = conn.execute("ALTER TABLE sessions ADD COLUMN resumed_at TEXT", []);
    let _ = conn.execute("ALTER TABLE sessions ADD COLUMN claude_session_id TEXT", []);
    // Backfill any null claude_session_id with the session id (won't be valid UUID but prevents nulls)
    let _ = conn.execute("UPDATE sessions SET claude_session_id = id WHERE claude_session_id IS NULL", []);

    // Create indexes for efficient queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active DESC)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)",
        [],
    )?;

    // Create worktree_bindings table for story-to-worktree associations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS worktree_bindings (
            story_id TEXT PRIMARY KEY,
            worktree_path TEXT NOT NULL UNIQUE,
            branch_name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_worktree_bindings_path ON worktree_bindings(worktree_path)",
        [],
    )?;

    Ok(conn)
}

/// Saves or updates a session record in the database.
pub fn save_session(conn: &Connection, session: &SessionRecord) -> Result<(), DbError> {
    conn.execute(
        "INSERT OR REPLACE INTO sessions (id, claude_session_id, project_path, agent, workflow, started_at, last_active, status, resumed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            session.id,
            session.claude_session_id,
            session.project_path,
            session.agent,
            session.workflow,
            session.started_at.to_rfc3339(),
            session.last_active.to_rfc3339(),
            session.status.as_str(),
            session.resumed_at.map(|dt| dt.to_rfc3339()),
        ],
    )?;
    Ok(())
}

/// Updates the status and last_active timestamp for a session.
pub fn update_session_status(
    conn: &Connection,
    id: &str,
    status: SessionStatus,
    last_active: DateTime<Utc>,
) -> Result<(), DbError> {
    conn.execute(
        "UPDATE sessions SET status = ?1, last_active = ?2 WHERE id = ?3",
        params![status.as_str(), last_active.to_rfc3339(), id],
    )?;
    Ok(())
}

/// Marks a session as resumed - updates status to active, sets resumed_at and last_active.
pub fn resume_session(conn: &Connection, id: &str) -> Result<bool, DbError> {
    let now = Utc::now();
    let rows_affected = conn.execute(
        "UPDATE sessions SET status = 'active', last_active = ?1, resumed_at = ?1 WHERE id = ?2",
        params![now.to_rfc3339(), id],
    )?;
    Ok(rows_affected > 0)
}

/// Gets sessions for a specific project, sorted by last_active descending.
pub fn get_sessions_for_project(
    conn: &Connection,
    project_path: &str,
    limit: u32,
) -> Result<Vec<SessionRecord>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, claude_session_id, project_path, agent, workflow, started_at, last_active, status, resumed_at
         FROM sessions
         WHERE project_path = ?1
         ORDER BY last_active DESC
         LIMIT ?2",
    )?;

    let sessions = stmt
        .query_map(params![project_path, limit], |row| {
            Ok(SessionRecord {
                id: row.get(0)?,
                claude_session_id: row.get(1)?,
                project_path: row.get(2)?,
                agent: row.get(3)?,
                workflow: row.get(4)?,
                started_at: parse_datetime(row.get::<_, String>(5)?),
                last_active: parse_datetime(row.get::<_, String>(6)?),
                status: SessionStatus::from_str(&row.get::<_, String>(7)?),
                resumed_at: row.get::<_, Option<String>>(8)?.map(parse_datetime),
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    Ok(sessions)
}

/// Gets recent sessions across all projects, sorted by last_active descending.
pub fn get_recent_sessions(conn: &Connection, limit: u32) -> Result<Vec<SessionRecord>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, claude_session_id, project_path, agent, workflow, started_at, last_active, status, resumed_at
         FROM sessions
         ORDER BY last_active DESC
         LIMIT ?1",
    )?;

    let sessions = stmt
        .query_map(params![limit], |row| {
            Ok(SessionRecord {
                id: row.get(0)?,
                claude_session_id: row.get(1)?,
                project_path: row.get(2)?,
                agent: row.get(3)?,
                workflow: row.get(4)?,
                started_at: parse_datetime(row.get::<_, String>(5)?),
                last_active: parse_datetime(row.get::<_, String>(6)?),
                status: SessionStatus::from_str(&row.get::<_, String>(7)?),
                resumed_at: row.get::<_, Option<String>>(8)?.map(parse_datetime),
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    Ok(sessions)
}

/// Searches sessions by agent, workflow, or project name.
pub fn search_sessions(
    conn: &Connection,
    query: &str,
    limit: u32,
) -> Result<Vec<SessionRecord>, DbError> {
    let search_pattern = format!("%{}%", query);

    let mut stmt = conn.prepare(
        "SELECT id, claude_session_id, project_path, agent, workflow, started_at, last_active, status, resumed_at
         FROM sessions
         WHERE agent LIKE ?1 OR workflow LIKE ?1 OR project_path LIKE ?1
         ORDER BY last_active DESC
         LIMIT ?2",
    )?;

    let sessions = stmt
        .query_map(params![search_pattern, limit], |row| {
            Ok(SessionRecord {
                id: row.get(0)?,
                claude_session_id: row.get(1)?,
                project_path: row.get(2)?,
                agent: row.get(3)?,
                workflow: row.get(4)?,
                started_at: parse_datetime(row.get::<_, String>(5)?),
                last_active: parse_datetime(row.get::<_, String>(6)?),
                status: SessionStatus::from_str(&row.get::<_, String>(7)?),
                resumed_at: row.get::<_, Option<String>>(8)?.map(parse_datetime),
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    Ok(sessions)
}

/// Marks all active sessions as interrupted.
/// Called on app startup to clean up stale sessions from previous runs.
pub fn mark_active_sessions_interrupted(conn: &Connection) -> Result<u64, DbError> {
    let count = conn.execute(
        "UPDATE sessions SET status = 'interrupted' WHERE status = 'active'",
        [],
    )?;
    Ok(count as u64)
}

/// Deletes sessions older than the specified number of days.
/// Returns the number of sessions deleted.
pub fn prune_old_sessions(conn: &Connection, older_than_days: u32) -> Result<u64, DbError> {
    let cutoff = Utc::now() - chrono::Duration::days(older_than_days as i64);
    let count = conn.execute(
        "DELETE FROM sessions WHERE last_active < ?1 AND status != 'active'",
        params![cutoff.to_rfc3339()],
    )?;
    Ok(count as u64)
}

/// Gets the total count of sessions in the database.
/// Reserved for future use (e.g., UI display of session count).
#[allow(dead_code)]
pub fn get_session_count(conn: &Connection) -> Result<u64, DbError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))?;
    Ok(count as u64)
}

/// Retrieves a single session by ID.
pub fn get_session_by_id(conn: &Connection, id: &str) -> Result<Option<SessionRecord>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, claude_session_id, project_path, agent, workflow, started_at, last_active, status, resumed_at
         FROM sessions
         WHERE id = ?1",
    )?;

    let session = stmt
        .query_row(params![id], |row| {
            Ok(SessionRecord {
                id: row.get(0)?,
                claude_session_id: row.get(1)?,
                project_path: row.get(2)?,
                agent: row.get(3)?,
                workflow: row.get(4)?,
                started_at: parse_datetime(row.get::<_, String>(5)?),
                last_active: parse_datetime(row.get::<_, String>(6)?),
                status: SessionStatus::from_str(&row.get::<_, String>(7)?),
                resumed_at: row.get::<_, Option<String>>(8)?.map(parse_datetime),
            })
        })
        .optional()?;

    Ok(session)
}

/// Parses a datetime string to DateTime<Utc>.
/// Falls back to current time if parsing fails, with a warning logged.
fn parse_datetime(s: String) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&s)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|e| {
            eprintln!("Warning: Failed to parse datetime '{}': {}. Using current time.", s, e);
            Utc::now()
        })
}

// ============================================================================
// Worktree Binding Operations
// ============================================================================

/// A stored binding between a story and its worktree.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeBinding {
    /// Story ID (primary key).
    pub story_id: String,
    /// Path to the worktree directory.
    pub worktree_path: String,
    /// Branch name.
    pub branch_name: String,
    /// When the binding was created.
    pub created_at: String,
}

/// Saves or updates a worktree binding in the database.
pub fn save_worktree_binding(conn: &Connection, binding: &WorktreeBinding) -> Result<(), DbError> {
    conn.execute(
        "INSERT OR REPLACE INTO worktree_bindings (story_id, worktree_path, branch_name, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            binding.story_id,
            binding.worktree_path,
            binding.branch_name,
            binding.created_at,
        ],
    )?;
    Ok(())
}

/// Gets a worktree binding by story ID.
pub fn get_worktree_binding(
    conn: &Connection,
    story_id: &str,
) -> Result<Option<WorktreeBinding>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT story_id, worktree_path, branch_name, created_at
         FROM worktree_bindings
         WHERE story_id = ?1",
    )?;

    let binding = stmt
        .query_row(params![story_id], |row| {
            Ok(WorktreeBinding {
                story_id: row.get(0)?,
                worktree_path: row.get(1)?,
                branch_name: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .optional()?;

    Ok(binding)
}

/// Gets all worktree bindings from the database.
pub fn get_all_worktree_bindings(conn: &Connection) -> Result<Vec<WorktreeBinding>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT story_id, worktree_path, branch_name, created_at
         FROM worktree_bindings
         ORDER BY created_at DESC",
    )?;

    let bindings = stmt
        .query_map([], |row| {
            Ok(WorktreeBinding {
                story_id: row.get(0)?,
                worktree_path: row.get(1)?,
                branch_name: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?
        .collect::<SqliteResult<Vec<_>>>()?;

    Ok(bindings)
}

/// Gets a worktree binding by worktree path.
/// Used by Story 3-6 (worktree cleanup) - not yet called externally.
#[allow(dead_code)]
pub fn get_worktree_binding_by_path(
    conn: &Connection,
    worktree_path: &str,
) -> Result<Option<WorktreeBinding>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT story_id, worktree_path, branch_name, created_at
         FROM worktree_bindings
         WHERE worktree_path = ?1",
    )?;

    let binding = stmt
        .query_row(params![worktree_path], |row| {
            Ok(WorktreeBinding {
                story_id: row.get(0)?,
                worktree_path: row.get(1)?,
                branch_name: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .optional()?;

    Ok(binding)
}

/// Removes a worktree binding by worktree path.
/// Returns true if a binding was removed.
/// Used by Story 3-6 (worktree cleanup) - not yet called externally.
#[allow(dead_code)]
pub fn remove_worktree_binding_by_path(conn: &Connection, worktree_path: &str) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "DELETE FROM worktree_bindings WHERE worktree_path = ?1",
        params![worktree_path],
    )?;
    Ok(rows_affected > 0)
}

/// Removes a worktree binding by story ID.
/// Returns true if a binding was removed.
/// Used by Story 3-6 (worktree cleanup) - not yet called externally.
#[allow(dead_code)]
pub fn remove_worktree_binding(conn: &Connection, story_id: &str) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "DELETE FROM worktree_bindings WHERE story_id = ?1",
        params![story_id],
    )?;
    Ok(rows_affected > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_test_db() -> (TempDir, Connection) {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let conn = init_db(&db_path).unwrap();
        (temp_dir, conn)
    }

    fn create_test_session(id: &str) -> SessionRecord {
        SessionRecord {
            id: id.to_string(),
            claude_session_id: uuid::Uuid::new_v4().to_string(),
            project_path: "/test/project".to_string(),
            agent: "architect".to_string(),
            workflow: Some("/bmad-create-prd".to_string()),
            started_at: Utc::now(),
            last_active: Utc::now(),
            status: SessionStatus::Active,
            resumed_at: None,
        }
    }

    #[test]
    fn test_init_db_creates_table() {
        let (_temp_dir, conn) = setup_test_db();

        // Verify table exists by querying it
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_save_and_retrieve_session() {
        let (_temp_dir, conn) = setup_test_db();

        let session = create_test_session("bmad-test-architect-20260216-143052");
        save_session(&conn, &session).unwrap();

        let retrieved = get_recent_sessions(&conn, 10).unwrap();
        assert_eq!(retrieved.len(), 1);
        assert_eq!(retrieved[0].id, session.id);
        assert_eq!(retrieved[0].agent, "architect");
    }

    #[test]
    fn test_update_session_status() {
        let (_temp_dir, conn) = setup_test_db();

        let session = create_test_session("bmad-test-architect-20260216-143052");
        save_session(&conn, &session).unwrap();

        update_session_status(&conn, &session.id, SessionStatus::Completed, Utc::now()).unwrap();

        let retrieved = get_session_by_id(&conn, &session.id).unwrap().unwrap();
        assert_eq!(retrieved.status, SessionStatus::Completed);
    }

    #[test]
    fn test_get_sessions_for_project() {
        let (_temp_dir, conn) = setup_test_db();

        // Create sessions for different projects
        let session1 = SessionRecord {
            id: "bmad-proj1-architect-20260216-143052".to_string(),
            claude_session_id: uuid::Uuid::new_v4().to_string(),
            project_path: "/project/one".to_string(),
            agent: "architect".to_string(),
            workflow: None,
            started_at: Utc::now(),
            last_active: Utc::now(),
            status: SessionStatus::Active,
            resumed_at: None,
        };

        let session2 = SessionRecord {
            id: "bmad-proj2-developer-20260216-143053".to_string(),
            claude_session_id: uuid::Uuid::new_v4().to_string(),
            project_path: "/project/two".to_string(),
            agent: "developer".to_string(),
            workflow: None,
            started_at: Utc::now(),
            last_active: Utc::now(),
            status: SessionStatus::Active,
            resumed_at: None,
        };

        save_session(&conn, &session1).unwrap();
        save_session(&conn, &session2).unwrap();

        let proj1_sessions = get_sessions_for_project(&conn, "/project/one", 10).unwrap();
        assert_eq!(proj1_sessions.len(), 1);
        assert_eq!(proj1_sessions[0].id, session1.id);
    }

    #[test]
    fn test_search_sessions() {
        let (_temp_dir, conn) = setup_test_db();

        let session1 = SessionRecord {
            id: "bmad-myproject-architect-20260216-143052".to_string(),
            claude_session_id: uuid::Uuid::new_v4().to_string(),
            project_path: "/my/project".to_string(),
            agent: "architect".to_string(),
            workflow: Some("/bmad-create-prd".to_string()),
            started_at: Utc::now(),
            last_active: Utc::now(),
            status: SessionStatus::Active,
            resumed_at: None,
        };

        let session2 = SessionRecord {
            id: "bmad-another-developer-20260216-143053".to_string(),
            claude_session_id: uuid::Uuid::new_v4().to_string(),
            project_path: "/another/project".to_string(),
            agent: "developer".to_string(),
            workflow: None,
            started_at: Utc::now(),
            last_active: Utc::now(),
            status: SessionStatus::Active,
            resumed_at: None,
        };

        save_session(&conn, &session1).unwrap();
        save_session(&conn, &session2).unwrap();

        // Search by agent
        let results = search_sessions(&conn, "architect", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].agent, "architect");

        // Search by workflow
        let results = search_sessions(&conn, "prd", 10).unwrap();
        assert_eq!(results.len(), 1);

        // Search by project path
        let results = search_sessions(&conn, "another", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].agent, "developer");
    }

    #[test]
    fn test_sessions_ordered_by_last_active() {
        let (_temp_dir, conn) = setup_test_db();

        // Create sessions with different timestamps
        let mut session1 = create_test_session("bmad-test-architect-20260216-143052");
        session1.last_active = Utc::now() - chrono::Duration::hours(2);

        let session2 = create_test_session("bmad-test-developer-20260216-143053");
        // session2 has current time as last_active

        save_session(&conn, &session1).unwrap();
        save_session(&conn, &session2).unwrap();

        let results = get_recent_sessions(&conn, 10).unwrap();
        assert_eq!(results.len(), 2);
        // Most recent should be first
        assert_eq!(results[0].id, session2.id);
        assert_eq!(results[1].id, session1.id);
    }

    #[test]
    fn test_session_status_serialization() {
        assert_eq!(SessionStatus::Active.as_str(), "active");
        assert_eq!(SessionStatus::Completed.as_str(), "completed");
        assert_eq!(SessionStatus::Interrupted.as_str(), "interrupted");

        assert_eq!(SessionStatus::from_str("active"), SessionStatus::Active);
        assert_eq!(
            SessionStatus::from_str("completed"),
            SessionStatus::Completed
        );
        assert_eq!(
            SessionStatus::from_str("interrupted"),
            SessionStatus::Interrupted
        );
        assert_eq!(
            SessionStatus::from_str("unknown"),
            SessionStatus::Interrupted
        );
    }

    #[test]
    fn test_resume_session() {
        let (_temp_dir, conn) = setup_test_db();

        // Create a completed session
        let mut session = create_test_session("bmad-test-architect-20260216-143052");
        session.status = SessionStatus::Completed;
        save_session(&conn, &session).unwrap();

        // Verify it's completed
        let retrieved = get_session_by_id(&conn, &session.id).unwrap().unwrap();
        assert_eq!(retrieved.status, SessionStatus::Completed);
        assert!(retrieved.resumed_at.is_none());

        // Resume the session
        let result = resume_session(&conn, &session.id).unwrap();
        assert!(result, "resume_session should return true for existing session");

        // Verify status changed to active and resumed_at is set
        let retrieved = get_session_by_id(&conn, &session.id).unwrap().unwrap();
        assert_eq!(retrieved.status, SessionStatus::Active);
        assert!(retrieved.resumed_at.is_some());
    }

    #[test]
    fn test_resume_nonexistent_session() {
        let (_temp_dir, conn) = setup_test_db();

        // Try to resume a session that doesn't exist
        let result = resume_session(&conn, "nonexistent-session-id").unwrap();
        assert!(!result, "resume_session should return false for nonexistent session");
    }

    #[test]
    fn test_mark_active_sessions_interrupted() {
        let (_temp_dir, conn) = setup_test_db();

        // Create multiple sessions with different statuses
        let session1 = create_test_session("bmad-test-active1-20260216-143052");
        let mut session2 = create_test_session("bmad-test-active2-20260216-143053");
        let mut session3 = create_test_session("bmad-test-completed-20260216-143054");
        session3.status = SessionStatus::Completed;

        save_session(&conn, &session1).unwrap();
        save_session(&conn, &session2).unwrap();
        save_session(&conn, &session3).unwrap();

        // Mark active sessions as interrupted
        let count = mark_active_sessions_interrupted(&conn).unwrap();
        assert_eq!(count, 2, "Should have marked 2 active sessions as interrupted");

        // Verify statuses
        let s1 = get_session_by_id(&conn, &session1.id).unwrap().unwrap();
        let s2 = get_session_by_id(&conn, &session2.id).unwrap().unwrap();
        let s3 = get_session_by_id(&conn, &session3.id).unwrap().unwrap();

        assert_eq!(s1.status, SessionStatus::Interrupted);
        assert_eq!(s2.status, SessionStatus::Interrupted);
        assert_eq!(s3.status, SessionStatus::Completed, "Completed session should remain completed");
    }

    #[test]
    fn test_prune_old_sessions() {
        let (_temp_dir, conn) = setup_test_db();

        // Create an old session (100 days ago)
        let mut old_session = create_test_session("bmad-test-old-20260101-100000");
        old_session.last_active = Utc::now() - chrono::Duration::days(100);
        old_session.status = SessionStatus::Completed;
        save_session(&conn, &old_session).unwrap();

        // Create a recent session
        let recent_session = create_test_session("bmad-test-recent-20260216-143052");
        save_session(&conn, &recent_session).unwrap();

        // Verify we have 2 sessions
        assert_eq!(get_session_count(&conn).unwrap(), 2);

        // Prune sessions older than 90 days
        let pruned = prune_old_sessions(&conn, 90).unwrap();
        assert_eq!(pruned, 1, "Should have pruned 1 old session");

        // Verify only recent session remains
        assert_eq!(get_session_count(&conn).unwrap(), 1);
        let remaining = get_recent_sessions(&conn, 10).unwrap();
        assert_eq!(remaining[0].id, recent_session.id);
    }

    #[test]
    fn test_prune_does_not_delete_active_sessions() {
        let (_temp_dir, conn) = setup_test_db();

        // Create an old but still active session
        let mut old_active = create_test_session("bmad-test-old-active-20260101-100000");
        old_active.last_active = Utc::now() - chrono::Duration::days(100);
        old_active.status = SessionStatus::Active; // Still active!
        save_session(&conn, &old_active).unwrap();

        // Try to prune
        let pruned = prune_old_sessions(&conn, 90).unwrap();
        assert_eq!(pruned, 0, "Should not prune active sessions");

        // Session should still exist
        assert_eq!(get_session_count(&conn).unwrap(), 1);
    }

    // ========================================================================
    // Worktree Binding Tests
    // ========================================================================

    fn create_test_binding(story_id: &str) -> WorktreeBinding {
        WorktreeBinding {
            story_id: story_id.to_string(),
            worktree_path: format!("/test/project-wt-{}", story_id),
            branch_name: format!("story/{}-test", story_id),
            created_at: Utc::now().to_rfc3339(),
        }
    }

    #[test]
    fn test_save_and_get_worktree_binding() {
        let (_temp_dir, conn) = setup_test_db();

        let binding = create_test_binding("3-3");
        save_worktree_binding(&conn, &binding).unwrap();

        let retrieved = get_worktree_binding(&conn, "3-3").unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.story_id, "3-3");
        assert_eq!(retrieved.worktree_path, "/test/project-wt-3-3");
        assert_eq!(retrieved.branch_name, "story/3-3-test");
    }

    #[test]
    fn test_get_worktree_binding_not_found() {
        let (_temp_dir, conn) = setup_test_db();

        let result = get_worktree_binding(&conn, "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_get_all_worktree_bindings() {
        let (_temp_dir, conn) = setup_test_db();

        let binding1 = create_test_binding("1-1");
        let binding2 = create_test_binding("2-2");
        save_worktree_binding(&conn, &binding1).unwrap();
        save_worktree_binding(&conn, &binding2).unwrap();

        let all = get_all_worktree_bindings(&conn).unwrap();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_get_worktree_binding_by_path() {
        let (_temp_dir, conn) = setup_test_db();

        let binding = create_test_binding("3-3");
        save_worktree_binding(&conn, &binding).unwrap();

        let retrieved = get_worktree_binding_by_path(&conn, "/test/project-wt-3-3").unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().story_id, "3-3");
    }

    #[test]
    fn test_remove_worktree_binding_by_path() {
        let (_temp_dir, conn) = setup_test_db();

        let binding = create_test_binding("3-3");
        save_worktree_binding(&conn, &binding).unwrap();

        let removed = remove_worktree_binding_by_path(&conn, "/test/project-wt-3-3").unwrap();
        assert!(removed);

        let retrieved = get_worktree_binding(&conn, "3-3").unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_remove_worktree_binding() {
        let (_temp_dir, conn) = setup_test_db();

        let binding = create_test_binding("3-3");
        save_worktree_binding(&conn, &binding).unwrap();

        let removed = remove_worktree_binding(&conn, "3-3").unwrap();
        assert!(removed);

        let retrieved = get_worktree_binding(&conn, "3-3").unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_worktree_binding_update() {
        let (_temp_dir, conn) = setup_test_db();

        let binding = create_test_binding("3-3");
        save_worktree_binding(&conn, &binding).unwrap();

        // Update with same story_id but different path
        let updated = WorktreeBinding {
            story_id: "3-3".to_string(),
            worktree_path: "/new/path".to_string(),
            branch_name: "story/3-3-updated".to_string(),
            created_at: Utc::now().to_rfc3339(),
        };
        save_worktree_binding(&conn, &updated).unwrap();

        let retrieved = get_worktree_binding(&conn, "3-3").unwrap().unwrap();
        assert_eq!(retrieved.worktree_path, "/new/path");
        assert_eq!(retrieved.branch_name, "story/3-3-updated");
    }
}
