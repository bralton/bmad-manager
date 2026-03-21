//! Artifact browser module for categorized artifact listing and display.
//!
//! Provides functions for listing, categorizing, and retrieving BMAD artifacts
//! for the artifact browser UI component.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Category of a BMAD artifact for display grouping.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArtifactCategory {
    Epic,
    Story,
    Retrospective,
    Design,
    Planning,
    Other,
}

impl ArtifactCategory {
    /// Returns a display-friendly name for the category.
    #[allow(dead_code)] // Public API for future use
    pub fn display_name(&self) -> &'static str {
        match self {
            ArtifactCategory::Epic => "Epics",
            ArtifactCategory::Story => "Stories",
            ArtifactCategory::Retrospective => "Retrospectives",
            ArtifactCategory::Design => "Design Docs",
            ArtifactCategory::Planning => "Planning Docs",
            ArtifactCategory::Other => "Other",
        }
    }
}

/// Artifact information for the browser UI.
///
/// Different from ArtifactMeta - focused on display rather than workflow state.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactInfo {
    /// Absolute path to the artifact file
    pub path: String,
    /// Display title (from H1 heading or filename)
    pub title: String,
    /// Category for grouping
    pub category: ArtifactCategory,
    /// Epic ID if this is an epic-related artifact (e.g., "1", "2", "2.5")
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub epic_id: Option<String>,
    /// Story ID if this is a story (e.g., "1-1", "2-3")
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub story_id: Option<String>,
    /// Last modified timestamp (ISO 8601)
    pub modified_at: String,
    /// Status from file content (if available)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

/// Groups of artifacts organized by category.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactGroups {
    pub epics: Vec<ArtifactInfo>,
    pub stories: Vec<ArtifactInfo>,
    pub retrospectives: Vec<ArtifactInfo>,
    pub design: Vec<ArtifactInfo>,
    pub planning: Vec<ArtifactInfo>,
    pub other: Vec<ArtifactInfo>,
}

impl ArtifactGroups {
    /// Returns the total count of all artifacts.
    #[allow(dead_code)] // Public API for future use
    pub fn total_count(&self) -> usize {
        self.epics.len()
            + self.stories.len()
            + self.retrospectives.len()
            + self.design.len()
            + self.planning.len()
            + self.other.len()
    }

    /// Adds an artifact to the appropriate category group.
    pub fn add(&mut self, artifact: ArtifactInfo) {
        match artifact.category {
            ArtifactCategory::Epic => self.epics.push(artifact),
            ArtifactCategory::Story => self.stories.push(artifact),
            ArtifactCategory::Retrospective => self.retrospectives.push(artifact),
            ArtifactCategory::Design => self.design.push(artifact),
            ArtifactCategory::Planning => self.planning.push(artifact),
            ArtifactCategory::Other => self.other.push(artifact),
        }
    }
}

/// Categorizes an artifact based on its filename.
///
/// Rules (in order of precedence):
/// 1. If filename contains `-retro` → `Retrospective`
/// 2. If filename contains `-ux-design` or `-tech-reference` → `Design` (before epic check)
/// 3. If filename starts with `epic-` (not design, not retro) → `Epic`
/// 4. If filename matches `N-N-*.md` or `N.N-N-*.md` pattern → `Story`
/// 5. If filename starts with `prd-`, `architecture-`, `product-brief`, `tech-spec` → `Planning`
/// 6. Otherwise → `Other`
pub fn categorize_artifact(filename: &str) -> ArtifactCategory {
    let filename_lower = filename.to_lowercase();

    // 1. Retrospectives (check first since epic retros have "epic-" prefix)
    if filename_lower.contains("-retro") {
        return ArtifactCategory::Retrospective;
    }

    // 2. Design docs (before epic check - files like epic-4-ux-design.md are design docs)
    if filename_lower.contains("-ux-design") || filename_lower.contains("-tech-reference") {
        return ArtifactCategory::Design;
    }

    // 3. Epics (must check after retro and design exclusion)
    if filename_lower.starts_with("epic-") {
        return ArtifactCategory::Epic;
    }

    // 4. Stories - pattern: N-N-name.md or N.N-N-name.md (e.g., 1-1-foo.md, 2.5-1-bar.md)
    if is_story_filename(filename) {
        return ArtifactCategory::Story;
    }

    // 5. Planning docs
    if filename_lower.starts_with("prd-")
        || filename_lower.starts_with("architecture-")
        || filename_lower.starts_with("product-brief")
        || filename_lower.starts_with("tech-spec")
    {
        return ArtifactCategory::Planning;
    }

    // 6. Other
    ArtifactCategory::Other
}

