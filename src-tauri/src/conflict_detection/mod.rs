//! Conflict detection module for identifying file overlaps between active stories.
//!
//! This module parses story files to extract the files each story modifies,
//! then detects conflicts where multiple active stories touch the same files.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

/// Files associated with a story.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StoryFiles {
    /// Story ID (e.g., "4-3")
    pub story_id: String,
    /// List of file paths this story modifies
    pub files: Vec<String>,
}

/// A conflict warning between two stories sharing files.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConflictWarning {
    /// Story ID that has conflicts
    pub story_id: String,
    /// Story ID it conflicts with
    pub conflicts_with: String,
    /// List of shared file paths
    pub shared_files: Vec<String>,
}

/// Parses files_to_modify from story file content.
///
/// Supports two formats:
/// 1. YAML frontmatter with `files_to_modify:` list
/// 2. Markdown section "## Files to Modify" or "**Files to modify:**"
///
/// Returns a list of file paths extracted from the story.
pub fn parse_files_from_story(content: &str) -> Vec<String> {
    // Try frontmatter first
    if let Some(files) = parse_files_from_frontmatter(content) {
        if !files.is_empty() {
            return files;
        }
    }

    // Fall back to markdown section
    parse_files_from_markdown(content)
}

/// Parses files_to_modify from YAML frontmatter.
///
/// Expects format:
/// ```yaml
/// ---
/// files_to_modify:
///   - path/to/file.ts
///   - path/to/other.rs
/// ---
/// ```
fn parse_files_from_frontmatter(content: &str) -> Option<Vec<String>> {
    // Check if content starts with frontmatter
    if !content.starts_with("---") {
        return None;
    }

    // Find the closing ---
    let rest = &content[3..];
    let end_idx = rest.find("\n---")?;
    let frontmatter = &rest[..end_idx];

    // Look for files_to_modify: in the frontmatter
    let mut files = Vec::new();
    let mut in_files_section = false;

    for line in frontmatter.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("files_to_modify:") {
            in_files_section = true;
            // Check for inline array format: files_to_modify: [a, b]
            if let Some(inline) = trimmed.strip_prefix("files_to_modify:") {
                let inline = inline.trim();
                if inline.starts_with('[') && inline.ends_with(']') {
                    let inner = &inline[1..inline.len() - 1];
                    // Use bracket-aware splitting to handle paths with commas in brackets
                    for path in split_respecting_brackets(inner) {
                        if !path.is_empty() {
                            files.push(normalize_path(&path));
                        }
                    }
                    return Some(files);
                }
            }
            continue;
        }

        if in_files_section {
            // End of list when we hit a non-indented line that's not a list item
            if !trimmed.is_empty() && !trimmed.starts_with('-') && !line.starts_with(' ') {
                break;
            }

            // Parse list items
            if let Some(item) = trimmed.strip_prefix('-') {
                let path = item.trim().trim_matches('"').trim_matches('\'');
                if !path.is_empty() {
                    files.push(normalize_path(path));
                }
            }
        }
    }

    Some(files)
}

/// Parses files to modify from markdown sections.
///
/// Supports various formats:
/// - `## Files to Modify`
/// - `### Files to Modify`
/// - `**Files to modify:**`
/// - `Files to modify:`
///
/// Extracts bullet list items following the heading.
fn parse_files_from_markdown(content: &str) -> Vec<String> {
    let mut files = Vec::new();
    let mut in_files_section = false;
    let mut section_indent: Option<usize> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        let line_lower = trimmed.to_lowercase();

        // Check for section header
        if line_lower.contains("files to modify") {
            // Various formats: ## Files to Modify, **Files to modify:**, etc.
            if line_lower.starts_with('#')
                || line_lower.starts_with("**files to modify")
                || line_lower.starts_with("files to modify")
            {
                in_files_section = true;
                section_indent = None;
                continue;
            }
        }

        if in_files_section {
            // End section on new heading or empty line followed by non-list content
            if trimmed.starts_with('#') {
                break;
            }

            // Skip empty lines
            if trimmed.is_empty() {
                continue;
            }

            // Parse bullet items: - `path` or - path or * path
            if let Some(item) = trimmed.strip_prefix('-').or_else(|| trimmed.strip_prefix('*')) {
                let path = extract_file_path(item.trim());
                if !path.is_empty() {
                    // Track indentation to handle nested lists
                    let current_indent = line.len() - line.trim_start().len();
                    if section_indent.is_none() {
                        section_indent = Some(current_indent);
                    }

                    // Only include items at the same indentation level
                    if Some(current_indent) == section_indent {
                        files.push(normalize_path(&path));
                    }
                }
            } else if !trimmed.starts_with('-') && !trimmed.starts_with('*') {
                // Non-list content ends the section (unless it's an inline description)
                if !trimmed.starts_with('(') && !trimmed.starts_with('[') {
                    break;
                }
            }
        }
    }

    files
}

