/**
 * Unit tests for PinnedSessionsBar component.
 * Tests AC#1 (empty state), AC#3 (multiple sessions display),
 * AC#4 (unread indicator), AC#5 (overflow behavior), AC#7 (close button).
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClaudeSession } from '$lib/services/process';
import PinnedSessionsBar from './PinnedSessionsBar.svelte';
import * as sessionsStore from '$lib/stores/sessions';

// Mock the stores module using the proven pattern from SessionTabs.test.ts
vi.mock('$lib/stores/sessions', async () => {
  const { writable, derived } = await import('svelte/store');

  const sessions = writable<Map<string, ClaudeSession>>(new Map());
  const currentSessionId = writable<string | null>(null);
  const activeSessions = derived(sessions, ($sessions) =>
    Array.from($sessions.values()).filter((s) => s.status === 'active')
  );
  const sessionsWithNewOutput = writable<Set<string>>(new Set());
  const selectSession = vi.fn();

  return {
    sessions,
    currentSessionId,
    activeSessions,
    sessionsWithNewOutput,
    selectSession,
  };
});

// Mock project store
vi.mock('$lib/stores/project', async () => {
  const { writable } = await import('svelte/store');
  return {
    currentProject: writable({ path: '/test/project', name: 'Test Project' }),
  };
});

// Mock process service
import * as processService from '$lib/services/process';
vi.mock('$lib/services/process', () => ({
  terminateSession: vi.fn().mockResolvedValue(undefined),
}));

// Mock UI store
import * as uiStore from '$lib/stores/ui';
vi.mock('$lib/stores/ui', () => ({
  showToast: vi.fn(),
}));

describe('PinnedSessionsBar', () => {
  // Helper to create mock active sessions
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
  function setSessions(...sessions: ClaudeSession[]) {
    const map = new Map(sessions.map((s) => [s.id, s]));
    (sessionsStore.sessions as { set: (v: Map<string, ClaudeSession>) => void }).set(map);
  }

  // Helper to set current session
  function setCurrentSession(id: string | null) {
    (sessionsStore.currentSessionId as { set: (v: string | null) => void }).set(id);
  }

  // Helper to set new output sessions
  function setNewOutput(...ids: string[]) {
    (sessionsStore.sessionsWithNewOutput as { set: (v: Set<string>) => void }).set(new Set(ids));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores to empty state
    setSessions();
    setCurrentSession(null);
    setNewOutput();
  });

  afterEach(() => {
    cleanup();
  });

  describe('AC#1: Empty State - No Active Sessions', () => {
    it('does not render bar when no active sessions', () => {
      render(PinnedSessionsBar);

      // Bar should not render at all when empty
      const bar = document.querySelector('.border-b.border-gray-700');
      expect(bar).not.toBeInTheDocument();
    });

    it('does not show any buttons when no active sessions', () => {
      render(PinnedSessionsBar);

      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });
  });

  describe('AC#3: Multiple Active Sessions Display', () => {
    it('displays all active session tabs', () => {
      setSessions(
        createMockSession('session-1', 'Architect'),
        createMockSession('session-2', 'Developer'),
        createMockSession('session-3', 'Tester')
      );

      render(PinnedSessionsBar);

      expect(screen.getByText('Architect')).toBeInTheDocument();
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('Tester')).toBeInTheDocument();
    });

    it('each tab shows status dot and agent name', () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      // Should have agent name
      expect(screen.getByText('Architect')).toBeInTheDocument();

      // Should have a status dot (green for active)
      const statusDot = document.querySelector('.bg-green-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('does not show completed sessions in the bar', () => {
      setSessions(
        createMockSession('session-1', 'ActiveAgent', 'active'),
        createMockSession('session-2', 'CompletedAgent', 'completed')
      );

      render(PinnedSessionsBar);

      expect(screen.getByText('ActiveAgent')).toBeInTheDocument();
      expect(screen.queryByText('CompletedAgent')).not.toBeInTheDocument();
    });
  });

  describe('AC#4: Unread Output Indicator (Blue Dot)', () => {
    it('shows blue dot for sessions with new output', () => {
      setSessions(createMockSession('session-1', 'Architect'));
      setNewOutput('session-1');

      render(PinnedSessionsBar);

      const blueDot = document.querySelector('.bg-blue-500');
      expect(blueDot).toBeInTheDocument();
    });

    it('blue dot has pulse animation', () => {
      setSessions(createMockSession('session-1', 'Architect'));
      setNewOutput('session-1');

      render(PinnedSessionsBar);

      const blueDot = document.querySelector('.bg-blue-500.animate-pulse');
      expect(blueDot).toBeInTheDocument();
    });

    it('does not show blue dot for selected session', () => {
      setSessions(createMockSession('session-1', 'Architect'));
      setNewOutput('session-1');
      setCurrentSession('session-1');

      render(PinnedSessionsBar);

      // Blue dot should not be visible when session is selected
      const blueDot = document.querySelector('.bg-blue-500');
      expect(blueDot).not.toBeInTheDocument();
    });
  });

  describe('AC#5: Overflow Behavior (5+ Sessions)', () => {
    it('shows first 4 tabs plus overflow indicator when 5+ sessions', () => {
      setSessions(
        createMockSession('s1', 'Agent1'),
        createMockSession('s2', 'Agent2'),
        createMockSession('s3', 'Agent3'),
        createMockSession('s4', 'Agent4'),
        createMockSession('s5', 'Agent5'),
        createMockSession('s6', 'Agent6')
      );

      render(PinnedSessionsBar);

      // Should show first 4 agents
      expect(screen.getByText('Agent1')).toBeInTheDocument();
      expect(screen.getByText('Agent2')).toBeInTheDocument();
      expect(screen.getByText('Agent3')).toBeInTheDocument();
      expect(screen.getByText('Agent4')).toBeInTheDocument();

      // Should NOT show 5th and 6th in main bar
      expect(screen.queryByText('Agent5')).not.toBeInTheDocument();
      expect(screen.queryByText('Agent6')).not.toBeInTheDocument();

      // Should show "+2 more" overflow button
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('clicking overflow button shows dropdown with remaining sessions', async () => {
      setSessions(
        createMockSession('s1', 'Agent1'),
        createMockSession('s2', 'Agent2'),
        createMockSession('s3', 'Agent3'),
        createMockSession('s4', 'Agent4'),
        createMockSession('s5', 'Agent5')
      );

      render(PinnedSessionsBar);

      const overflowButton = screen.getByText('+1 more');
      await fireEvent.click(overflowButton);

      // Dropdown should now show Agent5
      expect(screen.getByText('Agent5')).toBeInTheDocument();
    });

    it('overflow dropdown sessions have close buttons', async () => {
      setSessions(
        createMockSession('s1', 'Agent1'),
        createMockSession('s2', 'Agent2'),
        createMockSession('s3', 'Agent3'),
        createMockSession('s4', 'Agent4'),
        createMockSession('s5', 'Agent5')
      );

      render(PinnedSessionsBar);

      // Open dropdown
      const overflowButton = screen.getByText('+1 more');
      await fireEvent.click(overflowButton);

      // Should have close buttons (5 total: 4 visible + 1 in dropdown)
      const closeButtons = screen.getAllByTitle('Terminate session');
      expect(closeButtons.length).toBe(5);
    });

    it('escape key closes overflow dropdown', async () => {
      setSessions(
        createMockSession('s1', 'Agent1'),
        createMockSession('s2', 'Agent2'),
        createMockSession('s3', 'Agent3'),
        createMockSession('s4', 'Agent4'),
        createMockSession('s5', 'Agent5')
      );

      render(PinnedSessionsBar);

      // Open dropdown
      const overflowButton = screen.getByText('+1 more');
      await fireEvent.click(overflowButton);

      // Agent5 should be visible
      expect(screen.getByText('Agent5')).toBeInTheDocument();

      // Press Escape
      await fireEvent.keyDown(window, { key: 'Escape' });

      // Dropdown should close - Agent5 should no longer be visible
      expect(screen.queryByText('Agent5')).not.toBeInTheDocument();
    });

    it('overflow button has proper accessibility attributes', () => {
      setSessions(
        createMockSession('s1', 'Agent1'),
        createMockSession('s2', 'Agent2'),
        createMockSession('s3', 'Agent3'),
        createMockSession('s4', 'Agent4'),
        createMockSession('s5', 'Agent5')
      );

      render(PinnedSessionsBar);

      const overflowButton = screen.getByLabelText('Show 1 more sessions');
      expect(overflowButton).toHaveAttribute('aria-haspopup', 'menu');
      expect(overflowButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('AC#7: Close Button on Hover', () => {
    it('close button is present on session tabs', () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const closeButton = screen.getByTitle('Terminate session');
      expect(closeButton).toBeInTheDocument();
    });

    it('close button has hover visibility styling', () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const closeButton = screen.getByTitle('Terminate session');
      // Should have opacity-0 class for default hidden state
      expect(closeButton.className).toMatch(/opacity-0/);
    });
  });

  describe('AC#8: Terminate Session via Close Button', () => {
    it('clicking close button shows confirmation dialog', async () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      // Dialog should appear
      expect(screen.getByText('Terminate Session?')).toBeInTheDocument();
      expect(screen.getByText(/This will stop the Claude CLI process/)).toBeInTheDocument();
    });

    it('cancel button dismisses dialog without terminating', async () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      // Click cancel
      const cancelButton = screen.getByText('Cancel');
      await fireEvent.click(cancelButton);

      // Dialog should be dismissed
      expect(screen.queryByText('Terminate Session?')).not.toBeInTheDocument();

      // terminateSession should NOT have been called
      expect(processService.terminateSession).not.toHaveBeenCalled();
    });

    it('confirm button calls terminateSession and shows toast', async () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      // Click terminate
      const terminateButton = screen.getByText('Terminate');
      await fireEvent.click(terminateButton);

      // terminateSession should have been called with the session ID
      expect(processService.terminateSession).toHaveBeenCalledWith('session-1');

      // Wait for async operation
      await vi.waitFor(() => {
        expect(uiStore.showToast).toHaveBeenCalledWith('Session terminated', expect.any(String));
      });
    });

    it('shows error toast when termination fails', async () => {
      // Make terminateSession reject
      vi.mocked(processService.terminateSession).mockRejectedValueOnce(new Error('Connection lost'));

      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const terminateButton = screen.getByText('Terminate');
      await fireEvent.click(terminateButton);

      // Wait for async error handling
      await vi.waitFor(() => {
        expect(uiStore.showToast).toHaveBeenCalledWith(
          expect.stringContaining('Failed to terminate'),
          expect.any(String),
          expect.any(Number)
        );
      });
    });

    it('dialog closes after successful termination', async () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const terminateButton = screen.getByText('Terminate');
      await fireEvent.click(terminateButton);

      // Wait for dialog to close
      await vi.waitFor(() => {
        expect(screen.queryByText('Terminate Session?')).not.toBeInTheDocument();
      });
    });
  });

  describe('AC#9: Tab Click Selects Session', () => {
    it('clicking a tab selects the session', async () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const tab = screen.getByText('Architect').closest('[role="button"]');
      await fireEvent.click(tab!);

      expect(sessionsStore.selectSession).toHaveBeenCalledWith('session-1');
    });

    it('selected session tab has highlighted styling', () => {
      setSessions(createMockSession('session-1', 'Architect'));
      setCurrentSession('session-1');

      render(PinnedSessionsBar);

      const tab = screen.getByText('Architect').closest('[role="button"]');
      expect(tab).toHaveClass('bg-gray-700');
    });
  });

  describe('AC#10: Bar Visibility', () => {
    it('renders the bar container with border styling when sessions exist', () => {
      setSessions(createMockSession('session-1', 'Architect'));

      render(PinnedSessionsBar);

      const container = document.querySelector('.border-b.border-gray-700');
      expect(container).toBeInTheDocument();
    });
  });
});
