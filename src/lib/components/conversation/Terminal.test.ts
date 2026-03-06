/**
 * Unit tests for Terminal.svelte component.
 * Tests xterm.js initialization, output handling, input handling, and cleanup.
 */

import { render, screen, waitFor, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Terminal from './Terminal.svelte';

// Mock xterm.js Terminal class
const mockTerminal = {
  loadAddon: vi.fn(),
  open: vi.fn(),
  write: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
  onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  rows: 24,
  cols: 80,
};

const mockFitAddon = {
  fit: vi.fn(),
};

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => mockTerminal),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => mockFitAddon),
}));

// Mock terminal service
vi.mock('$lib/services/terminal', () => ({
  defaultTerminalOptions: {
    cursorBlink: true,
    theme: { background: '#1a1a2e' },
  },
  tryLoadWebGLAddon: vi.fn().mockResolvedValue(false),
}));

// Mock process service
const mockOnSessionOutput = vi.fn();
const mockOnSessionExited = vi.fn();
const mockSendSessionInput = vi.fn();
const mockResizeSession = vi.fn();

vi.mock('$lib/services/process', () => ({
  onSessionOutput: (...args: unknown[]) => mockOnSessionOutput(...args),
  onSessionExited: (...args: unknown[]) => mockOnSessionExited(...args),
  sendSessionInput: (...args: unknown[]) => mockSendSessionInput(...args),
  resizeSession: (...args: unknown[]) => mockResizeSession(...args),
}));

// Mock session stores
vi.mock('$lib/stores/sessions', () => ({
  updateSessionStatus: vi.fn(),
  markNewOutput: vi.fn(),
  appendSessionOutput: vi.fn(),
  getSessionOutputHistory: vi.fn(() => []),
}));

// Mock ResizeObserver with tracked instances
const mockResizeObserverObserve = vi.fn();
const mockResizeObserverDisconnect = vi.fn();

class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe = mockResizeObserverObserve;
  unobserve = vi.fn();
  disconnect = mockResizeObserverDisconnect;
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

