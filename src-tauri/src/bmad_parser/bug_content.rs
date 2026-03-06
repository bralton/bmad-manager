//! Bug content parser for extracting structured sections from bug markdown files.
//!
//! Parses bug markdown files into structured sections for display in the
//! Bug Detail Panel. This enables viewing bug content on the kanban board.

use serde::Serialize;
use std::fs;
use std::path::Path;

/// Parsed content from a bug file.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugContent {
    /// Bug ID from frontmatter (e.g., "BUG-001")
    pub bug_id: Option<String>,
    /// Bug title from frontmatter
    pub title: Option<String>,
    /// Severity level (low, medium, high, critical)
    pub severity: Option<String>,
    /// Priority (P1, P2, P3, etc.)
    pub priority: Option<String>,
    /// Current status
    pub status: Option<String>,
    /// Who reported the bug
    pub reported_by: Option<String>,
    /// When the bug was reported
    pub reported_date: Option<String>,
    /// Related story IDs
    pub related_stories: Option<Vec<String>>,
    /// The summary section content
    pub summary: Option<String>,
    /// Full markdown body after frontmatter
    pub body: Option<String>,
    /// Whether the file was successfully parsed
    pub parsed: bool,
    /// Error message if parsing failed
    pub error: Option<String>,
}

impl Default for BugContent {
    fn default() -> Self {
        Self {
            bug_id: None,
            title: None,
            severity: None,
            priority: None,
            status: None,
            reported_by: None,
            reported_date: None,
            related_stories: None,
            summary: None,
            body: None,
            parsed: false,
            error: None,
        }
    }
}

/// Reads and parses a bug file into structured sections.
///
/// # Arguments
/// * `bug_path` - Path to the bug markdown file
///
/// # Returns
/// BugContent with parsed sections, or with error field set if parsing failed
pub fn get_bug_content(bug_path: &Path) -> BugContent {
    match fs::read_to_string(bug_path) {
        Ok(content) => parse_bug_content(&content),
        Err(e) => BugContent {
            error: Some(format!("Failed to read file: {}", e)),
            ..Default::default()
        },
    }
}

/// Parses bug content from a markdown string into sections.
///
/// Exposed for testability without filesystem access.
pub fn parse_bug_content(content: &str) -> BugContent {
    let mut result = BugContent::default();
    result.parsed = true;

    // Split frontmatter from body
    let (frontmatter, body) = extract_frontmatter(content);

    // Parse frontmatter fields
    if let Some(fm) = frontmatter {
        result.bug_id = extract_field(&fm, "bug_id");
        result.title = extract_field(&fm, "title");
        result.severity = extract_field(&fm, "severity");
        result.priority = extract_field(&fm, "priority");
        result.status = extract_field(&fm, "status");
        result.reported_by = extract_field(&fm, "reported_by");
        result.reported_date = extract_field(&fm, "reported_date");
        result.related_stories = extract_array_field(&fm, "related_stories");
    }

    // Store body content
    if let Some(b) = body {
        result.body = Some(b.clone());

        // Extract summary section from body
        result.summary = extract_section(&b, "summary");
    }

    result
}

/// Extracts frontmatter and body from markdown content.
fn extract_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    let lines: Vec<&str> = content.lines().collect();

    // Check if starts with frontmatter delimiter
    if lines.is_empty() || lines[0].trim() != "---" {
        return (None, Some(content.to_string()));
    }

    // Find closing delimiter
    let mut end_idx = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if line.trim() == "---" {
            end_idx = Some(i);
            break;
        }
    }

    match end_idx {
        Some(idx) => {
            let frontmatter = lines[1..idx].join("\n");
            let body = lines[idx + 1..].join("\n").trim().to_string();
            (
                Some(frontmatter),
                if body.is_empty() { None } else { Some(body) },
            )
        }
        None => (None, Some(content.to_string())),
    }
}

