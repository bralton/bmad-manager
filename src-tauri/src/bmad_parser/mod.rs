//! BMAD parser module for parsing agent manifests and configurations.

mod agents;
mod artifacts;
mod types;

pub use agents::parse_agent_manifest;
pub use artifacts::{parse_frontmatter, scan_artifacts, ArtifactMeta, ArtifactStatus};
pub use types::Agent;
