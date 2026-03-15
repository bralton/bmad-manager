//! Artifact frontmatter parser for BMAD output files.
//!
//! Parses YAML frontmatter from markdown files in `_bmad-output/` directories.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Parsed artifact metadata from YAML frontmatter.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactMeta {
    pub path: PathBuf,
    pub title: String,
    pub created: String,
    pub status: ArtifactStatus,
    pub workflow_type: String,
    #[serde(default)]
    pub steps_completed: Vec<u32>,
    #[serde(default)]
    pub input_documents: Vec<String>,
}

/// Status of an artifact in the BMAD workflow.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ArtifactStatus {
    Draft,
    Approved,
    Deprecated,
}

/// Status of a story in the implementation workflow.
///
/// Stories use a different lifecycle than artifacts:
/// backlog → ready-for-dev → in-progress → review → done
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum StoryStatus {
    Backlog,
    ReadyForDev,
    InProgress,
    Review,
    Done,
}

/// Status of a bug in the implementation workflow.
///
/// Bugs use a lifecycle similar to stories:
/// backlog → ready-for-dev → in-progress → review → resolved
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum BugStatus {
    Backlog,
    ReadyForDev,
    InProgress,
    Review,
    Resolved,
}

/// Parsed story metadata from markdown files.
///
/// Stories don't use YAML frontmatter - their status is in the markdown body.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StoryMeta {
    pub path: PathBuf,
    pub title: String,
    pub status: StoryStatus,
}

/// Parsed bug metadata from YAML frontmatter.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BugMeta {
    pub path: PathBuf,
    pub title: String,
    pub status: BugStatus,
}

/// Collection of implementation items (stories and bugs).
#[derive(Debug, Clone, Default)]
pub struct ImplementationItems {
    pub stories: Vec<StoryMeta>,
    pub bugs: Vec<BugMeta>,
}

/// Raw frontmatter structure for deserialization.
/// Handles both `created` and `date` field names.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontmatterRaw {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    created: Option<String>,
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    status: Option<ArtifactStatus>,
    #[serde(default)]
    workflow_type: Option<String>,
    #[serde(default)]
    steps_completed: Option<Vec<u32>>,
    #[serde(default)]
    input_documents: Option<Vec<String>>,
}

/// Parses YAML frontmatter from a markdown file.
///
/// Returns `None` if:
/// - The file cannot be read
/// - The file doesn't have frontmatter delimiters (`---`)
/// - The YAML is malformed
/// - Required fields are missing
///
/// # Arguments
/// * `path` - Path to the markdown file
///
/// # Example
/// ```ignore
/// let meta = parse_frontmatter(Path::new("artifact.md"));
/// if let Some(artifact) = meta {
///     println!("Title: {}", artifact.title);
/// }
/// ```
pub fn parse_frontmatter(path: &Path) -> Option<ArtifactMeta> {
    let content = fs::read_to_string(path).ok()?;

    // Check for frontmatter delimiters
    if !content.starts_with("---") {
        return None;
    }

    // Find closing delimiter (skip the opening "---")
    let rest = &content[3..];
    let end_idx = rest.find("---")?;
    let yaml_content = &rest[..end_idx].trim();

    // Parse YAML
    let raw: FrontmatterRaw = match serde_yaml::from_str(yaml_content) {
        Ok(r) => r,
        Err(e) => {
            // Log warning for malformed YAML - using eprintln for now
            // TODO: Replace with tracing crate for structured logging
            eprintln!("Warning: Failed to parse frontmatter in {:?}: {}", path, e);
            return None;
        }
    };

    // Extract created date (handle both `created` and `date` field names)
    let created = raw.created.or(raw.date)?;

    // Require title, status, and workflow_type
    let title = raw.title?;
    let status = raw.status?;
    let workflow_type = raw.workflow_type?;

    Some(ArtifactMeta {
        path: path.to_path_buf(),
        title,
        created,
        status,
        workflow_type,
        steps_completed: raw.steps_completed.unwrap_or_default(),
        input_documents: raw.input_documents.unwrap_or_default(),
    })
}