/// Extracts a file path from a markdown list item.
///
/// Handles formats like:
/// - `src/file.ts` - with backticks
/// - src/file.ts - plain text
/// - src/file.ts - some description
fn extract_file_path(item: &str) -> String {
    let item = item.trim();

    // Handle backtick-wrapped paths
    if item.starts_with('`') {
        if let Some(end) = item[1..].find('`') {
            return item[1..=end].to_string();
        }
    }

    // Split on common separators and take the first part
    // Handle: "path/file.ts - description" or "path/file.ts (optional)"
    let path = item
        .split(" - ")
        .next()
        .unwrap_or(item)
        .split(" (")
        .next()
        .unwrap_or(item)
        .split(" [")
        .next()
        .unwrap_or(item)
        .trim();

    // Remove any trailing punctuation
    path.trim_end_matches(|c| c == ',' || c == ';' || c == ':')
        .to_string()
}

/// Splits a string by commas, but respects brackets (does not split inside []).
/// Used for parsing inline YAML arrays that may contain paths with brackets.
fn split_respecting_brackets(s: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut bracket_depth: i32 = 0;

    for ch in s.chars() {
        match ch {
            '[' => {
                bracket_depth += 1;
                current.push(ch);
            }
            ']' => {
                bracket_depth = bracket_depth.saturating_sub(1);
                current.push(ch);
            }
            ',' if bracket_depth == 0 => {
                let trimmed = current.trim().trim_matches('"').trim_matches('\'').to_string();
                if !trimmed.is_empty() {
                    result.push(trimmed);
                }
                current.clear();
            }
            _ => {
                current.push(ch);
            }
        }
    }

    // Don't forget the last item
    let trimmed = current.trim().trim_matches('"').trim_matches('\'').to_string();
    if !trimmed.is_empty() {
        result.push(trimmed);
    }

    result
}

/// Normalizes a file path for comparison.
///
/// - Removes leading `./`
/// - Converts backslashes to forward slashes
/// - Trims whitespace
fn normalize_path(path: &str) -> String {
    let path = path.trim();
    let path = path.replace('\\', "/");
    let path = path.strip_prefix("./").unwrap_or(&path);
    path.to_string()
}

/// Parses story files and extracts files_to_modify for each.
///
/// Scans the implementation-artifacts directory for story files
/// and parses their files_to_modify sections.
pub fn parse_story_files(project_path: &Path) -> Vec<StoryFiles> {
    let impl_dir = project_path.join("_bmad-output/implementation-artifacts");

    if !impl_dir.exists() {
        return Vec::new();
    }

    let mut results = Vec::new();

    for entry in walkdir::WalkDir::new(&impl_dir)
        .max_depth(1) // Don't recurse into subdirectories
        .into_iter()
        .filter_map(|e| {
            match e {
                Ok(entry) => Some(entry),
                Err(err) => {
                    eprintln!("Warning: Failed to read directory entry in conflict detection: {}", err);
                    None
                }
            }
        })
    {
        let path = entry.path();

        // Only process story files (pattern: N-N-*.md or N.N-N-*.md)
        if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
            if !is_story_filename(filename) {
                continue;
            }

            if let Some(story_id) = extract_story_id(filename) {
                if let Ok(content) = fs::read_to_string(path) {
                    let files = parse_files_from_story(&content);
                    results.push(StoryFiles { story_id, files });
                }
            }
        }
    }

    results
}

/// Checks if a filename matches the story pattern (N-N-*.md or N.N-N-*.md).
fn is_story_filename(filename: &str) -> bool {
    if !filename.ends_with(".md") {
        return false;
    }

    let parts: Vec<&str> = filename.split('-').collect();
    if parts.len() < 3 {
        return false;
    }

    // First part: digits or digits.digits (e.g., "1" or "2.5")
    let first_valid = parts[0]
        .chars()
        .all(|c| c.is_ascii_digit() || c == '.');
    if !first_valid || parts[0].is_empty() {
        return false;
    }

    // Second part: digits only
    let second_valid = parts[1].chars().all(|c| c.is_ascii_digit());
    if !second_valid || parts[1].is_empty() {
        return false;
    }

    true
}

