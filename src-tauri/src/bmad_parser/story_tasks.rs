//! Story task parser for extracting task lists from story markdown files.
//!
//! Parses markdown task checkboxes (- [ ], - [x]) from story files
//! to display task progress in the workflow dashboard.

use serde::Serialize;
use std::fs;
use std::path::Path;

/// A single task item parsed from a story file.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryTask {
    /// Task text/description
    pub text: String,
    /// Whether the task is completed
    pub completed: bool,
    /// Indentation level (0 for top-level tasks, 1+ for subtasks)
    pub level: u32,
}

/// Progress data for a story's tasks.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryTasks {
    /// List of tasks parsed from the story
    pub tasks: Vec<StoryTask>,
    /// Total number of tasks
    pub total: u32,
    /// Number of completed tasks
    pub completed: u32,
    /// Completion percentage (0-100)
    pub percentage: u32,
}

/// Parses story tasks from a story file.
///
/// # Arguments
/// * `story_path` - Path to the story markdown file
///
/// # Returns
/// Some(StoryTasks) if file exists and contains tasks, None otherwise
pub fn parse_story_tasks(story_path: &Path) -> Option<StoryTasks> {
    let content = fs::read_to_string(story_path).ok()?;
    parse_story_tasks_from_content(&content)
}

/// Parses story tasks from markdown content string.
///
/// Exposed for testability without filesystem access.
pub fn parse_story_tasks_from_content(content: &str) -> Option<StoryTasks> {
    let mut tasks = Vec::new();
    let mut total = 0u32;
    let mut completed = 0u32;

    for line in content.lines() {
        // Calculate indentation level based on leading whitespace
        let trimmed = line.trim_start();
        let indent_chars = line.len() - trimmed.len();
        // Approximate level: 2-4 spaces or 1 tab = 1 level
        let level = (indent_chars / 2).min(5) as u32;

        // Check for task patterns: - [ ], - [x], - [X], * [ ], * [x], * [X]
        if let Some(task) = parse_task_line(trimmed, level) {
            total += 1;
            if task.completed {
                completed += 1;
            }
            tasks.push(task);
        }
    }

    if total == 0 {
        return None;
    }

    let percentage = ((completed as f64 / total as f64) * 100.0).round() as u32;

    Some(StoryTasks {
        tasks,
        total,
        completed,
        percentage,
    })
}

/// Parses a single line to extract task info if it matches a task pattern.
fn parse_task_line(trimmed: &str, level: u32) -> Option<StoryTask> {
    // Patterns: - [ ], - [x], - [X], * [ ], * [x], * [X]
    let (prefix, completed) = if trimmed.starts_with("- [ ] ") || trimmed.starts_with("* [ ] ") {
        (6, false)
    } else if trimmed.starts_with("- [x] ")
        || trimmed.starts_with("- [X] ")
        || trimmed.starts_with("* [x] ")
        || trimmed.starts_with("* [X] ")
    {
        (6, true)
    } else if trimmed.starts_with("- [ ]") || trimmed.starts_with("* [ ]") {
        // Handle case without trailing space (e.g., "- [ ]Task")
        (5, false)
    } else if trimmed.starts_with("- [x]")
        || trimmed.starts_with("- [X]")
        || trimmed.starts_with("* [x]")
        || trimmed.starts_with("* [X]")
    {
        (5, true)
    } else {
        return None;
    };

    let text = trimmed[prefix..].trim().to_string();

    Some(StoryTask {
        text,
        completed,
        level,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_parse_incomplete_task_dash() {
        let content = "- [ ] Implement feature";
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.total, 1);
        assert_eq!(tasks.completed, 0);
        assert_eq!(tasks.percentage, 0);
        assert_eq!(tasks.tasks[0].text, "Implement feature");
        assert!(!tasks.tasks[0].completed);
    }

    #[test]
    fn test_parse_complete_task_lowercase_x() {
        let content = "- [x] Write tests";
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.total, 1);
        assert_eq!(tasks.completed, 1);
        assert_eq!(tasks.percentage, 100);
        assert!(tasks.tasks[0].completed);
    }

    #[test]
    fn test_parse_complete_task_uppercase_x() {
        let content = "- [X] Write tests";
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert!(tasks.tasks[0].completed);
    }

    #[test]
    fn test_parse_asterisk_variant() {
        let content = "* [ ] Task with asterisk";
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.tasks[0].text, "Task with asterisk");
    }

    #[test]
    fn test_parse_complete_asterisk_variant() {
        let content = "* [x] Completed asterisk task";
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert!(tasks.tasks[0].completed);
    }

    #[test]
    fn test_no_tasks_returns_none() {
        let content = r#"# Story Title

This is a story description with no tasks.

## Notes
Some additional notes.
"#;
        let result = parse_story_tasks_from_content(content);
        assert!(result.is_none());
    }

    #[test]
    fn test_mixed_content_with_tasks() {
        let content = r#"# Story 1.1: Test Story

## Tasks / Subtasks

- [ ] Task 1: Implement parser
  - [ ] 1.1: Create module
  - [x] 1.2: Add types
- [x] Task 2: Write tests
  - [x] 2.1: Unit tests
  - [x] 2.2: Integration tests

## Notes

Some notes here.
"#;
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.total, 6);
        assert_eq!(tasks.completed, 4);
        assert_eq!(tasks.percentage, 67); // 4/6 = 66.7 rounded to 67
    }

    #[test]
    fn test_indentation_levels() {
        let content = r#"- [ ] Top level
  - [ ] First level indent
    - [ ] Second level indent
"#;
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.tasks.len(), 3);
        assert_eq!(tasks.tasks[0].level, 0);
        assert_eq!(tasks.tasks[1].level, 1);
        assert_eq!(tasks.tasks[2].level, 2);
    }

    #[test]
    fn test_percentage_calculation() {
        let content = r#"- [x] Done 1
- [x] Done 2
- [x] Done 3
- [ ] Not done
"#;
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.total, 4);
        assert_eq!(tasks.completed, 3);
        assert_eq!(tasks.percentage, 75); // 3/4 = 75%
    }

    #[test]
    fn test_parse_story_file() {
        let dir = tempdir().unwrap();
        let story_path = dir.path().join("story.md");

        fs::write(
            &story_path,
            r#"# Test Story

## Tasks
- [ ] Task 1
- [x] Task 2
"#,
        )
        .unwrap();

        let result = parse_story_tasks(&story_path);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.total, 2);
        assert_eq!(tasks.completed, 1);
    }

    #[test]
    fn test_nonexistent_file_returns_none() {
        let dir = tempdir().unwrap();
        let nonexistent = dir.path().join("nonexistent.md");

        let result = parse_story_tasks(&nonexistent);
        assert!(result.is_none());
    }

    #[test]
    fn test_task_text_extraction() {
        let content = "- [ ] Task 1: Create the component (AC: #1)";
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.tasks[0].text, "Task 1: Create the component (AC: #1)");
    }

    #[test]
    fn test_task_without_trailing_space() {
        // Some markdown might not have space after checkbox
        let content = "- [ ]Task without space";
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.tasks[0].text, "Task without space");
    }

    #[test]
    fn test_ignores_non_task_dashes() {
        let content = r#"- Regular list item
-- Double dash
- [ ] Actual task
---
Horizontal rule above
"#;
        let result = parse_story_tasks_from_content(content);

        assert!(result.is_some());
        let tasks = result.unwrap();
        assert_eq!(tasks.total, 1);
        assert_eq!(tasks.tasks[0].text, "Actual task");
    }
}
