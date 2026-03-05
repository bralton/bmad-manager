/**
 * Unit tests for StoryWorkflow.svelte component.
 * Tests story selector, stage rendering, and data flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import type { SprintStatus, Story } from '$lib/types/stories';
import type { ArtifactInfo } from '$lib/types/artifact';
import type { StoryProgress } from '$lib/types/workflow';

// Use vi.hoisted to create mocks that are accessible to vi.mock factories
const {
  mockSprintStatus,
  mockEpicTitles,
  mockCurrentProject,
  mockRefreshSprintStatus,
  mockRefreshEpicTitles,
  mockGetStoryArtifact,
  mockGetStoryTasks,
  mockSetupEventListeners,
  mockShowToast,
} = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockSprintStatus: writable(null),
    mockEpicTitles: writable(new Map()),
    mockCurrentProject: writable(null),
    mockRefreshSprintStatus: vi.fn(),
    mockRefreshEpicTitles: vi.fn(),
    mockGetStoryArtifact: vi.fn().mockResolvedValue(null),
    mockGetStoryTasks: vi.fn().mockResolvedValue(null),
    mockSetupEventListeners: vi.fn().mockResolvedValue([]),
    mockShowToast: vi.fn(),
  };
});

// Mock stores
vi.mock('$lib/stores/stories', () => ({
  sprintStatus: mockSprintStatus,
  epicTitles: mockEpicTitles,
  refreshSprintStatus: mockRefreshSprintStatus,
  refreshEpicTitles: mockRefreshEpicTitles,
}));

vi.mock('$lib/stores/project', () => ({
  currentProject: mockCurrentProject,
}));

vi.mock('$lib/services/artifacts', () => ({
  artifactBrowserApi: {
    getStoryArtifact: mockGetStoryArtifact,
  },
}));

vi.mock('$lib/services/tauri', () => ({
  workflowApi: {
    getStoryTasks: mockGetStoryTasks,
  },
}));

vi.mock('$lib/services/events', () => ({
  setupEventListeners: mockSetupEventListeners,
}));

vi.mock('$lib/stores/ui', () => ({
  showToast: mockShowToast,
}));

// Import component after mocks are set up
import StoryWorkflow from './StoryWorkflow.svelte';

const mockStories: Story[] = [
  {
    id: '5-7-story-workflow-view',
    epicId: '5',
    storyNumber: 7,
    slug: 'story-workflow-view',
    status: 'in-progress',
  },
  {
    id: '5-6-epic-workflow-view',
    epicId: '5',
    storyNumber: 6,
    slug: 'epic-workflow-view',
    status: 'done',
  },
  {
    id: '5-5-session-drawer',
    epicId: '5',
    storyNumber: 5,
    slug: 'session-drawer',
    status: 'done',
  },
  {
    id: '4-11-party-mode',
    epicId: '4',
    storyNumber: 11,
    slug: 'party-mode',
    status: 'done',
  },
];

const mockSprintData: SprintStatus = {
  generated: '2026-03-05',
  project: 'bmad_manager',
  epics: [
    { id: '5', status: 'in-progress' },
    { id: '4', status: 'done' },
  ],
  stories: mockStories,
};

const mockArtifact: ArtifactInfo = {
  path: '/project/_bmad-output/implementation-artifacts/5-7-story-workflow.md',
  title: '5-7: Story Workflow View',
  category: 'story',
  modifiedAt: '2026-03-05T12:00:00Z',
};

describe('StoryWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSprintStatus.set(null);
    mockEpicTitles.set(new Map());
    mockCurrentProject.set(null);
  });

  describe('empty state', () => {
    it('shows empty state when no stories', () => {
      mockSprintStatus.set({ ...mockSprintData, stories: [] });
      render(StoryWorkflow);

      expect(screen.getByText('No stories found')).toBeInTheDocument();
    });
  });

  describe('story selector', () => {
    it('renders story selector dropdown', () => {
      mockSprintStatus.set(mockSprintData);
      render(StoryWorkflow);

      const select = screen.getByLabelText('Select Story');
      expect(select).toBeInTheDocument();
    });

    it('populates dropdown with stories sorted by epic and story number descending', () => {
      mockSprintStatus.set(mockSprintData);
      render(StoryWorkflow);

      const storySelect = screen.getByLabelText('Select Story') as HTMLSelectElement;
      const options = Array.from(storySelect.options);
      // Stories should be sorted: 5-7, 5-6, 5-5, 4-11
      expect(options[0]).toHaveTextContent('5-7');
      expect(options[1]).toHaveTextContent('5-6');
      expect(options[2]).toHaveTextContent('5-5');
      expect(options[3]).toHaveTextContent('4-11');
    });

    it('auto-selects first in-progress story', () => {
      mockSprintStatus.set(mockSprintData);
      render(StoryWorkflow);

      const select = screen.getByLabelText('Select Story') as HTMLSelectElement;
      expect(select.value).toBe('5-7-story-workflow-view'); // This story is in-progress
    });

    it('auto-selects review story when none in-progress', () => {
      const reviewData: SprintStatus = {
        ...mockSprintData,
        stories: [
          {
            id: '5-8-stories-enhancement',
            epicId: '5',
            storyNumber: 8,
            slug: 'stories-enhancement',
            status: 'review',
          },
          {
            id: '5-7-story-workflow',
            epicId: '5',
            storyNumber: 7,
            slug: 'story-workflow',
            status: 'done',
          },
        ],
      };
      mockSprintStatus.set(reviewData);
      render(StoryWorkflow);

      const select = screen.getByLabelText('Select Story') as HTMLSelectElement;
      expect(select.value).toBe('5-8-stories-enhancement');
    });

    it('auto-selects ready-for-dev story when none in-progress or review', () => {
      const readyData: SprintStatus = {
        ...mockSprintData,
        stories: [
          {
            id: '5-8-stories-enhancement',
            epicId: '5',
            storyNumber: 8,
            slug: 'stories-enhancement',
            status: 'ready-for-dev',
          },
          {
            id: '5-7-story-workflow',
            epicId: '5',
            storyNumber: 7,
            slug: 'story-workflow',
            status: 'done',
          },
        ],
      };
      mockSprintStatus.set(readyData);
      render(StoryWorkflow);

      const select = screen.getByLabelText('Select Story') as HTMLSelectElement;
      expect(select.value).toBe('5-8-stories-enhancement');
    });

    it('auto-selects lowest backlog story (next in queue) when none in-progress, review, or ready', () => {
      const backlogData: SprintStatus = {
        ...mockSprintData,
        epics: [
          { id: '5', status: 'in-progress' },
          { id: '99', status: 'backlog' },
        ],
        stories: [
          {
            id: '99-5-future-feature',
            epicId: '99',
            storyNumber: 5,
            slug: 'future-feature',
            status: 'backlog',
          },
          {
            id: '5-8-next-feature',
            epicId: '5',
            storyNumber: 8,
            slug: 'next-feature',
            status: 'backlog',
          },
          {
            id: '5-6-epic-workflow',
            epicId: '5',
            storyNumber: 6,
            slug: 'epic-workflow',
            status: 'done',
          },
        ],
      };
      mockSprintStatus.set(backlogData);
      render(StoryWorkflow);

      const select = screen.getByLabelText('Select Story') as HTMLSelectElement;
      // Should select 5-8 (Epic 5) not 99-5 (Epic 99) because lower epic number is "next"
      expect(select.value).toBe('5-8-next-feature');
    });

    it('auto-selects most recent done story as final fallback', () => {
      const allDoneData: SprintStatus = {
        ...mockSprintData,
        stories: [
          {
            id: '5-6-epic-workflow',
            epicId: '5',
            storyNumber: 6,
            slug: 'epic-workflow',
            status: 'done',
          },
          {
            id: '5-5-session-drawer',
            epicId: '5',
            storyNumber: 5,
            slug: 'session-drawer',
            status: 'done',
          },
        ],
      };
      mockSprintStatus.set(allDoneData);
      render(StoryWorkflow);

      const select = screen.getByLabelText('Select Story') as HTMLSelectElement;
      expect(select.value).toBe('5-6-epic-workflow'); // First in sorted list (most recent)
    });

    it('updates selection when dropdown changes', async () => {
      mockSprintStatus.set(mockSprintData);
      render(StoryWorkflow);

      const select = screen.getByLabelText('Select Story');
      await fireEvent.change(select, { target: { value: '5-6-epic-workflow-view' } });

      expect((select as HTMLSelectElement).value).toBe('5-6-epic-workflow-view');
    });
  });

  describe('epic filter', () => {
    it('shows epic filter when multiple epics exist', () => {
      mockSprintStatus.set(mockSprintData);
      render(StoryWorkflow);

      const epicFilter = screen.getByLabelText('Filter by Epic');
      expect(epicFilter).toBeInTheDocument();
    });

    it('does not show epic filter when only one epic exists', () => {
      const singleEpicData: SprintStatus = {
        ...mockSprintData,
        epics: [{ id: '5', status: 'in-progress' }],
        stories: mockStories.filter((s) => s.epicId === '5'),
      };
      mockSprintStatus.set(singleEpicData);
      render(StoryWorkflow);

      expect(screen.queryByLabelText('Filter by Epic')).not.toBeInTheDocument();
    });

    it('filters stories when epic is selected', async () => {
      mockSprintStatus.set(mockSprintData);
      render(StoryWorkflow);

      const epicFilter = screen.getByLabelText('Filter by Epic');
      await fireEvent.change(epicFilter, { target: { value: '4' } });

      // Only Epic 4 story should be in the story dropdown now
      const storySelect = screen.getByLabelText('Select Story') as HTMLSelectElement;
      const storyOptions = Array.from(storySelect.options);
      expect(storyOptions.length).toBe(1);
      expect(storyOptions[0]).toHaveTextContent('4-11');
    });
  });

  describe('workflow stages', () => {
    it('renders five stages: Backlog, Ready, Dev, Review, Done', () => {
      mockSprintStatus.set(mockSprintData);
      render(StoryWorkflow);

      // Check stage labels exist (use getAllByText since "Done" appears multiple times)
      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Dev')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      // "Done" appears as both stage label and status indicator, just check it exists
      const doneElements = screen.getAllByText('Done');
      expect(doneElements.length).toBeGreaterThan(0);
    });

    it('renders horizontal connectors between stages', () => {
      mockSprintStatus.set(mockSprintData);
      const { container } = render(StoryWorkflow);

      // Look for connector divs (horizontal on desktop, vertical on mobile)
      const horizontalConnectors = container.querySelectorAll('.md\\:block.h-0\\.5');
      expect(horizontalConnectors.length).toBe(4); // Four connectors between five stages
    });
  });

  describe('loading and error states', () => {
    it('shows loading indicator while fetching story data', async () => {
      // Set up project first
      mockCurrentProject.set({
        path: '/test/project',
        name: 'test',
        state: 'fully-initialized',
      });

      // Make getStoryArtifact slow
      mockGetStoryArtifact.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockArtifact), 100))
      );

      mockSprintStatus.set(mockSprintData);
      const { container } = render(StoryWorkflow);

      // Loading indicator should appear
      await waitFor(() => {
        const loadingText = container.querySelector('.animate-spin');
        expect(loadingText).toBeInTheDocument();
      });
    });

    it('shows toast notification on fetch error', async () => {
      mockShowToast.mockClear();

      mockCurrentProject.set({
        path: '/test/project',
        name: 'test',
        state: 'fully-initialized',
      });

      // Make getStoryArtifact fail
      mockGetStoryArtifact.mockRejectedValue(new Error('Network error'));

      mockSprintStatus.set(mockSprintData);
      render(StoryWorkflow);

      // Wait for error handling
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Failed to load story data', '⚠️', 3000);
      });
    });
  });

  describe('stage status based on story status', () => {
    it('shows correct status for backlog story', () => {
      const backlogData: SprintStatus = {
        ...mockSprintData,
        stories: [
          {
            id: '5-8-enhancement',
            epicId: '5',
            storyNumber: 8,
            slug: 'enhancement',
            status: 'backlog',
          },
        ],
      };
      mockSprintStatus.set(backlogData);
      const { container } = render(StoryWorkflow);

      // Backlog should be active (has pulsing indicator), rest pending
      const pulsingIndicators = container.querySelectorAll('.animate-pulse');
      expect(pulsingIndicators.length).toBe(1); // Only backlog stage is active
    });

    it('shows correct status for in-progress story', () => {
      mockSprintStatus.set(mockSprintData);
      const { container } = render(StoryWorkflow);

      // Backlog & Ready completed, Dev active, Review & Done pending
      // Look for checkmark icons (completed) and pulsing (active)
      const checkmarks = container.querySelectorAll('svg path[d*="M5 13l4 4L19 7"]');
      const pulsingIndicators = container.querySelectorAll('.animate-pulse');
      expect(checkmarks.length).toBe(2); // Backlog and Ready are completed
      expect(pulsingIndicators.length).toBe(1); // Dev is active
    });

    it('shows correct status for done story', async () => {
      const doneData: SprintStatus = {
        generated: '2026-03-05',
        project: 'bmad_manager',
        epics: [{ id: '5', status: 'done' }],
        stories: [
          {
            id: '5-6-epic-workflow',
            epicId: '5',
            storyNumber: 6,
            slug: 'epic-workflow',
            status: 'done',
          },
        ],
      };
      mockSprintStatus.set(doneData);
      const { container } = render(StoryWorkflow);

      // Wait for the story to be auto-selected and stages to render with correct status
      await waitFor(() => {
        // The Done stage shows a large circled checkmark when completed
        const doneCheckmark = container.querySelector('svg path[d*="M9 12l2 2 4-4"]');
        expect(doneCheckmark).toBeInTheDocument();
      });

      // All stages should be completed - no pulsing indicators
      const pulsingIndicators = container.querySelectorAll('.animate-pulse');
      expect(pulsingIndicators.length).toBe(0); // No active stages
    });
  });
});
