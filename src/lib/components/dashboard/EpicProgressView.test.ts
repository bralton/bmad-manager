/**
 * Unit tests for EpicProgressView.svelte component.
 * Tests epic progress display, progress bar colors, and artifact viewer integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { EpicProgress } from '$lib/types/workflow';

// Use vi.hoisted to create mocks that are accessible to vi.mock factories
const { mockEpicProgress, mockSelectedArtifact, mockArtifactViewerOpen, mockSelectArtifact, mockGetEpicArtifact, mockRefreshSprintStatus, mockRefreshEpicTitles } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockEpicProgress: writable([]),
    mockSelectedArtifact: writable(null),
    mockArtifactViewerOpen: writable(false),
    mockSelectArtifact: vi.fn(),
    mockGetEpicArtifact: vi.fn(),
    mockRefreshSprintStatus: vi.fn(),
    mockRefreshEpicTitles: vi.fn(),
  };
});

// Mock stores
vi.mock('$lib/stores/workflow', () => ({
  epicProgress: mockEpicProgress,
  workflowViewMode: writable('phase'),
}));

vi.mock('$lib/stores/project', () => ({
  currentProject: writable({
    path: '/test/project',
    state: 'fully-initialized',
  }),
}));

vi.mock('$lib/stores/artifacts', () => ({
  selectedArtifact: mockSelectedArtifact,
  artifactViewerOpen: mockArtifactViewerOpen,
  selectArtifact: mockSelectArtifact,
}));

vi.mock('$lib/stores/stories', () => ({
  refreshSprintStatus: mockRefreshSprintStatus,
  refreshEpicTitles: mockRefreshEpicTitles,
}));

vi.mock('$lib/services/artifacts', () => ({
  artifactBrowserApi: {
    getEpicArtifact: mockGetEpicArtifact,
  },
}));

// Import component after mocks are set up
import EpicProgressView from './EpicProgressView.svelte';

describe('EpicProgressView', () => {
  const mockEpics: EpicProgress[] = [
    {
      epicId: '1',
      title: 'Foundation',
      status: 'done',
      stats: { total: 10, done: 10, inProgress: 0, percentage: 100 },
    },
    {
      epicId: '2',
      title: 'Workflow Visualization',
      status: 'in-progress',
      stats: { total: 6, done: 3, inProgress: 1, percentage: 50 },
    },
    {
      epicId: '3',
      title: 'Stories & Worktrees',
      status: 'backlog',
      stats: { total: 0, done: 0, inProgress: 0, percentage: 0 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockEpicProgress.set([]);
    mockSelectedArtifact.set(null);
    mockArtifactViewerOpen.set(false);
    mockGetEpicArtifact.mockResolvedValue({
      path: '/test/epic-1.md',
      title: 'Epic 1',
      category: 'epics',
    });
  });

  describe('rendering', () => {
    it('shows empty state when no epics exist', () => {
      mockEpicProgress.set([]);
      render(EpicProgressView);

      expect(screen.getByText('No epics found')).toBeInTheDocument();
      expect(screen.getByText('Sprint status has no epics to display.')).toBeInTheDocument();
    });

    it('renders all epics when data exists', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      expect(screen.getByText('Foundation')).toBeInTheDocument();
      expect(screen.getByText('Workflow Visualization')).toBeInTheDocument();
      expect(screen.getByText('Stories & Worktrees')).toBeInTheDocument();
    });

    it('displays epic status in parentheses', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      expect(screen.getByText('(done)')).toBeInTheDocument();
      expect(screen.getByText('(in-progress)')).toBeInTheDocument();
      expect(screen.getByText('(backlog)')).toBeInTheDocument();
    });

    it('shows done/total counts', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      expect(screen.getByText('10/10 done')).toBeInTheDocument();
      expect(screen.getByText('3/6 done')).toBeInTheDocument();
      expect(screen.getByText('0/0 done')).toBeInTheDocument();
    });

    it('displays percentages', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('displays epic IDs', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      expect(screen.getByText('Epic 1')).toBeInTheDocument();
      expect(screen.getByText('Epic 2')).toBeInTheDocument();
      expect(screen.getByText('Epic 3')).toBeInTheDocument();
    });
  });

  describe('progress bar colors', () => {
    it('uses green for 100% completion', () => {
      mockEpicProgress.set([mockEpics[0]]); // 100% done
      render(EpicProgressView);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar.className).toContain('bg-green-500');
    });

    it('uses blue for partial completion', () => {
      mockEpicProgress.set([mockEpics[1]]); // 50% done
      render(EpicProgressView);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar.className).toContain('bg-blue-500');
    });

    it('uses gray for 0% completion', () => {
      mockEpicProgress.set([mockEpics[2]]); // 0% done
      render(EpicProgressView);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar.className).toContain('bg-gray-600');
    });
  });

  describe('artifact viewer integration', () => {
    it('opens artifact viewer when epic is clicked', async () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      const epicButton = screen.getByRole('button', {
        name: /View Epic 1: Foundation/,
      });
      await fireEvent.click(epicButton);

      expect(mockGetEpicArtifact).toHaveBeenCalledWith('/test/project', '1');
    });

    it('calls selectArtifact on successful click', async () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      const epicButton = screen.getByRole('button', {
        name: /View Epic 1: Foundation/,
      });
      await fireEvent.click(epicButton);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockSelectArtifact).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper aria labels on progress bars', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars[0]).toHaveAttribute('aria-valuenow', '100');
      expect(progressBars[0]).toHaveAttribute('aria-valuemin', '0');
      expect(progressBars[0]).toHaveAttribute('aria-valuemax', '100');
    });

    it('has aria-label on epic buttons', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicProgressView);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-label', 'View Epic 1: Foundation');
    });
  });
});
