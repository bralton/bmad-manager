/**
 * Unit tests for CommandPalette.svelte component.
 * Tests open/close, search filtering, keyboard navigation, and command execution.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import CommandPalette from './CommandPalette.svelte';
import { currentProject } from '$lib/stores/project';
import {
  commandPaletteOpen,
  openCommandPalette,
  closeCommandPalette,
  lastExecutedCommand,
  clearLastExecutedCommand,
} from '$lib/stores/ui';
import type { Project } from '$lib/types/project';
import type { Workflow } from '$lib/types/workflow';
import type { Task } from '$lib/types/task';

// Mock workflowApi and taskApi
vi.mock('$lib/services/tauri', () => ({
  workflowApi: {
    getWorkflows: vi.fn(),
  },
  taskApi: {
    getTasks: vi.fn(),
  },
}));

import { workflowApi, taskApi } from '$lib/services/tauri';
const mockGetWorkflows = workflowApi.getWorkflows as ReturnType<typeof vi.fn>;
const mockGetTasks = taskApi.getTasks as ReturnType<typeof vi.fn>;

describe('CommandPalette', () => {
  const mockWorkflows: Workflow[] = [
    {
      name: 'create-prd',
      description: 'Create a product requirements document',
      module: 'bmm',
      path: '/bmad/workflows/create-prd',
    },
    {
      name: 'create-story',
      description: 'Create a user story',
      module: 'bmm',
      path: '/bmad/workflows/create-story',
    },
    {
      name: 'dev-story',
      description: 'Implement a development story',
      module: 'bmm',
      path: '/bmad/workflows/dev-story',
    },
  ];

  const mockTasks: Task[] = [
    {
      name: 'editorial-review-prose',
      displayName: 'Editorial Review - Prose',
      description: 'Clinical copy-editor for prose clarity',
      module: 'core',
      path: '/bmad/tasks/editorial-review-prose.xml',
      standalone: true,
    },
    {
      name: 'shard-doc',
      displayName: 'Shard Document',
      description: 'Split large documents into sections',
      module: 'core',
      path: '/bmad/tasks/shard-doc.xml',
      standalone: true,
    },
  ];

  const mockProject: Project = {
    name: 'Test Project',
    path: '/test/project',
    state: 'fully-initialized',
    config: null,
    agents: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    closeCommandPalette();
    currentProject.set(null);
    clearLastExecutedCommand();
    mockGetWorkflows.mockResolvedValue(mockWorkflows);
    mockGetTasks.mockResolvedValue(mockTasks);
  });

  afterEach(() => {
    closeCommandPalette();
    currentProject.set(null);
  });

  describe('open/close', () => {
    // P0: Test palette opens when commandPaletteOpen is true
    it('renders when commandPaletteOpen is true', async () => {
      currentProject.set(mockProject);
      openCommandPalette();

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    // P0: Test palette does not render when closed
    it('does not render when commandPaletteOpen is false', () => {
      currentProject.set(mockProject);
      closeCommandPalette();

      render(CommandPalette);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('workflow loading', () => {
    // P0: Test workflows load on project change
    it('loads workflows when project is set', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(mockGetWorkflows).toHaveBeenCalledWith('/test/project');
      });

      // Wait for workflows to render
      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });
    });

    // P0: Test loading state
    it('shows loading state while fetching workflows', async () => {
      // Make the mock take some time
      let resolvePromise: (value: Workflow[]) => void;
      mockGetWorkflows.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      expect(screen.getByText('Loading commands...')).toBeInTheDocument();

      // Resolve
      resolvePromise!(mockWorkflows);
    });
  });

  describe('search filtering', () => {
    // P0: Test search filters workflows by name
    it('filters workflows by name', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search commands...');
      await fireEvent.input(searchInput, { target: { value: 'story' } });

      // create-story and dev-story should remain (check by aria-label since text is split by highlight marks)
      expect(screen.getByRole('option', { name: /create-story/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /dev-story/i })).toBeInTheDocument();
      // create-prd should be filtered out
      expect(screen.queryByRole('option', { name: /create-prd/i })).not.toBeInTheDocument();
    });

    // P0: Test search filters by description
    it('filters workflows by description', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search commands...');
      await fireEvent.input(searchInput, { target: { value: 'product' } });

      // Only create-prd matches "product requirements document"
      expect(screen.getByText('/create-prd')).toBeInTheDocument();
      expect(screen.queryByText('/create-story')).not.toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    // P1: Test ArrowDown moves selection
    it('ArrowDown moves selection to next item', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      // First item should be selected initially
      const firstItem = screen.getByRole('option', { name: /create-prd/i });
      expect(firstItem).toHaveAttribute('aria-selected', 'true');

      // Press ArrowDown
      const dialog = screen.getByRole('dialog');
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });

      // Second item should now be selected
      const secondItem = screen.getByRole('option', { name: /create-story/i });
      expect(secondItem).toHaveAttribute('aria-selected', 'true');
    });

    // P1: Test ArrowUp moves selection
    it('ArrowUp moves selection to previous item', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      // Move down first
      const dialog = screen.getByRole('dialog');
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });

      // Then move up
      await fireEvent.keyDown(dialog, { key: 'ArrowUp' });

      // First item should be selected again
      const firstItem = screen.getByRole('option', { name: /create-prd/i });
      expect(firstItem).toHaveAttribute('aria-selected', 'true');
    });

    // P1: Test ArrowDown wraps around
    it('ArrowDown wraps to first item at end of list', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // Move down 5 times (to wrap around with 3 workflows + 2 tasks = 5 items)
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });

      // First item should be selected (wrapped)
      const firstItem = screen.getByRole('option', { name: /create-prd/i });
      expect(firstItem).toHaveAttribute('aria-selected', 'true');
    });

    // P1: Test ArrowUp wraps around
    it('ArrowUp wraps to last item at start of list', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // Press ArrowUp from first item
      await fireEvent.keyDown(dialog, { key: 'ArrowUp' });

      // Last item should be selected (Shard Document - the last task in the list)
      const lastItem = screen.getByRole('option', { name: /Shard Document/i });
      expect(lastItem).toHaveAttribute('aria-selected', 'true');
    });

    // P1: Test Enter executes selected command
    it('Enter executes selected command', async () => {
      const onExecute = vi.fn();
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette, { props: { onExecute } });

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      await fireEvent.keyDown(dialog, { key: 'Enter' });

      // Commands are now formatted with bmad- prefix based on module
      expect(onExecute).toHaveBeenCalledWith('bmad-bmm-create-prd');
      expect(get(lastExecutedCommand)).toBe('bmad-bmm-create-prd');
    });

    // P1: Test Escape closes palette
    it('Escape closes the palette', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      await fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(get(commandPaletteOpen)).toBe(false);
    });
  });

  describe('Tab focus trap', () => {
    // P1: Test Tab keeps focus in search input
    it('Tab traps focus in search input', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const searchInput = screen.getByPlaceholderText('Search commands...');

      // Press Tab
      await fireEvent.keyDown(dialog, { key: 'Tab' });

      // Focus should remain on search input
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('click interactions', () => {
    // P1: Test backdrop click closes palette
    it('clicking backdrop closes palette', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click on the backdrop (the element with bg-black/50)
      const backdrop = document.querySelector('.bg-black\\/50');
      await fireEvent.click(backdrop!);

      expect(get(commandPaletteOpen)).toBe(false);
    });

    // P1: Test workflow item click executes command
    it('clicking workflow item executes command', async () => {
      const onExecute = vi.fn();
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette, { props: { onExecute } });

      await waitFor(() => {
        expect(screen.getByText('/create-story')).toBeInTheDocument();
      });

      const storyOption = screen.getByRole('option', { name: /create-story/i });
      await fireEvent.click(storyOption);

      // Commands are now formatted with bmad- prefix based on module
      expect(onExecute).toHaveBeenCalledWith('bmad-bmm-create-story');
    });

    // P1: Test hover updates selectedIndex
    it('hovering workflow item updates selection', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      // Hover over second item
      const secondItem = screen.getByRole('option', { name: /create-story/i });
      await fireEvent.mouseEnter(secondItem);

      // Second item should be selected
      expect(secondItem).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('command execution', () => {
    // P1: Test executeCommand sets lastExecutedCommand
    it('sets lastExecutedCommand in store', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/dev-story')).toBeInTheDocument();
      });

      // Move to dev-story and select
      const dialog = screen.getByRole('dialog');
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });
      await fireEvent.keyDown(dialog, { key: 'Enter' });

      // Commands are now formatted with bmad- prefix based on module
      expect(get(lastExecutedCommand)).toBe('bmad-bmm-dev-story');
    });

    // P1: Test command execution closes palette
    it('closes palette after command execution', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      await fireEvent.keyDown(dialog, { key: 'Enter' });

      expect(get(commandPaletteOpen)).toBe(false);
    });
  });

  describe('focus management', () => {
    // P1: Test search input receives focus on open
    it('focuses search input when palette opens', async () => {
      currentProject.set(mockProject);

      render(CommandPalette);

      openCommandPalette();

      // Wait for focus (setTimeout in component)
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search commands...');
        expect(document.activeElement).toBe(searchInput);
      });
    });
  });

  describe('utility functions', () => {
    // P2: Test highlightMatch utility via rendered output
    it('highlights matching text in search results', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search commands...');
      await fireEvent.input(searchInput, { target: { value: 'prd' } });

      // Should have a mark element highlighting "prd"
      const markElement = document.querySelector('mark');
      expect(markElement).toBeInTheDocument();
      expect(markElement?.textContent).toBe('prd');
    });

    // P2: Test escapeHtml via potential XSS (no script execution)
    it('escapes HTML in workflow names', async () => {
      const xssWorkflows: Workflow[] = [
        {
          name: '<script>alert("xss")</script>',
          description: 'Test XSS',
          module: 'test',
          path: '/test',
        },
      ];
      mockGetWorkflows.mockResolvedValue(xssWorkflows);

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        // The script should be escaped and displayed as text, not executed
        expect(screen.getByText(/<script>/)).toBeInTheDocument();
      });
    });
  });

  describe('edge case states', () => {
    // P2: Test no project loaded
    it('shows no project message when no project', async () => {
      openCommandPalette();
      currentProject.set(null);

      render(CommandPalette);

      expect(screen.getByText('No project loaded')).toBeInTheDocument();
    });

    // P2: Test graceful degradation - tasks shown when workflows fail
    // (Error only shown when BOTH fail - see task integration tests)
    it('shows tasks when workflow loading fails (graceful degradation)', async () => {
      mockGetWorkflows.mockRejectedValue(new Error('Network error'));

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      // Should show tasks even though workflows failed
      await waitFor(() => {
        expect(screen.getByText('/Editorial Review - Prose')).toBeInTheDocument();
        expect(screen.getByText('/Shard Document')).toBeInTheDocument();
      });

      // Should show 2 commands (tasks only)
      expect(screen.getByText('2 commands')).toBeInTheDocument();

      // No error should be shown since tasks loaded successfully
      expect(screen.queryByText('Failed to load commands')).not.toBeInTheDocument();
    });

    // P2: Test empty search results
    it('shows empty state when search has no matches', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search commands...');
      await fireEvent.input(searchInput, { target: { value: 'zzzzzzz' } });

      expect(screen.getByText(/No commands match/)).toBeInTheDocument();
    });

    // P2: Test command count display
    it('shows correct command count', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      // 3 workflows + 2 tasks = 5 commands
      await waitFor(() => {
        expect(screen.getByText('5 commands')).toBeInTheDocument();
      });
    });

    // P2: Test filtered count updates
    it('updates command count when filtering', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      // 3 workflows + 2 tasks = 5 commands initially
      await waitFor(() => {
        expect(screen.getByText('5 commands')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search commands...');
      await fireEvent.input(searchInput, { target: { value: 'story' } });

      // Only create-story and dev-story workflows match "story"
      expect(screen.getByText('2 commands')).toBeInTheDocument();
    });
  });

  describe('selectedIndex reset', () => {
    // P2: Test selectedIndex resets when filter changes
    it('resets selection to first item when search changes', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // Move to second item
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });

      const secondItem = screen.getByRole('option', { name: /create-story/i });
      expect(secondItem).toHaveAttribute('aria-selected', 'true');

      // Search to change filter
      const searchInput = screen.getByPlaceholderText('Search commands...');
      await fireEvent.input(searchInput, { target: { value: 'dev' } });

      // First filtered item should be selected
      await waitFor(() => {
        const devStory = screen.getByRole('option', { name: /dev-story/i });
        expect(devStory).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('scroll into view', () => {
    // P2: Test scroll into view on keyboard navigation
    it('calls scrollIntoView on selected item during keyboard navigation', async () => {
      const scrollIntoViewSpy = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewSpy;

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // Navigate down to trigger scrollIntoView
      await fireEvent.keyDown(dialog, { key: 'ArrowDown' });

      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest' });
    });
  });

  // =========================================================================
  // Story 5-12: Task Integration Tests
  // =========================================================================
  describe('task integration', () => {
    // P0: Test tasks are loaded alongside workflows (AC #1-5)
    it('loads and displays tasks alongside workflows', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      // Wait for workflows and tasks to load
      await waitFor(() => {
        // Workflows should be displayed
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
        // Tasks should be displayed with their displayName
        expect(screen.getByText('/Editorial Review - Prose')).toBeInTheDocument();
        expect(screen.getByText('/Shard Document')).toBeInTheDocument();
      });
    });

    // P0: Test task badge displays correctly (AC #6)
    it('displays task badge for tasks', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/Editorial Review - Prose')).toBeInTheDocument();
      });

      // Tasks should have 'task' badge
      const taskBadges = screen.getAllByText('task');
      expect(taskBadges.length).toBeGreaterThan(0);
    });

    // P0: Test workflow badges remain unchanged (AC #7)
    it('displays workflow module badges for workflows', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      // Workflows should have 'bmm' badge
      const bmmBadges = screen.getAllByText('bmm');
      expect(bmmBadges.length).toBe(3); // 3 bmm workflows
    });

    // P0: Test task search filtering (AC #1-4)
    it('filters tasks by name and description', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/Editorial Review - Prose')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search commands...');
      await fireEvent.input(searchInput, { target: { value: 'editorial' } });

      // Editorial Review - Prose should remain
      expect(screen.getByRole('option', { name: /Editorial Review - Prose/i })).toBeInTheDocument();
      // Other tasks and workflows should be filtered out
      expect(screen.queryByText('/create-prd')).not.toBeInTheDocument();
      expect(screen.queryByText('/Shard Document')).not.toBeInTheDocument();
    });

    // P0: Test task execution generates correct skill name (AC #8)
    it('executes task with bmad-{name} skill format', async () => {
      const onExecute = vi.fn();
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette, { props: { onExecute } });

      await waitFor(() => {
        expect(screen.getByText('/Editorial Review - Prose')).toBeInTheDocument();
      });

      // Click on the task
      const taskOption = screen.getByRole('option', { name: /Editorial Review - Prose/i });
      await fireEvent.click(taskOption);

      // Tasks should use bmad-{name} format (not bmad-core-{name})
      expect(onExecute).toHaveBeenCalledWith('bmad-editorial-review-prose');
      expect(get(lastExecutedCommand)).toBe('bmad-editorial-review-prose');
    });

    // P1: Test mixed search results show both tasks and workflows (AC #5)
    it('shows mixed results when search matches both tasks and workflows', async () => {
      // Add a workflow with "review" in the name for mixed results
      const workflowsWithReview: Workflow[] = [
        ...mockWorkflows,
        {
          name: 'code-review',
          description: 'Review code changes',
          module: 'bmm',
          path: '/bmad/workflows/code-review',
        },
      ];
      mockGetWorkflows.mockResolvedValue(workflowsWithReview);

      // Add a task with "review" in the name
      const tasksWithReview: Task[] = [
        ...mockTasks,
        {
          name: 'review-adversarial-general',
          displayName: 'Adversarial Review (General)',
          description: 'Cynically review content',
          module: 'core',
          path: '/bmad/tasks/review-adversarial.xml',
          standalone: true,
        },
      ];
      mockGetTasks.mockResolvedValue(tasksWithReview);

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/code-review')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search commands...');
      await fireEvent.input(searchInput, { target: { value: 'review' } });

      // Both workflow and task should appear
      expect(screen.getByRole('option', { name: /code-review/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Adversarial Review/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Editorial Review/i })).toBeInTheDocument();

      // Verify badge types
      expect(screen.getAllByText('task').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('bmm').length).toBeGreaterThanOrEqual(1);
    });

    // P1: Test graceful degradation - workflows display even when task loading fails
    it('still displays workflows when task loading fails', async () => {
      mockGetTasks.mockRejectedValue(new Error('Task loading failed'));

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      // Workflows should still display even though tasks failed
      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
        expect(screen.getByText('/create-story')).toBeInTheDocument();
        expect(screen.getByText('/dev-story')).toBeInTheDocument();
      });

      // Should show 3 commands (workflows only, no tasks)
      expect(screen.getByText('3 commands')).toBeInTheDocument();

      // No error should be shown since workflows loaded successfully
      expect(screen.queryByText('Failed to load commands')).not.toBeInTheDocument();
    });

    // P1: Test graceful degradation - tasks display even when workflow loading fails
    it('still displays tasks when workflow loading fails', async () => {
      mockGetWorkflows.mockRejectedValue(new Error('Workflow loading failed'));

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      // Tasks should still display even though workflows failed
      await waitFor(() => {
        expect(screen.getByText('/Editorial Review - Prose')).toBeInTheDocument();
        expect(screen.getByText('/Shard Document')).toBeInTheDocument();
      });

      // Should show 2 commands (tasks only, no workflows)
      expect(screen.getByText('2 commands')).toBeInTheDocument();

      // No error should be shown since tasks loaded successfully
      expect(screen.queryByText('Failed to load commands')).not.toBeInTheDocument();
    });

    // P1: Test error state only when BOTH fail
    it('shows error only when both workflows and tasks fail to load', async () => {
      mockGetWorkflows.mockRejectedValue(new Error('Workflow error'));
      mockGetTasks.mockRejectedValue(new Error('Task error'));

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      // Should show error state since BOTH failed
      // Use getAllByText since the error message appears in both header and detail
      await waitFor(() => {
        const errorMessages = screen.getAllByText('Failed to load commands');
        expect(errorMessages.length).toBeGreaterThan(0);
      });

      // Verify no commands are displayed
      expect(screen.getByText('0 commands')).toBeInTheDocument();
    });

    // P1: Test empty tasks array works correctly
    it('works correctly when no tasks are available', async () => {
      mockGetTasks.mockResolvedValue([]);

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      // Should show 3 commands (workflows only)
      expect(screen.getByText('3 commands')).toBeInTheDocument();
    });
  });
});