/// Checks if a filename matches the story pattern (N-N-*.md or N.N-N-*.md).
fn is_story_filename(filename: &str) -> bool {
    let parts: Vec<&str> = filename.split('-').collect();
    if parts.len() < 3 {
        return false;
    }

    // First part: digits or digits.digits (e.g., "1" or "2.5")
    let first_valid = parts[0].chars().all(|c| c.is_ascii_digit() || c == '.');
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

/// Extracts epic ID from filename (e.g., "epic-1" → "1", "epic-2.5" → "2.5").
fn extract_epic_id(filename: &str) -> Option<String> {
    let filename_lower = filename.to_lowercase();
    if !filename_lower.starts_with("epic-") {
        return None;
    }

    // Remove "epic-" prefix and get the ID part
    let rest = &filename[5..]; // Skip "epic-"

    // Find where the ID ends (at first non-digit-or-dot character)
    let id_end = rest
        .find(|c: char| !c.is_ascii_digit() && c != '.')
        .unwrap_or(rest.len());

    let id = &rest[..id_end];
    if id.is_empty() {
        None
    } else {
        Some(id.to_string())
    }
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

/// Extracts the title from markdown file content.
///
/// Looks for the first H1 heading (`# Title`) in the content.
/// Falls back to filename if no heading is found.
fn extract_title_from_content(content: &str, filename: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(title) = trimmed.strip_prefix("# ") {
            return title.trim().to_string();
        }
    }

    // Fallback: use filename without extension
    filename.strip_suffix(".md").unwrap_or(filename).to_string()
}

/// Extracts the status from markdown file content.
///
/// Looks for a line starting with "Status:" (case-insensitive).
fn extract_status_from_content(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim().to_lowercase();
        if trimmed.starts_with("status:") {
            let status = line.split(':').nth(1).map(|s| s.trim().to_string());
            return status;
        }
    }
    None
}

/// Extracts the workflowType from markdown file frontmatter.
///
/// Looks for a line starting with "workflowType:" in YAML frontmatter.
fn extract_workflow_type_from_content(content: &str) -> Option<String> {
    let mut in_frontmatter = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            if in_frontmatter {
                // End of frontmatter
                break;
            }
            in_frontmatter = true;
            continue;
        }
        if in_frontmatter {
            let lower = trimmed.to_lowercase();
            if lower.starts_with("workflowtype:") {
                return line
                    .split(':')
                    .nth(1)
                    .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string());
            }
        }
    }
    None
}

/// Checks if a workflowType matches planning artifact types.
///
/// Matches: product-brief, prd, tech-spec, architecture, *-design, *-ux-*
fn is_planning_workflow_type(workflow_type: &str) -> bool {
    let wt = workflow_type.to_lowercase();

    // Exact matches
    if matches!(
        wt.as_str(),
        "product-brief" | "prd" | "tech-spec" | "architecture"
    ) {
        return true;
    }

    // Wildcard patterns: *-design, *-ux-*
    if wt.ends_with("-design") || wt.contains("-ux-") || wt.starts_with("ux-") {
        return true;
    }

    false
}

/// Parses a single artifact file into ArtifactInfo.
///
/// Categorization uses `workflowType` frontmatter if present (BUG-003 fix),
/// falling back to filename-based categorization.
pub fn parse_artifact_file(path: &Path) -> Option<ArtifactInfo> {
    if !path.is_file() {
        return None;
    }

    let extension = path.extension()?.to_str()?;
    if extension != "md" {
        return None;
    }

    let filename = path.file_name()?.to_str()?;
    let content = fs::read_to_string(path).ok()?;

    // BUG-003 fix: Check workflowType frontmatter first for categorization
    let category = if let Some(workflow_type) = extract_workflow_type_from_content(&content) {
        if is_planning_workflow_type(&workflow_type) {
            ArtifactCategory::Planning
        } else {
            // Fallback to filename-based categorization
            categorize_artifact(filename)
        }
    } else {
        // No workflowType - use filename-based categorization
        categorize_artifact(filename)
    };

    let title = extract_title_from_content(&content, filename);
    let status = extract_status_from_content(&content);

    // Get modification time
    let metadata = fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?;
    let modified_at = chrono::DateTime::<chrono::Utc>::from(modified)
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string();

    // Extract IDs based on category
    let epic_id = match category {
        ArtifactCategory::Epic | ArtifactCategory::Retrospective => extract_epic_id(filename),
        ArtifactCategory::Story => {
            extract_story_id(filename).map(|s| s.split('-').next().unwrap_or("").to_string())
        }
        _ => None,
    };

    let story_id = match category {
        ArtifactCategory::Story => extract_story_id(filename),
        _ => None,
    };

    Some(ArtifactInfo {
        path: path.to_string_lossy().to_string(),
        title,
        category,
        epic_id,
        story_id,
        modified_at,
        status,
    })
}

