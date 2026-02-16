/**
 * Process service for managing Claude CLI sessions.
 * Provides typed Tauri invoke wrappers for session lifecycle operations.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Options for spawning a new Claude CLI session.
 */
export interface SpawnOptions {
  /** Session name for Claude CLI (e.g., "bmad-myproject-architect-20260216-143052") */
  sessionName: string;
  /** Path to the project directory */
  projectPath: string;
  /** Optional initial command to run (e.g., "/bmad-create-prd") */
  initialCommand?: string;
  /** Whether to resume an existing session */
  resume?: boolean;
}

/**
 * Status of a Claude session.
 */
export type SessionStatus = 'active' | 'completed' | 'interrupted';

/**
 * Represents an active or completed Claude session.
 */
export interface ClaudeSession {
  /** Unique session identifier */
  id: string;
  /** Path to the project directory */
  projectPath: string;
  /** Agent name that spawned this session */
  agent: string;
  /** Optional workflow being executed */
  workflow?: string;
  /** When the session started (ISO string) */
  startedAt: string;
  /** Current session status */
  status: SessionStatus;
}

/**
 * Spawns a new Claude CLI session in a PTY.
 */
export async function spawnClaudeSession(options: SpawnOptions): Promise<ClaudeSession> {
  return invoke<ClaudeSession>('spawn_claude_session', { options });
}

/**
 * Sends input data to an active session.
 */
export async function sendSessionInput(sessionId: string, data: string): Promise<void> {
  return invoke('session_input', { sessionId, data });
}

/**
 * Terminates an active session.
 */
export async function terminateSession(sessionId: string): Promise<void> {
  return invoke('terminate_session', { sessionId });
}

/**
 * Lists all active sessions.
 */
export async function listActiveSessions(): Promise<ClaudeSession[]> {
  return invoke<ClaudeSession[]>('list_active_sessions');
}

/**
 * Resizes the PTY for a session.
 * Call this when the terminal container size changes.
 */
export async function resizeSession(sessionId: string, rows: number, cols: number): Promise<void> {
  return invoke('resize_session', { sessionId, rows, cols });
}

/**
 * Subscribes to output events for a session.
 * @returns Unsubscribe function
 */
export async function onSessionOutput(
  sessionId: string,
  callback: (data: string) => void
): Promise<UnlistenFn> {
  return listen<string>(`session-output-${sessionId}`, (event) => {
    callback(event.payload);
  });
}

/**
 * Subscribes to session exit events.
 * @returns Unsubscribe function
 */
export async function onSessionExited(
  sessionId: string,
  callback: (status: string, exitCode?: number) => void
): Promise<UnlistenFn> {
  return listen<{ status: string; exitCode?: number }>(`session-exited-${sessionId}`, (event) => {
    callback(event.payload.status, event.payload.exitCode);
  });
}

/**
 * Generates a session name following the pattern: bmad-{project}-{agent}-{YYYYMMDD-HHmmss}
 */
export function generateSessionName(projectName: string, agentName: string): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15); // YYYYMMDD-HHmmss

  // Sanitize names to be safe for session naming
  const sanitizedProject = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const sanitizedAgent = agentName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  return `bmad-${sanitizedProject}-${sanitizedAgent}-${timestamp}`;
}
