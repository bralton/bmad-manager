//! Epic title parser for extracting titles from epic files.
//!
//! Parses YAML frontmatter from epic files to extract epic IDs and titles
//! for display in the story board UI.

use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// YAML frontmatter structure for epic files.
/// Supports both integer and decimal epic IDs (e.g., 1, 2.5).
#[derive(Debug, Deserialize)]
struct EpicFrontmatter {
    /// Epic ID - can be integer (1) or decimal (2.5)
    epic_id: Option<serde_yaml::Value>,
    /// Epic title (e.g., "Foundation", "Prep Sprint")
    title: Option<String>,
}

/// Parses all epic titles from a project's implementation-artifacts directory.
///
/// Scans for files matching `epic-*.md` (excluding retrospectives containing `-retro`).
/// Returns a HashMap mapping epic ID strings to their titles.
///
/// # Arguments
/// * `project_path` - Root path to the project directory
///
/// # Returns
/// HashMap where keys are epic IDs (e.g., "1", "2.5") and values are titles
pub fn parse_epic_titles(project_path: &Path) -> HashMap<String, String> {
    let mut titles = HashMap::new();
    let impl_dir = project_path.join("_bmad-output/implementation-artifacts");

    if !impl_dir.exists() {
        return titles;
    }

    if let Ok(entries) = fs::read_dir(&impl_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                // Match epic-*.md but exclude retrospectives (-retro)
                if filename.starts_with("epic-")
                    && filename.ends_with(".md")
                    && !filename.contains("-retro")
                {
                    if let Some((id, title)) = parse_epic_file(&path) {
                        titles.insert(id, title);
                    }
                }
            }
        }
    }

    titles
}

/// Parses a single epic file to extract ID and title from YAML frontmatter.
///
/// # Arguments
/// * `path` - Path to the epic markdown file
///
/// # Returns
/// Some((id, title)) if both epic_id and title are present, None otherwise
fn parse_epic_file(path: &Path) -> Option<(String, String)> {
    let content = fs::read_to_string(path).ok()?;
    parse_epic_frontmatter(&content)
}

/// Parses epic frontmatter from markdown content string.
///
/// Exposed for testability without filesystem access.
fn parse_epic_frontmatter(content: &str) -> Option<(String, String)> {
    // Extract YAML frontmatter between --- markers
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }

    let after_first = &content[3..];
    let end_marker = after_first.find("---")?;
    let yaml_content = &after_first[..end_marker];

    // Parse YAML frontmatter
    let frontmatter: EpicFrontmatter = serde_yaml::from_str(yaml_content).ok()?;

    // Extract epic_id as string (handles both int and float)
    let epic_id = match frontmatter.epic_id? {
        serde_yaml::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                i.to_string()
            } else if let Some(f) = n.as_f64() {
                // Format decimals without trailing zeros
                format_decimal(f)
            } else {
                return None;
            }
        }
        serde_yaml::Value::String(s) => s,
        _ => return None,
    };

    let title = frontmatter.title?;

    Some((epic_id, title))
}

