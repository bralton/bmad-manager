/**
 * Unit tests for DashboardVisualizerContainer.svelte component.
 * Tests conditional rendering based on dashboardViewMode.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';

// Use vi.hoisted to create mocks
const { mockDashboardViewMode, mockCurrentProject } = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    mockDashboardViewMode: writable('epic'),
    mockCurrentProject: writable({
      path: '/test/project',
      name: 'test-project',
      state: 'fully-initialized',
    }),
  };
});

// Mock the stores
vi.mock('$lib/stores/workflow', () => ({
  dashboardViewMode: mockDashboardViewMode,
  setDashboardViewMode: vi.fn((mode: string) => mockDashboardViewMode.set(mode)),
  epicProgress: writable([]),
  sprintProgress: writable(null),
}));

vi.mock('$lib/stores/project', () => ({
  currentProject: mockCurrentProject,
}));

vi.mock('$lib/stores/stories', () => ({
  refreshSprintStatus: vi.fn(),
  refreshEpicTitles: vi.fn(),
}));

vi.mock('$lib/stores/artifacts', () => ({
  selectedArtifact: writable(null),
  artifactViewerOpen: writable(false),
  selectArtifact: vi.fn(),
}));

vi.mock('$lib/services/artifacts', () => ({
  artifactBrowserApi: {
    getEpicArtifact: vi.fn(),
  },
}));

// Import after mocks
import DashboardVisualizerContainer from './DashboardVisualizerContainer.svelte';

describe('DashboardVisualizerContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboardViewMode.set('epic');
    mockCurrentProject.set({
      path: '/test/project',
      name: 'test-project',
      state: 'fully-initialized',
    });
  });

  describe('rendering', () => {
    it('renders the container when project is fully initialized', () => {
      const { container } = render(DashboardVisualizerContainer);
      expect(container.querySelector('.border-b')).toBeInTheDocument();
    });

    it('renders DashboardViewTabs', () => {
      render(DashboardVisualizerContainer);
      // Check for the tablist
      expect(screen.getByRole('tablist', { name: 'Dashboard views' })).toBeInTheDocument();
    });

    it('renders Epic Progress tab as active by default', () => {
      render(DashboardVisualizerContainer);
      const epicTab = screen.getByRole('tab', { name: 'Epic Progress' });
      expect(epicTab).toHaveAttribute('aria-selected', 'true');
    });

    it('renders Sprint Overview tab when mode is sprint', () => {
      mockDashboardViewMode.set('sprint');
      render(DashboardVisualizerContainer);
      const sprintTab = screen.getByRole('tab', { name: 'Sprint Overview' });
      expect(sprintTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('project state', () => {
    it('does not render when project is not fully initialized', () => {
      mockCurrentProject.set({
        path: '/test/project',
        name: 'test-project',
        state: 'not-initialized',
      });
      const { container } = render(DashboardVisualizerContainer);
      expect(container.querySelector('.border-b')).not.toBeInTheDocument();
    });

    it('does not render when project is null', () => {
      mockCurrentProject.set(null);
      const { container } = render(DashboardVisualizerContainer);
      expect(container.querySelector('.border-b')).not.toBeInTheDocument();
    });
  });
});
