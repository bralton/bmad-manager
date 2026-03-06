/**
 * Unit tests for ProjectInfoBar component.
 * Tests ACs #1-#8 from Story 5-9: component rendering, name display, status badge,
 * path display, positioning, hidden state, visual consistency, and clipboard.
 * Note: ACs #9-#11 (welcome card behavior, tab disabling) are tested in +page.svelte and Sidebar tests.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Project, ProjectState } from '$lib/types/project';
import ProjectInfoBar from './ProjectInfoBar.svelte';

// Mock the project store
vi.mock('$lib/stores/project', async () => {
  const { writable } = await import('svelte/store');
  return {
    currentProject: writable<Project | null>(null),
  };
});

// Mock UI store
vi.mock('$lib/stores/ui', async () => {
  return {
    showToast: vi.fn(),
  };
});

// Import mocked stores for manipulation
import * as projectStore from '$lib/stores/project';
import * as uiStore from '$lib/stores/ui';

describe('ProjectInfoBar', () => {
  // Helper to create mock project
  function createMockProject(
    name: string = 'test-project',
    state: ProjectState = 'fully-initialized',
    path: string = '/Users/test/projects/test-project'
  ): Project {
    return {
      path,
      name,
      state,
      config: null,
      agents: [],
    };
  }

  // Helper to set project store
  function setProject(project: Project | null) {
    (projectStore.currentProject as { set: (v: Project | null) => void }).set(project);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setProject(null);
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('AC#1: Minimal Project Info Bar Component', () => {
    it('renders the bar when project is loaded', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      // Bar should be rendered
      const bar = document.querySelector('[data-testid="project-info-bar"]');
      expect(bar).toBeInTheDocument();
    });

    it('displays folder icon', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      expect(screen.getByText('📁')).toBeInTheDocument();
    });

    it('has compact height styling', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const bar = document.querySelector('[data-testid="project-info-bar"]');
      expect(bar).toHaveClass('py-2');
    });
  });

  describe('AC#2: Project Name Display', () => {
    it('displays the project name', () => {
      setProject(createMockProject('my-awesome-project'));
      render(ProjectInfoBar);

      expect(screen.getByText('my-awesome-project')).toBeInTheDocument();
    });

    it('applies font-medium styling to name', () => {
      setProject(createMockProject('test-project'));
      render(ProjectInfoBar);

      const name = screen.getByText('test-project');
      expect(name).toHaveClass('font-medium');
    });
  });

  describe('AC#3: Initialization Status Badge', () => {
    it('shows green badge for fully-initialized state', () => {
      setProject(createMockProject('test', 'fully-initialized'));
      render(ProjectInfoBar);

      const badge = screen.getByText('Fully Initialized');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-green-400');
    });

    it('shows yellow badge for git-only state', () => {
      setProject(createMockProject('test', 'git-only'));
      render(ProjectInfoBar);

      const badge = screen.getByText('Git Only');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-yellow-400');
    });

    it('shows orange badge for bmad-only state', () => {
      setProject(createMockProject('test', 'bmad-only'));
      render(ProjectInfoBar);

      const badge = screen.getByText('BMAD Only');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-orange-400');
    });

    it('shows gray badge for empty state', () => {
      setProject(createMockProject('test', 'empty'));
      render(ProjectInfoBar);

      const badge = screen.getByText('Empty');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-gray-400');
    });

    it('badge has small pill styling', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const badge = screen.getByText('Fully Initialized');
      expect(badge).toHaveClass('text-xs');
      expect(badge).toHaveClass('rounded-full');
    });
  });

  describe('AC#4: Project Path Display', () => {
    it('displays the project path', () => {
      setProject(createMockProject('test', 'fully-initialized', '/Users/dev/projects/myapp'));
      render(ProjectInfoBar);

      expect(screen.getByText('/Users/dev/projects/myapp')).toBeInTheDocument();
    });

    it('path has muted gray color', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      expect(pathElement).toHaveClass('text-gray-400');
    });

    it('path has monospace font', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      expect(pathElement).toHaveClass('font-mono');
    });

    it('path has cursor-pointer for click-to-copy', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      expect(pathElement).toHaveClass('cursor-pointer');
    });

    it('path uses RTL direction for left-truncation', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      // Tailwind arbitrary value class for direction: rtl
      expect(pathElement.className).toContain('[direction:rtl]');
    });

    it('path content is wrapped in bdi for visual order preservation', () => {
      setProject(createMockProject('test', 'fully-initialized', '/test/path'));
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      const bdiElement = pathElement.querySelector('bdi');
      expect(bdiElement).toBeInTheDocument();
      expect(bdiElement?.textContent).toBe('/test/path');
    });
  });

  describe('AC#6: Hidden When No Project', () => {
    it('does not render when no project is loaded', () => {
      setProject(null);
      render(ProjectInfoBar);

      const bar = document.querySelector('[data-testid="project-info-bar"]');
      expect(bar).not.toBeInTheDocument();
    });
  });

  describe('AC#7: Visual Consistency', () => {
    it('has dark theme background', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const bar = document.querySelector('[data-testid="project-info-bar"]');
      expect(bar).toHaveClass('bg-gray-800');
    });

    it('has border styling', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const bar = document.querySelector('[data-testid="project-info-bar"]');
      expect(bar).toHaveClass('border-b');
      expect(bar).toHaveClass('border-gray-700');
    });

    it('uses flex layout with centered items', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const bar = document.querySelector('[data-testid="project-info-bar"]');
      expect(bar).toHaveClass('flex');
      expect(bar).toHaveClass('items-center');
    });
  });

  describe('AC#8: Clickable Project Path', () => {
    it('copies path to clipboard on click', async () => {
      const testPath = '/Users/dev/projects/myapp';
      setProject(createMockProject('test', 'fully-initialized', testPath));
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      await fireEvent.click(pathElement);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testPath);
    });

    it('shows toast after copying path', async () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      await fireEvent.click(pathElement);

      // Wait for async clipboard operation
      await vi.waitFor(() => {
        expect(uiStore.showToast).toHaveBeenCalledWith('Path copied to clipboard', '📋');
      });
    });

    it('path has hover state styling', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      expect(pathElement.className).toMatch(/hover:/);
    });

    it('shows error toast when clipboard fails', async () => {
      // Mock clipboard to reject
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard access denied')),
        },
      });

      setProject(createMockProject());
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      await fireEvent.click(pathElement);

      // Wait for async error handling
      await vi.waitFor(() => {
        expect(uiStore.showToast).toHaveBeenCalledWith('Failed to copy path', '✗', 3000);
      });
    });

    it('has aria-label for accessibility', () => {
      setProject(createMockProject());
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      expect(pathElement).toHaveAttribute('aria-label', 'Copy project path to clipboard');
    });
  });

  describe('Edge Cases', () => {
    it('handles very long project names with truncation', () => {
      setProject(createMockProject('this-is-a-very-long-project-name-that-should-be-truncated'));
      render(ProjectInfoBar);

      const nameElement = screen.getByText('this-is-a-very-long-project-name-that-should-be-truncated');
      expect(nameElement).toHaveClass('truncate');
    });

    it('handles very long paths', () => {
      const longPath = '/Users/developer/very/deep/nested/directory/structure/that/goes/on/forever/myproject';
      setProject(createMockProject('test', 'fully-initialized', longPath));
      render(ProjectInfoBar);

      const pathElement = screen.getByTestId('project-path');
      expect(pathElement).toHaveClass('truncate');
    });
  });
});