/// Lists all artifacts in a project, organized by category.
///
/// Scans `_bmad-output/planning-artifacts`, `_bmad-output/implementation-artifacts`,
/// and `_bmad-output/design`.
pub fn list_artifacts(project_path: &Path) -> ArtifactGroups {
    let mut groups = ArtifactGroups::default();
    let output_base = project_path.join("_bmad-output");

    // Scan planning-artifacts
    let planning_dir = output_base.join("planning-artifacts");
    if planning_dir.exists() {
        scan_directory_for_artifacts(&planning_dir, &mut groups);
    }

    // Scan implementation-artifacts
    let impl_dir = output_base.join("implementation-artifacts");
    if impl_dir.exists() {
        scan_directory_for_artifacts(&impl_dir, &mut groups);
    }

    // Scan design folder
    let design_dir = output_base.join("design");
    if design_dir.exists() {
        scan_directory_for_artifacts(&design_dir, &mut groups);
    }

    // Sort each category by modified_at descending (newest first)
    sort_artifacts_by_date(&mut groups.epics);
    sort_artifacts_by_date(&mut groups.stories);
    sort_artifacts_by_date(&mut groups.retrospectives);
    sort_artifacts_by_date(&mut groups.design);
    sort_artifacts_by_date(&mut groups.planning);
    sort_artifacts_by_date(&mut groups.other);

    groups
}

/// Scans a directory recursively for artifact files.
fn scan_directory_for_artifacts(dir: &Path, groups: &mut ArtifactGroups) {
    if !dir.exists() || !dir.is_dir() {
        return;
    }

    for entry in walkdir::WalkDir::new(dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if let Some(artifact) = parse_artifact_file(path) {
            groups.add(artifact);
        }
    }
}

/// Sorts artifacts by modified_at descending (newest first).
fn sort_artifacts_by_date(artifacts: &mut [ArtifactInfo]) {
    artifacts.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
}

/// Gets a specific story artifact by its ID.
pub fn get_story_artifact(project_path: &Path, story_id: &str) -> Option<ArtifactInfo> {
    let impl_dir = project_path.join("_bmad-output/implementation-artifacts");

    // Story files can follow two patterns:
    // 1. Exact match: {story_id}.md (e.g., "5-7-story-workflow-view.md")
    // 2. Prefix match: {story_id}-*.md (for numeric-only IDs like "5-7-*.md")
    let exact_match = format!("{}.md", story_id);
    let prefix_pattern = format!("{}-", story_id);

    for entry in walkdir::WalkDir::new(&impl_dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
            // Check exact match first (story_id includes slug)
            if filename == exact_match {
                return parse_artifact_file(path);
            }
            // Fallback to prefix match (story_id is numeric only)
            if filename.starts_with(&prefix_pattern) && filename.ends_with(".md") {
                return parse_artifact_file(path);
            }
        }
    }

    None
}

/// Gets a specific epic artifact by its ID.
pub fn get_epic_artifact(project_path: &Path, epic_id: &str) -> Option<ArtifactInfo> {
    let impl_dir = project_path.join("_bmad-output/implementation-artifacts");

    // Epic files follow pattern: epic-{id}-*.md (not retro)
    let pattern = format!("epic-{}-", epic_id);
    let pattern_exact = format!("epic-{}.md", epic_id);

    for entry in walkdir::WalkDir::new(&impl_dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
            let filename_lower = filename.to_lowercase();
            // Match epic-N-name.md or epic-N.md, but not epic-N-retro-*.md
            if (filename_lower.starts_with(&pattern.to_lowercase())
                || filename_lower == pattern_exact.to_lowercase())
                && !filename_lower.contains("-retro")
            {
                return parse_artifact_file(path);
            }
        }
    }

    None
}