/// Scans both planning and implementation artifact directories for a project.
///
/// This is the standard way to get all artifacts from a BMAD project.
/// Scans `_bmad-output/planning-artifacts` and `_bmad-output/implementation-artifacts`.
///
/// # Arguments
/// * `project_path` - Path to the project root directory
///
/// # Returns
/// Vector of all artifacts from both directories, sorted by date descending (newest first).
/// Returns empty vector if `_bmad-output` doesn't exist or contains no valid artifacts.
pub fn scan_all_project_artifacts(project_path: &Path) -> Vec<ArtifactMeta> {
    let output_base = project_path.join("_bmad-output");
    let mut all_artifacts = Vec::new();

    // Scan planning-artifacts
    let planning_dir = output_base.join("planning-artifacts");
    if planning_dir.exists() {
        all_artifacts.extend(scan_artifacts(&planning_dir));
    }

    // Scan implementation-artifacts
    let impl_dir = output_base.join("implementation-artifacts");
    if impl_dir.exists() {
        all_artifacts.extend(scan_artifacts(&impl_dir));
    }

    // Re-sort combined results by date descending
    all_artifacts.sort_by(|a, b| b.created.cmp(&a.created));

    all_artifacts
}

/// Scans a directory for artifact markdown files and parses their frontmatter.
///
/// - Recursively finds all `*.md` files in the directory
/// - Parses frontmatter from each file
/// - Collects successful results
/// - Sorts by creation date descending (newest first)
///
/// # Arguments
/// * `dir` - Directory to scan for artifacts
///
/// # Returns
/// Vector of successfully parsed artifact metadata, sorted newest first.
/// Returns empty vector if directory doesn't exist or contains no valid artifacts.
pub fn scan_artifacts(dir: &Path) -> Vec<ArtifactMeta> {
    if !dir.exists() || !dir.is_dir() {
        return Vec::new();
    }

    let mut artifacts: Vec<ArtifactMeta> = Vec::new();

    // Use walkdir for recursive scanning
    for entry in walkdir::WalkDir::new(dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Only process markdown files
        if path.extension().map_or(false, |ext| ext == "md") {
            if let Some(meta) = parse_frontmatter(path) {
                artifacts.push(meta);
            }
        }
    }

    // Sort by created date descending (newest first)
    artifacts.sort_by(|a, b| b.created.cmp(&a.created));

    artifacts
}

/// Parses a story file from markdown body format.
///
/// Story files don't use YAML frontmatter. Instead, the status is in the markdown body:
/// ```markdown
/// # Story 1.1: Title
///
/// Status: done
/// ```
///
/// # Arguments
/// * `path` - Path to the story markdown file
///
/// # Returns
/// `Some(StoryMeta)` if the file matches story format, `None` otherwise
pub fn parse_story(path: &Path) -> Option<StoryMeta> {
    let content = fs::read_to_string(path).ok()?;

    // Extract title from first H1 heading
    let title = content
        .lines()
        .find(|line| line.starts_with("# "))
        .map(|line| line.trim_start_matches("# ").to_string())?;

    // Extract status from "Status: xyz" line (case-insensitive for Status:)
    let status_line = content
        .lines()
        .find(|line| line.to_lowercase().starts_with("status:"))?;

    let status_str = status_line.split(':').nth(1)?.trim().to_lowercase();

    let status = match status_str.as_str() {
        "backlog" => StoryStatus::Backlog,
        "ready-for-dev" => StoryStatus::ReadyForDev,
        "in-progress" => StoryStatus::InProgress,
        "review" => StoryStatus::Review,
        "done" => StoryStatus::Done,
        _ => return None,
    };

    Some(StoryMeta {
        path: path.to_path_buf(),
        title,
        status,
    })
}

/// Raw bug frontmatter structure for deserialization.
/// Note: bug_id uses snake_case in YAML, but status values use kebab-case
#[derive(Debug, Deserialize)]
struct BugFrontmatterRaw {
    #[serde(default)]
    bug_id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    status: Option<BugStatus>,
}