/// Extracts a simple field value from YAML frontmatter.
fn extract_field(frontmatter: &str, field: &str) -> Option<String> {
    for line in frontmatter.lines() {
        let line = line.trim();
        let prefix = format!("{}:", field);
        if line.starts_with(&prefix) {
            let value = line[prefix.len()..].trim();
            // Remove quotes if present
            let value = value.trim_matches(|c| c == '\'' || c == '"');
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Extracts an array field from YAML frontmatter (e.g., related_stories: ['1-7', '1-8']).
fn extract_array_field(frontmatter: &str, field: &str) -> Option<Vec<String>> {
    for line in frontmatter.lines() {
        let line = line.trim();
        let prefix = format!("{}:", field);
        if line.starts_with(&prefix) {
            let value = line[prefix.len()..].trim();
            // Parse array format: ['item1', 'item2']
            if value.starts_with('[') && value.ends_with(']') {
                let inner = &value[1..value.len() - 1];
                let items: Vec<String> = inner
                    .split(',')
                    .map(|s| s.trim().trim_matches(|c| c == '\'' || c == '"').to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if !items.is_empty() {
                    return Some(items);
                }
            }
        }
    }
    None
}

/// Extracts a section from markdown content by header name.
fn extract_section(content: &str, section_name: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    let header_prefix = format!("## {}", section_name);
    let header_lower = header_prefix.to_lowercase();

    let mut i = 0;
    while i < lines.len() {
        if lines[i].to_lowercase().starts_with(&header_lower) {
            // Found the section, collect content until next ## header
            let mut section_lines = Vec::new();
            i += 1;

            while i < lines.len() {
                if lines[i].starts_with("## ") {
                    break;
                }
                section_lines.push(lines[i]);
                i += 1;
            }

            let section_content = trim_section_content(&section_lines);
            if !section_content.is_empty() {
                return Some(section_content);
            }
        }
        i += 1;
    }
    None
}

/// Trims leading and trailing empty lines from section content.
fn trim_section_content(lines: &[&str]) -> String {
    let start = lines.iter().position(|line| !line.trim().is_empty());
    let end = lines.iter().rposition(|line| !line.trim().is_empty());

    match (start, end) {
        (Some(s), Some(e)) => lines[s..=e].join("\n"),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_bug_frontmatter() {
        let content = r#"---
bug_id: BUG-001
title: 'Test bug title'
severity: high
priority: P1
status: backlog
reported_by: TestUser
reported_date: '2026-02-17'
related_stories: ['1-7', '1-8']
---

# BUG-001: Test bug

## Summary

This is the bug summary.
"#;

        let result = parse_bug_content(content);

        assert!(result.parsed);
        assert!(result.error.is_none());
        assert_eq!(result.bug_id, Some("BUG-001".to_string()));
        assert_eq!(result.title, Some("Test bug title".to_string()));
        assert_eq!(result.severity, Some("high".to_string()));
        assert_eq!(result.priority, Some("P1".to_string()));
        assert_eq!(result.status, Some("backlog".to_string()));
        assert_eq!(result.reported_by, Some("TestUser".to_string()));
        assert_eq!(result.reported_date, Some("2026-02-17".to_string()));
        assert_eq!(
            result.related_stories,
            Some(vec!["1-7".to_string(), "1-8".to_string()])
        );
        assert!(result.summary.is_some());
        assert!(result.summary.unwrap().contains("bug summary"));
    }

    #[test]
    fn test_parse_bug_without_frontmatter() {
        let content = r#"# BUG-002: No frontmatter

## Summary

Just a summary.
"#;

        let result = parse_bug_content(content);

        assert!(result.parsed);
        assert!(result.bug_id.is_none());
        assert!(result.body.is_some());
        assert!(result.summary.is_some());
    }

    #[test]
    fn test_extract_field_with_quotes() {
        let fm = "title: 'Single quoted'\nother: \"Double quoted\"";

        assert_eq!(extract_field(fm, "title"), Some("Single quoted".to_string()));
        assert_eq!(extract_field(fm, "other"), Some("Double quoted".to_string()));
    }

    #[test]
    fn test_extract_array_field() {
        let fm = "related_stories: ['1-7', '1-8', '2-1']";

        let result = extract_array_field(fm, "related_stories");
        assert_eq!(
            result,
            Some(vec!["1-7".to_string(), "1-8".to_string(), "2-1".to_string()])
        );
    }

    #[test]
    fn test_extract_section() {
        let content = r#"# Bug Title

## Summary

This is the summary content.
Multiple lines.

## Expected Behavior

Should work correctly.
"#;

        let summary = extract_section(content, "Summary");
        assert!(summary.is_some());
        assert!(summary.as_ref().unwrap().contains("summary content"));
        assert!(summary.as_ref().unwrap().contains("Multiple lines"));
    }
}
