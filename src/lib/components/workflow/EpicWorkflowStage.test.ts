/**
 * Unit tests for EpicWorkflowStage.svelte component.
 * Tests stage rendering, status indicators, artifact links, and empty states.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EpicWorkflowStage from './EpicWorkflowStage.svelte';
import type { ArtifactInfo } from '$lib/types/artifact';

// Mock the stores
vi.mock('$lib/stores/artifacts', () => ({
  selectArtifact: vi.fn(),
}));

import { selectArtifact } from '$lib/stores/artifacts';

const mockArtifact: ArtifactInfo = {
  path: '/test/path/epic-5-ux-design.md',
  title: 'Epic 5 UX Design',
  category: 'design',
  epicId: '5',
  modifiedAt: '2026-02-24T10:00:00Z',
  status: 'approved',
};

const mockRetroArtifact: ArtifactInfo = {
  path: '/test/path/epic-5-retrospective.md',
  title: 'Epic 5 Retrospective',
  category: 'retrospective',
  epicId: '5',
  modifiedAt: '2026-02-24T12:00:00Z',
  status: 'done',
};

describe('EpicWorkflowStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('planning stage', () => {
    it('renders planning stage with label', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'planning', status: 'completed' },
      });

      expect(screen.getByText('Planning')).toBeInTheDocument();
    });

    it('shows artifacts when provided', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'planning', status: 'completed', artifacts: [mockArtifact] },
      });

      expect(screen.getByText('Epic 5 UX Design')).toBeInTheDocument();
    });

    it('shows empty state when no artifacts', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'planning', status: 'completed', artifacts: [] },
      });

      expect(screen.getByText('No documents')).toBeInTheDocument();
    });

    it('calls selectArtifact when artifact is clicked', async () => {
      render(EpicWorkflowStage, {
        props: { stage: 'planning', status: 'completed', artifacts: [mockArtifact] },
      });

      const artifactButton = screen.getByText('Epic 5 UX Design');
      await fireEvent.click(artifactButton);

      expect(selectArtifact).toHaveBeenCalledWith(mockArtifact);
    });
  });

  describe('implementation stage', () => {
    it('renders implementation stage with label', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'implementation', status: 'active' },
      });

      expect(screen.getByText('Implementation')).toBeInTheDocument();
    });

    it('shows story stats when provided', () => {
      render(EpicWorkflowStage, {
        props: {
          stage: 'implementation',
          status: 'active',
          storyStats: { done: 5, total: 10 },
        },
      });

      expect(screen.getByText('5/10')).toBeInTheDocument();
      expect(screen.getByText('stories done')).toBeInTheDocument();
    });

    it('shows empty state when no story stats', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'implementation', status: 'pending' },
      });

      expect(screen.getByText('No stories')).toBeInTheDocument();
    });

    it('shows progress bar for story stats', () => {
      render(EpicWorkflowStage, {
        props: {
          stage: 'implementation',
          status: 'active',
          storyStats: { done: 5, total: 10 },
        },
      });

      // Progress bar should be rendered with 50% width
      const progressBar = document.querySelector('[style*="width: 50%"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('retro stage', () => {
    it('renders retro stage with label', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'retro', status: 'pending' },
      });

      expect(screen.getByText('Retro')).toBeInTheDocument();
    });

    it('shows retro artifact when provided', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'retro', status: 'completed', retroArtifact: mockRetroArtifact },
      });

      expect(screen.getByText('Epic 5 Retrospective')).toBeInTheDocument();
    });

    it('shows empty state when no retro artifact', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'retro', status: 'pending' },
      });

      expect(screen.getByText('No retrospective')).toBeInTheDocument();
    });

    it('calls selectArtifact when retro artifact is clicked', async () => {
      render(EpicWorkflowStage, {
        props: { stage: 'retro', status: 'completed', retroArtifact: mockRetroArtifact },
      });

      const retroButton = screen.getByText('Epic 5 Retrospective');
      await fireEvent.click(retroButton);

      expect(selectArtifact).toHaveBeenCalledWith(mockRetroArtifact);
    });
  });

  describe('status indicators', () => {
    it('shows checkmark for completed status', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'planning', status: 'completed' },
      });

      expect(screen.getByText('Done')).toBeInTheDocument();
      // Check for SVG with checkmark (path d="M5 13l4 4L19 7")
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('shows active indicator for active status', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'implementation', status: 'active' },
      });

      expect(screen.getByText('Active')).toBeInTheDocument();
      // Check for pulsing indicator
      const pulsingDiv = document.querySelector('.animate-pulse');
      expect(pulsingDiv).toBeInTheDocument();
    });

    it('shows pending indicator for pending status', () => {
      render(EpicWorkflowStage, {
        props: { stage: 'retro', status: 'pending' },
      });

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies completed styling', () => {
      const { container } = render(EpicWorkflowStage, {
        props: { stage: 'planning', status: 'completed' },
      });

      const stageDiv = container.firstChild as HTMLElement;
      expect(stageDiv.className).toContain('bg-green-900/20');
      expect(stageDiv.className).toContain('border-green-700/50');
    });

    it('applies active styling', () => {
      const { container } = render(EpicWorkflowStage, {
        props: { stage: 'implementation', status: 'active' },
      });

      const stageDiv = container.firstChild as HTMLElement;
      expect(stageDiv.className).toContain('bg-blue-900/30');
      expect(stageDiv.className).toContain('border-blue-600');
    });

    it('applies pending styling', () => {
      const { container } = render(EpicWorkflowStage, {
        props: { stage: 'retro', status: 'pending' },
      });

      const stageDiv = container.firstChild as HTMLElement;
      expect(stageDiv.className).toContain('bg-gray-800/50');
      expect(stageDiv.className).toContain('border-gray-700');
    });
  });
});
