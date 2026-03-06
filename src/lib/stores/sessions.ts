/**
 * Svelte stores for managing Claude CLI sessions.
 * Tracks active sessions and provides reactive state for UI updates.
 */

import { writable, derived, get } from 'svelte/store';
import type { ClaudeSession } from '$lib/services/process';

/**
 * Map of all tracked sessions by session ID.
 */
export const sessions = writable<Map<string, ClaudeSession>>(new Map());

/**
 * Derived store of active sessions only.
 */
export const activeSessions = derived(sessions, ($sessions) =>
  Array.from($sessions.values()).filter((s) => s.status === 'active')
);

/**
 * Count of active sessions for quick access.
 */
export const activeSessionCount = derived(activeSessions, ($activeSessions) => $activeSessions.length);

/**
 * Currently selected/visible session ID.
 */
export const currentSessionId = writable<string | null>(null);

/**
 * Derived: currently selected session.
 */
export const currentSession = derived(
  [sessions, currentSessionId],
  ([$sessions, $id]) => ($id ? $sessions.get($id) : undefined)
);

/**
 * Adds a new session to the store.
 */
export function addSession(session: ClaudeSession) {
  sessions.update((map) => {
    const newMap = new Map(map);
    newMap.set(session.id, session);
    return newMap;
  });
}

/**
 * Updates an existing session's status.
 */
export function updateSessionStatus(sessionId: string, status: ClaudeSession['status']) {
  sessions.update((map) => {
    const session = map.get(sessionId);
    if (session) {
      const newMap = new Map(map);
      newMap.set(sessionId, { ...session, status });
      return newMap;
    }
    return map;
  });
}

/**
 * Gets a session by ID.
 */
export function getSession(sessionId: string): ClaudeSession | undefined {
  return get(sessions).get(sessionId);
}

/**
 * Removes a session from the store.
 */
export function removeSession(sessionId: string) {
  sessions.update((map) => {
    const newMap = new Map(map);
    newMap.delete(sessionId);
    return newMap;
  });
}

/**
 * Clears all sessions from the store.
 */
export function clearSessions() {
  sessions.set(new Map());
  currentSessionId.set(null);
}

/**
 * Selects a session for display.
 * Clears the new output indicator for the selected session.
 * Updates are batched to prevent intermediate state visibility.
 */
export function selectSession(sessionId: string | null) {
  // Clear new output indicator first (if applicable) to ensure
  // subscribers see consistent state when currentSessionId updates
  if (sessionId) {
    sessionsWithNewOutput.update((set) => {
      if (set.has(sessionId)) {
        const newSet = new Set(set);
        newSet.delete(sessionId);
        return newSet;
      }
      return set;
    });
  }
  currentSessionId.set(sessionId);
}

/**
 * Tracks sessions with new (unread) output.
 */
export const sessionsWithNewOutput = writable<Set<string>>(new Set());

/**
 * Marks a session as having new output.
 * Only marks if the session is not currently selected.
 */
export function markNewOutput(sessionId: string) {
  const currentId = get(currentSessionId);
  if (sessionId !== currentId) {
    sessionsWithNewOutput.update((set) => {
      const newSet = new Set(set);
      newSet.add(sessionId);
      return newSet;
    });
  }
}

/**
 * Clears the new output indicator for a session.
 */
export function clearNewOutput(sessionId: string) {
  sessionsWithNewOutput.update((set) => {
    const newSet = new Set(set);
    newSet.delete(sessionId);
    return newSet;
  });
}

/**
 * Terminal output history per session.
 * Stores output chunks to replay when terminal remounts.
 */
const sessionOutputHistory = new Map<string, string[]>();

/**
 * Maximum number of output chunks to store per session.
 * Prevents unbounded memory growth for long-running sessions.
 */
const MAX_OUTPUT_CHUNKS = 10000;

/**
 * Appends output to a session's history.
 */
export function appendSessionOutput(sessionId: string, data: string) {
  let history = sessionOutputHistory.get(sessionId);
  if (!history) {
    history = [];
    sessionOutputHistory.set(sessionId, history);
  }
  history.push(data);
  // Trim if too large (keep recent output)
  if (history.length > MAX_OUTPUT_CHUNKS) {
    history.splice(0, history.length - MAX_OUTPUT_CHUNKS);
  }
}

/**
 * Gets all stored output for a session.
 */
export function getSessionOutputHistory(sessionId: string): string[] {
  return sessionOutputHistory.get(sessionId) || [];
}

/**
 * Clears output history for a session (call when session is removed).
 */
export function clearSessionOutputHistory(sessionId: string) {
  sessionOutputHistory.delete(sessionId);
}
