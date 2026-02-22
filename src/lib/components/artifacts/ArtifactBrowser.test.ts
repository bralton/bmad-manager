import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/svelte';
import ArtifactBrowser from './ArtifactBrowser.svelte';
import {
  artifactGroups,
  artifactsLoading,
  artifactsError,
  collapsedCategories,
} from '$lib/stores/artifacts';
import { currentProject } from '$lib/stores/project';
import type { ArtifactGroups } from '$lib/types/artifact';
import type { Project } from '$lib/types/project';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

// Mock the artifacts service to return empty groups by default
const mockListProjectArtifacts = vi.fn();
vi.mock('$lib/services/artifacts', () => ({
  artifactBrowserApi: {
    listProjectArtifacts: (...args: unknown[]) => mockListProjectArtifacts(...args),
    readArtifactFile: vi.fn(),
    openInIde: vi.fn(),
  },
}));

describe('ArtifactBrowser', () => {
  const mockProject: Project = {
    path: '/test/project',
    name: 'test-project',
    state: 'fully-initialized',
    config: null,
    agents: [],
  };

  const emptyGroups: ArtifactGroups = {
    epics: [],
    stories: [],
    retrospectives: [],
    design: [],
    planning: [],
    other: [],
  };

  const mockGroups: ArtifactGroups = {
    epics: [
      {
        path: '/test/epic-1.md',
        title: 'Epic 1: Foundation',
        category: 'epic',
        epicId: '1',
        modifiedAt: '2026-02-22T10:00:00Z',
        status: 'done',
      },
    ],
    stories: [
      {
        path: '/test/1-1-story.md',
        title: 'Story 1.1: Setup',
        category: 'story',
        storyId: '1-1',
        epicId: '1',
        modifiedAt: '2026-02-22T11:00:00Z',
        status: 'done',
      },
      {
        path: '/test/1-2-story.md',
        title: 'Story 1.2: Feature',
        category: 'story',
        storyId: '1-2',
        epicId: '1',
        modifiedAt: '2026-02-22T12:00:00Z',
        status: 'in-progress',
      },
    ],
    retrospectives: [],
    design: [
      {
        path: '/test/design.md',
        title: 'UX Design',
        category: 'design',
        modifiedAt: '2026-02-22T09:00:00Z',
      },
    ],
    planning: [],
    other: [],
  };

  beforeEach(() => {
    // Reset stores
    currentProject.set(mockProject);
    artifactGroups.set(null);
    artifactsLoading.set(false);
    artifactsError.set(null);
    collapsedCategories.set(new Set());
    // Default mock returns empty
    mockListProjectArtifacts.mockResolvedValue(emptyGroups);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading indicator when loading', async () => {
      // Make the API call hang to show loading state
      mockListProjectArtifacts.mockImplementation(() => new Promise(() => {}));

      render(ArtifactBrowser);

      // Should show loading spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error occurs', async () => {
      mockListProjectArtifacts.mockRejectedValue(new Error('Failed to load artifacts'));

      render(ArtifactBrowser);

      await waitFor(() => {
        expect(screen.getByText('Failed to load artifacts')).toBeInTheDocument();
      });
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no artifacts exist', async () => {
      mockListProjectArtifacts.mockResolvedValue(emptyGroups);

      render(ArtifactBrowser);

      await waitFor(() => {
        expect(screen.getByText('No artifacts found')).toBeInTheDocument();
      });
      expect(
        screen.getByText(/BMAD artifacts will appear here/)
      ).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    it('renders category lists when artifacts exist', async () => {
      mockListProjectArtifacts.mockResolvedValue(mockGroups);

      render(ArtifactBrowser);

      // Should show category headers after loading completes
      await waitFor(() => {
        expect(screen.getByText('Epics')).toBeInTheDocument();
      });
      expect(screen.getByText('Stories')).toBeInTheDocument();
      expect(screen.getByText('Design Docs')).toBeInTheDocument();
    });

    it('shows total item count in header', async () => {
      mockListProjectArtifacts.mockResolvedValue(mockGroups);

      render(ArtifactBrowser);

      // Total: 1 epic + 2 stories + 1 design = 4
      await waitFor(() => {
        expect(screen.getByText('4 items')).toBeInTheDocument();
      });
    });
  });

  describe('header', () => {
    it('shows Artifacts title', async () => {
      render(ArtifactBrowser);

      expect(screen.getByText('Artifacts')).toBeInTheDocument();
    });
  });
});
