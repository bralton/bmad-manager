/**
 * Unit tests for SessionList.svelte component.
 * Tests search functionality, clear button, empty states, and session display.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionList from './SessionList.svelte';
import type { SessionRecord } from '$lib/services/process';

describe('SessionList', () => {
  const mockSessions: SessionRecord[] = [
    {
      id: 'session-1',
      claudeSessionId: 'uuid-1',
      projectPath: '/my/project',
      agent: 'architect',
      workflow: 'create-prd',
      startedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      status: 'active',
    },
    {
      id: 'session-2',
      claudeSessionId: 'uuid-2',
      projectPath: '/another/project',
      agent: 'developer',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      lastActive: new Date(Date.now() - 3600000).toISOString(),
      status: 'completed',
    },
    {
      id: 'session-3',
      claudeSessionId: 'uuid-3',
      projectPath: '/third/project',
      agent: 'tester',
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      lastActive: new Date(Date.now() - 86400000).toISOString(),
      status: 'interrupted',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search input', () => {
    it('renders search input', () => {
      render(SessionList, { props: { sessions: mockSessions } });

      const input = screen.getByPlaceholderText('Search sessions...');
      expect(input).toBeInTheDocument();
    });

    it('calls onSearch with debounced query', async () => {
      vi.useFakeTimers();
      const onSearch = vi.fn();

      render(SessionList, { props: { sessions: mockSessions, onSearch } });

      const input = screen.getByPlaceholderText('Search sessions...');
      await fireEvent.input(input, { target: { value: 'architect' } });

      // Should not be called immediately
      expect(onSearch).not.toHaveBeenCalled();

      // Advance timers past debounce (300ms)
      vi.advanceTimersByTime(300);

      expect(onSearch).toHaveBeenCalledWith('architect');

      vi.useRealTimers();
    });
  });

  describe('clear button', () => {
    it('shows clear button when search query exists', async () => {
      render(SessionList, { props: { sessions: mockSessions } });

      const input = screen.getByPlaceholderText('Search sessions...');
      await fireEvent.input(input, { target: { value: 'test' } });

      // Clear button should appear (X icon)
      const clearButton = screen.getByTitle('Clear search');
      expect(clearButton).toBeInTheDocument();
    });

    it('does not show clear button when search is empty', () => {
      render(SessionList, { props: { sessions: mockSessions } });

      expect(screen.queryByTitle('Clear search')).not.toBeInTheDocument();
    });

    it('clears search when clear button clicked', async () => {
      const onSearch = vi.fn();
      render(SessionList, { props: { sessions: mockSessions, onSearch } });

      const input = screen.getByPlaceholderText('Search sessions...') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'test' } });

      const clearButton = screen.getByTitle('Clear search');
      await fireEvent.click(clearButton);

      expect(input.value).toBe('');
      expect(onSearch).toHaveBeenCalledWith('');
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when isSearching is true', () => {
      render(SessionList, { props: { sessions: mockSessions, isSearching: true } });

      // Find spinner by its class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('does not show spinner when not searching', () => {
      render(SessionList, { props: { sessions: mockSessions, isSearching: false } });

      // Check specifically for the search spinner (in the input area)
      const inputArea = document.querySelector('.border-gray-700');
      const spinner = inputArea?.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows no history message when no sessions', () => {
      render(SessionList, { props: { sessions: [] } });

      expect(screen.getByText('No session history yet')).toBeInTheDocument();
    });

    it('shows search query in empty results message', async () => {
      render(SessionList, { props: { sessions: [] } });

      const input = screen.getByPlaceholderText('Search sessions...');
      await fireEvent.input(input, { target: { value: 'foobar' } });

      expect(screen.getByText(/No sessions match/)).toBeInTheDocument();
      expect(screen.getByText('foobar')).toBeInTheDocument();
    });

    it('shows Clear Search button in empty search results', async () => {
      render(SessionList, { props: { sessions: [] } });

      const input = screen.getByPlaceholderText('Search sessions...');
      await fireEvent.input(input, { target: { value: 'test' } });

      const clearButton = screen.getByRole('button', { name: 'Clear Search' });
      expect(clearButton).toBeInTheDocument();
    });

    it('Clear Search button in empty state clears search', async () => {
      const onSearch = vi.fn();
      render(SessionList, { props: { sessions: [], onSearch } });

      const input = screen.getByPlaceholderText('Search sessions...') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'test' } });

      const clearButton = screen.getByRole('button', { name: 'Clear Search' });
      await fireEvent.click(clearButton);

      expect(input.value).toBe('');
      expect(onSearch).toHaveBeenCalledWith('');
    });
  });

  describe('session display', () => {
    it('renders session list items', () => {
      render(SessionList, { props: { sessions: mockSessions } });

      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows workflow when present', () => {
      render(SessionList, { props: { sessions: mockSessions } });

      expect(screen.getByText('create-prd')).toBeInTheDocument();
    });

    it('shows project name from path', () => {
      render(SessionList, { props: { sessions: mockSessions } });

      // All 3 sessions have paths ending in 'project', so should see 3 instances
      const projectNames = screen.getAllByText('project');
      expect(projectNames.length).toBe(3);
    });

    it('shows status badges', () => {
      render(SessionList, { props: { sessions: mockSessions } });

      // Status badges appear both as filter chips and session badges
      // Use getAllByText to account for both
      const activeElements = screen.getAllByText('Active');
      const completedElements = screen.getAllByText('Completed');
      const interruptedElements = screen.getAllByText('Interrupted');

      // At least one of each should exist (session badges)
      expect(activeElements.length).toBeGreaterThanOrEqual(1);
      expect(completedElements.length).toBeGreaterThanOrEqual(1);
      expect(interruptedElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows Resumed badge when session was resumed', () => {
      const resumedSession: SessionRecord[] = [
        {
          ...mockSessions[0],
          resumedAt: new Date().toISOString(),
        },
      ];

      render(SessionList, { props: { sessions: resumedSession } });

      expect(screen.getByText('Resumed')).toBeInTheDocument();
    });
  });

  describe('session resume', () => {
    it('calls onResume when session clicked', async () => {
      const onResume = vi.fn();
      render(SessionList, { props: { sessions: mockSessions, onResume } });

      const sessionButton = screen.getByText('architect').closest('button');
      await fireEvent.click(sessionButton!);

      expect(onResume).toHaveBeenCalledWith('session-1');
    });

    it('shows loading state for resuming session', () => {
      render(SessionList, {
        props: { sessions: mockSessions, resumingSessionId: 'session-1' },
      });

      // The resuming session should have a spinner
      const sessionButtons = screen.getAllByRole('button');
      const resumingButton = sessionButtons.find((btn) =>
        btn.textContent?.includes('architect')
      );
      expect(resumingButton).toHaveClass('opacity-50');
    });

    it('disables button while resuming', () => {
      render(SessionList, {
        props: { sessions: mockSessions, resumingSessionId: 'session-1' },
      });

      const sessionButtons = screen.getAllByRole('button');
      const resumingButton = sessionButtons.find((btn) =>
        btn.textContent?.includes('architect')
      );
      expect(resumingButton).toBeDisabled();
    });
  });

  describe('relative time formatting', () => {
    it('shows Just now for very recent sessions', () => {
      const recentSession: SessionRecord[] = [
        {
          ...mockSessions[0],
          lastActive: new Date().toISOString(),
        },
      ];

      render(SessionList, { props: { sessions: recentSession } });

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('shows hours ago for older sessions', () => {
      const olderSession: SessionRecord[] = [
        {
          ...mockSessions[0],
          lastActive: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
      ];

      render(SessionList, { props: { sessions: olderSession } });

      expect(screen.getByText('1h ago')).toBeInTheDocument();
    });
  });

  describe('filter chips', () => {
    it('renders all filter chips', () => {
      render(SessionList, { props: { sessions: mockSessions } });

      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'This Week' })).toBeInTheDocument();
    });

    it('All filter is selected by default', () => {
      render(SessionList, { props: { sessions: mockSessions } });

      const allChip = screen.getByRole('button', { name: 'All' });
      expect(allChip).toHaveAttribute('aria-pressed', 'true');
    });

    it('clicking Active filter shows only active sessions', async () => {
      render(SessionList, { props: { sessions: mockSessions } });

      const activeChip = screen.getByRole('button', { name: 'Active' });
      await fireEvent.click(activeChip);

      // Should only show active session
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.queryByText('developer')).not.toBeInTheDocument();
      expect(screen.queryByText('tester')).not.toBeInTheDocument();
    });

    it('clicking Completed filter shows only completed sessions', async () => {
      render(SessionList, { props: { sessions: mockSessions } });

      const completedChip = screen.getByRole('button', { name: 'Completed' });
      await fireEvent.click(completedChip);

      // Should only show completed session
      expect(screen.queryByText('architect')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText('tester')).not.toBeInTheDocument();
    });

    it('clicking This Week filter shows only recent sessions', async () => {
      // All mock sessions have recent lastActive timestamps
      render(SessionList, { props: { sessions: mockSessions } });

      const thisWeekChip = screen.getByRole('button', { name: 'This Week' });
      await fireEvent.click(thisWeekChip);

      // Should show all 3 since they're all recent (within this week)
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('clicking All filter after another filter shows all sessions', async () => {
      render(SessionList, { props: { sessions: mockSessions } });

      // First filter to Active
      const activeChip = screen.getByRole('button', { name: 'Active' });
      await fireEvent.click(activeChip);

      // Then click All
      const allChip = screen.getByRole('button', { name: 'All' });
      await fireEvent.click(allChip);

      // Should show all sessions
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows empty state message when filter has no matches', async () => {
      // Only one active session
      const sessions: SessionRecord[] = [
        {
          ...mockSessions[0],
          status: 'interrupted',
        },
      ];

      render(SessionList, { props: { sessions } });

      const completedChip = screen.getByRole('button', { name: 'Completed' });
      await fireEvent.click(completedChip);

      expect(screen.getByText(/No completed sessions/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show All' })).toBeInTheDocument();
    });

    it('Show All button resets filter', async () => {
      const sessions: SessionRecord[] = [
        {
          ...mockSessions[0],
          status: 'interrupted',
        },
      ];

      render(SessionList, { props: { sessions } });

      const completedChip = screen.getByRole('button', { name: 'Completed' });
      await fireEvent.click(completedChip);

      const showAllButton = screen.getByRole('button', { name: 'Show All' });
      await fireEvent.click(showAllButton);

      // Should show the session now
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('combines text search with filter', async () => {
      vi.useFakeTimers();
      const onSearch = vi.fn();
      render(SessionList, { props: { sessions: mockSessions, onSearch } });

      // Type in search
      const input = screen.getByPlaceholderText('Search sessions...');
      await fireEvent.input(input, { target: { value: 'test' } });

      // Advance past debounce timeout
      vi.advanceTimersByTime(300);

      // Also apply filter
      const activeChip = screen.getByRole('button', { name: 'Active' });
      await fireEvent.click(activeChip);

      // Both should be applied
      expect(activeChip).toHaveAttribute('aria-pressed', 'true');
      // Search callback should have been triggered (after debounce)
      expect(onSearch).toHaveBeenCalledWith('test');

      vi.useRealTimers();
    });
  });
});
