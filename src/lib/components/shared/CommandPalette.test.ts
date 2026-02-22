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

// Mock workflowApi
vi.mock('$lib/services/tauri', () => ({
  workflowApi: {
    getWorkflows: vi.fn(),
  },
}));

import { workflowApi } from '$lib/services/tauri';
const mockGetWorkflows = workflowApi.getWorkflows as ReturnType<typeof vi.fn>;

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

      expect(screen.getByText('Loading workflows...')).toBeInTheDocument();

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

      const searchInput = screen.getByPlaceholderText('Search workflows...');
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

      const searchInput = screen.getByPlaceholderText('Search workflows...');
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

      // Move down 3 times (to wrap around with 3 items)
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

      // Last item should be selected (dev-story)
      const lastItem = screen.getByRole('option', { name: /dev-story/i });
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
      const searchInput = screen.getByPlaceholderText('Search workflows...');

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
        const searchInput = screen.getByPlaceholderText('Search workflows...');
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

      const searchInput = screen.getByPlaceholderText('Search workflows...');
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

    // P2: Test error state
    it('shows error when workflow loading fails', async () => {
      mockGetWorkflows.mockRejectedValue(new Error('Network error'));

      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('Failed to load workflows')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    // P2: Test empty search results
    it('shows empty state when search has no matches', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('/create-prd')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search workflows...');
      await fireEvent.input(searchInput, { target: { value: 'zzzzzzz' } });

      expect(screen.getByText(/No commands match/)).toBeInTheDocument();
    });

    // P2: Test command count display
    it('shows correct command count', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('3 commands')).toBeInTheDocument();
      });
    });

    // P2: Test filtered count updates
    it('updates command count when filtering', async () => {
      openCommandPalette();
      currentProject.set(mockProject);

      render(CommandPalette);

      await waitFor(() => {
        expect(screen.getByText('3 commands')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search workflows...');
      await fireEvent.input(searchInput, { target: { value: 'story' } });

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
      const searchInput = screen.getByPlaceholderText('Search workflows...');
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
});
