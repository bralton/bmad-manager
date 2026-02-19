//! Workflow state aggregation for BMAD projects.
//!
//! Aggregates artifact metadata into a unified workflow state that powers
//! the Workflow Visualizer component in the frontend.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use super::{
    scan_all_project_artifacts, scan_implementation_items, ArtifactMeta, ArtifactStatus,
    BugStatus, ImplementationItems, StoryStatus,
};

/// Development phase in the BMAD workflow.
///
/// Phases are ordered by progression, with `NotStarted` being the initial state
/// and `Implementation` being the final active phase.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum Phase {
    NotStarted,
    Discovery,
    Planning,
    Solutioning,
    Implementation,
}

/// Currently active workflow being worked on.
///
/// Represents a workflow that is in progress (draft status or incomplete steps).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActiveWorkflow {
    /// Type of workflow (e.g., "prd", "tech-spec", "create-story")
    pub workflow_type: String,
    /// Path to the output artifact file
    pub output_path: PathBuf,
    /// Array of completed step numbers
    pub steps_completed: Vec<u32>,
    /// The highest completed step number (0 if none)
    pub last_step: u32,
}

/// Aggregated workflow state for the project.
///
/// This is the main data structure returned to the frontend to power
/// the workflow visualizer component.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowState {
    /// Current development phase based on artifact analysis
    pub current_phase: Phase,
    /// Currently active workflow (if any is in progress)
    pub active_workflow: Option<ActiveWorkflow>,
    /// List of completed (approved) artifacts, sorted by date descending
    pub completed_artifacts: Vec<ArtifactMeta>,
}

/// Maps a workflow type string to its corresponding development phase.
///
/// # Arguments
/// * `workflow_type` - The workflow type from artifact frontmatter
///
/// # Returns
/// The `Phase` that corresponds to the workflow type
fn workflow_type_to_phase(workflow_type: &str) -> Phase {
    let wt = workflow_type.to_lowercase();

    // Implementation phase (highest priority)
    if wt.contains("story") || wt.contains("sprint") || wt.contains("implementation") {
        return Phase::Implementation;
    }

    // Solutioning phase
    if wt.contains("tech-spec") || wt.contains("architecture") {
        return Phase::Solutioning;
    }

    // Planning phase
    if wt.contains("prd") || wt.contains("ux") || wt.contains("design") {
        return Phase::Planning;
    }

    // Discovery phase
    if wt.contains("brief") || wt.contains("discovery") {
        return Phase::Discovery;
    }

    // Default to planning for unknown types
    // Log a warning to help identify unmapped workflow types
    eprintln!(
        "Warning: Unknown workflow type '{}' defaulting to Planning phase",
        workflow_type
    );
    Phase::Planning
}

/// Determines the current development phase from artifacts and implementation items.
///
/// Phase detection follows priority order (highest first):
/// 1. Implementation - Any active story/bug OR draft artifact with implementation workflow type
/// 2. Solutioning - Any draft artifact with solutioning workflow type
/// 3. Planning - Any draft artifact with planning workflow type
/// 4. Discovery - Any draft artifact with discovery workflow type
/// 5. NotStarted - No artifacts or all approved
///
/// Stories with status `in-progress`, `review`, or `done` indicate active implementation.
/// Bugs with status `in-progress` or `resolved` also indicate implementation work.
///
/// When no active work exists, returns the phase of the most recent approved artifact.
///
/// # Arguments
/// * `artifacts` - Slice of artifact metadata to analyze
/// * `impl_items` - Optional implementation items (stories and bugs)
///
/// # Preconditions
/// * `artifacts` should be sorted by date descending (newest first) for correct
///   "most recent approved" fallback behavior.
///
/// # Returns
/// The determined current phase
pub fn determine_phase(artifacts: &[ArtifactMeta], impl_items: Option<&ImplementationItems>) -> Phase {
    // Check for active implementation work (stories and bugs)
    if let Some(items) = impl_items {
        // Any story with in-progress, review, or done status = Implementation
        let has_active_story = items.stories.iter().any(|s| {
            matches!(
                s.status,
                StoryStatus::InProgress | StoryStatus::Review | StoryStatus::Done
            )
        });

        // Any bug with in-progress, review, or resolved status = Implementation
        let has_active_bug = items.bugs.iter().any(|b| {
            matches!(b.status, BugStatus::InProgress | BugStatus::Review | BugStatus::Resolved)
        });

        if has_active_story || has_active_bug {
            return Phase::Implementation;
        }
    }

    if artifacts.is_empty() {
        return Phase::NotStarted;
    }

    // Find the highest priority phase among draft artifacts
    let mut highest_phase = Phase::NotStarted;

    for artifact in artifacts {
        if artifact.status == ArtifactStatus::Draft {
            let phase = workflow_type_to_phase(&artifact.workflow_type);
            if phase > highest_phase {
                highest_phase = phase;
            }
        }
    }

    // If no drafts, use the most recent approved artifact's phase
    if highest_phase == Phase::NotStarted {
        // Artifacts are already sorted by date descending, so find first approved
        for artifact in artifacts {
            if artifact.status == ArtifactStatus::Approved {
                return workflow_type_to_phase(&artifact.workflow_type);
            }
        }
    }

    highest_phase
}

