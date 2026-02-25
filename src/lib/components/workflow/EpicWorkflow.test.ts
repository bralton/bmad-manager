/**
 * Unit tests for EpicWorkflow.svelte component.
 * Tests epic selector, stage rendering, and data flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { EpicProgress } from '$lib/types/workflow';

// Use vi.hoisted to create mocks that are accessible to vi.mock factories
const {
  mockEpicProgress,
  mockCurrentProject,
  mockRefreshSprintStatus,
  mockRefreshEpicTitles,
  mockGetEpicArtifacts,
  mockSetupEventListeners,
} = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockEpicProgress: writable([]),
    mockCurrentProject: writable(null),
    mockRefreshSprintStatus: vi.fn(),
    mockRefreshEpicTitles: vi.fn(),
    mockGetEpicArtifacts: vi.fn().mockResolvedValue({
      planning: [],
      storyDoneCount: 5,
      storyTotalCount: 10,
      retro: null,
    }),
    mockSetupEventListeners: vi.fn().mockResolvedValue([]),
  };
});

// Mock stores
vi.mock('$lib/stores/workflow', () => ({
  epicProgress: mockEpicProgress,
}));

vi.mock('$lib/stores/project', () => ({
  currentProject: mockCurrentProject,
}));

vi.mock('$lib/stores/stories', () => ({
  refreshSprintStatus: mockRefreshSprintStatus,
  refreshEpicTitles: mockRefreshEpicTitles,
}));

vi.mock('$lib/services/artifacts', () => ({
  artifactBrowserApi: {
    getEpicArtifacts: mockGetEpicArtifacts,
  },
}));

vi.mock('$lib/services/events', () => ({
  setupEventListeners: mockSetupEventListeners,
}));

// Import component after mocks are set up
import EpicWorkflow from './EpicWorkflow.svelte';

const mockEpics: EpicProgress[] = [
  {
    epicId: '5',
    title: 'UI/IA Redesign',
    status: 'in-progress',
    stats: { total: 10, done: 5, inProgress: 2, percentage: 50 },
  },
  {
    epicId: '4',
    title: 'Polish',
    status: 'done',
    stats: { total: 11, done: 11, inProgress: 0, percentage: 100 },
  },
  {
    epicId: '3',
    title: 'Stories & Worktrees',
    status: 'done',
    stats: { total: 6, done: 6, inProgress: 0, percentage: 100 },
  },
];

describe('EpicWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEpicProgress.set([]);
    mockCurrentProject.set(null);
  });

  describe('empty state', () => {
    it('shows empty state when no epics', () => {
      mockEpicProgress.set([]);
      render(EpicWorkflow);

      expect(screen.getByText('No epics found')).toBeInTheDocument();
    });
  });

  describe('epic selector', () => {
    it('renders epic selector dropdown', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicWorkflow);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('populates dropdown with epics sorted by ID descending', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicWorkflow);

      const options = screen.getAllByRole('option');
      // Epics sorted by ID descending: 5, 4, 3
      expect(options[0]).toHaveTextContent('Epic 5: UI/IA Redesign');
      expect(options[1]).toHaveTextContent('Epic 4: Polish');
      expect(options[2]).toHaveTextContent('Epic 3: Stories & Worktrees');
    });

    it('auto-selects first in-progress epic', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicWorkflow);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('5'); // Epic 5 is in-progress
    });

    it('auto-selects most recent epic when none in-progress', () => {
      const allDoneEpics: EpicProgress[] = [
        {
          epicId: '4',
          title: 'Polish',
          status: 'done',
          stats: { total: 11, done: 11, inProgress: 0, percentage: 100 },
        },
        {
          epicId: '3',
          title: 'Stories',
          status: 'done',
          stats: { total: 6, done: 6, inProgress: 0, percentage: 100 },
        },
      ];
      mockEpicProgress.set(allDoneEpics);
      render(EpicWorkflow);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('4'); // First in sorted list (highest ID)
    });

    it('updates selection when dropdown changes', async () => {
      mockEpicProgress.set(mockEpics);
      render(EpicWorkflow);

      const select = screen.getByRole('combobox');
      await fireEvent.change(select, { target: { value: '4' } });

      expect((select as HTMLSelectElement).value).toBe('4');
    });
  });

  describe('workflow stages', () => {
    it('renders three stages: Planning, Implementation, Retro', () => {
      mockEpicProgress.set(mockEpics);
      render(EpicWorkflow);

      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Implementation')).toBeInTheDocument();
      expect(screen.getByText('Retro')).toBeInTheDocument();
    });

    it('renders horizontal connectors between stages', () => {
      mockEpicProgress.set(mockEpics);
      const { container } = render(EpicWorkflow);

      // Look for connector divs (horizontal on desktop, vertical on mobile)
      const horizontalConnectors = container.querySelectorAll('.md\\:block.h-0\\.5');
      expect(horizontalConnectors.length).toBe(2); // Two connectors between three stages
    });
  });

  describe('stage status based on epic status', () => {
    it('shows correct status for in-progress epic', () => {
      mockEpicProgress.set([
        {
          epicId: '5',
          title: 'In Progress Epic',
          status: 'in-progress',
          stats: { total: 10, done: 5, inProgress: 2, percentage: 50 },
        },
      ]);
      render(EpicWorkflow);

      // Planning should be completed, Implementation active, Retro pending
      const statusTexts = screen.getAllByText(/Done|Active|Pending/);
      expect(statusTexts.some((el) => el.textContent === 'Done')).toBe(true);
      expect(statusTexts.some((el) => el.textContent === 'Active')).toBe(true);
      expect(statusTexts.some((el) => el.textContent === 'Pending')).toBe(true);
    });

    it('shows correct status for done epic', () => {
      mockEpicProgress.set([
        {
          epicId: '4',
          title: 'Done Epic',
          status: 'done',
          stats: { total: 11, done: 11, inProgress: 0, percentage: 100 },
        },
      ]);
      render(EpicWorkflow);

      // All stages should be completed
      const doneStatuses = screen.getAllByText('Done');
      expect(doneStatuses.length).toBe(3);
    });

    it('shows correct status for backlog epic', () => {
      mockEpicProgress.set([
        {
          epicId: '6',
          title: 'Backlog Epic',
          status: 'backlog',
          stats: { total: 0, done: 0, inProgress: 0, percentage: 0 },
        },
      ]);
      render(EpicWorkflow);

      // All stages should be pending
      const pendingStatuses = screen.getAllByText('Pending');
      expect(pendingStatuses.length).toBe(3);
    });
  });
});
