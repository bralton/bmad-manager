import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import BugDetailPanel from './BugDetailPanel.svelte';
import { currentProject } from '$lib/stores/project';
import type { Bug } from '$lib/types/stories';
import type { Project } from '$lib/types/project';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock stores
vi.mock('$lib/stores/project', () => ({
  currentProject: {
    subscribe: vi.fn(),
  },
}));

// Import invoke after mocking
import { invoke } from '@tauri-apps/api/core';

describe('BugDetailPanel', () => {
  let mockUnsubscribe: Mock;
  let onCloseMock: Mock;

  const mockBug: Bug = {
    id: 'bug-1-session-visibility',
    bugNumber: 1,
    slug: 'session-visibility',
    status: 'in-progress',
  };

  const mockProject: Project = {
    path: '/test/project',
    name: 'Test Project',
    agents: [],
    config: null,
    state: 'fully-initialized',
  };

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    onCloseMock = vi.fn();

    // Setup store subscription
    (currentProject.subscribe as Mock).mockImplementation((callback: (value: Project | null) => void) => {
      callback(mockProject);
      return mockUnsubscribe;
    });

    // Setup invoke mock for bug content
    (invoke as Mock).mockResolvedValue({
      bugId: 'BUG-001',
      title: 'Session Visibility Issue',
      severity: 'high',
      priority: 'P1',
      status: 'in-progress',
      reportedBy: 'TestUser',
      reportedDate: '2026-02-17',
      relatedStories: ['1-7', '1-8'],
      summary: 'Sessions appear before project selection.',
      body: 'Full bug description here.',
      parsed: true,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders bug header with bug number', () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    expect(screen.getByText('BUG-1')).toBeInTheDocument();
  });

  it('displays status badge', () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('displays full bug ID', () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    expect(screen.getByText('bug-1-session-visibility')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    const closeButton = screen.getByLabelText('Close detail panel');
    await fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    // The backdrop has role="presentation"
    const backdrop = screen.getByRole('presentation');
    // Click directly on the backdrop (not the panel)
    await fireEvent.click(backdrop);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('loads bug content from API', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_bug_content', {
        bugPath: '/test/project/_bmad-output/implementation-artifacts/bug-1-session-visibility.md',
      });
    });
  });

  it('displays bug content when loaded', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await waitFor(() => {
      // Title from content should be displayed
      expect(screen.getByText('Session Visibility Issue')).toBeInTheDocument();
    });

    // Severity should be shown
    expect(screen.getByText('high')).toBeInTheDocument();

    // Priority should be shown
    expect(screen.getByText('P1')).toBeInTheDocument();
  });

  it('displays severity with correct styling', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await waitFor(() => {
      const severityBadge = screen.getByText('high');
      expect(severityBadge).toBeInTheDocument();
      // High severity should have orange color class
      expect(severityBadge.className).toContain('text-orange-400');
    });
  });

  it('displays related stories', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await waitFor(() => {
      expect(screen.getByText('1-7')).toBeInTheDocument();
      expect(screen.getByText('1-8')).toBeInTheDocument();
    });
  });

  it('displays reported by and date', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await waitFor(() => {
      expect(screen.getByText('TestUser')).toBeInTheDocument();
      expect(screen.getByText('2026-02-17')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching content', () => {
    // Make invoke hang
    (invoke as Mock).mockReturnValue(new Promise(() => {}));

    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    expect(screen.getByText('Loading bug details...')).toBeInTheDocument();
  });

  it('shows error state with retry button', async () => {
    (invoke as Mock).mockRejectedValue(new Error('Network error'));

    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries loading when retry button is clicked', async () => {
    (invoke as Mock).mockRejectedValueOnce(new Error('Network error'));

    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    // Setup success for retry
    (invoke as Mock).mockResolvedValueOnce({
      bugId: 'BUG-001',
      title: 'Session Visibility Issue',
      parsed: true,
      error: null,
    });

    const retryButton = screen.getByText('Retry');
    await fireEvent.click(retryButton);

    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('shows backlog state for backlog bugs when file does not exist', async () => {
    const backlogBug: Bug = {
      ...mockBug,
      status: 'backlog',
    };

    // Mock file not found error
    (invoke as Mock).mockResolvedValueOnce({
      parsed: false,
      error: 'Failed to read file: No such file or directory',
    });

    render(BugDetailPanel, {
      props: { bug: backlogBug, onClose: onCloseMock },
    });

    // Should try to load even for backlog bugs
    await waitFor(() => {
      expect(invoke).toHaveBeenCalled();
    });

    // Should show no file message after load fails
    await waitFor(() => {
      expect(screen.getByText('Bug file not yet created')).toBeInTheDocument();
      expect(screen.getByText('This bug is in the backlog.')).toBeInTheDocument();
    });
  });

  it('derives title from slug when content title is not available', async () => {
    const backlogBug: Bug = {
      ...mockBug,
      status: 'backlog',
    };

    // Mock file not found
    (invoke as Mock).mockResolvedValueOnce({
      parsed: false,
      error: 'Failed to read file: No such file or directory',
    });

    render(BugDetailPanel, {
      props: { bug: backlogBug, onClose: onCloseMock },
    });

    // Should derive "Session Visibility" from "session-visibility"
    // This should be visible immediately (derived from slug)
    expect(screen.getByText('Session Visibility')).toBeInTheDocument();
  });

  it('has correct aria attributes', () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'bug-detail-title');
  });

  it('renders summary section when available', async () => {
    render(BugDetailPanel, {
      props: { bug: mockBug, onClose: onCloseMock },
    });

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });
  });
});
