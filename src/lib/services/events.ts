/**
 * Frontend event service for listening to Tauri file watcher events.
 *
 * This service provides a unified interface for subscribing to file system
 * events emitted by the Rust file watcher module.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Event payload for artifact events.
 */
export interface ArtifactEventPayload {
  path: string;
}

/**
 * Event payload for watcher error events.
 */
export interface WatcherErrorPayload {
  message: string;
}

/**
 * Event handlers for file watcher events.
 */
export interface EventHandlers {
  /** Called when an existing artifact is modified */
  onArtifactModified?: (path: string) => void;
  /** Called when workflow state changes (implementation artifacts modified) */
  onWorkflowStateChanged?: () => void;
  /** Called when story status changes (sprint-status.yaml modified) */
  onStoryStatusChanged?: () => void;
  /** Called when the file watcher encounters an error */
  onWatcherError?: (message: string) => void;
}

/**
 * Sets up event listeners for file watcher events.
 *
 * @param handlers - Object containing callback functions for different event types
 * @returns Array of unlisten functions to call for cleanup
 *
 * @example
 * ```typescript
 * const unlisteners = await setupEventListeners({
 *   onWorkflowStateChanged: () => refreshWorkflowState(projectPath),
 *   onArtifactModified: (path) => console.log('Modified:', path),
 *   onWatcherError: (msg) => console.error('Watcher error:', msg),
 * });
 *
 * // Cleanup when done
 * unlisteners.forEach(fn => fn());
 * ```
 */
export async function setupEventListeners(handlers: EventHandlers): Promise<UnlistenFn[]> {
  const unlisteners: UnlistenFn[] = [];

  if (handlers.onArtifactModified) {
    const handler = handlers.onArtifactModified;
    unlisteners.push(
      await listen<ArtifactEventPayload>('artifact-modified', (event) => {
        handler(event.payload.path);
      })
    );
  }

  if (handlers.onWorkflowStateChanged) {
    const handler = handlers.onWorkflowStateChanged;
    unlisteners.push(
      await listen('workflow-state-changed', () => {
        handler();
      })
    );
  }

  if (handlers.onStoryStatusChanged) {
    const handler = handlers.onStoryStatusChanged;
    unlisteners.push(
      await listen('story-status-changed', () => {
        handler();
      })
    );
  }

  if (handlers.onWatcherError) {
    const handler = handlers.onWatcherError;
    unlisteners.push(
      await listen<WatcherErrorPayload>('watcher-error', (event) => {
        handler(event.payload.message);
      })
    );
  }

  return unlisteners;
}
