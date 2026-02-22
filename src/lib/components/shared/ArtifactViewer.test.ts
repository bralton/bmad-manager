import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import ArtifactViewer from './ArtifactViewer.svelte';
import {
  selectedArtifact,
  selectedArtifactContent,
  artifactContentLoading,
  artifactViewerOpen,
  artifactGroups,
} from '$lib/stores/artifacts';
import type { ArtifactInfo, ArtifactGroups } from '$lib/types/artifact';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

// Mock the artifacts service
vi.mock('$lib/services/artifacts', () => ({
  artifactBrowserApi: {
    listProjectArtifacts: vi.fn(),
    readArtifactFile: vi.fn(),
    openInIde: vi.fn(),
  },
}));

describe('ArtifactViewer', () => {
  const mockArtifact: ArtifactInfo = {
    path: '/test/1-1-story.md',
    title: 'Story 1.1: Test Story',
    category: 'story',
    storyId: '1-1',
    epicId: '1',
    modifiedAt: '2026-02-22T10:00:00Z',
    status: 'done',
  };

  const mockContent = `---
title: Story 1.1: Test Story
status: done
---
# Story 1.1: Test Story

This is the story content.

## Acceptance Criteria

- [ ] AC 1
- [x] AC 2
`;

  const mockGroups: ArtifactGroups = {
    epics: [],
    stories: [
      mockArtifact,
      {
        path: '/test/1-2-story.md',
        title: 'Story 1.2: Another Story',
        category: 'story',
        storyId: '1-2',
        epicId: '1',
        modifiedAt: '2026-02-22T11:00:00Z',
        status: 'in-progress',
      },
    ],
    retrospectives: [],
    design: [],
    planning: [],
    other: [],
  };

  beforeEach(() => {
    // Reset stores
    selectedArtifact.set(null);
    selectedArtifactContent.set(null);
    artifactContentLoading.set(false);
    artifactViewerOpen.set(false);
    artifactGroups.set(mockGroups);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('closed state', () => {
    it('does not render when viewer is closed', () => {
      artifactViewerOpen.set(false);
      selectedArtifact.set(mockArtifact);

      render(ArtifactViewer);

      // Should not find the dialog
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('open state', () => {
    beforeEach(() => {
      artifactViewerOpen.set(true);
      selectedArtifact.set(mockArtifact);
      selectedArtifactContent.set(mockContent);
    });

    it('renders when viewer is open', () => {
      render(ArtifactViewer);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows artifact title', () => {
      render(ArtifactViewer);

      // Title appears in the header (there may be multiple from markdown content)
      const titles = screen.getAllByText('Story 1.1: Test Story');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    it('shows category label', () => {
      render(ArtifactViewer);

      expect(screen.getByText('Stories')).toBeInTheDocument();
    });

    it('shows Open in Editor button', () => {
      render(ArtifactViewer);

      expect(screen.getByText('Open in Editor')).toBeInTheDocument();
    });

    it('shows keyboard hints in footer', () => {
      render(ArtifactViewer);

      expect(screen.getByText('Esc to close')).toBeInTheDocument();
      expect(screen.getByText('Cmd+E to edit')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when content is loading', () => {
      artifactViewerOpen.set(true);
      selectedArtifact.set(mockArtifact);
      artifactContentLoading.set(true);

      render(ArtifactViewer);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      artifactViewerOpen.set(true);
      selectedArtifact.set(mockArtifact);
      selectedArtifactContent.set(mockContent);
    });

    it('shows navigation when multiple artifacts in category', () => {
      render(ArtifactViewer);

      // Should show "1 / 2" (first of two stories)
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });

    it('shows previous/next buttons', () => {
      render(ArtifactViewer);

      const prevButton = screen.getByLabelText('Previous artifact');
      const nextButton = screen.getByLabelText('Next artifact');

      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });

    it('disables previous button on first artifact', () => {
      render(ArtifactViewer);

      const prevButton = screen.getByLabelText('Previous artifact');
      expect(prevButton).toBeDisabled();
    });

    it('enables next button when not on last artifact', () => {
      render(ArtifactViewer);

      const nextButton = screen.getByLabelText('Next artifact');
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('close functionality', () => {
    beforeEach(() => {
      artifactViewerOpen.set(true);
      selectedArtifact.set(mockArtifact);
      selectedArtifactContent.set(mockContent);
    });

    it('has close button', () => {
      render(ArtifactViewer);

      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeInTheDocument();
    });

    it('has backdrop for closing', () => {
      render(ArtifactViewer);

      const backdrop = screen.getByLabelText('Close viewer');
      expect(backdrop).toBeInTheDocument();
    });
  });

  describe('frontmatter', () => {
    beforeEach(() => {
      artifactViewerOpen.set(true);
      selectedArtifact.set(mockArtifact);
      selectedArtifactContent.set(mockContent);
    });

    it('shows collapsible frontmatter panel', () => {
      render(ArtifactViewer);

      expect(screen.getByText('Frontmatter')).toBeInTheDocument();
    });
  });
});
