//! BMAD parser module for parsing agent manifests and configurations.

mod agents;
mod artifact_browser;
mod artifacts;
pub mod epic_parser;
mod sprint_status;
pub mod story_content;
pub mod story_tasks;
mod types;
mod workflow_state;
mod tasks;
mod workflows;

pub use agents::parse_agent_manifest;
pub use artifacts::{
    scan_all_project_artifacts, scan_implementation_items, ArtifactMeta, ArtifactStatus,
    BugStatus, ImplementationItems, StoryStatus,
};
pub use types::Agent;
pub use workflow_state::{aggregate_workflow_state, WorkflowState};
// Sprint status types are exported for Tauri IPC serialization to TypeScript.
// They may appear unused in Rust but are consumed by the frontend.
#[allow(unused_imports)]
pub use sprint_status::{parse_sprint_status, Epic, EpicStatus, RetroStatus, SprintStatus, Story};
pub use tasks::{parse_task_manifest, Task};
pub use workflows::{parse_workflow_manifest, Workflow};
// Artifact browser exports for Tauri commands
pub use artifact_browser::{
    get_epic_artifact, get_epic_artifacts, get_story_artifact, list_artifacts, read_artifact_content,
    ArtifactGroups, ArtifactInfo, EpicArtifacts,
};