/// Detects the currently active workflow from a list of artifacts.
///
/// An active workflow is an artifact with `status=draft`.
///
/// Note: The original design mentioned "incomplete stepsCompleted array" as an
/// alternative criterion, but this requires knowing the total steps in a workflow,
/// which isn't available from artifact metadata alone. We use draft status as the
/// sole indicator of active work.
///
/// Returns the most recent active artifact if multiple exist.
///
/// # Arguments
/// * `artifacts` - Slice of artifact metadata to analyze (should be sorted by date descending)
///
/// # Returns
/// The active workflow if one exists, or None
pub fn detect_active_workflow(artifacts: &[ArtifactMeta]) -> Option<ActiveWorkflow> {
    // Artifacts should already be sorted by date descending
    // Find the first (most recent) draft artifact
    for artifact in artifacts {
        if artifact.status == ArtifactStatus::Draft {
            let last_step = artifact.steps_completed.iter().max().copied().unwrap_or(0);

            return Some(ActiveWorkflow {
                workflow_type: artifact.workflow_type.clone(),
                output_path: artifact.path.clone(),
                steps_completed: artifact.steps_completed.clone(),
                last_step,
            });
        }
    }

    None
}

/// Aggregates workflow state from a project directory.
///
/// Scans both `planning-artifacts` and `implementation-artifacts` directories,
/// analyzes artifacts, stories, and bugs to return a unified workflow state.
///
/// # Arguments
/// * `project_path` - Path to the project root directory
///
/// # Returns
/// Aggregated workflow state for the project
pub fn aggregate_workflow_state(project_path: &Path) -> WorkflowState {
    // Use shared function to scan all artifact directories
    let all_artifacts = scan_all_project_artifacts(project_path);

    // Scan implementation items (stories and bugs) separately
    let impl_dir = project_path.join("_bmad-output").join("implementation-artifacts");
    let impl_items = scan_implementation_items(&impl_dir);

    // Determine phase considering both artifacts and implementation items
    let current_phase = determine_phase(&all_artifacts, Some(&impl_items));
    let active_workflow = detect_active_workflow(&all_artifacts);

    // Filter completed artifacts (status=approved)
    let completed_artifacts: Vec<ArtifactMeta> = all_artifacts
        .into_iter()
        .filter(|a| a.status == ArtifactStatus::Approved)
        .collect();

    WorkflowState {
        current_phase,
        active_workflow,
        completed_artifacts,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::artifacts::{BugMeta, StoryMeta};
    use std::fs;
    use tempfile::tempdir;

    fn create_test_artifact(dir: &Path, filename: &str, frontmatter: &str) {
        fs::write(
            dir.join(filename),
            format!("---\n{}\n---\n# Content", frontmatter),
        )
        .unwrap();
    }

    // ========== Phase enum tests ==========

    #[test]
    fn test_phase_ordering() {
        assert!(Phase::NotStarted < Phase::Discovery);
        assert!(Phase::Discovery < Phase::Planning);
        assert!(Phase::Planning < Phase::Solutioning);
        assert!(Phase::Solutioning < Phase::Implementation);
    }

    #[test]
    fn test_phase_serialization() {
        assert_eq!(serde_json::to_string(&Phase::NotStarted).unwrap(), "\"not-started\"");
        assert_eq!(serde_json::to_string(&Phase::Discovery).unwrap(), "\"discovery\"");
        assert_eq!(serde_json::to_string(&Phase::Planning).unwrap(), "\"planning\"");
        assert_eq!(serde_json::to_string(&Phase::Solutioning).unwrap(), "\"solutioning\"");
        assert_eq!(serde_json::to_string(&Phase::Implementation).unwrap(), "\"implementation\"");
    }

    // ========== workflow_type_to_phase tests ==========

    #[test]
    fn test_workflow_type_to_phase_implementation() {
        assert_eq!(workflow_type_to_phase("create-story"), Phase::Implementation);
        assert_eq!(workflow_type_to_phase("dev-story"), Phase::Implementation);
        assert_eq!(workflow_type_to_phase("story"), Phase::Implementation);
        assert_eq!(workflow_type_to_phase("sprint-planning"), Phase::Implementation);
    }

    #[test]
    fn test_workflow_type_to_phase_solutioning() {
        assert_eq!(workflow_type_to_phase("tech-spec"), Phase::Solutioning);
        assert_eq!(workflow_type_to_phase("architecture"), Phase::Solutioning);
        assert_eq!(workflow_type_to_phase("create-architecture"), Phase::Solutioning);
    }

    #[test]
    fn test_workflow_type_to_phase_planning() {
        assert_eq!(workflow_type_to_phase("prd"), Phase::Planning);
        assert_eq!(workflow_type_to_phase("ux-design"), Phase::Planning);
        assert_eq!(workflow_type_to_phase("create-ux-design"), Phase::Planning);
    }

    #[test]
    fn test_workflow_type_to_phase_discovery() {
        assert_eq!(workflow_type_to_phase("product-brief"), Phase::Discovery);
        assert_eq!(workflow_type_to_phase("discovery"), Phase::Discovery);
    }

    #[test]
    fn test_workflow_type_to_phase_unknown() {
        // Unknown types default to Planning
        assert_eq!(workflow_type_to_phase("unknown"), Phase::Planning);
        assert_eq!(workflow_type_to_phase("random-thing"), Phase::Planning);
    }

    // ========== determine_phase tests ==========

    #[test]
    fn test_determine_phase_empty_artifacts() {
        let artifacts: Vec<ArtifactMeta> = vec![];
        assert_eq!(determine_phase(&artifacts, None), Phase::NotStarted);
    }

    #[test]
    fn test_determine_phase_single_draft_discovery() {
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("product-brief.md"),
            title: "Product Brief".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Draft,
            workflow_type: "product-brief".to_string(),
            steps_completed: vec![],
            input_documents: vec![],
        }];
        assert_eq!(determine_phase(&artifacts, None), Phase::Discovery);
    }

    #[test]
    fn test_determine_phase_single_draft_implementation() {
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("1-1-story.md"),
            title: "Story 1.1".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Draft,
            workflow_type: "create-story".to_string(),
            steps_completed: vec![1, 2],
            input_documents: vec![],
        }];
        assert_eq!(determine_phase(&artifacts, None), Phase::Implementation);
    }

    #[test]
    fn test_determine_phase_mixed_drafts_highest_wins() {
        // Discovery draft and Implementation draft - Implementation should win
        let artifacts = vec![
            ArtifactMeta {
                path: PathBuf::from("product-brief.md"),
                title: "Product Brief".to_string(),
                created: "2026-02-15".to_string(),
                status: ArtifactStatus::Draft,
                workflow_type: "product-brief".to_string(),
                steps_completed: vec![],
                input_documents: vec![],
            },
            ArtifactMeta {
                path: PathBuf::from("1-1-story.md"),
                title: "Story 1.1".to_string(),
                created: "2026-02-17".to_string(),
                status: ArtifactStatus::Draft,
                workflow_type: "create-story".to_string(),
                steps_completed: vec![1],
                input_documents: vec![],
            },
        ];
        assert_eq!(determine_phase(&artifacts, None), Phase::Implementation);
    }

    #[test]
    fn test_determine_phase_all_approved_uses_most_recent() {
        let artifacts = vec![
            ArtifactMeta {
                path: PathBuf::from("tech-spec.md"),
                title: "Tech Spec".to_string(),
                created: "2026-02-17".to_string(), // Most recent
                status: ArtifactStatus::Approved,
                workflow_type: "tech-spec".to_string(),
                steps_completed: vec![1, 2, 3],
                input_documents: vec![],
            },
            ArtifactMeta {
                path: PathBuf::from("product-brief.md"),
                title: "Product Brief".to_string(),
                created: "2026-02-15".to_string(),
                status: ArtifactStatus::Approved,
                workflow_type: "product-brief".to_string(),
                steps_completed: vec![],
                input_documents: vec![],
            },
        ];
        // Most recent approved is tech-spec -> Solutioning
        assert_eq!(determine_phase(&artifacts, None), Phase::Solutioning);
    }

    // ========== detect_active_workflow tests ==========

    #[test]
    fn test_detect_active_workflow_none_when_empty() {
        let artifacts: Vec<ArtifactMeta> = vec![];
        assert!(detect_active_workflow(&artifacts).is_none());
    }

    #[test]
    fn test_detect_active_workflow_none_when_all_approved() {
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("approved.md"),
            title: "Approved".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Approved,
            workflow_type: "tech-spec".to_string(),
            steps_completed: vec![1, 2, 3],
            input_documents: vec![],
        }];
        assert!(detect_active_workflow(&artifacts).is_none());
    }

    #[test]
    fn test_detect_active_workflow_finds_draft() {
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("/project/_bmad-output/planning-artifacts/tech-spec.md"),
            title: "Tech Spec".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Draft,
            workflow_type: "tech-spec".to_string(),
            steps_completed: vec![1, 2],
            input_documents: vec![],
        }];

        let active = detect_active_workflow(&artifacts);
        assert!(active.is_some());

        let active = active.unwrap();
        assert_eq!(active.workflow_type, "tech-spec");
        assert_eq!(active.steps_completed, vec![1, 2]);
        assert_eq!(active.last_step, 2);
        assert_eq!(
            active.output_path,
            PathBuf::from("/project/_bmad-output/planning-artifacts/tech-spec.md")
        );
    }

    #[test]
    fn test_detect_active_workflow_uses_most_recent_draft() {
        // First artifact (newer) is approved, second (older) is draft
        // Should find the draft
        let artifacts = vec![
            ArtifactMeta {
                path: PathBuf::from("newer-approved.md"),
                title: "Newer Approved".to_string(),
                created: "2026-02-17".to_string(),
                status: ArtifactStatus::Approved,
                workflow_type: "prd".to_string(),
                steps_completed: vec![],
                input_documents: vec![],
            },
            ArtifactMeta {
                path: PathBuf::from("older-draft.md"),
                title: "Older Draft".to_string(),
                created: "2026-02-15".to_string(),
                status: ArtifactStatus::Draft,
                workflow_type: "tech-spec".to_string(),
                steps_completed: vec![1],
                input_documents: vec![],
            },
        ];

        let active = detect_active_workflow(&artifacts);
        assert!(active.is_some());
        assert_eq!(active.unwrap().workflow_type, "tech-spec");
    }

    #[test]
    fn test_detect_active_workflow_last_step_calculation() {
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("test.md"),
            title: "Test".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Draft,
            workflow_type: "prd".to_string(),
            steps_completed: vec![1, 3, 2, 5], // Unsorted
            input_documents: vec![],
        }];

        let active = detect_active_workflow(&artifacts).unwrap();
        assert_eq!(active.last_step, 5); // Max value
    }

    #[test]
    fn test_detect_active_workflow_empty_steps() {
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("test.md"),
            title: "Test".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Draft,
            workflow_type: "prd".to_string(),
            steps_completed: vec![],
            input_documents: vec![],
        }];

        let active = detect_active_workflow(&artifacts).unwrap();
        assert_eq!(active.last_step, 0); // Default when empty
    }

    // ========== aggregate_workflow_state tests ==========

    #[test]
    fn test_aggregate_workflow_state_not_started() {
        let dir = tempdir().unwrap();
        let state = aggregate_workflow_state(dir.path());

        assert_eq!(state.current_phase, Phase::NotStarted);
        assert!(state.active_workflow.is_none());
        assert!(state.completed_artifacts.is_empty());
    }

    #[test]
    fn test_aggregate_workflow_state_empty_bmad_output() {
        let dir = tempdir().unwrap();
        let output_dir = dir.path().join("_bmad-output");
        fs::create_dir_all(&output_dir).unwrap();

        let state = aggregate_workflow_state(dir.path());

        assert_eq!(state.current_phase, Phase::NotStarted);
        assert!(state.active_workflow.is_none());
        assert!(state.completed_artifacts.is_empty());
    }

    #[test]
    fn test_aggregate_workflow_state_discovery_phase() {
        let dir = tempdir().unwrap();
        let output_dir = dir.path().join("_bmad-output").join("planning-artifacts");
        fs::create_dir_all(&output_dir).unwrap();

        create_test_artifact(
            &output_dir,
            "product-brief.md",
            r#"title: Product Brief
created: '2026-02-17'
status: draft
workflowType: product-brief"#,
        );

        let state = aggregate_workflow_state(dir.path());

        assert_eq!(state.current_phase, Phase::Discovery);
        assert!(state.active_workflow.is_some());
        assert_eq!(state.active_workflow.unwrap().workflow_type, "product-brief");
        assert!(state.completed_artifacts.is_empty());
    }

    #[test]
    fn test_aggregate_workflow_state_solutioning_phase() {
        let dir = tempdir().unwrap();
        let output_dir = dir.path().join("_bmad-output").join("planning-artifacts");
        fs::create_dir_all(&output_dir).unwrap();

        create_test_artifact(
            &output_dir,
            "tech-spec.md",
            r#"title: Tech Spec
created: '2026-02-17'
status: draft
workflowType: tech-spec
stepsCompleted: [1, 2]"#,
        );

        let state = aggregate_workflow_state(dir.path());

        assert_eq!(state.current_phase, Phase::Solutioning);
        let active = state.active_workflow.unwrap();
        assert_eq!(active.workflow_type, "tech-spec");
        assert_eq!(active.steps_completed, vec![1, 2]);
        assert_eq!(active.last_step, 2);
    }

    #[test]
    fn test_aggregate_workflow_state_implementation_phase() {
        let dir = tempdir().unwrap();
        let impl_dir = dir.path().join("_bmad-output").join("implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();

        create_test_artifact(
            &impl_dir,
            "1-1-story.md",
            r#"title: Story 1.1
created: '2026-02-17'
status: draft
workflowType: create-story"#,
        );

        let state = aggregate_workflow_state(dir.path());

        assert_eq!(state.current_phase, Phase::Implementation);
        assert!(state.active_workflow.is_some());
    }

    #[test]
    fn test_aggregate_workflow_state_completed_artifacts_sorted() {
        let dir = tempdir().unwrap();
        let output_dir = dir.path().join("_bmad-output").join("planning-artifacts");
        fs::create_dir_all(&output_dir).unwrap();

        // Create older approved artifact
        create_test_artifact(
            &output_dir,
            "product-brief.md",
            r#"title: Product Brief
created: '2026-02-10'
status: approved
workflowType: product-brief"#,
        );

        // Create newer approved artifact
        create_test_artifact(
            &output_dir,
            "prd.md",
            r#"title: PRD
created: '2026-02-15'
status: approved
workflowType: prd"#,
        );

        // Create draft (not included in completed)
        create_test_artifact(
            &output_dir,
            "tech-spec.md",
            r#"title: Tech Spec
created: '2026-02-17'
status: draft
workflowType: tech-spec"#,
        );

        let state = aggregate_workflow_state(dir.path());

        // Should have 2 completed artifacts (approved only)
        assert_eq!(state.completed_artifacts.len(), 2);
        // Should be sorted by date descending (newest first)
        assert_eq!(state.completed_artifacts[0].title, "PRD");
        assert_eq!(state.completed_artifacts[1].title, "Product Brief");
    }

    #[test]
    fn test_aggregate_workflow_state_scans_both_directories() {
        let dir = tempdir().unwrap();
        let planning_dir = dir.path().join("_bmad-output").join("planning-artifacts");
        let impl_dir = dir.path().join("_bmad-output").join("implementation-artifacts");
        fs::create_dir_all(&planning_dir).unwrap();
        fs::create_dir_all(&impl_dir).unwrap();

        // Planning artifact
        create_test_artifact(
            &planning_dir,
            "prd.md",
            r#"title: PRD
created: '2026-02-15'
status: approved
workflowType: prd"#,
        );

        // Implementation artifact
        create_test_artifact(
            &impl_dir,
            "story.md",
            r#"title: Story
created: '2026-02-17'
status: draft
workflowType: create-story"#,
        );

        let state = aggregate_workflow_state(dir.path());

        // Should detect Implementation phase (higher priority)
        assert_eq!(state.current_phase, Phase::Implementation);
        // Should have 1 completed artifact (from planning)
        assert_eq!(state.completed_artifacts.len(), 1);
        assert_eq!(state.completed_artifacts[0].title, "PRD");
    }

    // ========== Serialization tests ==========

    #[test]
    fn test_workflow_state_camel_case_serialization() {
        let state = WorkflowState {
            current_phase: Phase::Solutioning,
            active_workflow: Some(ActiveWorkflow {
                workflow_type: "tech-spec".to_string(),
                output_path: PathBuf::from("/test/path.md"),
                steps_completed: vec![1, 2],
                last_step: 2,
            }),
            completed_artifacts: vec![],
        };

        let json = serde_json::to_string(&state).unwrap();
        // Verify camelCase field names
        assert!(json.contains("\"currentPhase\""));
        assert!(json.contains("\"activeWorkflow\""));
        assert!(json.contains("\"completedArtifacts\""));
        assert!(json.contains("\"workflowType\""));
        assert!(json.contains("\"outputPath\""));
        assert!(json.contains("\"stepsCompleted\""));
        assert!(json.contains("\"lastStep\""));
        // Verify no snake_case
        assert!(!json.contains("\"current_phase\""));
        assert!(!json.contains("\"active_workflow\""));
        assert!(!json.contains("\"workflow_type\""));
    }

    #[test]
    fn test_active_workflow_serialization() {
        let active = ActiveWorkflow {
            workflow_type: "prd".to_string(),
            output_path: PathBuf::from("/project/output.md"),
            steps_completed: vec![1, 2, 3],
            last_step: 3,
        };

        let json = serde_json::to_string(&active).unwrap();
        assert!(json.contains("\"workflowType\":\"prd\""));
        assert!(json.contains("\"stepsCompleted\":[1,2,3]"));
        assert!(json.contains("\"lastStep\":3"));
    }

    // ========== Deprecated status tests ==========

    #[test]
    fn test_determine_phase_deprecated_only() {
        // When all artifacts are deprecated, should return NotStarted
        // (deprecated artifacts are neither draft nor approved)
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("old-prd.md"),
            title: "Old PRD".to_string(),
            created: "2026-01-01".to_string(),
            status: ArtifactStatus::Deprecated,
            workflow_type: "prd".to_string(),
            steps_completed: vec![1, 2, 3],
            input_documents: vec![],
        }];
        assert_eq!(determine_phase(&artifacts, None), Phase::NotStarted);
    }

    #[test]
    fn test_completed_artifacts_excludes_deprecated() {
        let dir = tempdir().unwrap();
        let output_dir = dir.path().join("_bmad-output").join("planning-artifacts");
        fs::create_dir_all(&output_dir).unwrap();

        // Create approved artifact
        create_test_artifact(
            &output_dir,
            "approved.md",
            r#"title: Approved Doc
created: '2026-02-17'
status: approved
workflowType: prd"#,
        );

        // Create deprecated artifact
        create_test_artifact(
            &output_dir,
            "deprecated.md",
            r#"title: Deprecated Doc
created: '2026-02-15'
status: deprecated
workflowType: tech-spec"#,
        );

        let state = aggregate_workflow_state(dir.path());

        // Only approved artifacts should be in completed_artifacts
        assert_eq!(state.completed_artifacts.len(), 1);
        assert_eq!(state.completed_artifacts[0].title, "Approved Doc");
    }

    #[test]
    fn test_detect_active_workflow_ignores_deprecated() {
        // Deprecated artifacts should not be considered active workflows
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("deprecated.md"),
            title: "Deprecated".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Deprecated,
            workflow_type: "prd".to_string(),
            steps_completed: vec![1],
            input_documents: vec![],
        }];

        assert!(detect_active_workflow(&artifacts).is_none());
    }

    // ========== Multi-draft priority tests ==========

    #[test]
    fn test_detect_active_workflow_multiple_drafts_selects_most_recent() {
        // When multiple drafts exist, should select the most recent one
        // (first in the pre-sorted list)
        let artifacts = vec![
            ArtifactMeta {
                path: PathBuf::from("newer-draft.md"),
                title: "Newer Draft".to_string(),
                created: "2026-02-17".to_string(), // Most recent
                status: ArtifactStatus::Draft,
                workflow_type: "tech-spec".to_string(),
                steps_completed: vec![1, 2],
                input_documents: vec![],
            },
            ArtifactMeta {
                path: PathBuf::from("older-draft.md"),
                title: "Older Draft".to_string(),
                created: "2026-02-10".to_string(), // Older
                status: ArtifactStatus::Draft,
                workflow_type: "prd".to_string(),
                steps_completed: vec![1],
                input_documents: vec![],
            },
            ArtifactMeta {
                path: PathBuf::from("oldest-draft.md"),
                title: "Oldest Draft".to_string(),
                created: "2026-02-01".to_string(), // Oldest
                status: ArtifactStatus::Draft,
                workflow_type: "product-brief".to_string(),
                steps_completed: vec![],
                input_documents: vec![],
            },
        ];

        let active = detect_active_workflow(&artifacts);
        assert!(active.is_some());
        let active = active.unwrap();
        // Should select the first (most recent) draft
        assert_eq!(active.workflow_type, "tech-spec");
        assert_eq!(active.steps_completed, vec![1, 2]);
    }

    // ========== Story/Bug-based phase detection tests (BUG-002 fix) ==========

    #[test]
    fn test_determine_phase_from_in_progress_story() {
        let artifacts: Vec<ArtifactMeta> = vec![]; // No artifacts
        let impl_items = ImplementationItems {
            stories: vec![StoryMeta {
                path: PathBuf::from("1-1-story.md"),
                title: "Story 1.1".to_string(),
                status: StoryStatus::InProgress,
            }],
            bugs: vec![],
        };

        // Story in-progress should indicate Implementation phase
        assert_eq!(determine_phase(&artifacts, Some(&impl_items)), Phase::Implementation);
    }

    #[test]
    fn test_determine_phase_from_done_story() {
        let artifacts: Vec<ArtifactMeta> = vec![];
        let impl_items = ImplementationItems {
            stories: vec![StoryMeta {
                path: PathBuf::from("1-1-story.md"),
                title: "Story 1.1".to_string(),
                status: StoryStatus::Done,
            }],
            bugs: vec![],
        };

        // Completed story indicates Implementation phase was reached
        assert_eq!(determine_phase(&artifacts, Some(&impl_items)), Phase::Implementation);
    }

    #[test]
    fn test_determine_phase_from_review_story() {
        let artifacts: Vec<ArtifactMeta> = vec![];
        let impl_items = ImplementationItems {
            stories: vec![StoryMeta {
                path: PathBuf::from("2-1-feature.md"),
                title: "Story 2.1".to_string(),
                status: StoryStatus::Review,
            }],
            bugs: vec![],
        };

        // Story in review indicates Implementation phase
        assert_eq!(determine_phase(&artifacts, Some(&impl_items)), Phase::Implementation);
    }

    #[test]
    fn test_determine_phase_from_in_progress_bug() {
        let artifacts: Vec<ArtifactMeta> = vec![];
        let impl_items = ImplementationItems {
            stories: vec![],
            bugs: vec![BugMeta {
                path: PathBuf::from("bug-001-fix.md"),
                title: "Bug Fix".to_string(),
                status: BugStatus::InProgress,
            }],
        };

        // Bug in-progress indicates Implementation phase
        assert_eq!(determine_phase(&artifacts, Some(&impl_items)), Phase::Implementation);
    }

    #[test]
    fn test_determine_phase_from_resolved_bug() {
        let artifacts: Vec<ArtifactMeta> = vec![];
        let impl_items = ImplementationItems {
            stories: vec![],
            bugs: vec![BugMeta {
                path: PathBuf::from("bug-001-fix.md"),
                title: "Bug Fix".to_string(),
                status: BugStatus::Resolved,
            }],
        };

        // Resolved bug indicates Implementation phase was reached
        assert_eq!(determine_phase(&artifacts, Some(&impl_items)), Phase::Implementation);
    }

    #[test]
    fn test_determine_phase_from_review_bug() {
        let artifacts: Vec<ArtifactMeta> = vec![];
        let impl_items = ImplementationItems {
            stories: vec![],
            bugs: vec![BugMeta {
                path: PathBuf::from("bug-002-review.md"),
                title: "Bug in Review".to_string(),
                status: BugStatus::Review,
            }],
        };

        // Bug in review indicates Implementation phase
        assert_eq!(determine_phase(&artifacts, Some(&impl_items)), Phase::Implementation);
    }

    #[test]
    fn test_determine_phase_backlog_story_does_not_indicate_implementation() {
// Only approved planning artifacts, no active stories
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("prd.md"),
            title: "PRD".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Approved,
            workflow_type: "prd".to_string(),
            steps_completed: vec![1, 2, 3],
            input_documents: vec![],
        }];

        let impl_items = ImplementationItems {
            stories: vec![StoryMeta {
                path: PathBuf::from("1-1-story.md"),
                title: "Story 1.1".to_string(),
                status: StoryStatus::Backlog, // Backlog = not active
            }],
            bugs: vec![],
        };

        // Backlog story should NOT trigger Implementation phase
        // Should use artifact-based detection (Planning from approved PRD)
        assert_eq!(determine_phase(&artifacts, Some(&impl_items)), Phase::Planning);
    }

    #[test]
    fn test_determine_phase_stories_override_artifacts() {
        // Draft planning artifact exists
        let artifacts = vec![ArtifactMeta {
            path: PathBuf::from("prd.md"),
            title: "PRD".to_string(),
            created: "2026-02-17".to_string(),
            status: ArtifactStatus::Draft,
            workflow_type: "prd".to_string(),
            steps_completed: vec![1],
            input_documents: vec![],
        }];

        let impl_items = ImplementationItems {
            stories: vec![StoryMeta {
                path: PathBuf::from("1-1-story.md"),
                title: "Story 1.1".to_string(),
                status: StoryStatus::Done,
            }],
            bugs: vec![],
        };

        // Active story should override draft artifact - Implementation wins
        assert_eq!(determine_phase(&artifacts, Some(&impl_items)), Phase::Implementation);
    }

    #[test]
    fn test_aggregate_workflow_state_with_stories() {
        let dir = tempdir().unwrap();
        let impl_dir = dir.path().join("_bmad-output").join("implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();

        // Create a story file (body-based status, not frontmatter)
        fs::write(
            impl_dir.join("1-1-test-story.md"),
            r#"# Story 1.1: Test Story

Status: done

## Story
As a user...
"#,
        )
        .unwrap();

        let state = aggregate_workflow_state(dir.path());

        // Should detect Implementation phase from story
        assert_eq!(state.current_phase, Phase::Implementation);
    }

    #[test]
    fn test_aggregate_workflow_state_with_bugs() {
        let dir = tempdir().unwrap();
        let impl_dir = dir.path().join("_bmad-output").join("implementation-artifacts");
        fs::create_dir_all(&impl_dir).unwrap();

        // Create a bug file (frontmatter-based status)
        fs::write(
            impl_dir.join("bug-001-fix.md"),
            r#"---
bug_id: BUG-001
title: 'Test Bug'
status: resolved
---
# BUG-001: Test Bug
"#,
        )
        .unwrap();

        let state = aggregate_workflow_state(dir.path());

        // Should detect Implementation phase from bug
        assert_eq!(state.current_phase, Phase::Implementation);
    }
}
