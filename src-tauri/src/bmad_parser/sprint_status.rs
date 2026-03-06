//! Sprint status YAML parsing for story board visualization.

use super::StoryStatus;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Epic status values from sprint-status.yaml.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EpicStatus {
    Backlog,
    InProgress,
    Done,
}

impl Default for EpicStatus {
    fn default() -> Self {
        EpicStatus::Backlog
    }
}

// Note: StoryStatus is imported from artifacts.rs to avoid duplicate enum definitions.
// Both story files (Status: line) and sprint-status.yaml use the same status values.

/// Retrospective status values from sprint-status.yaml.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RetroStatus {
    Optional,
    Done,
}

/// Represents a bug entry with its status and metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bug {
    /// Full bug ID (e.g., "bug-123-description")
    pub id: String,
    /// Bug number extracted from ID (e.g., 123)
    pub bug_number: u32,
    /// URL-friendly slug (e.g., "description")
    pub slug: String,
    /// Current status of the bug (reuses StoryStatus)
    pub status: StoryStatus,
}

impl Default for RetroStatus {
    fn default() -> Self {
        RetroStatus::Optional
    }
}

/// Represents an epic with its status and optional retrospective.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Epic {
    /// Epic ID (e.g., 1, 2, 2.5)
    pub id: String,
    /// Current status of the epic
    pub status: EpicStatus,
    /// Retrospective status if present
    #[serde(default)]
    pub retro_status: Option<RetroStatus>,
}

/// Represents a story with its status and metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Story {
    /// Full story ID (e.g., "1-2-user-auth" or "1-5-2-terminate-lock")
    pub id: String,
    /// Epic ID this story belongs to (e.g., "1" or "2.5")
    pub epic_id: String,
    /// Story number within the epic
    pub story_number: u32,
    /// Sub-story number for stories like 5.2 (None for regular stories)
    #[serde(default)]
    pub sub_story_number: Option<u32>,
    /// URL-friendly slug (e.g., "user-auth")
    pub slug: String,
    /// Current status of the story
    pub status: StoryStatus,
}

/// Aggregated sprint status containing all epics and stories.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SprintStatus {
    /// Generation date from YAML
    #[serde(default)]
    pub generated: String,
    /// Project name from YAML
    #[serde(default)]
    pub project: String,
    /// List of epics sorted by ID
    pub epics: Vec<Epic>,
    /// List of stories sorted by epic_id then story_number
    pub stories: Vec<Story>,
    /// List of bugs sorted by bug_number
    #[serde(default)]
    pub bugs: Vec<Bug>,
}

/// Raw structure for initial YAML parsing before transformation.
#[derive(Debug, Deserialize)]
struct RawSprintStatus {
    #[serde(default)]
    generated: Option<String>,
    #[serde(default)]
    project: Option<String>,
    #[serde(default)]
    development_status: HashMap<String, String>,
}

/// Parse sprint status from a project path.
///
/// Returns an empty SprintStatus if the file doesn't exist.
pub fn parse_sprint_status(project_path: &Path) -> SprintStatus {
    let status_path = project_path.join("_bmad-output/implementation-artifacts/sprint-status.yaml");

    if !status_path.exists() {
        return SprintStatus::default();
    }

    match fs::read_to_string(&status_path) {
        Ok(content) => parse_sprint_status_content(&content),
        Err(_) => SprintStatus::default(),
    }
}

