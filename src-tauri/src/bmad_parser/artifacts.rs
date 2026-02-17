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
            eprintln!(
                "Warning: Failed to parse frontmatter in {:?}: {}",
                path, e
            );
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

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
