//! Task manifest CSV parsing.

use std::fs::File;
use std::path::Path;

use csv::Reader;
use serde::{Deserialize, Serialize};

use super::types::ParseError;

/// Represents a BMAD task parsed from task-manifest.csv
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub module: String,
    pub path: String,
    #[serde(deserialize_with = "deserialize_bool_from_string")]
    pub standalone: bool,
}

/// Helper to deserialize "true"/"false" strings to bool
fn deserialize_bool_from_string<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s: String = Deserialize::deserialize(deserializer)?;
    match s.to_lowercase().as_str() {
        "true" | "1" | "yes" => Ok(true),
        "false" | "0" | "no" | "" => Ok(false),
        _ => Err(serde::de::Error::custom(format!(
            "Invalid boolean value: {}",
            s
        ))),
    }
}

/// Parses task-manifest.csv and returns list of standalone tasks only.
pub fn parse_task_manifest(path: &Path) -> Result<Vec<Task>, ParseError> {
    let file = File::open(path)?;
    let mut rdr = Reader::from_reader(file);

    let mut tasks = Vec::new();

    for result in rdr.deserialize() {
        let task: Task = result?;
        // Only include standalone tasks (AC #9)
        if task.standalone {
            tasks.push(task);
        }
    }

    Ok(tasks)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_parse_valid_task_manifest() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("task-manifest.csv");

        let csv_content = r#"name,displayName,description,module,path,standalone
"editorial-review-prose","Editorial Review - Prose","Clinical copy-editor","core","path/to/task.xml","true"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let tasks = parse_task_manifest(&manifest_path).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].name, "editorial-review-prose");
        assert_eq!(tasks[0].display_name, "Editorial Review - Prose");
        assert_eq!(tasks[0].description, "Clinical copy-editor");
        assert_eq!(tasks[0].module, "core");
        assert!(tasks[0].standalone);
    }

    #[test]
    fn test_parse_filters_non_standalone_tasks() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("task-manifest.csv");

        let csv_content = r#"name,displayName,description,module,path,standalone
"standalone-task","Standalone Task","A standalone task","core","path1.xml","true"
"internal-task","Internal Task","Not user-facing","core","path2.xml","false"
"another-standalone","Another One","Also standalone","core","path3.xml","true"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let tasks = parse_task_manifest(&manifest_path).unwrap();
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].name, "standalone-task");
        assert_eq!(tasks[1].name, "another-standalone");
    }

    #[test]
    fn test_empty_manifest_header_only() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("task-manifest.csv");

        let csv_content = "name,displayName,description,module,path,standalone\n";
        std::fs::write(&manifest_path, csv_content).unwrap();

        let tasks = parse_task_manifest(&manifest_path).unwrap();
        assert_eq!(tasks.len(), 0);
    }

    #[test]
    fn test_missing_manifest_returns_error() {
        let result = parse_task_manifest(Path::new("/nonexistent/path.csv"));
        assert!(result.is_err());
        match result {
            Err(ParseError::IoError(_)) => (),
            _ => panic!("Expected IoError"),
        }
    }

    #[test]
    fn test_multiple_tasks() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("task-manifest.csv");

        let csv_content = r#"name,displayName,description,module,path,standalone
"help","help","Get help","core","help.md","true"
"shard-doc","Shard Document","Split docs","core","shard.xml","true"
"index-docs","Index Docs","Generate index","core","index.xml","true"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let tasks = parse_task_manifest(&manifest_path).unwrap();
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].name, "help");
        assert_eq!(tasks[1].name, "shard-doc");
        assert_eq!(tasks[2].name, "index-docs");
    }

    #[test]
    fn test_malformed_csv_returns_error() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("task-manifest.csv");

        // Missing columns - CSV will fail to deserialize
        let csv_content = r#"name,description
"task","Description only"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let result = parse_task_manifest(&manifest_path);
        assert!(result.is_err());
        match result {
            Err(ParseError::CsvError(_)) => (),
            _ => panic!("Expected CsvError"),
        }
    }

    #[test]
    fn test_camel_case_serialization() {
        // Verify that Task serializes to camelCase for TypeScript
        let task = Task {
            name: "test".to_string(),
            display_name: "Test Task".to_string(),
            description: "A test".to_string(),
            module: "core".to_string(),
            path: "test.xml".to_string(),
            standalone: true,
        };

        let json = serde_json::to_string(&task).unwrap();
        assert!(json.contains("\"displayName\""));
        assert!(!json.contains("\"display_name\""));
    }
}
