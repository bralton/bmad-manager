//! Agent manifest CSV parsing.

use std::fs::File;
use std::path::Path;

use csv::Reader;

use super::types::{Agent, ParseError};

/// Parses agent-manifest.csv and returns list of agents.
pub fn parse_agent_manifest(path: &Path) -> Result<Vec<Agent>, ParseError> {
    let file = File::open(path)?;
    let mut rdr = Reader::from_reader(file);

    let mut agents = Vec::new();

    for result in rdr.deserialize() {
        let mut agent: Agent = result?;
        // Decode HTML entities in text fields
        agent.identity = decode_html_entities(&agent.identity);
        agent.communication_style = decode_html_entities(&agent.communication_style);
        agent.principles = decode_html_entities(&agent.principles);
        agents.push(agent);
    }

    Ok(agents)
}

/// Decodes common HTML entities in a string.
fn decode_html_entities(s: &str) -> String {
    s.replace("&quot;", "\"")
        .replace("&#34;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&amp;", "&")
        .replace("&#38;", "&")
        .replace("&lt;", "<")
        .replace("&#60;", "<")
        .replace("&gt;", ">")
        .replace("&#62;", ">")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_parse_valid_manifest() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("agent-manifest.csv");

        let csv_content = r#"name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
"analyst","Mary","Business Analyst","📊","BA Role","Identity here","Style here","Principles","bmm","path/to/agent.md"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let agents = parse_agent_manifest(&manifest_path).unwrap();
        assert_eq!(agents.len(), 1);
        assert_eq!(agents[0].name, "analyst");
        assert_eq!(agents[0].display_name, "Mary");
        assert_eq!(agents[0].icon, "📊");
    }

    #[test]
    fn test_decode_html_entities() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("agent-manifest.csv");

        let csv_content = r#"name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
"test","Test","Title","🧪","Role","Has &quot;quotes&quot;","Style &apos;here&apos;","A &amp; B","core","path.md"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let agents = parse_agent_manifest(&manifest_path).unwrap();
        assert!(agents[0].identity.contains("\"quotes\""));
        assert!(agents[0].communication_style.contains("'here'"));
        assert!(agents[0].principles.contains("A & B"));
    }

    #[test]
    fn test_missing_manifest_returns_error() {
        let result = parse_agent_manifest(Path::new("/nonexistent/path.csv"));
        assert!(result.is_err());
        match result {
            Err(ParseError::IoError(_)) => (),
            _ => panic!("Expected IoError"),
        }
    }

    #[test]
    fn test_empty_manifest_header_only() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("agent-manifest.csv");

        let csv_content =
            "name,displayName,title,icon,role,identity,communicationStyle,principles,module,path\n";
        std::fs::write(&manifest_path, csv_content).unwrap();

        let agents = parse_agent_manifest(&manifest_path).unwrap();
        assert_eq!(agents.len(), 0);
    }

    #[test]
    fn test_multiple_agents() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("agent-manifest.csv");

        let csv_content = r#"name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
"analyst","Mary","BA","📊","Role1","Id1","Style1","Prin1","bmm","path1.md"
"dev","Amelia","Dev","💻","Role2","Id2","Style2","Prin2","bmm","path2.md"
"pm","John","PM","📋","Role3","Id3","Style3","Prin3","bmm","path3.md"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let agents = parse_agent_manifest(&manifest_path).unwrap();
        assert_eq!(agents.len(), 3);
        assert_eq!(agents[0].name, "analyst");
        assert_eq!(agents[1].name, "dev");
        assert_eq!(agents[2].name, "pm");
    }

    #[test]
    fn test_malformed_csv_returns_error() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("agent-manifest.csv");

        // Missing columns - CSV will fail to deserialize
        let csv_content = r#"name,displayName
"analyst","Mary"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let result = parse_agent_manifest(&manifest_path);
        assert!(result.is_err());
        match result {
            Err(ParseError::CsvError(_)) => (),
            _ => panic!("Expected CsvError"),
        }
    }

    #[test]
    fn test_empty_field_values_handled() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("agent-manifest.csv");

        // Empty strings for optional-ish fields (identity, communicationStyle, principles)
        let csv_content = r#"name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
"minimal","Min","Title","🔧","Role","","","","core","path.md"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let agents = parse_agent_manifest(&manifest_path).unwrap();
        assert_eq!(agents.len(), 1);
        assert_eq!(agents[0].name, "minimal");
        assert_eq!(agents[0].identity, "");
        assert_eq!(agents[0].communication_style, "");
        assert_eq!(agents[0].principles, "");
    }

    #[test]
    fn test_decode_numeric_html_entities() {
        let dir = tempdir().unwrap();
        let manifest_path = dir.path().join("agent-manifest.csv");

        // Test numeric entities: &#39; &#34; &#x27;
        let csv_content = r#"name,displayName,title,icon,role,identity,communicationStyle,principles,module,path
"test","Test","Title","🧪","Role","Has &#34;quotes&#34;","Style &#39;here&#39;","A &#x27;test&#x27;","core","path.md"
"#;
        std::fs::write(&manifest_path, csv_content).unwrap();

        let agents = parse_agent_manifest(&manifest_path).unwrap();
        assert!(agents[0].identity.contains("\"quotes\""));
        assert!(agents[0].communication_style.contains("'here'"));
        assert!(agents[0].principles.contains("'test'"));
    }
}
