import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import ArtifactCard from './ArtifactCard.svelte';
import type { ArtifactInfo } from '$lib/types/artifact';

describe('ArtifactCard', () => {
  afterEach(() => {
    cleanup();
  });

  const mockStoryArtifact: ArtifactInfo = {
    path: '/test/1-1-story.md',
    title: 'Story 1.1: Test Story',
    category: 'story',
    storyId: '1-1',
    epicId: '1',
    modifiedAt: '2026-02-22T10:00:00Z',
    status: 'done',
  };

  const mockEpicArtifact: ArtifactInfo = {
    path: '/test/epic-1.md',
    title: 'Epic 1: Foundation',
    category: 'epic',
    epicId: '1',
    modifiedAt: '2026-02-22T09:00:00Z',
  };

  describe('rendering', () => {
    it('renders artifact title', () => {
      render(ArtifactCard, { props: { artifact: mockStoryArtifact, onClick: vi.fn() } });
      expect(screen.getByText('Story 1.1: Test Story')).toBeInTheDocument();
    });

    it('renders story ID for stories', () => {
      render(ArtifactCard, { props: { artifact: mockStoryArtifact, onClick: vi.fn() } });
      expect(screen.getByText('1-1')).toBeInTheDocument();
    });

    it('renders epic ID for epics', () => {
      render(ArtifactCard, { props: { artifact: mockEpicArtifact, onClick: vi.fn() } });
      expect(screen.getByText('Epic 1')).toBeInTheDocument();
    });

    it('renders formatted modified date', () => {
      render(ArtifactCard, { props: { artifact: mockStoryArtifact, onClick: vi.fn() } });
      // Feb 22, 2026
      expect(screen.getByText('Feb 22, 2026')).toBeInTheDocument();
    });

    it('renders status badge when status is present', () => {
      render(ArtifactCard, { props: { artifact: mockStoryArtifact, onClick: vi.fn() } });
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('does not render status badge when status is absent', () => {
      render(ArtifactCard, { props: { artifact: mockEpicArtifact, onClick: vi.fn() } });
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', async () => {
      const onClick = vi.fn();
      render(ArtifactCard, { props: { artifact: mockStoryArtifact, onClick } });

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('status formatting', () => {
    it('formats in-progress status correctly', () => {
      const artifact: ArtifactInfo = {
        ...mockStoryArtifact,
        status: 'in-progress',
      };
      render(ArtifactCard, { props: { artifact, onClick: vi.fn() } });
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('formats ready-for-dev status correctly', () => {
      const artifact: ArtifactInfo = {
        ...mockStoryArtifact,
        status: 'ready-for-dev',
      };
      render(ArtifactCard, { props: { artifact, onClick: vi.fn() } });
      expect(screen.getByText('Ready For Dev')).toBeInTheDocument();
    });
  });
});
