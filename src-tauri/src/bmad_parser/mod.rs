//! BMAD parser module for parsing agent manifests and configurations.

mod agents;
mod types;

pub use agents::parse_agent_manifest;
pub use types::Agent;
