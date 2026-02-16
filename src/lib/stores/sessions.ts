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
}
