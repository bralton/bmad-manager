/**
 * Unit tests for SessionDrawer component (Story 5-5).
 * Tests drawer opening/closing, session display, resize, and ESC key handling.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClaudeSession } from '$lib/services/process';
import * as sessionsStore from '$lib/stores/sessions';
import * as uiStore from '$lib/stores/ui';

// Mock ResizeObserver which isn't available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock xterm.js and related modules that Terminal.svelte imports
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    focus: vi.fn(),
    rows: 24,
    cols: 80,
    onData: vi.fn(() => ({ dispose: vi.fn() })),
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
    activate: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('$lib/services/terminal', () => ({
  defaultTerminalOptions: {},
  tryLoadWebGLAddon: vi.fn(),
}));

vi.mock('$lib/services/process', async () => {
  return {
    onSessionOutput: vi.fn().mockResolvedValue(vi.fn()),
    onSessionExited: vi.fn().mockResolvedValue(vi.fn()),
    sendSessionInput: vi.fn().mockResolvedValue(undefined),
    resizeSession: vi.fn().mockResolvedValue(undefined),
    terminateSession: vi.fn().mockResolvedValue(undefined),
  };
});

// Import after mocks are set up
import SessionDrawer from './SessionDrawer.svelte';
import * as processService from '$lib/services/process';

// Mock the stores module
vi.mock('$lib/stores/sessions', async () => {
  const { writable, derived } = await import('svelte/store');

  const sessions = writable<Map<string, ClaudeSession>>(new Map());
  const currentSessionId = writable<string | null>(null);
  const currentSession = derived([sessions, currentSessionId], ([$sessions, $id]) =>
    $id ? $sessions.get($id) : undefined
  );
  const selectSession = vi.fn();

  return {
    sessions,
    currentSessionId,
    currentSession,
    selectSession,
    // Terminal output history functions (needed for Terminal component)
    appendSessionOutput: vi.fn(),
    getSessionOutputHistory: vi.fn(() => []),
  };
});

// Mock UI store
vi.mock('$lib/stores/ui', async () => {
  const { writable } = await import('svelte/store');
  const sessionDrawerOpen = writable(false);
  const sessionDrawerHeight = writable(400);

  return {
    sessionDrawerOpen,
    sessionDrawerHeight,
    closeSessionDrawer: vi.fn(() => sessionDrawerOpen.set(false)),
    setSessionDrawerHeight: vi.fn((height: number) => sessionDrawerHeight.set(height)),
    showToast: vi.fn(),
  };
});

// Mock keyboard utils
vi.mock('$lib/utils/keyboard', () => ({
  isTerminalFocused: vi.fn(() => false),
}));

import * as keyboardUtils from '$lib/utils/keyboard';

describe('SessionDrawer', () => {
  // Helper to create mock session
  function createMockSession(
    id: string,
    agent: string,
    status: 'active' | 'completed' | 'interrupted' = 'active'
  ): ClaudeSession {
    return {
      id,
      claudeSessionId: `claude-${id}`,
      projectPath: '/test/project',
      agent,
      startedAt: new Date().toISOString(),
      status,
    };
  }

  // Helper to set sessions store
  function setSession(session: ClaudeSession | null) {
    if (session) {
      const map = new Map([[session.id, session]]);
      (sessionsStore.sessions as { set: (v: Map<string, ClaudeSession>) => void }).set(map);
      (sessionsStore.currentSessionId as { set: (v: string | null) => void }).set(session.id);
    } else {
      (sessionsStore.sessions as { set: (v: Map<string, ClaudeSession>) => void }).set(new Map());
      (sessionsStore.currentSessionId as { set: (v: string | null) => void }).set(null);
    }
  }

  // Helper to set drawer state
  function setDrawerOpen(open: boolean) {
    (uiStore.sessionDrawerOpen as { set: (v: boolean) => void }).set(open);
  }

  // Helper to set drawer height
  function setDrawerHeight(height: number) {
    (uiStore.sessionDrawerHeight as { set: (v: number) => void }).set(height);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setSession(null);
    setDrawerOpen(false);
    setDrawerHeight(400);
    vi.mocked(keyboardUtils.isTerminalFocused).mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe('AC#1: Drawer Opens/Closes', () => {
    it('does not render when drawer is closed', () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(false);

      render(SessionDrawer);

      // Should not render any drawer content
      expect(screen.queryByText('Architect')).not.toBeInTheDocument();
    });

    it('renders when drawer is open and session exists', () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);

      render(SessionDrawer);

      expect(screen.getByText('Architect')).toBeInTheDocument();
    });

    it('does not render when drawer is open but no session', () => {
      setSession(null);
      setDrawerOpen(true);

      render(SessionDrawer);

      // Drawer requires both open state AND a session
      const drawerContent = document.querySelector('.bg-gray-900');
      expect(drawerContent).not.toBeInTheDocument();
    });
  });

  describe('AC#2: Drawer Header Display', () => {
    it('shows session name and status indicator', () => {
      const session = createMockSession('s1', 'Architect', 'active');
      setSession(session);
      setDrawerOpen(true);

      render(SessionDrawer);

      expect(screen.getByText('Architect')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows green status dot for active session', () => {
      setSession(createMockSession('s1', 'Architect', 'active'));
      setDrawerOpen(true);

      render(SessionDrawer);

      const greenDot = document.querySelector('.bg-green-500');
      expect(greenDot).toBeInTheDocument();
    });

    it('shows collapse button', () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);

      render(SessionDrawer);

      expect(screen.getByTitle('Collapse drawer')).toBeInTheDocument();
    });

    it('shows close button', () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);

      render(SessionDrawer);

      expect(screen.getByTitle('Terminate session')).toBeInTheDocument();
    });

    it('shows start time', () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);

      render(SessionDrawer);

      expect(screen.getByText(/Started/)).toBeInTheDocument();
    });
  });

  describe('AC#4: Collapse Behavior', () => {
    it('clicking collapse button calls closeSessionDrawer', async () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);

      render(SessionDrawer);

      const collapseButton = screen.getByTitle('Collapse drawer');
      await fireEvent.click(collapseButton);

      expect(uiStore.closeSessionDrawer).toHaveBeenCalled();
    });
  });

  describe('AC#5: ESC Key Handling', () => {
    it('pressing Escape closes drawer when terminal not focused', async () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);
      vi.mocked(keyboardUtils.isTerminalFocused).mockReturnValue(false);

      render(SessionDrawer);

      await fireEvent.keyDown(window, { key: 'Escape' });

      expect(uiStore.closeSessionDrawer).toHaveBeenCalled();
    });

    it('pressing Escape does NOT close drawer when terminal is focused', async () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);
      vi.mocked(keyboardUtils.isTerminalFocused).mockReturnValue(true);

      render(SessionDrawer);

      await fireEvent.keyDown(window, { key: 'Escape' });

      // closeSessionDrawer should NOT be called
      expect(uiStore.closeSessionDrawer).not.toHaveBeenCalled();
    });
  });

  describe('AC#7: Drawer Height', () => {
    it('applies drawer height from store', () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);
      setDrawerHeight(500);

      render(SessionDrawer);

      const drawer = document.querySelector('.bg-gray-900');
      expect(drawer).toHaveStyle({ height: '500px' });
    });
  });

  describe('AC#8: Resize Handle', () => {
    it('has resize handle with proper cursor styling', () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);

      render(SessionDrawer);

      const resizeHandle = document.querySelector('.cursor-row-resize');
      expect(resizeHandle).toBeInTheDocument();
    });

    it('resize handle has separator role for accessibility', () => {
      setSession(createMockSession('s1', 'Architect'));
      setDrawerOpen(true);

      render(SessionDrawer);

      const separator = screen.getByRole('separator');
      expect(separator).toBeInTheDocument();
    });
  });

  describe('AC#11: Terminate Session', () => {
    it('clicking close button shows confirmation dialog for active session', async () => {
      setSession(createMockSession('s1', 'Architect', 'active'));
      setDrawerOpen(true);

      render(SessionDrawer);

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      expect(screen.getByText('Terminate Session?')).toBeInTheDocument();
    });

    it('clicking close button for completed session closes drawer directly', async () => {
      setSession(createMockSession('s1', 'Architect', 'completed'));
      setDrawerOpen(true);

      render(SessionDrawer);

      const closeButton = screen.getByTitle('Close drawer');
      await fireEvent.click(closeButton);

      // Should close drawer and clear session, not show dialog
      expect(uiStore.closeSessionDrawer).toHaveBeenCalled();
      expect(sessionsStore.selectSession).toHaveBeenCalledWith(null);
      expect(screen.queryByText('Terminate Session?')).not.toBeInTheDocument();
    });

    it('confirm terminate calls terminateSession', async () => {
      setSession(createMockSession('s1', 'Architect', 'active'));
      setDrawerOpen(true);

      render(SessionDrawer);

      // Open dialog
      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      // Confirm
      const terminateButton = screen.getByRole('button', { name: 'Terminate' });
      await fireEvent.click(terminateButton);

      expect(processService.terminateSession).toHaveBeenCalledWith('s1');
    });

    it('cancel dismiss confirmation dialog', async () => {
      setSession(createMockSession('s1', 'Architect', 'active'));
      setDrawerOpen(true);

      render(SessionDrawer);

      // Open dialog
      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      // Cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await fireEvent.click(cancelButton);

      expect(screen.queryByText('Terminate Session?')).not.toBeInTheDocument();
      expect(processService.terminateSession).not.toHaveBeenCalled();
    });
  });

  describe('Party Mode Support', () => {
    it('shows party mode indicator and participants', () => {
      const session = createMockSession('s1', 'Developer', 'active');
      session.partyMode = {
        enabled: true,
        participants: ['Opus', 'Sonnet', 'Haiku'],
      };
      setSession(session);
      setDrawerOpen(true);

      render(SessionDrawer);

      expect(screen.getByText('Party Mode')).toBeInTheDocument();
      expect(screen.getByText('3 agents')).toBeInTheDocument();
    });
  });
});
