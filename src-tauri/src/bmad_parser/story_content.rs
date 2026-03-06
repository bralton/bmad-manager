//! Story content parser for extracting structured sections from story markdown files.
//!
//! Parses story markdown files into structured sections for display in the
//! Story Detail Panel. This enables viewing story content without leaving
//! the kanban board.

use serde::Serialize;
use std::fs;
use std::path::Path;

/// Parsed content sections from a story file.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryContent {
    /// The user story text (from "## Story" section)
    pub story: Option<String>,
    /// Acceptance criteria (from "## Acceptance Criteria" section)
    pub acceptance_criteria: Option<String>,
    /// Tasks and subtasks (from "## Tasks / Subtasks" section)
    pub tasks: Option<String>,
    /// Developer notes (from "## Dev Notes" section)
    pub dev_notes: Option<String>,
    /// Whether the file was successfully parsed
    pub parsed: bool,
    /// Error message if parsing failed
    pub error: Option<String>,
}

impl Default for StoryContent {
    fn default() -> Self {
        Self {
            story: None,
            acceptance_criteria: None,
            tasks: None,
            dev_notes: None,
            parsed: false,
            error: None,
        }
    }
}

/// Reads and parses a story file into structured sections.
///
/// # Arguments
/// * `story_path` - Path to the story markdown file
///
/// # Returns
/// StoryContent with parsed sections, or with error field set if parsing failed
pub fn get_story_content(story_path: &Path) -> StoryContent {
    match fs::read_to_string(story_path) {
        Ok(content) => parse_story_content(&content),
        Err(e) => StoryContent {
            error: Some(format!("Failed to read file: {}", e)),
            ..Default::default()
        },
    }
}

/// Parses story content from a markdown string into sections.
///
/// Exposed for testability without filesystem access.
pub fn parse_story_content(content: &str) -> StoryContent {
    let mut result = StoryContent::default();
    result.parsed = true;

    // Find all level-2 headers and their positions
    let sections = extract_sections(content);

    // Extract each known section
    result.story = sections.get("story").cloned();
    result.acceptance_criteria = sections
        .get("acceptance criteria")
        .or_else(|| sections.get("acceptance_criteria"))
        .cloned();
    result.tasks = sections
        .get("tasks / subtasks")
        .or_else(|| sections.get("tasks/subtasks"))
        .or_else(|| sections.get("tasks"))
        .cloned();
    result.dev_notes = sections
        .get("dev notes")
        .or_else(|| sections.get("dev_notes"))
        .or_else(|| sections.get("developer notes"))
        .cloned();

    result
}

/// Extracts sections from markdown content by level-2 headers.
///
/// Returns a map of lowercased section names to their content.
fn extract_sections(content: &str) -> std::collections::HashMap<String, String> {
    let mut sections = std::collections::HashMap::new();
    let lines: Vec<&str> = content.lines().collect();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];

        // Check for level-2 header (## Section Name)
        if line.starts_with("## ") {
            let header_name = line[3..].trim().to_lowercase();

            // Find the content until the next level-2 header or end of file
            let mut section_lines = Vec::new();
            i += 1;

            while i < lines.len() {
                let next_line = lines[i];
                // Stop at next level-2 header
                if next_line.starts_with("## ") {
                    break;
                }
                section_lines.push(next_line);
                i += 1;
            }

            // Trim leading and trailing empty lines from section content
            let section_content = trim_section_content(&section_lines);
            if !section_content.is_empty() {
                sections.insert(header_name, section_content);
            }
        } else {
            i += 1;
        }
    }

    sections
}

