//! Type definitions for BMAD parser.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Represents a BMAD agent parsed from agent-manifest.csv
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub name: String,
    pub display_name: String,
    pub title: String,
    pub icon: String,
    pub role: String,
    pub identity: String,
    pub communication_style: String,
    pub principles: String,
    pub module: String,
    pub path: String,
}

/// Errors that can occur during BMAD parsing.
#[derive(Debug, Error, Serialize)]
pub enum ParseError {
    #[error("Failed to read manifest: {0}")]
    IoError(String),
    #[error("Failed to parse CSV: {0}")]
    CsvError(String),
}

impl From<std::io::Error> for ParseError {
    fn from(e: std::io::Error) -> Self {
        ParseError::IoError(e.to_string())
    }
}

impl From<csv::Error> for ParseError {
    fn from(e: csv::Error) -> Self {
        ParseError::CsvError(e.to_string())
    }
}