describe('Terminal', () => {
  let outputCallback: ((data: string) => void) | null = null;
  let exitedCallback: ((status: string, exitCode?: number) => void) | null = null;
  let inputCallback: ((data: string) => void) | null = null;
  const mockUnlisten = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    outputCallback = null;
    exitedCallback = null;
    inputCallback = null;

    // Reset mock implementations
    mockOnSessionOutput.mockImplementation(
      (_sessionId: string, callback: (data: string) => void) => {
        outputCallback = callback;
        return Promise.resolve(mockUnlisten);
      }
    );

    mockOnSessionExited.mockImplementation(
      (
        _sessionId: string,
        callback: (status: string, exitCode?: number) => void
      ) => {
        exitedCallback = callback;
        return Promise.resolve(mockUnlisten);
      }
    );

    mockTerminal.onData.mockImplementation((callback: (data: string) => void) => {
      inputCallback = callback;
      return { dispose: vi.fn() };
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders terminal container element', () => {
      render(Terminal, { props: { sessionId: 'test-session' } });

      const container = document.querySelector('.terminal-container');
      expect(container).toBeInTheDocument();
    });

    it('initializes xterm Terminal with default options', async () => {
      const { Terminal: TerminalClass } = await import('@xterm/xterm');
      render(Terminal, { props: { sessionId: 'test-session' } });

      expect(TerminalClass).toHaveBeenCalledWith(
        expect.objectContaining({ cursorBlink: true })
      );
    });

    it('loads FitAddon and calls fit()', async () => {
      const { FitAddon } = await import('@xterm/addon-fit');
      render(Terminal, { props: { sessionId: 'test-session' } });

      expect(FitAddon).toHaveBeenCalled();
      expect(mockTerminal.loadAddon).toHaveBeenCalled();
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('opens terminal in container element', () => {
      render(Terminal, { props: { sessionId: 'test-session' } });

      expect(mockTerminal.open).toHaveBeenCalled();
    });
  });

  describe('error state', () => {
    it('shows error state when initialization fails', async () => {
      const { Terminal: TerminalClass } = await import('@xterm/xterm');
      (TerminalClass as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('WebGL not supported');
      });

      render(Terminal, { props: { sessionId: 'test-session' } });

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to initialize terminal: WebGL not supported/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('visibility effect', () => {
    it('calls fit and focus when visible changes to true', async () => {
      vi.useFakeTimers();

      const { rerender } = render(Terminal, {
        props: { sessionId: 'test-session', visible: false },
      });

      // Clear initial calls
      mockFitAddon.fit.mockClear();
      mockTerminal.focus.mockClear();

      // Change visibility to true
      rerender({ sessionId: 'test-session', visible: true });

      // Run timers for setTimeout in effect
      vi.advanceTimersByTime(0);

      expect(mockFitAddon.fit).toHaveBeenCalled();
      expect(mockTerminal.focus).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('does not call fit/focus when visible is false', async () => {
      vi.useFakeTimers();

      render(Terminal, { props: { sessionId: 'test-session', visible: false } });

      // Clear any initial calls
      const initialFitCalls = mockFitAddon.fit.mock.calls.length;

      vi.advanceTimersByTime(100);

      // Should not have additional calls after initial render
      expect(mockFitAddon.fit.mock.calls.length).toBe(initialFitCalls);

      vi.useRealTimers();
    });
  });

  describe('session output handling', () => {
    it('subscribes to session output events', async () => {
      render(Terminal, { props: { sessionId: 'test-session-123' } });

      await waitFor(() => {
        expect(mockOnSessionOutput).toHaveBeenCalledWith(
          'test-session-123',
          expect.any(Function)
        );
      });
    });

    it('writes output data to terminal', async () => {
      render(Terminal, { props: { sessionId: 'test-session' } });

      await waitFor(() => {
        expect(outputCallback).not.toBeNull();
      });

      // Simulate output
      outputCallback!('Hello, world!');

      expect(mockTerminal.write).toHaveBeenCalledWith('Hello, world!');
    });
  });

  describe('input handling', () => {
    it('sends input data via sendSessionInput', async () => {
      render(Terminal, { props: { sessionId: 'test-session-456' } });

      await waitFor(() => {
        expect(inputCallback).not.toBeNull();
      });

      // Simulate user typing
      inputCallback!('ls -la');

      expect(mockSendSessionInput).toHaveBeenCalledWith('test-session-456', 'ls -la');
    });
  });

  describe('session exit handling', () => {
    it('subscribes to session exit events', async () => {
      render(Terminal, { props: { sessionId: 'test-session-789' } });

      await waitFor(() => {
        expect(mockOnSessionExited).toHaveBeenCalledWith(
          'test-session-789',
          expect.any(Function)
        );
      });
    });

    it('calls onSessionExit callback when session exits', async () => {
      const onSessionExit = vi.fn();
      render(Terminal, {
        props: { sessionId: 'test-session', onSessionExit },
      });

      await waitFor(() => {
        expect(exitedCallback).not.toBeNull();
      });

      // Simulate session exit
      exitedCallback!('completed', 0);

      expect(onSessionExit).toHaveBeenCalledWith('completed', 0);
    });

    it('writes completed message to terminal', async () => {
      render(Terminal, { props: { sessionId: 'test-session' } });

      await waitFor(() => {
        expect(exitedCallback).not.toBeNull();
      });

      exitedCallback!('completed', 0);

      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining('Session completed')
      );
    });

    it('writes interrupted message to terminal', async () => {
      render(Terminal, { props: { sessionId: 'test-session' } });

      await waitFor(() => {
        expect(exitedCallback).not.toBeNull();
      });

      exitedCallback!('interrupted');

      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining('Session terminated')
      );
    });

    it('shows exit code for non-zero exits', async () => {
      render(Terminal, { props: { sessionId: 'test-session' } });

      await waitFor(() => {
        expect(exitedCallback).not.toBeNull();
      });

      exitedCallback!('completed', 1);

      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining('exited with code 1')
      );
    });
  });

  describe('resize handling', () => {
    it('sends initial resize notification', () => {
      render(Terminal, { props: { sessionId: 'test-session' } });

      expect(mockResizeSession).toHaveBeenCalledWith('test-session', 24, 80);
    });

    it('sets up ResizeObserver on container', () => {
      render(Terminal, { props: { sessionId: 'test-session' } });

      expect(mockResizeObserverObserve).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('disposes terminal on unmount', () => {
      const { unmount } = render(Terminal, { props: { sessionId: 'test-session' } });

      unmount();

      expect(mockTerminal.dispose).toHaveBeenCalled();
    });

    it('disconnects ResizeObserver on unmount', () => {
      const { unmount } = render(Terminal, { props: { sessionId: 'test-session' } });

      unmount();

      expect(mockResizeObserverDisconnect).toHaveBeenCalled();
    });
  });
});
