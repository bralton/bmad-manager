//! Session data structures and state management for Claude CLI sessions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Status of a Claude session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    /// Session is actively running.
    Active,
    /// Session completed normally.
    Completed,
    /// Session was interrupted or terminated.
    Interrupted,
}

/// Options for spawning a new Claude CLI session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnOptions {
    /// Session name for Claude CLI (e.g., "bmad-myproject-architect-20260216-143052")
    pub session_name: String,
    /// Path to the project directory
    pub project_path: PathBuf,
    /// Optional initial command to run (e.g., "/bmad-create-prd")
    pub initial_command: Option<String>,
    /// Whether to resume an existing session
    pub resume: bool,
}

/// Represents an active or completed Claude session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSession {
    /// Unique session identifier
    pub id: String,
    /// Path to the project directory
    pub project_path: PathBuf,
    /// Agent name that spawned this session
    pub agent: String,
    /// Optional workflow being executed
    pub workflow: Option<String>,
    /// When the session started
    pub started_at: DateTime<Utc>,
    /// Current session status
    pub status: SessionStatus,
}

impl ClaudeSession {
    /// Creates a new Claude session from spawn options.
    pub fn new(options: &SpawnOptions, agent: String) -> Self {
        Self {
            id: options.session_name.clone(),
            project_path: options.project_path.clone(),
            agent,
            workflow: options.initial_command.clone(),
            started_at: Utc::now(),
            status: SessionStatus::Active,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spawn_options_serialization() {
        let options = SpawnOptions {
            session_name: "bmad-test-architect-20260216-143052".to_string(),
            project_path: PathBuf::from("/path/to/project"),
            initial_command: Some("/bmad-create-prd".to_string()),
            resume: false,
        };

        let json = serde_json::to_string(&options).unwrap();
        assert!(json.contains("sessionName"));
        assert!(json.contains("projectPath"));
        assert!(json.contains("initialCommand"));

        let deserialized: SpawnOptions = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.session_name, options.session_name);
    }

    #[test]
    fn test_session_status_serialization() {
        let status = SessionStatus::Active;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"active\"");

        let completed = SessionStatus::Completed;
        let json = serde_json::to_string(&completed).unwrap();
        assert_eq!(json, "\"completed\"");
    }

    #[test]
    fn test_claude_session_creation() {
        let options = SpawnOptions {
            session_name: "bmad-test-dev-20260216-150000".to_string(),
            project_path: PathBuf::from("/test/project"),
            initial_command: None,
            resume: false,
        };

        let session = ClaudeSession::new(&options, "developer".to_string());

        assert_eq!(session.id, "bmad-test-dev-20260216-150000");
        assert_eq!(session.agent, "developer");
        assert_eq!(session.status, SessionStatus::Active);
        assert!(session.workflow.is_none());
    }
}
