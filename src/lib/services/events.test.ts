/**
 * Unit tests for events.ts service.
 * Tests setupEventListeners and event handler callbacks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupEventListeners } from './events';

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { listen } from '@tauri-apps/api/event';
const mockListen = listen as ReturnType<typeof vi.fn>;

describe('events service', () => {
  // Store event handlers for testing
  type EventCallback = (event: { payload: unknown }) => void;
  const eventHandlers: Map<string, EventCallback> = new Map();

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers.clear();

    // Setup mock to capture handlers and return unlisten function
    mockListen.mockImplementation((eventName: string, handler: EventCallback) => {
      eventHandlers.set(eventName, handler);
      return Promise.resolve(() => {
        eventHandlers.delete(eventName);
      });
    });
  });

  describe('setupEventListeners', () => {
    // P0: Test returns unlisten functions
    it('returns array of unlisten functions', async () => {
      const unlisteners = await setupEventListeners({
        onArtifactModified: vi.fn(),
        onWorkflowStateChanged: vi.fn(),
      });

      expect(unlisteners).toBeInstanceOf(Array);
      expect(unlisteners.length).toBe(2);
      expect(typeof unlisteners[0]).toBe('function');
    });

    // P0: Test onArtifactModified handler
    it('sets up onArtifactModified listener and passes path', async () => {
      const handler = vi.fn();
      await setupEventListeners({ onArtifactModified: handler });

      expect(mockListen).toHaveBeenCalledWith('artifact-modified', expect.any(Function));

      // Simulate event
      const eventCallback = eventHandlers.get('artifact-modified');
      expect(eventCallback).toBeDefined();
      eventCallback!({ payload: { path: '/test/artifact.md' } });

      expect(handler).toHaveBeenCalledWith('/test/artifact.md');
    });

    // P0: Test onWorkflowStateChanged handler
    it('sets up onWorkflowStateChanged listener', async () => {
      const handler = vi.fn();
      await setupEventListeners({ onWorkflowStateChanged: handler });

      expect(mockListen).toHaveBeenCalledWith('workflow-state-changed', expect.any(Function));

      // Simulate event
      const eventCallback = eventHandlers.get('workflow-state-changed');
      expect(eventCallback).toBeDefined();
      eventCallback!({ payload: {} });

      expect(handler).toHaveBeenCalled();
    });

    // P0: Test onStoryStatusChanged handler
    it('sets up onStoryStatusChanged listener', async () => {
      const handler = vi.fn();
      await setupEventListeners({ onStoryStatusChanged: handler });

      expect(mockListen).toHaveBeenCalledWith('story-status-changed', expect.any(Function));

      // Simulate event
      const eventCallback = eventHandlers.get('story-status-changed');
      expect(eventCallback).toBeDefined();
      eventCallback!({ payload: {} });

      expect(handler).toHaveBeenCalled();
    });

    // P0: Test onWatcherError handler
    it('sets up onWatcherError listener and passes message', async () => {
      const handler = vi.fn();
      await setupEventListeners({ onWatcherError: handler });

      expect(mockListen).toHaveBeenCalledWith('watcher-error', expect.any(Function));

      // Simulate event
      const eventCallback = eventHandlers.get('watcher-error');
      expect(eventCallback).toBeDefined();
      eventCallback!({ payload: { message: 'Watch path not found' } });

      expect(handler).toHaveBeenCalledWith('Watch path not found');
    });

    // P1: Test partial handlers (only some provided)
    it('only registers listeners for provided handlers', async () => {
      await setupEventListeners({ onWorkflowStateChanged: vi.fn() });

      expect(mockListen).toHaveBeenCalledTimes(1);
      expect(mockListen).toHaveBeenCalledWith('workflow-state-changed', expect.any(Function));
    });

    // P1: Test empty handlers object
    it('returns empty array when no handlers provided', async () => {
      const unlisteners = await setupEventListeners({});

      expect(unlisteners).toEqual([]);
      expect(mockListen).not.toHaveBeenCalled();
    });

    // P1: Test unlisten cleanup
    it('unlisten functions remove handlers when called', async () => {
      const unlisteners = await setupEventListeners({
        onArtifactModified: vi.fn(),
      });

      expect(eventHandlers.has('artifact-modified')).toBe(true);

      // Call unlisten
      unlisteners[0]();

      expect(eventHandlers.has('artifact-modified')).toBe(false);
    });

    // P2: Test all handlers together
    it('sets up all four event listeners when all handlers provided', async () => {
      const unlisteners = await setupEventListeners({
        onArtifactModified: vi.fn(),
        onWorkflowStateChanged: vi.fn(),
        onStoryStatusChanged: vi.fn(),
        onWatcherError: vi.fn(),
      });

      expect(unlisteners.length).toBe(4);
      expect(mockListen).toHaveBeenCalledTimes(4);
      expect(mockListen).toHaveBeenCalledWith('artifact-modified', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('workflow-state-changed', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('story-status-changed', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('watcher-error', expect.any(Function));
    });
  });
});