/// Extracts story ID from filename (e.g., "1-2-name.md" → "1-2").
fn extract_story_id(filename: &str) -> Option<String> {
    if !is_story_filename(filename) {
        return None;
    }

    let parts: Vec<&str> = filename.split('-').collect();
    if parts.len() >= 2 {
        Some(format!("{}-{}", parts[0], parts[1]))
    } else {
        None
    }
}

/// Detects file conflicts between active stories.
///
/// Takes a list of all story files and a list of active story IDs.
/// Returns conflict warnings for each pair of active stories that share files.
pub fn detect_conflicts(
    story_files: &[StoryFiles],
    active_story_ids: &[String],
) -> Vec<ConflictWarning> {
    // Filter to only active stories with files
    let active_set: HashSet<&String> = active_story_ids.iter().collect();
    let active_stories: Vec<&StoryFiles> = story_files
        .iter()
        .filter(|sf| active_set.contains(&sf.story_id) && !sf.files.is_empty())
        .collect();

    // Build map: file -> [story_ids that touch it]
    let mut file_to_stories: HashMap<&String, Vec<&String>> = HashMap::new();
    for story in &active_stories {
        for file in &story.files {
            file_to_stories
                .entry(file)
                .or_default()
                .push(&story.story_id);
        }
    }

    // Find conflicts: files touched by 2+ stories
    let mut conflicts_map: HashMap<(&String, &String), HashSet<&String>> = HashMap::new();

    for (file, story_ids) in &file_to_stories {
        if story_ids.len() >= 2 {
            // Create pairs (avoid duplicates by ordering)
            for (i, id1) in story_ids.iter().enumerate() {
                for id2 in story_ids.iter().skip(i + 1) {
                    // Always order the pair consistently
                    let pair = if id1 < id2 { (*id1, *id2) } else { (*id2, *id1) };
                    conflicts_map.entry(pair).or_default().insert(*file);
                }
            }
        }
    }

    // Convert to ConflictWarning structs
    // Generate two warnings per pair (one for each direction) for easier lookup
    let mut warnings = Vec::new();
    for ((id1, id2), files) in conflicts_map {
        let shared_files: Vec<String> = files.iter().map(|f| (*f).clone()).collect();

        // Warning for id1
        warnings.push(ConflictWarning {
            story_id: id1.clone(),
            conflicts_with: id2.clone(),
            shared_files: shared_files.clone(),
        });

        // Warning for id2 (reverse direction)
        warnings.push(ConflictWarning {
            story_id: id2.clone(),
            conflicts_with: id1.clone(),
            shared_files,
        });
    }

    // Sort by story_id for consistent output
    warnings.sort_by(|a, b| {
        a.story_id
            .cmp(&b.story_id)
            .then_with(|| a.conflicts_with.cmp(&b.conflicts_with))
    });

    warnings
}