/// Reads the content of an artifact file.
pub fn read_artifact_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

/// Artifacts grouped by epic workflow stage for the Epic Workflow view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EpicArtifacts {
    /// Planning stage artifacts (PRD, Tech Spec, Design docs) for this epic
    pub planning: Vec<ArtifactInfo>,
    /// Number of done stories for this epic
    pub story_done_count: usize,
    /// Total number of stories for this epic
    pub story_total_count: usize,
    /// Retrospective artifact if it exists
    pub retro: Option<ArtifactInfo>,
}

/// Gets artifacts grouped by workflow stage for a specific epic.
///
/// Returns planning artifacts, story counts, and retro document for the epic.
pub fn get_epic_artifacts(project_path: &Path, epic_id: &str) -> EpicArtifacts {
    let output_base = project_path.join("_bmad-output");
    let planning_dir = output_base.join("planning-artifacts");
    let impl_dir = output_base.join("implementation-artifacts");

    let mut planning = Vec::new();
    let mut retro = None;

    // Scan planning-artifacts for epic-related docs
    if planning_dir.exists() {
        for entry in walkdir::WalkDir::new(&planning_dir)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if let Some(artifact) = parse_artifact_file(path) {
                // Include planning docs that reference this epic
                if is_planning_artifact_for_epic(&artifact, epic_id, path) {
                    planning.push(artifact);
                }
            }
        }
    }

    // Scan implementation-artifacts for epic-specific files and retro
    if impl_dir.exists() {
        for entry in walkdir::WalkDir::new(&impl_dir)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                // Check for retro files: *retro*{epic_id}*.md or epic-{id}-retro*.md
                if is_retro_file_for_epic(filename, epic_id) {
                    if let Some(artifact) = parse_artifact_file(path) {
                        retro = Some(artifact);
                    }
                }
                // Check for design docs tied to this epic
                else if is_design_doc_for_epic(filename, epic_id) {
                    if let Some(artifact) = parse_artifact_file(path) {
                        planning.push(artifact);
                    }
                }
            }
        }
    }

    // Get story counts from sprint status
    let sprint_status = super::parse_sprint_status(project_path);
    let epic_stories: Vec<_> = sprint_status
        .stories
        .iter()
        .filter(|s| s.epic_id == epic_id)
        .collect();

    let story_total_count = epic_stories.len();
    let story_done_count = epic_stories
        .iter()
        .filter(|s| s.status == super::StoryStatus::Done)
        .count();

    // Sort planning artifacts by title
    planning.sort_by(|a, b| a.title.cmp(&b.title));

    EpicArtifacts {
        planning,
        story_done_count,
        story_total_count,
        retro,
    }
}

/// Checks if a planning artifact is related to a specific epic.
///
/// An artifact is considered a planning artifact for an epic if:
/// 1. Its workflowType matches planning types (product-brief, prd, tech-spec, etc.)
/// 2. OR its filename contains the epic reference (epic-{id})
/// 3. AND it's associated with this specific epic
fn is_planning_artifact_for_epic(artifact: &ArtifactInfo, epic_id: &str, path: &Path) -> bool {
    // First check: does this artifact reference this epic?
    let references_epic = if let Some(ref aid) = artifact.epic_id {
        aid == epic_id
    } else if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
        let filename_lower = filename.to_lowercase();
        let epic_pattern = format!("epic-{}", epic_id.to_lowercase());
        let epic_pattern_dot = format!("epic-{}.", epic_id.to_lowercase());
        filename_lower.contains(&epic_pattern) || filename_lower.contains(&epic_pattern_dot)
    } else {
        false
    };

    if !references_epic {
        return false;
    }

    // Second check: is this a planning-type artifact?
    // Check workflowType from file content
    if let Ok(content) = fs::read_to_string(path) {
        if let Some(workflow_type) = extract_workflow_type_from_content(&content) {
            if is_planning_workflow_type(&workflow_type) {
                return true;
            }
        }
    }

    // Fall back to filename-based detection for artifacts without workflowType
    if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
        let filename_lower = filename.to_lowercase();
        // Planning filename patterns
        if filename_lower.contains("-prd")
            || filename_lower.contains("-tech-spec")
            || filename_lower.contains("-architecture")
            || filename_lower.contains("-product-brief")
        {
            return true;
        }
    }

    // If it references the epic but we can't determine type, include it
    // (conservative approach - better to show than hide)
    true
}

