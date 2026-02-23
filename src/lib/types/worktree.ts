/**
 * Types for Git worktree management.
 * Maps to Rust types in worktree/types.rs and session_registry/db.rs
 */

/**
 * Represents a Git worktree entry.
 * Maps to Rust Worktree struct.
 */
export interface Worktree {
  /** Path to the worktree directory */
  path: string;
  /** Branch name checked out in the worktree */
  branch: string;
  /** HEAD commit hash */
  head: string;
  /** Associated story ID, if any */
  storyId?: string;
  /** Whether the worktree is locked */
  locked: boolean;
  /** Whether this is the main worktree (original repository) */
  isMain: boolean;
}

/**
 * Options for creating a new worktree.
 * Maps to Rust CreateWorktreeOptions struct.
 */
export interface CreateWorktreeOptions {
  /** Story ID (e.g., "3-3") */
  storyId: string;
  /** Story slug for branch naming (e.g., "worktree-creation") */
  storySlug: string;
  /** Base branch to create from (defaults to current branch) */
  baseBranch?: string;
}

/**
 * A stored binding between a story and its worktree.
 * Maps to Rust WorktreeBinding struct.
 */
export interface WorktreeBinding {
  /** Story ID (primary key) */
  storyId: string;
  /** Path to the worktree directory */
  worktreePath: string;
  /** Branch name */
  branchName: string;
  /** When the binding was created (ISO 8601) */
  createdAt: string;
}

/**
 * Error types that can occur during worktree operations.
 * Matches Rust WorktreeError enum variants.
 */
export type WorktreeErrorKind =
  | 'GitError'
  | 'AlreadyExists'
  | 'BranchInUse'
  | 'NotFound'
  | 'DirtyWorktree'
  | 'InvalidPath'
  | 'DatabaseError'
  | 'IoError';

/**
 * Worktree error with kind and message.
 */
export interface WorktreeError {
  kind: WorktreeErrorKind;
  message: string;
}

/**
 * Cleanup mode options for worktree removal.
 */
export type CleanupMode = 'worktree-only' | 'worktree-and-branch';

/**
 * Options for cleaning up a worktree.
 */
export interface CleanupOptions {
  /** Whether to delete the branch after removing the worktree */
  deleteBranch: boolean;
  /** Whether to force removal even if worktree has uncommitted changes */
  force: boolean;
}

/**
 * Result of a merge operation.
 * Maps to Rust MergeResult struct.
 */
export interface MergeResult {
  /** Whether the merge was successful */
  success: boolean;
  /** Human-readable message about the merge result */
  message: string;
  /** List of conflicting file paths (empty if no conflicts) */
  conflicts: string[];
  /** The merge commit hash (short form) if successful */
  mergeCommit: string | null;
}
