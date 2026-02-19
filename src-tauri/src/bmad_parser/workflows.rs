//! Workflow manifest CSV parsing.

use std::fs::File;
use std::path::Path;

use csv::Reader;
use serde::{Deserialize, Serialize};

use super::types::ParseError;

/// Represents a BMAD workflow parsed from workflow-manifest.csv
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    pub name: String,
    pub description: String,
    pub module: String,
    pub path: String,
}

/// Parses workflow-manifest.csv and returns list of workflows.
pub fn parse_workflow_manifest(path: &Path) -> Result<Vec<Workflow>, ParseError> {
    let file = File::open(path)?;
    let mut rdr = Reader::from_reader(file);

    let mut workflows = Vec::new();

    for result in rdr.deserialize() {
        let workflow: Workflow = result?;
        workflows.push(workflow);
    }

    Ok(workflows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_parse_valid_manifest() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("workflow-manifest.csv");

        let csv_content = r#"name,description,module,path
"create-prd","Create a comprehensive PRD","bmm","_bmad/bmm/workflows/create-prd/workflow.md"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let workflows = parse_workflow_manifest(&manifest_path).unwrap();
        assert_eq!(workflows.len(), 1);
        assert_eq!(workflows[0].name, "create-prd");
        assert_eq!(workflows[0].description, "Create a comprehensive PRD");
        assert_eq!(workflows[0].module, "bmm");
    }

    #[test]
    fn test_empty_manifest_header_only() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("workflow-manifest.csv");

        let csv_content = "name,description,module,path\n";
        std::fs::write(&manifest_path, csv_content).unwrap();

        let workflows = parse_workflow_manifest(&manifest_path).unwrap();
        assert_eq!(workflows.len(), 0);
    }

    #[test]
    fn test_missing_manifest_returns_error() {
        let result = parse_workflow_manifest(Path::new("/nonexistent/path.csv"));
        assert!(result.is_err());
        match result {
            Err(ParseError::IoError(_)) => (),
            _ => panic!("Expected IoError"),
        }
    }

    #[test]
    fn test_multiple_workflows() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("workflow-manifest.csv");

        let csv_content = r#"name,description,module,path
"create-prd","Create PRD doc","bmm","path1.md"
"dev-story","Execute a story","bmm","path2.md"
"brainstorming","Brainstorm ideas","core","path3.md"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let workflows = parse_workflow_manifest(&manifest_path).unwrap();
        assert_eq!(workflows.len(), 3);
        assert_eq!(workflows[0].name, "create-prd");
        assert_eq!(workflows[1].name, "dev-story");
        assert_eq!(workflows[2].name, "brainstorming");
    }

    #[test]
    fn test_malformed_csv_returns_error() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("workflow-manifest.csv");

        // Missing columns - CSV will fail to deserialize
        let csv_content = r#"name,description
"create-prd","Create PRD"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let result = parse_workflow_manifest(&manifest_path);
        assert!(result.is_err());
        match result {
            Err(ParseError::CsvError(_)) => (),
            _ => panic!("Expected CsvError"),
        }
    }

    #[test]
    fn test_empty_field_values_handled() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("workflow-manifest.csv");

        // Empty description
        let csv_content = r#"name,description,module,path
"minimal","","core","path.md"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let workflows = parse_workflow_manifest(&manifest_path).unwrap();
        assert_eq!(workflows.len(), 1);
        assert_eq!(workflows[0].name, "minimal");
        assert_eq!(workflows[0].description, "");
    }
}
