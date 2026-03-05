/**
 * Unit tests for StoryWorkflowStage.svelte component.
 * Tests stage rendering, status indicators, and artifact click handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { ArtifactInfo } from '$lib/types/artifact';

// Use vi.hoisted to create mocks that are accessible to vi.mock factories
const { mockSelectArtifact } = vi.hoisted(() => ({
  mockSelectArtifact: vi.fn(),
}));

// Mock selectArtifact
vi.mock('$lib/stores/artifacts', () => ({
  selectArtifact: mockSelectArtifact,
}));

import StoryWorkflowStage from './StoryWorkflowStage.svelte';

const mockArtifact: ArtifactInfo = {
  path: '/project/_bmad-output/implementation-artifacts/5-7-story-workflow.md',
  title: '5-7: Story Workflow View',
  category: 'story',
  modifiedAt: '2026-03-05T12:00:00Z',
};

describe('StoryWorkflowStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('stage labels', () => {
    it('renders correct label for backlog stage', () => {
      render(StoryWorkflowStage, { props: { stage: 'backlog', status: 'pending' } });
      expect(screen.getByText('Backlog')).toBeInTheDocument();
    });

    it('renders correct label for ready stage', () => {
      render(StoryWorkflowStage, { props: { stage: 'ready', status: 'pending' } });
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('renders correct label for dev stage', () => {
      render(StoryWorkflowStage, { props: { stage: 'dev', status: 'pending' } });
      expect(screen.getByText('Dev')).toBeInTheDocument();
    });

    it('renders correct label for review stage', () => {
      render(StoryWorkflowStage, { props: { stage: 'review', status: 'pending' } });
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('renders correct label for done stage', () => {
      render(StoryWorkflowStage, { props: { stage: 'done', status: 'pending' } });
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  describe('status indicators', () => {
    it('shows checkmark icon for completed status', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'backlog', status: 'completed' },
      });

      // Look for SVG checkmark path
      const checkPath = container.querySelector('svg path[d*="M5 13l4 4L19 7"]');
      expect(checkPath).toBeInTheDocument();
    });

    it('shows pulsing circle for active status', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'active' },
      });

      const pulse = container.querySelector('.animate-pulse');
      expect(pulse).toBeInTheDocument();
    });

    it('shows empty circle for pending status', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'done', status: 'pending' },
      });

      const emptyCircle = container.querySelector('.border.border-gray-500');
      expect(emptyCircle).toBeInTheDocument();
    });

    it('displays "Done" text for completed status', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'backlog', status: 'completed' },
      });

      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('displays "Active" text for active status', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'active' },
      });

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('displays "Pending" text for pending status', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'done', status: 'pending' },
      });

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('backlog stage content', () => {
    it('shows "Story in backlog" when active', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'backlog', status: 'active' },
      });

      expect(screen.getByText('Story in backlog')).toBeInTheDocument();
    });

    it('shows "Completed" when completed', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'backlog', status: 'completed' },
      });

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('shows dash when pending', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'backlog', status: 'pending' },
      });

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('ready stage content', () => {
    it('shows story artifact link when artifact provided', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'ready', status: 'active', storyArtifact: mockArtifact },
      });

      const button = screen.getByRole('button', { name: /Story\.md/i });
      expect(button).toBeInTheDocument();
    });

    it('calls selectArtifact when artifact is clicked', async () => {
      render(StoryWorkflowStage, {
        props: { stage: 'ready', status: 'active', storyArtifact: mockArtifact },
      });

      const button = screen.getByRole('button', { name: /Story\.md/i });
      await fireEvent.click(button);

      expect(mockSelectArtifact).toHaveBeenCalledWith(mockArtifact);
    });

    it('shows "Story ready" when active but no artifact', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'ready', status: 'active' },
      });

      expect(screen.getByText('Story ready')).toBeInTheDocument();
    });

    it('shows dash when pending', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'ready', status: 'pending' },
      });

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('dev stage content', () => {
    it('shows task count when taskStats provided', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'active', taskStats: { done: 25, total: 35 } },
      });

      expect(screen.getByText('25/35')).toBeInTheDocument();
      expect(screen.getByText('tasks done')).toBeInTheDocument();
    });

    it('shows progress bar when taskStats provided', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'active', taskStats: { done: 25, total: 50 } },
      });

      // Progress bar should be at 50%
      const progressBar = container.querySelector('[style*="width: 50%"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('shows green progress bar when 100% complete', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'completed', taskStats: { done: 35, total: 35 } },
      });

      const greenBar = container.querySelector('.bg-green-500');
      expect(greenBar).toBeInTheDocument();
    });

    it('shows blue progress bar when not 100% complete', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'active', taskStats: { done: 20, total: 35 } },
      });

      const blueBar = container.querySelector('.bg-blue-500');
      expect(blueBar).toBeInTheDocument();
    });

    it('shows "In development" when active but no taskStats', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'active' },
      });

      expect(screen.getByText('In development')).toBeInTheDocument();
    });

    it('shows dash when pending', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'pending' },
      });

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('review stage content', () => {
    it('shows "In Review" when active', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'review', status: 'active' },
      });

      expect(screen.getByText('In Review')).toBeInTheDocument();
    });

    it('shows "Review Passed" when completed', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'review', status: 'completed' },
      });

      expect(screen.getByText('Review Passed')).toBeInTheDocument();
    });

    it('shows dash when pending', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'review', status: 'pending' },
      });

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('done stage content', () => {
    it('shows completion checkmark when completed', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'done', status: 'completed' },
      });

      // Look for the large completion checkmark SVG
      const checkCircle = container.querySelector('svg path[d*="M9 12l2 2 4-4m6 2a9 9"]');
      expect(checkCircle).toBeInTheDocument();
    });

    it('shows dash when pending', () => {
      render(StoryWorkflowStage, {
        props: { stage: 'done', status: 'pending' },
      });

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('container styling', () => {
    it('has green styling for completed status', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'backlog', status: 'completed' },
      });

      const stageContainer = container.firstChild as HTMLElement;
      expect(stageContainer.className).toContain('bg-green-900/20');
      expect(stageContainer.className).toContain('border-green-700/50');
    });

    it('has blue styling for active status', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'dev', status: 'active' },
      });

      const stageContainer = container.firstChild as HTMLElement;
      expect(stageContainer.className).toContain('bg-blue-900/30');
      expect(stageContainer.className).toContain('border-blue-600');
    });

    it('has gray styling for pending status', () => {
      const { container } = render(StoryWorkflowStage, {
        props: { stage: 'done', status: 'pending' },
      });

      const stageContainer = container.firstChild as HTMLElement;
      expect(stageContainer.className).toContain('bg-gray-800/50');
      expect(stageContainer.className).toContain('border-gray-700');
    });
  });
});
