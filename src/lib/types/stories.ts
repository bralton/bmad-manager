/**
 * Types for story board and sprint status.
 * Maps to Rust types in bmad_parser/sprint_status.rs
 */

/**
 * Epic status values from sprint-status.yaml.
 * Must match Rust EpicStatus enum (kebab-case serialization).
 */
export type EpicStatus = 'backlog' | 'in-progress' | 'done';

/**
 * Story status values from sprint-status.yaml.
 * Must match Rust StoryStatus enum (kebab-case serialization).
 */
export type StoryStatus = 'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'done';

/**
 * Retrospective status values.
 */
export type RetroStatus = 'optional' | 'done';

/**
 * Represents an epic with its status and optional retrospective.
 */
export interface Epic {
  /** Epic ID (e.g., "1", "2", "2.5") */
  id: string;
  /** Current status of the epic */
  status: EpicStatus;
  /** Retrospective status if present */
  retroStatus?: RetroStatus;
}

/**
 * Represents a story with its status and metadata.
 */
export interface Story {
  /** Full story ID (e.g., "1-2-user-auth" or "1-5-2-terminate-lock") */
  id: string;
  /** Epic ID this story belongs to (e.g., "1" or "2.5") */
  epicId: string;
  /** Story number within the epic */
  storyNumber: number;
  /** Sub-story number for stories like 5.2 (undefined for regular stories) */
  subStoryNumber?: number;
  /** URL-friendly slug (e.g., "user-auth") */
  slug: string;
  /** Current status of the story */
  status: StoryStatus;
}

/**
 * Represents a bug entry with its status and metadata.
 * Must match Rust Bug struct (camelCase serialization).
 */
export interface Bug {
  /** Full bug ID (e.g., "bug-123-description") */
  id: string;
  /** Bug number extracted from ID (e.g., 123) */
  bugNumber: number;
  /** URL-friendly slug (e.g., "description") */
  slug: string;
  /** Current status of the bug (same values as StoryStatus) */
  status: StoryStatus;
}

/**
 * Aggregated sprint status containing all epics and stories.
 */
export interface SprintStatus {
  /** Generation date from YAML */
  generated: string;
  /** Project name from YAML */
  project: string;
  /** List of epics sorted by ID */
  epics: Epic[];
  /** List of stories sorted by epic_id then story_number */
  stories: Story[];
  /** List of bugs sorted by bug_number (empty array if no bugs) */
  bugs: Bug[];
}

/**
 * Kanban column definition for the story board.
 */
export interface KanbanColumn {
  /** Status this column represents */
  status: StoryStatus;
  /** Display label for the column */
  label: string;
  /** Tailwind border color class */
  borderColor: string;
  /** Tailwind text color class */
  textColor: string;
}

/**
 * The five kanban columns for the story board.
 * Maps story statuses to display properties.
 */
export const KANBAN_COLUMNS: readonly KanbanColumn[] = [
  {
    status: 'backlog',
    label: 'Backlog',
    borderColor: 'border-gray-500',
    textColor: 'text-gray-400',
  },
  {
    status: 'ready-for-dev',
    label: 'Ready',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-400',
  },
  {
    status: 'in-progress',
    label: 'In Progress',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-400',
  },
  {
    status: 'review',
    label: 'Review',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-400',
  },
  {
    status: 'done',
    label: 'Done',
    borderColor: 'border-green-500',
    textColor: 'text-green-400',
  },
] as const;

/**
 * Parsed content sections from a story file.
 * Used by the Story Detail Panel to display story content.
 */
export interface StoryContent {
  /** The user story text (from "## Story" section) */
  story: string | null;
  /** Acceptance criteria (from "## Acceptance Criteria" section) */
  acceptanceCriteria: string | null;
  /** Tasks and subtasks (from "## Tasks / Subtasks" section) */
  tasks: string | null;
  /** Developer notes (from "## Dev Notes" section) */
  devNotes: string | null;
  /** Whether the file was successfully parsed */
  parsed: boolean;
  /** Error message if parsing failed */
  error: string | null;
}

/**
 * Parsed content from a bug file.
 * Used by the Bug Detail Panel to display bug content.
 */
export interface BugContent {
  /** Bug ID from frontmatter (e.g., "BUG-001") */
  bugId: string | null;
  /** Bug title from frontmatter */
  title: string | null;
  /** Severity level (low, medium, high, critical) */
  severity: string | null;
  /** Priority (P1, P2, P3, etc.) */
  priority: string | null;
  /** Current status */
  status: string | null;
  /** Who reported the bug */
  reportedBy: string | null;
  /** When the bug was reported */
  reportedDate: string | null;
  /** Related story IDs */
  relatedStories: string[] | null;
  /** The summary section content */
  summary: string | null;
  /** Full markdown body after frontmatter */
  body: string | null;
  /** Whether the file was successfully parsed */
  parsed: boolean;
  /** Error message if parsing failed */
  error: string | null;
}