/// Checks if a file is a retrospective for a specific epic.
fn is_retro_file_for_epic(filename: &str, epic_id: &str) -> bool {
    let filename_lower = filename.to_lowercase();

    // Pattern 1: epic-{id}-retro*.md (e.g., epic-4-retrospective.md, epic-4-retro-2026-02-22.md)
    let pattern1 = format!("epic-{}-retro", epic_id.to_lowercase());

    // Pattern 2: {id}-retrospective.md (e.g., 4-retrospective.md)
    let pattern2 = format!("{}-retrospective", epic_id.to_lowercase());

    filename_lower.starts_with(&pattern1) || filename_lower.starts_with(&pattern2)
}

/// Checks if a file is a design doc for a specific epic.
fn is_design_doc_for_epic(filename: &str, epic_id: &str) -> bool {
    let filename_lower = filename.to_lowercase();

    // Design docs: epic-{id}-ux-design.md, epic-{id}-tech-reference.md
    let pattern = format!("epic-{}-", epic_id.to_lowercase());

    if !filename_lower.starts_with(&pattern) {
        return false;
    }

    // Exclude retro files (handled separately)
    if filename_lower.contains("-retro") {
        return false;
    }

    // Include design-related files
    filename_lower.contains("-ux-")
        || filename_lower.contains("-design")
        || filename_lower.contains("-tech-")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    // ========== Category tests ==========

    #[test]
    fn test_categorize_retrospective() {
        assert_eq!(
            categorize_artifact("epic-1-retro-2026-02-17.md"),
            ArtifactCategory::Retrospective
        );
        assert_eq!(
            categorize_artifact("epic-2.5-retro-2026-02-22.md"),
            ArtifactCategory::Retrospective
        );
    }

    #[test]
    fn test_categorize_epic() {
        assert_eq!(
            categorize_artifact("epic-1-foundation.md"),
            ArtifactCategory::Epic
        );
        assert_eq!(
            categorize_artifact("epic-2.5-prep-sprint.md"),
            ArtifactCategory::Epic
        );
        assert_eq!(
            categorize_artifact("epic-4-polish.md"),
            ArtifactCategory::Epic
        );
    }

    #[test]
    fn test_categorize_story() {
        assert_eq!(
            categorize_artifact("1-1-tauri-svelte-scaffold.md"),
            ArtifactCategory::Story
        );
        assert_eq!(
            categorize_artifact("2.5-1-frontend-test.md"),
            ArtifactCategory::Story
        );
        assert_eq!(
            categorize_artifact("3-4-story-binding.md"),
            ArtifactCategory::Story
        );
    }

    #[test]
    fn test_categorize_design() {
        assert_eq!(
            categorize_artifact("epic-4-ux-design.md"),
            ArtifactCategory::Design
        );
        assert_eq!(
            categorize_artifact("epic-3-tech-reference.md"),
            ArtifactCategory::Design
        );
    }

    #[test]
    fn test_categorize_planning() {
        assert_eq!(
            categorize_artifact("prd-bmad-manager.md"),
            ArtifactCategory::Planning
        );
        assert_eq!(
            categorize_artifact("architecture-overview.md"),
            ArtifactCategory::Planning
        );
        assert_eq!(
            categorize_artifact("product-brief-bmad-manager-2026-02-15.md"),
            ArtifactCategory::Planning
        );
        assert_eq!(
            categorize_artifact("tech-spec-bmad-manager-2026-02-15.md"),
            ArtifactCategory::Planning
        );
    }

    #[test]
    fn test_categorize_other() {
        assert_eq!(
            categorize_artifact("bmad-workflow-parsing-design.md"),
            ArtifactCategory::Other
        );
        assert_eq!(
            categorize_artifact("random-notes.md"),
            ArtifactCategory::Other
        );
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
        assert!(!is_story_filename("1-name.md")); // Only one part
        assert!(!is_story_filename("a-1-name.md")); // Letter in first part
    }

    // ========== ID extraction tests ==========

    #[test]
    fn test_extract_epic_id() {
        assert_eq!(
            extract_epic_id("epic-1-foundation.md"),
            Some("1".to_string())
        );
        assert_eq!(extract_epic_id("epic-2.5-prep.md"), Some("2.5".to_string()));
        assert_eq!(extract_epic_id("epic-3-retro.md"), Some("3".to_string()));
        assert_eq!(extract_epic_id("not-an-epic.md"), None);
    }

    #[test]
    fn test_extract_story_id() {
        assert_eq!(extract_story_id("1-1-name.md"), Some("1-1".to_string()));
        assert_eq!(extract_story_id("2.5-3-name.md"), Some("2.5-3".to_string()));
        assert_eq!(extract_story_id("epic-1.md"), None);
    }

    // ========== Content extraction tests ==========

    #[test]
    fn test_extract_title_from_content() {
        let content = "# Story 1.1: Test Story\n\nSome content";
        assert_eq!(
            extract_title_from_content(content, "test.md"),
            "Story 1.1: Test Story"
        );
    }

    #[test]
    fn test_extract_title_fallback_to_filename() {
        let content = "No heading here";
        assert_eq!(extract_title_from_content(content, "my-file.md"), "my-file");
    }

    #[test]
    fn test_extract_status_from_content() {
        let content = "# Title\n\nStatus: in-progress\n\nContent";
        assert_eq!(
            extract_status_from_content(content),
            Some("in-progress".to_string())
        );
    }

    #[test]
    fn test_extract_status_none() {
        let content = "# Title\n\nNo status line here";
        assert_eq!(extract_status_from_content(content), None);
    }

    // ========== Workflow type extraction tests ==========

    #[test]
    fn test_extract_workflow_type_from_frontmatter() {
        let content = "---\ntitle: Test\nworkflowType: prd\nstatus: draft\n---\n# Content";
        assert_eq!(
            extract_workflow_type_from_content(content),
            Some("prd".to_string())
        );
    }

    #[test]
    fn test_extract_workflow_type_quoted() {
        let content = "---\nworkflowType: \"tech-spec\"\n---\n# Content";
        assert_eq!(
            extract_workflow_type_from_content(content),
            Some("tech-spec".to_string())
        );
    }

    #[test]
    fn test_extract_workflow_type_none() {
        let content = "# No frontmatter\n\nJust content";
        assert_eq!(extract_workflow_type_from_content(content), None);
    }

    #[test]
    fn test_is_planning_workflow_type_exact_matches() {
        assert!(is_planning_workflow_type("prd"));
        assert!(is_planning_workflow_type("PRD"));
        assert!(is_planning_workflow_type("tech-spec"));
        assert!(is_planning_workflow_type("architecture"));
        assert!(is_planning_workflow_type("product-brief"));
    }

    #[test]
    fn test_is_planning_workflow_type_wildcards() {
        assert!(is_planning_workflow_type("ux-design"));
        assert!(is_planning_workflow_type("epic-5-ux-design"));
        assert!(is_planning_workflow_type("system-design"));
        assert!(is_planning_workflow_type("ux-wireframes"));
    }

    #[test]
    fn test_is_planning_workflow_type_non_planning() {
        assert!(!is_planning_workflow_type("story"));
        assert!(!is_planning_workflow_type("retrospective"));
        assert!(!is_planning_workflow_type("epic"));
        assert!(!is_planning_workflow_type("random-workflow"));
    }

    // ========== Parse artifact tests ==========

    #[test]
    fn test_parse_artifact_file_story() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("1-1-test-story.md");
        fs::write(
            &file,
            "# Story 1.1: Test Story\n\nStatus: done\n\n## Content",
        )
        .unwrap();

        let result = parse_artifact_file(&file);
        assert!(result.is_some());

        let artifact = result.unwrap();
        assert_eq!(artifact.title, "Story 1.1: Test Story");
        assert_eq!(artifact.category, ArtifactCategory::Story);
        assert_eq!(artifact.story_id, Some("1-1".to_string()));
        assert_eq!(artifact.status, Some("done".to_string()));
    }

    #[test]
    fn test_parse_artifact_file_epic() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("epic-2-workflow.md");
        fs::write(&file, "# Epic 2: Workflow Visualization\n\nContent").unwrap();

        let result = parse_artifact_file(&file);
        assert!(result.is_some());

        let artifact = result.unwrap();
        assert_eq!(artifact.category, ArtifactCategory::Epic);
        assert_eq!(artifact.epic_id, Some("2".to_string()));
    }

    #[test]
    fn test_parse_artifact_file_non_md() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("readme.txt");
        fs::write(&file, "Not a markdown file").unwrap();

        let result = parse_artifact_file(&file);
        assert!(result.is_none());
    }

    // ========== Artifact groups tests ==========

    #[test]
    fn test_artifact_groups_add() {
        let mut groups = ArtifactGroups::default();

        let story = ArtifactInfo {
            path: "/test/1-1-story.md".to_string(),
            title: "Test Story".to_string(),
            category: ArtifactCategory::Story,
            epic_id: Some("1".to_string()),
            story_id: Some("1-1".to_string()),
            modified_at: "2026-02-22T10:00:00Z".to_string(),
            status: Some("done".to_string()),
        };

        groups.add(story);
        assert_eq!(groups.stories.len(), 1);
        assert_eq!(groups.total_count(), 1);
    }

    // ========== List artifacts integration test ==========

    #[test]
    fn test_list_artifacts_empty_project() {
        let dir = tempdir().unwrap();
        let groups = list_artifacts(dir.path());
        assert_eq!(groups.total_count(), 0);
    }

    #[test]
    fn test_list_artifacts_with_files() {
        let dir = tempdir().unwrap();
        let impl_dir = dir.path().join("_bmad-output/implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();

        // Create a story
        fs::write(
            impl_dir.join("1-1-test.md"),
            "# Story 1.1: Test\n\nStatus: done",
        )
        .unwrap();

        // Create an epic
        fs::write(
            impl_dir.join("epic-1-foundation.md"),
            "# Epic 1: Foundation",
        )
        .unwrap();

        let groups = list_artifacts(dir.path());
        assert_eq!(groups.stories.len(), 1);
        assert_eq!(groups.epics.len(), 1);
        assert_eq!(groups.total_count(), 2);
    }

    // ========== Serialization tests ==========

    #[test]
    fn test_artifact_category_serialization() {
        assert_eq!(
            serde_json::to_string(&ArtifactCategory::Epic).unwrap(),
            "\"epic\""
        );
        assert_eq!(
            serde_json::to_string(&ArtifactCategory::Story).unwrap(),
            "\"story\""
        );
        assert_eq!(
            serde_json::to_string(&ArtifactCategory::Retrospective).unwrap(),
            "\"retrospective\""
        );
    }

    #[test]
    fn test_artifact_info_camel_case_serialization() {
        let artifact = ArtifactInfo {
            path: "/test/path.md".to_string(),
            title: "Test".to_string(),
            category: ArtifactCategory::Story,
            epic_id: Some("1".to_string()),
            story_id: Some("1-1".to_string()),
            modified_at: "2026-02-22T10:00:00Z".to_string(),
            status: Some("done".to_string()),
        };

        let json = serde_json::to_string(&artifact).unwrap();
        assert!(json.contains("\"epicId\""));
        assert!(json.contains("\"storyId\""));
        assert!(json.contains("\"modifiedAt\""));
        assert!(!json.contains("\"epic_id\""));
        assert!(!json.contains("\"story_id\""));
        assert!(!json.contains("\"modified_at\""));
    }

    // ========== Design folder scanning tests (Story 5-10) ==========

    #[test]
    fn test_list_artifacts_with_design_folder() {
        let dir = tempdir().unwrap();

        // Create implementation-artifacts with a story
        let impl_dir = dir.path().join("_bmad-output/implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();
        fs::write(
            impl_dir.join("1-1-test.md"),
            "# Story 1.1: Test\n\nStatus: done",
        )
        .unwrap();

        // Create design folder with a design doc
        let design_dir = dir.path().join("_bmad-output/design");
        fs::create_dir_all(&design_dir).unwrap();
        fs::write(
            design_dir.join("epic-5-ux-design.md"),
            "# Epic 5 UX Design\n\nDesign document content",
        )
        .unwrap();

        let groups = list_artifacts(dir.path());

        // Should find story from implementation-artifacts
        assert_eq!(groups.stories.len(), 1);
        // Should find design doc from design folder
        assert_eq!(groups.design.len(), 1);
        assert_eq!(groups.design[0].title, "Epic 5 UX Design");
        // Total count should include both
        assert_eq!(groups.total_count(), 2);
    }

    #[test]
    fn test_list_artifacts_missing_design_folder_graceful() {
        let dir = tempdir().unwrap();

        // Create only implementation-artifacts (no design folder)
        let impl_dir = dir.path().join("_bmad-output/implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();
        fs::write(
            impl_dir.join("1-1-test.md"),
            "# Story 1.1: Test\n\nStatus: done",
        )
        .unwrap();

        // Should not error when design folder doesn't exist
        let groups = list_artifacts(dir.path());

        // Should still find the story
        assert_eq!(groups.stories.len(), 1);
        // Design should be empty (graceful handling)
        assert_eq!(groups.design.len(), 0);
    }

    #[test]
    fn test_list_artifacts_all_three_folders() {
        let dir = tempdir().unwrap();

        // Create planning-artifacts
        let planning_dir = dir.path().join("_bmad-output/planning-artifacts");
        fs::create_dir_all(&planning_dir).unwrap();
        fs::write(
            planning_dir.join("prd-bmad-manager.md"),
            "# PRD: BMAD Manager\n\nProduct requirements",
        )
        .unwrap();

        // Create implementation-artifacts
        let impl_dir = dir.path().join("_bmad-output/implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();
        fs::write(
            impl_dir.join("epic-1-foundation.md"),
            "# Epic 1: Foundation\n\nEpic content",
        )
        .unwrap();

        // Create design folder
        let design_dir = dir.path().join("_bmad-output/design");
        fs::create_dir_all(&design_dir).unwrap();
        fs::write(
            design_dir.join("epic-4-tech-reference.md"),
            "# Tech Reference\n\nTechnical documentation",
        )
        .unwrap();

        let groups = list_artifacts(dir.path());

        // Should find artifacts from all three folders
        assert_eq!(groups.planning.len(), 1);
        assert_eq!(groups.epics.len(), 1);
        assert_eq!(groups.design.len(), 1);
        assert_eq!(groups.total_count(), 3);
    }

    #[test]
    fn test_design_folder_artifacts_properly_categorized() {
        let dir = tempdir().unwrap();

        // Create design folder with multiple artifact types
        let design_dir = dir.path().join("_bmad-output/design");
        fs::create_dir_all(&design_dir).unwrap();

        // UX design doc -> Design category (with Status frontmatter for AC3)
        fs::write(
            design_dir.join("epic-5-ux-design.md"),
            "# Epic 5 UX Design\n\nStatus: draft\n\nUX content",
        )
        .unwrap();

        // Tech reference -> Design category
        fs::write(
            design_dir.join("epic-3-tech-reference.md"),
            "# Tech Reference\n\nStatus: approved\n\nTech content",
        )
        .unwrap();

        // Planning doc in design folder -> Planning category
        fs::write(
            design_dir.join("architecture-overview.md"),
            "# Architecture Overview\n\nArchitecture content",
        )
        .unwrap();

        let groups = list_artifacts(dir.path());

        // Two design docs
        assert_eq!(groups.design.len(), 2);
        // One planning doc
        assert_eq!(groups.planning.len(), 1);
        assert_eq!(groups.total_count(), 3);

        // AC3: Verify frontmatter parsing works same as planning artifacts
        // Design docs should have their Status field parsed
        let ux_design = groups.design.iter().find(|a| a.title == "Epic 5 UX Design");
        assert!(ux_design.is_some(), "UX design doc should be found");
        assert_eq!(ux_design.unwrap().status, Some("draft".to_string()));

        let tech_ref = groups.design.iter().find(|a| a.title == "Tech Reference");
        assert!(tech_ref.is_some(), "Tech reference doc should be found");
        assert_eq!(tech_ref.unwrap().status, Some("approved".to_string()));
    }

    #[test]
    fn test_design_folder_nested_directories() {
        let dir = tempdir().unwrap();

        // Create nested design folder structure
        let nested_dir = dir.path().join("_bmad-output/design/wireframes");
        fs::create_dir_all(&nested_dir).unwrap();

        // Doc in root design folder
        let design_dir = dir.path().join("_bmad-output/design");
        fs::write(
            design_dir.join("epic-5-ux-design.md"),
            "# Epic 5 UX Design\n\nStatus: draft",
        )
        .unwrap();

        // Doc in nested subfolder
        fs::write(
            nested_dir.join("epic-5-tech-reference.md"),
            "# Wireframe Tech Reference\n\nStatus: in-progress",
        )
        .unwrap();

        let groups = list_artifacts(dir.path());

        // Should find both docs (recursive scanning)
        assert_eq!(groups.design.len(), 2);

        // Verify nested doc was found and parsed correctly
        let nested_doc = groups
            .design
            .iter()
            .find(|a| a.title == "Wireframe Tech Reference");
        assert!(nested_doc.is_some(), "Nested design doc should be found");
        assert_eq!(nested_doc.unwrap().status, Some("in-progress".to_string()));
    }
}
