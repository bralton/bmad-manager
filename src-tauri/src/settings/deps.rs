//! Dependency detection for external tools.
//!
//! Checks for required external dependencies: Git, Node.js, and Claude CLI.

use serde::{Deserialize, Serialize};
use std::process::{Command, Output};

/// Status of an external dependency.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub install_command: Option<String>,
    pub min_version: Option<String>,
    pub version_ok: bool,
}

/// Runs a command and returns its output.
/// Handles cross-platform differences.
///
/// NOTE: The Windows fallback path (`cmd /C`) requires manual testing on Windows
/// before release, as it cannot be covered by CI running on Unix systems.
#[cfg(target_os = "windows")]
fn run_command(cmd: &str, args: &[&str]) -> std::io::Result<Output> {
    // Try direct first, fall back to cmd /C
    Command::new(cmd)
        .args(args)
        .output()
        .or_else(|_| Command::new("cmd").args(["/C", cmd]).args(args).output())
}

#[cfg(not(target_os = "windows"))]
fn run_command(cmd: &str, args: &[&str]) -> std::io::Result<Output> {
    Command::new(cmd).args(args).output()
}

/// Parses Git version from "git version X.Y.Z" format.
fn parse_git_version(output: &str) -> Option<String> {
    // "git version 2.39.0" -> "2.39.0"
    output
        .split_whitespace()
        .find(|s| s.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false))
        .map(|s| s.to_string())
}

/// Parses Node version from "vX.Y.Z" format.
fn parse_node_version(output: &str) -> Option<String> {
    // "v20.1.0" -> "20.1.0"
    output.trim().strip_prefix('v').map(|s| s.to_string())
}

/// Checks if Node version meets minimum requirement (>= 18).
fn check_node_version_ok(version: &str) -> bool {
    version
        .split('.')
        .next()
        .and_then(|major| major.parse::<u32>().ok())
        .map(|major| major >= 18)
        .unwrap_or(false)
}

/// Parses Claude CLI version from output.
fn parse_claude_version(output: &str) -> Option<String> {
    // Claude CLI may output "claude-code X.Y.Z" or just "X.Y.Z" or other formats
    // Try to find a version-like pattern
    output
        .split_whitespace()
        .find(|s| {
            let first_char = s.chars().next();
            first_char.map(|c| c.is_ascii_digit()).unwrap_or(false)
        })
        .map(|s| s.trim().to_string())
}

/// Checks if Git is installed and returns its status.
pub fn check_git() -> DependencyStatus {
    match run_command("git", &["--version"]) {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = parse_git_version(&version_str);

            DependencyStatus {
                name: "Git".to_string(),
                installed: true,
                version,
                install_command: None,
                min_version: None,
                version_ok: true, // Any version of Git is acceptable
            }
        }
        _ => DependencyStatus {
            name: "Git".to_string(),
            installed: false,
            version: None,
            install_command: Some("Install via your OS package manager (apt, brew, chocolatey)".to_string()),
            min_version: None,
            version_ok: false,
        },
    }
}

/// Checks if Node.js is installed with version >= 18.
pub fn check_node() -> DependencyStatus {
    match run_command("node", &["--version"]) {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = parse_node_version(&version_str);
            let version_ok = version
                .as_ref()
                .map(|v| check_node_version_ok(v))
                .unwrap_or(false);

            DependencyStatus {
                name: "Node.js".to_string(),
                installed: true,
                version,
                install_command: if version_ok {
                    None
                } else {
                    Some("Update Node.js to version 18 or later from nodejs.org".to_string())
                },
                min_version: Some("18.x".to_string()),
                version_ok,
            }
        }
        _ => DependencyStatus {
            name: "Node.js".to_string(),
            installed: false,
            version: None,
            install_command: Some("Install Node.js 18+ from nodejs.org or via nvm".to_string()),
            min_version: Some("18.x".to_string()),
            version_ok: false,
        },
    }
}

/// Checks if Claude CLI is installed.
pub fn check_claude_cli() -> DependencyStatus {
    match run_command("claude", &["--version"]) {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = parse_claude_version(&version_str);

            DependencyStatus {
                name: "Claude CLI".to_string(),
                installed: true,
                version,
                install_command: None,
                min_version: None,
                version_ok: true, // Any version is acceptable
            }
        }
        _ => DependencyStatus {
            name: "Claude CLI".to_string(),
            installed: false,
            version: None,
            install_command: Some("npm install -g @anthropic/claude-code".to_string()),
            min_version: None,
            version_ok: false,
        },
    }
}

/// Checks all required dependencies and returns their statuses.
pub fn check_dependencies() -> Vec<DependencyStatus> {
    vec![check_git(), check_node(), check_claude_cli()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_git_version() {
        assert_eq!(
            parse_git_version("git version 2.39.0"),
            Some("2.39.0".to_string())
        );
        assert_eq!(
            parse_git_version("git version 2.43.0.windows.1"),
            Some("2.43.0.windows.1".to_string())
        );
    }

    #[test]
    fn test_parse_node_version() {
        assert_eq!(parse_node_version("v20.1.0"), Some("20.1.0".to_string()));
        assert_eq!(parse_node_version("v18.0.0\n"), Some("18.0.0".to_string()));
    }

    #[test]
    fn test_check_node_version_ok() {
        assert!(check_node_version_ok("20.1.0"));
        assert!(check_node_version_ok("18.0.0"));
        assert!(!check_node_version_ok("16.0.0"));
        assert!(!check_node_version_ok("17.9.0"));
    }

    #[test]
    fn test_parse_claude_version() {
        assert_eq!(
            parse_claude_version("1.0.0"),
            Some("1.0.0".to_string())
        );
        assert_eq!(
            parse_claude_version("claude-code 1.2.3"),
            Some("1.2.3".to_string())
        );
    }

    #[test]
    fn test_dependency_status_serialization() {
        let status = DependencyStatus {
            name: "Git".to_string(),
            installed: true,
            version: Some("2.39.0".to_string()),
            install_command: None,
            min_version: None,
            version_ok: true,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"name\":\"Git\""));
        assert!(json.contains("\"installed\":true"));
        assert!(json.contains("\"versionOk\":true")); // camelCase
    }

    #[test]
    fn test_check_dependencies_returns_three() {
        // This test will actually run the commands, but we just verify structure
        let deps = check_dependencies();
        assert_eq!(deps.len(), 3);
        assert!(deps.iter().any(|d| d.name == "Git"));
        assert!(deps.iter().any(|d| d.name == "Node.js"));
        assert!(deps.iter().any(|d| d.name == "Claude CLI"));
    }
}
