/**
 * Represents a BMAD agent parsed from agent-manifest.csv.
 * Mirrors the Rust Agent struct in src-tauri/src/bmad_parser/types.rs
 */
export interface Agent {
  name: string;
  displayName: string;
  title: string;
  icon: string;
  role: string;
  identity: string;
  communicationStyle: string;
  principles: string;
  module: string;
  path: string;
}