/// Trims leading and trailing empty lines from section content.
fn trim_section_content(lines: &[&str]) -> String {
    // Find first non-empty line
    let start = lines.iter().position(|line| !line.trim().is_empty());
    // Find last non-empty line
    let end = lines.iter().rposition(|line| !line.trim().is_empty());

    match (start, end) {
        (Some(s), Some(e)) => lines[s..=e].join("\n"),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_parse_full_story() {
        let content = r#"# Story 5.13: Test Story

Status: in-progress

## Story

As a user,
I want to view story content,
So that I can review details easily.

## Acceptance Criteria

1. **AC1: Display Content**
   - Given a story is clicked
   - When the panel opens
   - Then content is shown

2. **AC2: Scroll Support**
   - Given long content
   - When viewing
   - Then it scrolls

## Tasks / Subtasks

- [ ] Task 1: Create parser
  - [ ] 1.1: Add module
  - [x] 1.2: Write tests
- [x] Task 2: Integrate

## Dev Notes

### Implementation Details

Use existing patterns from artifact viewer.

### References

- [Source: existing.rs]
"#;

        let result = parse_story_content(content);

        assert!(result.parsed);
        assert!(result.error.is_none());
        assert!(result.story.is_some());
        assert!(result.acceptance_criteria.is_some());
        assert!(result.tasks.is_some());
        assert!(result.dev_notes.is_some());

        // Verify story content
        let story = result.story.unwrap();
        assert!(story.contains("As a user"));
        assert!(story.contains("view story content"));

        // Verify acceptance criteria
        let acs = result.acceptance_criteria.unwrap();
        assert!(acs.contains("AC1: Display Content"));
        assert!(acs.contains("AC2: Scroll Support"));

        // Verify tasks
        let tasks = result.tasks.unwrap();
        assert!(tasks.contains("Task 1: Create parser"));
        assert!(tasks.contains("- [ ] 1.1: Add module"));
        assert!(tasks.contains("- [x] 1.2: Write tests"));

        // Verify dev notes
        let notes = result.dev_notes.unwrap();
        assert!(notes.contains("Implementation Details"));
    }

    #[test]
    fn test_parse_minimal_story() {
        let content = r#"# Story 1.1: Minimal

## Story

Just a simple story.
"#;

        let result = parse_story_content(content);

        assert!(result.parsed);
        assert!(result.story.is_some());
        assert!(result.acceptance_criteria.is_none());
        assert!(result.tasks.is_none());
        assert!(result.dev_notes.is_none());
    }

    #[test]
    fn test_parse_empty_content() {
        let content = "";

        let result = parse_story_content(content);

        assert!(result.parsed);
        assert!(result.story.is_none());
        assert!(result.acceptance_criteria.is_none());
    }

    #[test]
    fn test_alternative_header_formats() {
        // Test various header naming conventions
        let content = r#"## Story

Story text here.

## Acceptance_Criteria

ACs with underscore.

## Tasks

Tasks without slash subtasks.

## Dev_Notes

Notes with underscore.
"#;

        let result = parse_story_content(content);

        assert!(result.story.is_some());
        assert!(result.acceptance_criteria.is_some());
        assert!(result.tasks.is_some());
        assert!(result.dev_notes.is_some());
    }

    #[test]
    fn test_get_story_content_from_file() {
        let dir = tempdir().unwrap();
        let story_path = dir.path().join("test-story.md");

        fs::write(
            &story_path,
            r#"# Test Story

## Story

As a test,
I want to read from file.

## Acceptance Criteria

1. File is read
2. Content is parsed
"#,
        )
        .unwrap();

        let result = get_story_content(&story_path);

        assert!(result.parsed);
        assert!(result.error.is_none());
        assert!(result.story.is_some());
        assert!(result.acceptance_criteria.is_some());
    }

    #[test]
    fn test_nonexistent_file_returns_error() {
        let dir = tempdir().unwrap();
        let nonexistent = dir.path().join("nonexistent.md");

        let result = get_story_content(&nonexistent);

        assert!(!result.parsed);
        assert!(result.error.is_some());
        assert!(result.error.unwrap().contains("Failed to read file"));
    }

    #[test]
    fn test_trim_empty_lines() {
        let content = r#"## Story


Line after empty lines.

More content.


"#;

        let result = parse_story_content(content);

        let story = result.story.unwrap();
        // Should not start or end with empty lines
        assert!(story.starts_with("Line after"));
        assert!(story.ends_with("More content."));
    }

    #[test]
    fn test_preserves_internal_formatting() {
        let content = r#"## Tasks / Subtasks

- [ ] Task 1
  - [ ] 1.1: Subtask
  - [x] 1.2: Done

- [x] Task 2
  - [x] 2.1: Also done
"#;

        let result = parse_story_content(content);

        let tasks = result.tasks.unwrap();
        // Should preserve indentation
        assert!(tasks.contains("  - [ ] 1.1"));
        assert!(tasks.contains("  - [x] 1.2"));
    }

    #[test]
    fn test_handles_numbered_acs() {
        let content = r#"## Acceptance Criteria

1. **AC1: First Criterion**
   - Given X
   - When Y
   - Then Z

2. **AC2: Second Criterion**
   - Given A
   - When B
   - Then C
"#;

        let result = parse_story_content(content);

        let acs = result.acceptance_criteria.unwrap();
        assert!(acs.contains("1. **AC1:"));
        assert!(acs.contains("2. **AC2:"));
    }
}
