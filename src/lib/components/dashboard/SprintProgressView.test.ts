/**
 * Unit tests for SprintProgressView.svelte component.
 * Tests metric card display, counts, and progress visualization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { SprintProgress } from '$lib/types/workflow';

// Use vi.hoisted to create mocks that are accessible to vi.mock factories
const { mockSprintProgress, mockCurrentProject, mockRefreshSprintStatus } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockSprintProgress: writable(null),
    mockCurrentProject: writable({
      path: '/test/project',
      state: 'fully-initialized',
    }),
    mockRefreshSprintStatus: vi.fn(),
  };
});

// Mock the stores
vi.mock('$lib/stores/workflow', () => ({
  sprintProgress: mockSprintProgress,
}));

vi.mock('$lib/stores/project', () => ({
  currentProject: mockCurrentProject,
}));

vi.mock('$lib/stores/stories', () => ({
  refreshSprintStatus: mockRefreshSprintStatus,
}));

// Import component after mocks are set up
import SprintProgressView from './SprintProgressView.svelte';

describe('SprintProgressView', () => {
  const mockProgress: SprintProgress = {
    counts: {
      backlog: 5,
      ready: 3,
      inProgress: 2,
      review: 1,
      done: 10,
    },
    total: 21,
    percentage: 48,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSprintProgress.set(null);
  });

  describe('rendering', () => {
    it('shows empty state when no sprint data', () => {
      mockSprintProgress.set(null);
      render(SprintProgressView);

      expect(screen.getByText('No sprint data')).toBeInTheDocument();
      expect(screen.getByText('Sprint status is not available for this project.')).toBeInTheDocument();
    });

    it('renders all metric cards when data exists', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('displays correct counts for each status', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      expect(screen.getByText('5')).toBeInTheDocument(); // backlog
      expect(screen.getByText('3')).toBeInTheDocument(); // ready
      expect(screen.getByText('2')).toBeInTheDocument(); // inProgress
      expect(screen.getByText('1')).toBeInTheDocument(); // review
      expect(screen.getByText('10')).toBeInTheDocument(); // done
    });

    it('displays total stories count', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      expect(screen.getByText('Total Stories:')).toBeInTheDocument();
      expect(screen.getByText('21')).toBeInTheDocument();
    });

    it('displays completion percentage', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      expect(screen.getByText('Completion:')).toBeInTheDocument();
      expect(screen.getByText('48%')).toBeInTheDocument();
    });

    it('renders progress bar with correct width', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle('width: 48%');
    });
  });

  describe('metric card colors', () => {
    it('applies correct color to backlog count', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      // Find the backlog count element (the number 5)
      const backlogCount = screen.getByText('5');
      expect(backlogCount.className).toContain('text-gray-400');
    });

    it('applies correct color to ready count', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      // Find the ready count element (the number 3)
      const readyCount = screen.getByText('3');
      expect(readyCount.className).toContain('text-yellow-400');
    });

    it('applies correct color to in progress count', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      // Find the in progress count element (the number 2)
      const inProgressCount = screen.getByText('2');
      expect(inProgressCount.className).toContain('text-blue-400');
    });

    it('applies correct color to done count', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      // Find the done count element (the number 10)
      const doneCount = screen.getByText('10');
      expect(doneCount.className).toContain('text-green-400');
    });
  });

  describe('edge cases', () => {
    it('handles zero stories', () => {
      mockSprintProgress.set({
        counts: {
          backlog: 0,
          ready: 0,
          inProgress: 0,
          review: 0,
          done: 0,
        },
        total: 0,
        percentage: 0,
      });
      render(SprintProgressView);

      expect(screen.getByText('0%')).toBeInTheDocument();
      // All counts should show 0
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0);
    });

    it('handles 100% completion', () => {
      mockSprintProgress.set({
        counts: {
          backlog: 0,
          ready: 0,
          inProgress: 0,
          review: 0,
          done: 15,
        },
        total: 15,
        percentage: 100,
      });
      render(SprintProgressView);

      expect(screen.getByText('100%')).toBeInTheDocument();
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle('width: 100%');
    });
  });

  describe('accessibility', () => {
    it('has proper aria attributes on progress bar', () => {
      mockSprintProgress.set(mockProgress);
      render(SprintProgressView);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '48');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });
});