/// Formats a float as a decimal string, removing unnecessary trailing zeros.
/// Examples: 2.5 -> "2.5", 1.0 -> "1"
fn format_decimal(f: f64) -> String {
    if f.fract() == 0.0 {
        // No decimal part
        (f as i64).to_string()
    } else {
        // Has decimal part - format with precision and trim trailing zeros
        let s = format!("{:.10}", f);
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_parse_epic_frontmatter_integer_id() {
        let content = r#"---
epic_id: 1
title: 'Foundation'
---
# Epic 1: Foundation
"#;
        let result = parse_epic_frontmatter(content);
        assert!(result.is_some());
        let (id, title) = result.unwrap();
        assert_eq!(id, "1");
        assert_eq!(title, "Foundation");
    }

    #[test]
    fn test_parse_epic_frontmatter_decimal_id() {
        let content = r#"---
epic_id: 2.5
title: 'Prep Sprint'
---
# Epic 2.5: Prep Sprint
"#;
        let result = parse_epic_frontmatter(content);
        assert!(result.is_some());
        let (id, title) = result.unwrap();
        assert_eq!(id, "2.5");
        assert_eq!(title, "Prep Sprint");
    }

    #[test]
    fn test_parse_epic_frontmatter_string_id() {
        let content = r#"---
epic_id: "3"
title: 'Stories & Worktrees'
---
"#;
        let result = parse_epic_frontmatter(content);
        assert!(result.is_some());
        let (id, title) = result.unwrap();
        assert_eq!(id, "3");
        assert_eq!(title, "Stories & Worktrees");
    }

    #[test]
    fn test_parse_epic_frontmatter_missing_title() {
        let content = r#"---
epic_id: 1
---
"#;
        let result = parse_epic_frontmatter(content);
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_epic_frontmatter_missing_epic_id() {
        let content = r#"---
title: 'Some Title'
---
"#;
        let result = parse_epic_frontmatter(content);
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_epic_frontmatter_no_frontmatter() {
        let content = "# Just a heading\nNo frontmatter here.";
        let result = parse_epic_frontmatter(content);
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_epic_frontmatter_invalid_yaml() {
        let content = r#"---
epic_id: [invalid
title: 'Test'
---
"#;
        let result = parse_epic_frontmatter(content);
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_epic_titles_from_directory() {
        let dir = tempdir().unwrap();
        let impl_dir = dir.path().join("_bmad-output/implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();

        // Create epic files
        fs::write(
            impl_dir.join("epic-1-foundation.md"),
            r#"---
epic_id: 1
title: 'Foundation'
---
"#,
        )
        .unwrap();

        fs::write(
            impl_dir.join("epic-2.5-prep-sprint.md"),
            r#"---
epic_id: 2.5
title: 'Prep Sprint'
---
"#,
        )
        .unwrap();

        // Create a retrospective file that should be excluded
        fs::write(
            impl_dir.join("epic-1-retro-2026-02-17.md"),
            r#"---
epic_id: 1
title: 'Foundation Retro'
---
"#,
        )
        .unwrap();

        let titles = parse_epic_titles(dir.path());

        assert_eq!(titles.len(), 2);
        assert_eq!(titles.get("1"), Some(&"Foundation".to_string()));
        assert_eq!(titles.get("2.5"), Some(&"Prep Sprint".to_string()));
        // Retrospective should not be included
        assert!(!titles.values().any(|v| v.contains("Retro")));
    }

    #[test]
    fn test_parse_epic_titles_empty_directory() {
        let dir = tempdir().unwrap();
        let impl_dir = dir.path().join("_bmad-output/implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();

        let titles = parse_epic_titles(dir.path());
        assert!(titles.is_empty());
    }

    #[test]
    fn test_parse_epic_titles_nonexistent_directory() {
        let dir = tempdir().unwrap();
        // Don't create the impl_dir

        let titles = parse_epic_titles(dir.path());
        assert!(titles.is_empty());
    }

    #[test]
    fn test_format_decimal_integer() {
        assert_eq!(format_decimal(1.0), "1");
        assert_eq!(format_decimal(3.0), "3");
    }

    #[test]
    fn test_format_decimal_with_fractional() {
        assert_eq!(format_decimal(2.5), "2.5");
        assert_eq!(format_decimal(1.25), "1.25");
    }

    #[test]
    fn test_parse_epic_frontmatter_unquoted_title() {
        let content = r#"---
epic_id: 4
title: Polish
---
"#;
        let result = parse_epic_frontmatter(content);
        assert!(result.is_some());
        let (id, title) = result.unwrap();
        assert_eq!(id, "4");
        assert_eq!(title, "Polish");
    }

    #[test]
    fn test_parse_epic_file_with_extra_frontmatter_fields() {
        let content = r#"---
epic_id: 1
title: 'Foundation'
priority: P0
status: done
created: '2026-02-15'
stories_count: 11
---
# Epic 1
"#;
        let result = parse_epic_frontmatter(content);
        assert!(result.is_some());
        let (id, title) = result.unwrap();
        assert_eq!(id, "1");
        assert_eq!(title, "Foundation");
    }
}