/// Gets all conflict warnings for active stories in a project.
///
/// This is the main entry point for conflict detection.
/// Parses story files, determines active stories, and detects conflicts.
pub fn get_story_conflicts(
    project_path: &Path,
    active_story_ids: &[String],
) -> Vec<ConflictWarning> {
    let story_files = parse_story_files(project_path);
    detect_conflicts(&story_files, active_story_ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ========== Frontmatter parsing tests ==========

    #[test]
    fn test_parse_frontmatter_list() {
        let content = r#"---
title: Test Story
files_to_modify:
  - src/lib/components/auth/Login.svelte
  - src/lib/stores/auth.ts
status: in-progress
---

# Story Content
"#;
        let files = parse_files_from_story(content);
        assert_eq!(files.len(), 2);
        assert!(files.contains(&"src/lib/components/auth/Login.svelte".to_string()));
        assert!(files.contains(&"src/lib/stores/auth.ts".to_string()));
    }

    #[test]
    fn test_parse_frontmatter_inline_array() {
        let content = r#"---
files_to_modify: [src/file1.ts, src/file2.ts]
---
"#;
        let files = parse_files_from_story(content);
        assert_eq!(files.len(), 2);
        assert!(files.contains(&"src/file1.ts".to_string()));
        assert!(files.contains(&"src/file2.ts".to_string()));
    }

    #[test]
    fn test_parse_frontmatter_empty() {
        let content = r#"---
title: Test Story
---

No files_to_modify here.
"#;
        let files = parse_files_from_story(content);
        assert!(files.is_empty());
    }

    // ========== Markdown parsing tests ==========

    #[test]
    fn test_parse_markdown_h2_section() {
        let content = r#"# Story Title

## Acceptance Criteria

Some criteria.

## Files to Modify

- `src/lib/components/auth/Login.svelte`
- `src/lib/stores/auth.ts`

## Tasks
"#;
        let files = parse_files_from_story(content);
        assert_eq!(files.len(), 2);
        assert!(files.contains(&"src/lib/components/auth/Login.svelte".to_string()));
        assert!(files.contains(&"src/lib/stores/auth.ts".to_string()));
    }

    #[test]
    fn test_parse_markdown_bold_section() {
        let content = r#"# Story Title

**Files to modify:**
- src/lib/components/auth/Login.svelte
- src/lib/stores/auth.ts

Some other content.
"#;
        let files = parse_files_from_story(content);
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn test_parse_markdown_with_descriptions() {
        let content = r#"# Story Title

**Files to modify:**
- `src/lib/components/auth/Login.svelte` - Add login form
- `src/lib/stores/auth.ts` (new file)

Other content.
"#;
        let files = parse_files_from_story(content);
        assert_eq!(files.len(), 2);
        assert!(files.contains(&"src/lib/components/auth/Login.svelte".to_string()));
        assert!(files.contains(&"src/lib/stores/auth.ts".to_string()));
    }

    #[test]
    fn test_parse_markdown_asterisk_bullets() {
        let content = r#"### Files to Modify

* src/lib/stores/auth.ts
* src-tauri/src/auth.rs
"#;
        let files = parse_files_from_story(content);
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn test_parse_no_files_section() {
        let content = r#"# Story Title

## Acceptance Criteria

- AC1: Something
- AC2: Something else

## Tasks

- Task 1
"#;
        let files = parse_files_from_story(content);
        assert!(files.is_empty());
    }

    // ========== Path normalization tests ==========

    #[test]
    fn test_normalize_path_leading_dot_slash() {
        assert_eq!(normalize_path("./src/file.ts"), "src/file.ts");
    }

    #[test]
    fn test_normalize_path_backslashes() {
        assert_eq!(normalize_path("src\\lib\\file.ts"), "src/lib/file.ts");
    }

    #[test]
    fn test_normalize_path_whitespace() {
        assert_eq!(normalize_path("  src/file.ts  "), "src/file.ts");
    }

    // ========== Story filename tests ==========

    #[test]
    fn test_is_story_filename_valid() {
        assert!(is_story_filename("1-1-name.md"));
        assert!(is_story_filename("2-3-longer-name.md"));
        assert!(is_story_filename("2.5-1-prep.md"));
        assert!(is_story_filename("10-20-big-numbers.md"));
    }

    #[test]
    fn test_is_story_filename_invalid() {
        assert!(!is_story_filename("epic-1-name.md"));
        assert!(!is_story_filename("readme.md"));
        assert!(!is_story_filename("1-name.md"));
        assert!(!is_story_filename("sprint-status.yaml"));
    }

    #[test]
    fn test_extract_story_id() {
        assert_eq!(
            extract_story_id("1-1-name.md"),
            Some("1-1".to_string())
        );
        assert_eq!(
            extract_story_id("2.5-3-name.md"),
            Some("2.5-3".to_string())
        );
        assert_eq!(extract_story_id("epic-1.md"), None);
    }

    // ========== Conflict detection tests ==========

    #[test]
    fn test_detect_conflicts_no_overlap() {
        let stories = vec![
            StoryFiles {
                story_id: "1-1".to_string(),
                files: vec!["src/file1.ts".to_string()],
            },
            StoryFiles {
                story_id: "1-2".to_string(),
                files: vec!["src/file2.ts".to_string()],
            },
        ];
        let active = vec!["1-1".to_string(), "1-2".to_string()];

        let conflicts = detect_conflicts(&stories, &active);
        assert!(conflicts.is_empty());
    }

    #[test]
    fn test_detect_conflicts_with_overlap() {
        let stories = vec![
            StoryFiles {
                story_id: "1-1".to_string(),
                files: vec!["src/shared.ts".to_string(), "src/file1.ts".to_string()],
            },
            StoryFiles {
                story_id: "1-2".to_string(),
                files: vec!["src/shared.ts".to_string(), "src/file2.ts".to_string()],
            },
        ];
        let active = vec!["1-1".to_string(), "1-2".to_string()];

        let conflicts = detect_conflicts(&stories, &active);
        // Should have 2 warnings (one for each direction)
        assert_eq!(conflicts.len(), 2);

        let c1 = conflicts.iter().find(|c| c.story_id == "1-1").unwrap();
        assert_eq!(c1.conflicts_with, "1-2");
        assert!(c1.shared_files.contains(&"src/shared.ts".to_string()));

        let c2 = conflicts.iter().find(|c| c.story_id == "1-2").unwrap();
        assert_eq!(c2.conflicts_with, "1-1");
    }

    #[test]
    fn test_detect_conflicts_inactive_story_excluded() {
        let stories = vec![
            StoryFiles {
                story_id: "1-1".to_string(),
                files: vec!["src/shared.ts".to_string()],
            },
            StoryFiles {
                story_id: "1-2".to_string(),
                files: vec!["src/shared.ts".to_string()],
            },
        ];
        // Only 1-1 is active
        let active = vec!["1-1".to_string()];

        let conflicts = detect_conflicts(&stories, &active);
        assert!(conflicts.is_empty());
    }

    #[test]
    fn test_detect_conflicts_multiple_shared_files() {
        let stories = vec![
            StoryFiles {
                story_id: "1-1".to_string(),
                files: vec![
                    "src/a.ts".to_string(),
                    "src/b.ts".to_string(),
                    "src/c.ts".to_string(),
                ],
            },
            StoryFiles {
                story_id: "1-2".to_string(),
                files: vec![
                    "src/a.ts".to_string(),
                    "src/b.ts".to_string(),
                    "src/d.ts".to_string(),
                ],
            },
        ];
        let active = vec!["1-1".to_string(), "1-2".to_string()];

        let conflicts = detect_conflicts(&stories, &active);
        assert_eq!(conflicts.len(), 2);

        let c1 = conflicts.iter().find(|c| c.story_id == "1-1").unwrap();
        assert_eq!(c1.shared_files.len(), 2);
        assert!(c1.shared_files.contains(&"src/a.ts".to_string()));
        assert!(c1.shared_files.contains(&"src/b.ts".to_string()));
    }

    #[test]
    fn test_detect_conflicts_three_way() {
        let stories = vec![
            StoryFiles {
                story_id: "1-1".to_string(),
                files: vec!["src/shared.ts".to_string()],
            },
            StoryFiles {
                story_id: "1-2".to_string(),
                files: vec!["src/shared.ts".to_string()],
            },
            StoryFiles {
                story_id: "1-3".to_string(),
                files: vec!["src/shared.ts".to_string()],
            },
        ];
        let active = vec!["1-1".to_string(), "1-2".to_string(), "1-3".to_string()];

        let conflicts = detect_conflicts(&stories, &active);
        // 3 pairs * 2 directions = 6 warnings
        assert_eq!(conflicts.len(), 6);
    }

    #[test]
    fn test_detect_conflicts_empty_files() {
        let stories = vec![
            StoryFiles {
                story_id: "1-1".to_string(),
                files: vec![],
            },
            StoryFiles {
                story_id: "1-2".to_string(),
                files: vec!["src/file.ts".to_string()],
            },
        ];
        let active = vec!["1-1".to_string(), "1-2".to_string()];

        let conflicts = detect_conflicts(&stories, &active);
        assert!(conflicts.is_empty());
    }

    // ========== Extract file path tests ==========

    #[test]
    fn test_extract_file_path_backticks() {
        assert_eq!(
            extract_file_path("`src/file.ts`"),
            "src/file.ts"
        );
        assert_eq!(
            extract_file_path("`src/file.ts` - Add module"),
            "src/file.ts"
        );
    }

    #[test]
    fn test_extract_file_path_plain() {
        assert_eq!(extract_file_path("src/file.ts"), "src/file.ts");
        assert_eq!(
            extract_file_path("src/file.ts - description"),
            "src/file.ts"
        );
    }

    #[test]
    fn test_extract_file_path_with_parens() {
        assert_eq!(
            extract_file_path("src/file.ts (new file)"),
            "src/file.ts"
        );
    }

    // ========== Split respecting brackets tests ==========

    #[test]
    fn test_split_respecting_brackets_simple() {
        let result = split_respecting_brackets("a, b, c");
        assert_eq!(result, vec!["a", "b", "c"]);
    }

    #[test]
    fn test_split_respecting_brackets_with_brackets() {
        let result = split_respecting_brackets("src/file[1,2].ts, src/other.ts");
        assert_eq!(result, vec!["src/file[1,2].ts", "src/other.ts"]);
    }

    #[test]
    fn test_split_respecting_brackets_quoted() {
        let result = split_respecting_brackets("\"src/file.ts\", 'src/other.ts'");
        assert_eq!(result, vec!["src/file.ts", "src/other.ts"]);
    }

    #[test]
    fn test_split_respecting_brackets_empty() {
        let result = split_respecting_brackets("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_split_respecting_brackets_nested() {
        let result = split_respecting_brackets("src/[[a,b]].ts, other.ts");
        assert_eq!(result, vec!["src/[[a,b]].ts", "other.ts"]);
    }
}