/// Parses a bug file from YAML frontmatter.
///
/// Bug files use YAML frontmatter with their own status values:
/// ```yaml
/// ---
/// bug_id: BUG-001
/// title: 'Bug Title'
/// status: in-progress
/// ---
/// ```
///
/// # Arguments
/// * `path` - Path to the bug markdown file
///
/// # Returns
/// `Some(BugMeta)` if the file matches bug format, `None` otherwise
pub fn parse_bug(path: &Path) -> Option<BugMeta> {
    let content = fs::read_to_string(path).ok()?;

    // Check for frontmatter delimiters
    if !content.starts_with("---") {
        return None;
    }

    // Find closing delimiter
    let rest = &content[3..];
    let end_idx = rest.find("---")?;
    let yaml_content = &rest[..end_idx].trim();

    // Parse YAML
    let raw: BugFrontmatterRaw = serde_yaml::from_str(yaml_content).ok()?;

    // Require bug_id to identify this as a bug file
    raw.bug_id?;

    let title = raw.title?;
    let status = raw.status?;

    Some(BugMeta {
        path: path.to_path_buf(),
        title,
        status,
    })
}

/// Scans a directory for implementation items (stories and bugs).
///
/// This is separate from artifact scanning because stories and bugs
/// use different schemas than planning artifacts.
///
/// # Arguments
/// * `dir` - Directory to scan (typically `implementation-artifacts`)
///
/// # Returns
/// Collection of stories and bugs found in the directory
pub fn scan_implementation_items(dir: &Path) -> ImplementationItems {
    let mut items = ImplementationItems::default();

    if !dir.exists() || !dir.is_dir() {
        return items;
    }

    for entry in walkdir::WalkDir::new(dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Only process markdown files
        if !path.extension().map_or(false, |ext| ext == "md") {
            continue;
        }

        let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Try bug first (has frontmatter with bug_id)
        if filename.starts_with("bug-") {
            if let Some(bug) = parse_bug(path) {
                items.bugs.push(bug);
                continue;
            }
        }

        // Try story (matches X-X-name.md pattern, has Status: in body)
        // Story filenames match pattern: number-number-name.md (e.g., 1-1-story.md)
        let is_story_filename = filename
            .split('-')
            .take(2)
            .all(|part| part.chars().all(|c| c.is_ascii_digit()));

        if is_story_filename {
            if let Some(story) = parse_story(path) {
                items.stories.push(story);
            }
        }
    }

    items
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    // ========== Story status enum tests ==========

    #[test]
    fn test_story_status_serialization() {
        assert_eq!(
            serde_json::to_string(&StoryStatus::Backlog).unwrap(),
            "\"backlog\""
        );
        assert_eq!(
            serde_json::to_string(&StoryStatus::ReadyForDev).unwrap(),
            "\"ready-for-dev\""
        );
        assert_eq!(
            serde_json::to_string(&StoryStatus::InProgress).unwrap(),
            "\"in-progress\""
        );
        assert_eq!(
            serde_json::to_string(&StoryStatus::Review).unwrap(),
            "\"review\""
        );
        assert_eq!(
            serde_json::to_string(&StoryStatus::Done).unwrap(),
            "\"done\""
        );
    }

    #[test]
    fn test_bug_status_serialization() {
        assert_eq!(
            serde_json::to_string(&BugStatus::Backlog).unwrap(),
            "\"backlog\""
        );
        assert_eq!(
            serde_json::to_string(&BugStatus::ReadyForDev).unwrap(),
            "\"ready-for-dev\""
        );
        assert_eq!(
            serde_json::to_string(&BugStatus::InProgress).unwrap(),
            "\"in-progress\""
        );
        assert_eq!(
            serde_json::to_string(&BugStatus::Review).unwrap(),
            "\"review\""
        );
        assert_eq!(
            serde_json::to_string(&BugStatus::Resolved).unwrap(),
            "\"resolved\""
        );
    }

    #[test]
    fn test_parse_bug_review_status() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("bug-003-review.md");
        fs::write(
            &file,
            r#"---
bug_id: BUG-003
title: 'Bug in Review'
status: review
---
"#,
        )
        .unwrap();

        let result = parse_bug(&file);
        assert!(result.is_some());
        assert_eq!(result.unwrap().status, BugStatus::Review);
    }

    // ========== Story parsing tests ==========

    #[test]
    fn test_parse_story_from_markdown_body() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("1-1-test-story.md");
        // Real story format - status in markdown body, no frontmatter
        fs::write(
            &file,
            r#"# Story 1.1: Test Story

Status: done

## Story

As a user...
"#,
        )
        .unwrap();

        let result = parse_story(&file);
        assert!(result.is_some());
        let story = result.unwrap();
        assert_eq!(story.status, StoryStatus::Done);
        assert_eq!(story.title, "Story 1.1: Test Story");
    }

    #[test]
    fn test_parse_story_in_progress() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("2-1-feature.md");
        fs::write(
            &file,
            r#"# Story 2.1: Feature

Status: in-progress

## Story
"#,
        )
        .unwrap();

        let result = parse_story(&file);
        assert!(result.is_some());
        assert_eq!(result.unwrap().status, StoryStatus::InProgress);
    }

    #[test]
    fn test_parse_story_ready_for_dev() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("3-1-next.md");
        fs::write(
            &file,
            r#"# Story 3.1: Next Task

Status: ready-for-dev

## Story
"#,
        )
        .unwrap();

        let result = parse_story(&file);
        assert!(result.is_some());
        assert_eq!(result.unwrap().status, StoryStatus::ReadyForDev);
    }

    // ========== Bug parsing tests ==========

    #[test]
    fn test_parse_bug_frontmatter() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("bug-001-test.md");
        fs::write(
            &file,
            r#"---
bug_id: BUG-001
title: 'Test Bug'
status: in-progress
---
# BUG-001: Test Bug
"#,
        )
        .unwrap();

        let result = parse_bug(&file);
        assert!(result.is_some());
        let bug = result.unwrap();
        assert_eq!(bug.status, BugStatus::InProgress);
        assert_eq!(bug.title, "Test Bug");
    }

    #[test]
    fn test_parse_bug_resolved() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("bug-002-fixed.md");
        fs::write(
            &file,
            r#"---
bug_id: BUG-002
title: 'Fixed Bug'
status: resolved
---
"#,
        )
        .unwrap();

        let result = parse_bug(&file);
        assert!(result.is_some());
        assert_eq!(result.unwrap().status, BugStatus::Resolved);
    }

    // ========== Scan implementation items tests ==========

    #[test]
    fn test_scan_implementation_items_finds_stories_and_bugs() {
        let dir = tempdir().unwrap();

        // Create a story file
        fs::write(
            dir.path().join("1-1-story.md"),
            r#"# Story 1.1: Test

Status: done

## Story
"#,
        )
        .unwrap();

        // Create a bug file
        fs::write(
            dir.path().join("bug-001-fix.md"),
            r#"---
bug_id: BUG-001
title: 'Bug Fix'
status: resolved
---
"#,
        )
        .unwrap();

        let items = scan_implementation_items(dir.path());
        assert_eq!(items.stories.len(), 1);
        assert_eq!(items.bugs.len(), 1);
        assert_eq!(items.stories[0].status, StoryStatus::Done);
        assert_eq!(items.bugs[0].status, BugStatus::Resolved);
    }

    // ========== Original artifact tests ==========

    #[test]
    fn test_parse_valid_frontmatter() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(
            &file,
            r#"---
title: Test Doc
created: '2026-02-17'
status: approved
workflowType: test-workflow
stepsCompleted: [1, 2, 3]
inputDocuments: ['input.md']
---
# Content here
"#,
        )
        .unwrap();

        let result = parse_frontmatter(&file);
        assert!(result.is_some());
        let meta = result.unwrap();
        assert_eq!(meta.title, "Test Doc");
        assert_eq!(meta.created, "2026-02-17");
        assert_eq!(meta.status, ArtifactStatus::Approved);
        assert_eq!(meta.workflow_type, "test-workflow");
        assert_eq!(meta.steps_completed, vec![1, 2, 3]);
        assert_eq!(meta.input_documents, vec!["input.md"]);
    }

    #[test]
    fn test_parse_frontmatter_with_date_field() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(
            &file,
            r#"---
title: Date Field Test
date: '2026-02-15'
status: draft
workflowType: product-brief
---
# Content
"#,
        )
        .unwrap();

        let result = parse_frontmatter(&file);
        assert!(result.is_some());
        let meta = result.unwrap();
        assert_eq!(meta.created, "2026-02-15");
    }

    #[test]
    fn test_parse_missing_frontmatter() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(&file, "# Just content, no frontmatter").unwrap();

        let result = parse_frontmatter(&file);
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_partial_frontmatter_with_defaults() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(
            &file,
            r#"---
title: Partial
created: '2026-02-17'
status: draft
workflowType: partial-test
---
"#,
        )
        .unwrap();

        let result = parse_frontmatter(&file);
        assert!(result.is_some());
        let meta = result.unwrap();
        assert!(meta.steps_completed.is_empty()); // Default
        assert!(meta.input_documents.is_empty()); // Default
    }

    #[test]
    fn test_parse_malformed_yaml() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(
            &file,
            r#"---
title: [unclosed bracket
status: draft
---
"#,
        )
        .unwrap();

        let result = parse_frontmatter(&file);
        assert!(result.is_none()); // Malformed YAML returns None
    }

    #[test]
    fn test_parse_missing_required_fields() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.md");
        fs::write(
            &file,
            r#"---
title: Missing Status
created: '2026-02-17'
---
"#,
        )
        .unwrap();

        let result = parse_frontmatter(&file);
        assert!(result.is_none()); // Missing required fields returns None
    }

    #[test]
    fn test_scan_artifacts_empty_dir() {
        let dir = tempdir().unwrap();

        let result = scan_artifacts(dir.path());
        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_artifacts_nonexistent_dir() {
        let result = scan_artifacts(Path::new("/nonexistent/path"));
        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_artifacts_multiple_files() {
        let dir = tempdir().unwrap();

        // Create older file
        let file1 = dir.path().join("older.md");
        fs::write(
            &file1,
            r#"---
title: Older Doc
created: '2026-02-10'
status: approved
workflowType: test
---
"#,
        )
        .unwrap();

        // Create newer file
        let file2 = dir.path().join("newer.md");
        fs::write(
            &file2,
            r#"---
title: Newer Doc
created: '2026-02-17'
status: draft
workflowType: test
---
"#,
        )
        .unwrap();

        // Create file without frontmatter (should be skipped)
        let file3 = dir.path().join("no-frontmatter.md");
        fs::write(&file3, "# No frontmatter here").unwrap();

        let result = scan_artifacts(dir.path());
        assert_eq!(result.len(), 2);
        // Verify sorted newest first
        assert_eq!(result[0].title, "Newer Doc");
        assert_eq!(result[1].title, "Older Doc");
    }

    #[test]
    fn test_scan_artifacts_recursive() {
        let dir = tempdir().unwrap();
        let subdir = dir.path().join("subdir");
        fs::create_dir(&subdir).unwrap();

        // Create file in root
        let file1 = dir.path().join("root.md");
        fs::write(
            &file1,
            r#"---
title: Root Doc
created: '2026-02-15'
status: approved
workflowType: test
---
"#,
        )
        .unwrap();

        // Create file in subdir
        let file2 = subdir.join("nested.md");
        fs::write(
            &file2,
            r#"---
title: Nested Doc
created: '2026-02-17'
status: draft
workflowType: test
---
"#,
        )
        .unwrap();

        let result = scan_artifacts(dir.path());
        assert_eq!(result.len(), 2);
        // Verify nested file is found and sorted correctly
        assert_eq!(result[0].title, "Nested Doc"); // Newer
        assert_eq!(result[1].title, "Root Doc"); // Older
    }

    #[test]
    fn test_artifact_status_serialization() {
        // Test kebab-case serialization
        let status = ArtifactStatus::Draft;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"draft\"");

        let status = ArtifactStatus::Approved;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"approved\"");

        let status = ArtifactStatus::Deprecated;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"deprecated\"");
    }

    #[test]
    fn test_artifact_meta_camel_case_serialization() {
        let meta = ArtifactMeta {
            path: PathBuf::from("/test/path.md"),
            title: "Test".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Draft,
            workflow_type: "test".to_string(),
            steps_completed: vec![1, 2],
            input_documents: vec!["doc.md".to_string()],
        };

        let json = serde_json::to_string(&meta).unwrap();
        // Verify camelCase field names
        assert!(json.contains("\"workflowType\""));
        assert!(json.contains("\"stepsCompleted\""));
        assert!(json.contains("\"inputDocuments\""));
        // Verify no snake_case
        assert!(!json.contains("\"workflow_type\""));
        assert!(!json.contains("\"steps_completed\""));
        assert!(!json.contains("\"input_documents\""));
    }
}
