/**
 * Unit tests for SessionTabs.svelte component.
 * Tests tab rendering, tab switching, active tab highlighting, and new output indicator.
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClaudeSession } from '$lib/services/process';
import SessionTabs from './SessionTabs.svelte';
import * as sessionsStore from '$lib/stores/sessions';

// Mock the entire module, but use real svelte/store
vi.mock('$lib/stores/sessions', async (importOriginal) => {
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

describe('SessionTabs', () => {
  const mockSession1: ClaudeSession = {
    id: 'session-1',
    claudeSessionId: 'uuid-1',
    projectPath: '/my/project',
    agent: 'architect',
    startedAt: '2026-02-23T10:30:00.000Z',
    status: 'active',
  };

  const mockSession2: ClaudeSession = {
    id: 'session-2',
    claudeSessionId: 'uuid-2',
    projectPath: '/my/project',
    agent: 'developer',
    startedAt: '2026-02-23T11:00:00.000Z',
    status: 'completed',
  };

  const mockSession3: ClaudeSession = {
    id: 'session-3',
    claudeSessionId: 'uuid-3',
    projectPath: '/my/project',
    agent: 'tester',
    startedAt: '2026-02-23T11:30:00.000Z',
    status: 'interrupted',
  };

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
    (sessionsStore.sessionsWithNewOutput as { set: (v: Set<string>) => void }).set(
      new Set(ids)
    );
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

  describe('tab visibility', () => {
    it('does not render tabs when only one session exists', () => {
      setSessions(mockSession1);

      render(SessionTabs);

      // Should not render any tabs (tabs only show when > 1 session)
      expect(screen.queryByText('architect')).not.toBeInTheDocument();
    });

    it('renders tabs when multiple sessions exist', () => {
      setSessions(mockSession1, mockSession2);

      render(SessionTabs);

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('renders all session tabs when more than 2 sessions exist', () => {
      setSessions(mockSession1, mockSession2, mockSession3);

      render(SessionTabs);

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('tab content', () => {
    it('shows agent name in tab', () => {
      setSessions(mockSession1, mockSession2);

      render(SessionTabs);

      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('shows formatted start time in tab', () => {
      setSessions(mockSession1, mockSession2);

      render(SessionTabs);

      // Time format depends on locale, just check it's present
      const buttons = screen.getAllByRole('button');
      expect(buttons[0].textContent).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('status indicators', () => {
    it('shows green status indicator for active session', () => {
      setSessions(mockSession1, mockSession2);

      render(SessionTabs);

      const greenIndicator = document.querySelector('.bg-green-500');
      expect(greenIndicator).toBeInTheDocument();
    });

    it('shows gray status indicator for completed session', () => {
      setSessions(mockSession1, mockSession2);

      render(SessionTabs);

      const grayIndicator = document.querySelector('.bg-gray-500');
      expect(grayIndicator).toBeInTheDocument();
    });

    it('shows yellow status indicator for interrupted session', () => {
      setSessions(mockSession1, mockSession3);

      render(SessionTabs);

      const yellowIndicator = document.querySelector('.bg-yellow-500');
      expect(yellowIndicator).toBeInTheDocument();
    });

    it('animates pulse for active session indicator', () => {
      setSessions(mockSession1, mockSession2);

      render(SessionTabs);

      const pulsingIndicator = document.querySelector('.animate-pulse.bg-green-500');
      expect(pulsingIndicator).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('calls selectSession when clicking a tab', async () => {
      setSessions(mockSession1, mockSession2);

      render(SessionTabs);

      const developerTab = screen.getByText('developer').closest('button');
      await fireEvent.click(developerTab!);

      expect(sessionsStore.selectSession).toHaveBeenCalledWith('session-2');
    });
  });

  describe('active tab styling', () => {
    it('shows selected tab with highlighted styling', () => {
      setSessions(mockSession1, mockSession2);
      setCurrentSession('session-1');

      render(SessionTabs);

      const architectTab = screen.getByText('architect').closest('button');
      expect(architectTab).toHaveClass('bg-gray-700');
      expect(architectTab).toHaveClass('text-gray-100');
    });

    it('shows unselected tab with muted styling', () => {
      setSessions(mockSession1, mockSession2);
      setCurrentSession('session-1');

      render(SessionTabs);

      const developerTab = screen.getByText('developer').closest('button');
      expect(developerTab).toHaveClass('text-gray-400');
      expect(developerTab).not.toHaveClass('bg-gray-700');
    });
  });

  describe('new output indicator', () => {
    it('shows new output indicator for session with new output', () => {
      setSessions(mockSession1, mockSession2);
      setCurrentSession('session-1');
      setNewOutput('session-2');

      render(SessionTabs);

      // Blue pulsing indicator for new output
      const blueIndicator = document.querySelector('.bg-blue-500.animate-pulse');
      expect(blueIndicator).toBeInTheDocument();
    });

    it('does not show new output indicator for currently selected session', () => {
      setSessions(mockSession1, mockSession2);
      setCurrentSession('session-1');
      setNewOutput('session-1'); // Selected session has new output

      render(SessionTabs);

      // The architect tab is selected, so its blue indicator shouldn't show
      const architectTab = screen.getByText('architect').closest('button');
      const blueIndicators = architectTab?.querySelectorAll('.bg-blue-500');
      expect(blueIndicators?.length ?? 0).toBe(0);
    });

    it('does not show new output indicator when no new output', () => {
      setSessions(mockSession1, mockSession2);
      setCurrentSession('session-1');
      setNewOutput(); // No new output

      render(SessionTabs);

      const blueIndicator = document.querySelector('.bg-blue-500');
      expect(blueIndicator).not.toBeInTheDocument();
    });

    it('new output indicator has title attribute', () => {
      setSessions(mockSession1, mockSession2);
      setCurrentSession('session-1');
      setNewOutput('session-2');

      render(SessionTabs);

      const indicator = screen.getByTitle('New output');
      expect(indicator).toBeInTheDocument();
    });
  });
});