/// Parse sprint status from YAML content string.
///
/// This function is exposed for testability.
pub fn parse_sprint_status_content(content: &str) -> SprintStatus {
    let raw: RawSprintStatus = match serde_yaml::from_str(content) {
        Ok(r) => r,
        Err(_) => return SprintStatus::default(),
    };

    let mut epics: Vec<Epic> = Vec::new();
    let mut stories: Vec<Story> = Vec::new();
    let mut bugs: Vec<Bug> = Vec::new();
    let mut retros: HashMap<String, RetroStatus> = HashMap::new();

    // First pass: collect all entries and categorize
    for (key, value) in &raw.development_status {
        if let Some(entry) = parse_status_entry(key, value) {
            match entry {
                StatusEntry::Epic(epic) => epics.push(epic),
                StatusEntry::Story(story) => stories.push(story),
                StatusEntry::Bug(bug) => bugs.push(bug),
                StatusEntry::Retro(epic_id, status) => {
                    retros.insert(epic_id, status);
                }
            }
        }
    }

    // Apply retrospective statuses to their epics
    for epic in &mut epics {
        if let Some(retro_status) = retros.get(&epic.id) {
            epic.retro_status = Some(*retro_status);
        }
    }

    // Sort epics by ID (numeric, handling decimals)
    epics.sort_by(|a, b| {
        parse_epic_id_for_sort(&a.id).partial_cmp(&parse_epic_id_for_sort(&b.id))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Sort stories by epic_id, then story_number, then sub_story_number
    stories.sort_by(|a, b| {
        let epic_cmp = parse_epic_id_for_sort(&a.epic_id)
            .partial_cmp(&parse_epic_id_for_sort(&b.epic_id))
            .unwrap_or(std::cmp::Ordering::Equal);
        if epic_cmp != std::cmp::Ordering::Equal {
            return epic_cmp;
        }
        let story_cmp = a.story_number.cmp(&b.story_number);
        if story_cmp != std::cmp::Ordering::Equal {
            return story_cmp;
        }
        // Sub-stories sort after main story: None < Some(1) < Some(2)
        a.sub_story_number.cmp(&b.sub_story_number)
    });

    // Sort bugs by bug_number (ascending)
    bugs.sort_by_key(|b| b.bug_number);

    SprintStatus {
        generated: raw.generated.unwrap_or_default(),
        project: raw.project.unwrap_or_default(),
        epics,
        stories,
        bugs,
    }
}

/// Intermediate enum for categorizing parsed entries.
enum StatusEntry {
    Epic(Epic),
    Story(Story),
    Bug(Bug),
    Retro(String, RetroStatus),
}

/// Parse a single status entry from key-value pair.
fn parse_status_entry(key: &str, value: &str) -> Option<StatusEntry> {
    // Retrospective: "epic-1-retrospective" or "epic-2.5-retrospective"
    if key.ends_with("-retrospective") {
        let epic_id = key
            .strip_prefix("epic-")?
            .strip_suffix("-retrospective")?
            .to_string();
        let status = match value {
            "done" => RetroStatus::Done,
            _ => RetroStatus::Optional,
        };
        return Some(StatusEntry::Retro(epic_id, status));
    }

    // Epic: "epic-1" or "epic-2.5"
    if key.starts_with("epic-") {
        let epic_id = key.strip_prefix("epic-")?.to_string();
        let status = match value {
            "in-progress" => EpicStatus::InProgress,
            "done" => EpicStatus::Done,
            _ => EpicStatus::Backlog,
        };
        return Some(StatusEntry::Epic(Epic {
            id: epic_id,
            status,
            retro_status: None,
        }));
    }

    // Bug: "bug-123-description"
    if key.starts_with("bug-") {
        let rest = key.strip_prefix("bug-")?;
        let parts: Vec<&str> = rest.splitn(2, '-').collect();
        if parts.len() >= 2 {
            let bug_number: u32 = parts[0].parse().ok()?;
            let slug = parts[1].to_string();
            let status = match value {
                "ready-for-dev" => StoryStatus::ReadyForDev,
                "in-progress" => StoryStatus::InProgress,
                "review" => StoryStatus::Review,
                "done" => StoryStatus::Done,
                _ => StoryStatus::Backlog,
            };
            return Some(StatusEntry::Bug(Bug {
                id: key.to_string(),
                bug_number,
                slug,
                status,
            }));
        }
    }

    // Story: "1-2-user-auth" (epic-story-slug) or "1-5-2-terminate" (epic-story-substory-slug)
    // Use splitn(4) to detect sub-stories where the third part is a number
    let parts: Vec<&str> = key.splitn(4, '-').collect();
    if parts.len() >= 3 {
        let epic_id = parts[0].to_string();
        let story_number: u32 = parts[1].parse().ok()?;

        // Check if this is a sub-story: third part is a number and we have 4+ parts
        let (sub_story_number, slug) = if parts.len() >= 4 {
            if let Ok(sub_num) = parts[2].parse::<u32>() {
                // Sub-story: "1-5-2-terminate-lock" -> story 5.2, slug "terminate-lock"
                (Some(sub_num), parts[3].to_string())
            } else {
                // Regular story with splitn(4) that produced extra parts
                // Rejoin parts 2+ as the slug: "1-2-foo-bar-baz" -> slug "foo-bar-baz"
                (None, parts[2..].join("-"))
            }
        } else {
            // Regular story: "1-2-user-auth" -> parts[2] is the full slug
            (None, parts[2].to_string())
        };

        let status = match value {
            "ready-for-dev" => StoryStatus::ReadyForDev,
            "in-progress" => StoryStatus::InProgress,
            "review" => StoryStatus::Review,
            "done" => StoryStatus::Done,
            _ => StoryStatus::Backlog,
        };

        return Some(StatusEntry::Story(Story {
            id: key.to_string(),
            epic_id,
            story_number,
            sub_story_number,
            slug,
            status,
        }));
    }

    None
}

/// Parse epic ID string to f64 for sorting (handles "1", "2.5", etc.).
fn parse_epic_id_for_sort(id: &str) -> f64 {
    id.parse().unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_content_returns_default() {
        let result = parse_sprint_status_content("");
        assert!(result.epics.is_empty());
        assert!(result.stories.is_empty());
    }

    #[test]
    fn test_parse_epic_statuses() {
        let content = r#"
development_status:
  epic-1: done
  epic-2: in-progress
  epic-3: backlog
"#;
        let result = parse_sprint_status_content(content);
        assert_eq!(result.epics.len(), 3);

        // Find each epic and verify status
        let epic1 = result.epics.iter().find(|e| e.id == "1").unwrap();
        assert_eq!(epic1.status, EpicStatus::Done);

        let epic2 = result.epics.iter().find(|e| e.id == "2").unwrap();
        assert_eq!(epic2.status, EpicStatus::InProgress);

        let epic3 = result.epics.iter().find(|e| e.id == "3").unwrap();
        assert_eq!(epic3.status, EpicStatus::Backlog);
    }

    #[test]
    fn test_parse_story_statuses() {
        let content = r#"
development_status:
  1-1-scaffold: done
  1-2-detection: in-progress
  2-1-parser: ready-for-dev
  2-2-visualizer: review
  3-1-board: backlog
"#;
        let result = parse_sprint_status_content(content);
        assert_eq!(result.stories.len(), 5);

        let story1 = result.stories.iter().find(|s| s.id == "1-1-scaffold").unwrap();
        assert_eq!(story1.status, StoryStatus::Done);
        assert_eq!(story1.epic_id, "1");
        assert_eq!(story1.story_number, 1);
        assert_eq!(story1.slug, "scaffold");

        let story2 = result.stories.iter().find(|s| s.id == "2-1-parser").unwrap();
        assert_eq!(story2.status, StoryStatus::ReadyForDev);
    }

    #[test]
    fn test_parse_retrospective_statuses() {
        let content = r#"
development_status:
  epic-1: done
  epic-1-retrospective: done
  epic-2: in-progress
  epic-2-retrospective: optional
"#;
        let result = parse_sprint_status_content(content);

        let epic1 = result.epics.iter().find(|e| e.id == "1").unwrap();
        assert_eq!(epic1.retro_status, Some(RetroStatus::Done));

        let epic2 = result.epics.iter().find(|e| e.id == "2").unwrap();
        assert_eq!(epic2.retro_status, Some(RetroStatus::Optional));
    }

    #[test]
    fn test_sorting_epics_by_id() {
        let content = r#"
development_status:
  epic-3: backlog
  epic-1: done
  epic-2: in-progress
"#;
        let result = parse_sprint_status_content(content);

        assert_eq!(result.epics[0].id, "1");
        assert_eq!(result.epics[1].id, "2");
        assert_eq!(result.epics[2].id, "3");
    }

    #[test]
    fn test_sorting_stories_by_epic_and_number() {
        let content = r#"
development_status:
  2-2-second: done
  1-2-second: done
  2-1-first: done
  1-1-first: done
"#;
        let result = parse_sprint_status_content(content);

        assert_eq!(result.stories[0].id, "1-1-first");
        assert_eq!(result.stories[1].id, "1-2-second");
        assert_eq!(result.stories[2].id, "2-1-first");
        assert_eq!(result.stories[3].id, "2-2-second");
    }

    #[test]
    fn test_decimal_epic_ids() {
        let content = r#"
development_status:
  epic-2.5: in-progress
  epic-2: done
  epic-3: backlog
"#;
        let result = parse_sprint_status_content(content);

        assert_eq!(result.epics[0].id, "2");
        assert_eq!(result.epics[1].id, "2.5");
        assert_eq!(result.epics[2].id, "3");
    }

    #[test]
    fn test_stories_with_decimal_epic_ids() {
        let content = r#"
development_status:
  2.5-1-prep-work: done
  2.5-2-more-prep: in-progress
"#;
        let result = parse_sprint_status_content(content);
        assert_eq!(result.stories.len(), 2);

        let story1 = result.stories.iter().find(|s| s.id == "2.5-1-prep-work").unwrap();
        assert_eq!(story1.epic_id, "2.5");
        assert_eq!(story1.story_number, 1);
        assert_eq!(story1.slug, "prep-work");
    }

    #[test]
    fn test_full_sprint_status_content() {
        // Use actual sprint-status.yaml structure
        let content = r#"
generated: 2026-02-17
project: bmad_manager
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
  epic-1: done
  1-1-tauri-svelte-scaffold: done
  1-2-project-detection: done
  epic-1-retrospective: done

  epic-2: done
  2-1-artifact-frontmatter-parser: done
  epic-2-retrospective: done

  epic-2.5: done
  2.5-1-frontend-test-infrastructure: done
  epic-2.5-retrospective: done

  epic-3: in-progress
  3-1-sprint-status-parser: ready-for-dev
  3-2-story-board-ui-kanban: backlog
  epic-3-retrospective: optional
"#;
        let result = parse_sprint_status_content(content);

        assert_eq!(result.generated, "2026-02-17");
        assert_eq!(result.project, "bmad_manager");
        assert_eq!(result.epics.len(), 4);
        assert_eq!(result.stories.len(), 6);

        // Verify epic ordering
        assert_eq!(result.epics[0].id, "1");
        assert_eq!(result.epics[1].id, "2");
        assert_eq!(result.epics[2].id, "2.5");
        assert_eq!(result.epics[3].id, "3");

        // Verify story ordering
        assert_eq!(result.stories[0].id, "1-1-tauri-svelte-scaffold");
        assert_eq!(result.stories[1].id, "1-2-project-detection");
        assert_eq!(result.stories[2].id, "2-1-artifact-frontmatter-parser");
        assert_eq!(result.stories[3].id, "2.5-1-frontend-test-infrastructure");
        assert_eq!(result.stories[4].id, "3-1-sprint-status-parser");
        assert_eq!(result.stories[5].id, "3-2-story-board-ui-kanban");

        // Verify specific statuses
        let story = result.stories.iter().find(|s| s.id == "3-1-sprint-status-parser").unwrap();
        assert_eq!(story.status, StoryStatus::ReadyForDev);

        // Verify retrospective association
        let epic1 = result.epics.iter().find(|e| e.id == "1").unwrap();
        assert_eq!(epic1.retro_status, Some(RetroStatus::Done));

        let epic3 = result.epics.iter().find(|e| e.id == "3").unwrap();
        assert_eq!(epic3.retro_status, Some(RetroStatus::Optional));
    }

    #[test]
    fn test_missing_file_returns_default() {
        let result = parse_sprint_status(Path::new("/nonexistent/path"));
        assert!(result.epics.is_empty());
        assert!(result.stories.is_empty());
        assert!(result.bugs.is_empty());
    }

    #[test]
    fn test_parse_bug_entries() {
        let content = r#"
development_status:
  bug-1-terminal-crash: backlog
  bug-2-session-freeze: in-progress
  bug-3-worktree-error: done
"#;
        let result = parse_sprint_status_content(content);
        assert_eq!(result.bugs.len(), 3);

        let bug1 = result.bugs.iter().find(|b| b.id == "bug-1-terminal-crash").unwrap();
        assert_eq!(bug1.bug_number, 1);
        assert_eq!(bug1.slug, "terminal-crash");
        assert_eq!(bug1.status, StoryStatus::Backlog);

        let bug2 = result.bugs.iter().find(|b| b.id == "bug-2-session-freeze").unwrap();
        assert_eq!(bug2.bug_number, 2);
        assert_eq!(bug2.slug, "session-freeze");
        assert_eq!(bug2.status, StoryStatus::InProgress);

        let bug3 = result.bugs.iter().find(|b| b.id == "bug-3-worktree-error").unwrap();
        assert_eq!(bug3.bug_number, 3);
        assert_eq!(bug3.slug, "worktree-error");
        assert_eq!(bug3.status, StoryStatus::Done);
    }

    #[test]
    fn test_bug_sorting_by_number() {
        let content = r#"
development_status:
  bug-3-third: backlog
  bug-1-first: backlog
  bug-2-second: backlog
"#;
        let result = parse_sprint_status_content(content);

        assert_eq!(result.bugs[0].bug_number, 1);
        assert_eq!(result.bugs[1].bug_number, 2);
        assert_eq!(result.bugs[2].bug_number, 3);
    }

    #[test]
    fn test_bugs_not_mixed_with_stories() {
        let content = r#"
development_status:
  1-1-scaffold: done
  bug-1-crash: backlog
  1-2-detection: in-progress
  bug-2-freeze: done
"#;
        let result = parse_sprint_status_content(content);

        // Stories and bugs should be in separate arrays
        assert_eq!(result.stories.len(), 2);
        assert_eq!(result.bugs.len(), 2);

        // Stories should only contain stories
        assert!(result.stories.iter().all(|s| !s.id.starts_with("bug-")));

        // Bugs should only contain bugs
        assert!(result.bugs.iter().all(|b| b.id.starts_with("bug-")));
    }

    #[test]
    fn test_bug_slug_with_hyphens() {
        let content = r#"
development_status:
  bug-123-session-freeze-on-resize: in-progress
"#;
        let result = parse_sprint_status_content(content);
        assert_eq!(result.bugs.len(), 1);

        let bug = &result.bugs[0];
        assert_eq!(bug.id, "bug-123-session-freeze-on-resize");
        assert_eq!(bug.bug_number, 123);
        assert_eq!(bug.slug, "session-freeze-on-resize");
    }

    #[test]
    fn test_empty_bugs_array_when_no_bugs() {
        let content = r#"
development_status:
  epic-1: done
  1-1-scaffold: done
"#;
        let result = parse_sprint_status_content(content);

        // Bugs should be empty array, not undefined
        assert!(result.bugs.is_empty());
        assert_eq!(result.bugs.len(), 0);
    }

    #[test]
    fn test_bug_all_statuses() {
        let content = r#"
development_status:
  bug-1-backlog: backlog
  bug-2-ready: ready-for-dev
  bug-3-progress: in-progress
  bug-4-review: review
  bug-5-done: done
"#;
        let result = parse_sprint_status_content(content);
        assert_eq!(result.bugs.len(), 5);

        let bug1 = result.bugs.iter().find(|b| b.bug_number == 1).unwrap();
        assert_eq!(bug1.status, StoryStatus::Backlog);

        let bug2 = result.bugs.iter().find(|b| b.bug_number == 2).unwrap();
        assert_eq!(bug2.status, StoryStatus::ReadyForDev);

        let bug3 = result.bugs.iter().find(|b| b.bug_number == 3).unwrap();
        assert_eq!(bug3.status, StoryStatus::InProgress);

        let bug4 = result.bugs.iter().find(|b| b.bug_number == 4).unwrap();
        assert_eq!(bug4.status, StoryStatus::Review);

        let bug5 = result.bugs.iter().find(|b| b.bug_number == 5).unwrap();
        assert_eq!(bug5.status, StoryStatus::Done);
    }

    #[test]
    fn test_story_slug_with_hyphens() {
        let content = r#"
development_status:
  1-5-claude-cli-spawn-pty: done
  1-5-2-terminate-lock-optimization: done
"#;
        let result = parse_sprint_status_content(content);

        // Regular story: slug contains hyphens
        let story1 = result.stories.iter().find(|s| s.id == "1-5-claude-cli-spawn-pty").unwrap();
        assert_eq!(story1.epic_id, "1");
        assert_eq!(story1.story_number, 5);
        assert_eq!(story1.sub_story_number, None);
        assert_eq!(story1.slug, "claude-cli-spawn-pty");

        // Sub-story: 1-5-2 means epic 1, story 5.2
        let story2 = result.stories.iter().find(|s| s.id == "1-5-2-terminate-lock-optimization").unwrap();
        assert_eq!(story2.epic_id, "1");
        assert_eq!(story2.story_number, 5);
        assert_eq!(story2.sub_story_number, Some(2));
        assert_eq!(story2.slug, "terminate-lock-optimization");
    }

    #[test]
    fn test_sub_story_sorting() {
        let content = r#"
development_status:
  1-5-2-second-sub: done
  1-6-main: done
  1-5-main: done
  1-5-1-first-sub: done
"#;
        let result = parse_sprint_status_content(content);

        // Should sort: 1-5-main, 1-5-1-first-sub, 1-5-2-second-sub, 1-6-main
        assert_eq!(result.stories[0].id, "1-5-main");
        assert_eq!(result.stories[0].sub_story_number, None);
        assert_eq!(result.stories[1].id, "1-5-1-first-sub");
        assert_eq!(result.stories[1].sub_story_number, Some(1));
        assert_eq!(result.stories[2].id, "1-5-2-second-sub");
        assert_eq!(result.stories[2].sub_story_number, Some(2));
        assert_eq!(result.stories[3].id, "1-6-main");
    }
}
