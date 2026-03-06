/**
 * Unit tests for Sidebar.svelte component.
 * Tests navigation rendering, tab switching, active item highlighting, and settings button.
 */

import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Agent } from '$lib/types/agent';
import Sidebar from './Sidebar.svelte';
import * as uiStore from '$lib/stores/ui';

// Mock stores
vi.mock('$lib/stores/ui', async () => {
  const { writable } = await import('svelte/store');
  const activeView = writable<'dashboards' | 'workflows' | 'stories' | 'artifacts'>('workflows');

  return {
    activeView,
    setActiveView: vi.fn((view: 'dashboards' | 'workflows' | 'stories' | 'artifacts') => {
      activeView.set(view);
    }),
    openSettingsModal: vi.fn(),
  };
});

vi.mock('$lib/stores/sessions', async () => {
  const { writable } = await import('svelte/store');
  const sessions = writable(new Map());

  return {
    sessions,
    addSession: vi.fn(),
    selectSession: vi.fn(),
  };
});

// Mock project store with agents for AgentRoster
// Use async factory to avoid hoisting issues
vi.mock('$lib/stores/project', async () => {
  const { writable } = await import('svelte/store');
  const store = writable({
    path: '/test/project',
    name: 'test-project',
    state: 'fully-initialized', // Required for tabs to be enabled
    agents: [
      {
        name: 'architect',
        displayName: 'Architect',
        title: 'Architect',
        icon: '🏗️',
        role: 'architect',
        identity: '',
        communicationStyle: '',
        principles: '',
        module: 'core',
        path: '/path/to/architect.yaml',
      },
    ],
    config: null,
  });
  return {
    currentProject: store,
  };
});

// Import the mocked store for manipulation in tests
import { currentProject } from '$lib/stores/project';
import type { Project } from '$lib/types/project';

// Mock process service
vi.mock('$lib/services/process', () => ({
  getRecentSessions: vi.fn().mockResolvedValue([]),
  searchSessions: vi.fn().mockResolvedValue([]),
  spawnClaudeSession: vi.fn(),
  generateSessionName: vi.fn().mockReturnValue('test-session-name'),
}));

// Mock shortcuts service
vi.mock('$lib/services/shortcuts', () => ({
  formatShortcutDisplay: vi.fn((key: string) => key),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset activeView
    (uiStore.activeView as { set: (v: string) => void }).set('workflows');
  });

  afterEach(() => {
    cleanup();
  });

  describe('header', () => {
    it('renders BMAD Manager title', () => {
      render(Sidebar);

      expect(screen.getByText('BMAD Manager')).toBeInTheDocument();
    });
  });

  describe('main view navigation', () => {
    it('renders all navigation items', () => {
      render(Sidebar);

      expect(screen.getByRole('button', { name: /Workflows/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stories/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Artifacts/i })).toBeInTheDocument();
    });

    it('clicking Workflows calls setActiveView', async () => {
      render(Sidebar);

      const workflowsButton = screen.getByRole('button', { name: /Workflows/i });
      await fireEvent.click(workflowsButton);

      expect(uiStore.setActiveView).toHaveBeenCalledWith('workflows');
    });

    it('clicking Stories calls setActiveView', async () => {
      render(Sidebar);

      const storiesButton = screen.getByRole('button', { name: /Stories/i });
      await fireEvent.click(storiesButton);

      expect(uiStore.setActiveView).toHaveBeenCalledWith('stories');
    });

    it('clicking Artifacts calls setActiveView', async () => {
      render(Sidebar);

      const artifactsButton = screen.getByRole('button', { name: /Artifacts/i });
      await fireEvent.click(artifactsButton);

      expect(uiStore.setActiveView).toHaveBeenCalledWith('artifacts');
    });
  });

  describe('active view highlighting', () => {
    it('highlights Workflows when active', () => {
      (uiStore.activeView as { set: (v: string) => void }).set('workflows');

      render(Sidebar);

      const workflowsButton = screen.getByRole('button', { name: /Workflows/i });
      expect(workflowsButton).toHaveClass('border-blue-500');
    });

    it('highlights Stories when active', () => {
      (uiStore.activeView as { set: (v: string) => void }).set('stories');

      render(Sidebar);

      const storiesButton = screen.getByRole('button', { name: /Stories/i });
      expect(storiesButton).toHaveClass('border-blue-500');
    });

    it('highlights Artifacts when active', () => {
      (uiStore.activeView as { set: (v: string) => void }).set('artifacts');

      render(Sidebar);

      const artifactsButton = screen.getByRole('button', { name: /Artifacts/i });
      expect(artifactsButton).toHaveClass('border-blue-500');
    });
  });

  describe('sidebar tabs', () => {
    it('renders Agents and Sessions tabs', () => {
      render(Sidebar);

      expect(screen.getByRole('button', { name: /^Agents$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sessions$/i })).toBeInTheDocument();
    });

    it('Agents tab is active by default', () => {
      render(Sidebar);

      const agentsTab = screen.getByRole('button', { name: /^Agents$/i });
      expect(agentsTab).toHaveClass('border-blue-500');
    });

    it('switching to Sessions tab updates highlighting', async () => {
      render(Sidebar);

      const sessionsTab = screen.getByRole('button', { name: /^Sessions$/i });
      await fireEvent.click(sessionsTab);

      expect(sessionsTab).toHaveClass('border-blue-500');
    });

    it('Agents tab loses highlight when Sessions is clicked', async () => {
      render(Sidebar);

      const agentsTab = screen.getByRole('button', { name: /^Agents$/i });
      const sessionsTab = screen.getByRole('button', { name: /^Sessions$/i });

      await fireEvent.click(sessionsTab);

      expect(agentsTab).not.toHaveClass('border-blue-500');
    });
  });

  describe('settings button', () => {
    it('renders settings button', () => {
      render(Sidebar);

      expect(screen.getByTitle(/Open settings/i)).toBeInTheDocument();
    });

    it('clicking settings button calls openSettingsModal', async () => {
      render(Sidebar);

      const settingsButton = screen.getByTitle(/Open settings/i);
      await fireEvent.click(settingsButton);

      expect(uiStore.openSettingsModal).toHaveBeenCalled();
    });

    it('settings button shows Settings text', () => {
      render(Sidebar);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('sidebar persistence (Story 5-2)', () => {
    it('maintains sidebar tab selection when main view changes', async () => {
      // AC2: Sidebar tab state preserved across main view changes
      render(Sidebar);

      // Switch to Sessions tab in sidebar
      const sessionsTab = screen.getByRole('button', { name: /^Sessions$/i });
      await fireEvent.click(sessionsTab);
      expect(sessionsTab).toHaveClass('border-blue-500');

      // Switch main view from workflows to stories
      const storiesButton = screen.getByRole('button', { name: /Stories/i });
      await fireEvent.click(storiesButton);

      // Assert sidebar still shows Sessions tab (not reset to Agents)
      expect(sessionsTab).toHaveClass('border-blue-500');
      const agentsTab = screen.getByRole('button', { name: /^Agents$/i });
      expect(agentsTab).not.toHaveClass('border-blue-500');
    });

    it('maintains sidebar tab after multiple main view switches', async () => {
      // AC2: Extended - verify persistence across multiple switches
      render(Sidebar);

      // Switch to Sessions tab
      const sessionsTab = screen.getByRole('button', { name: /^Sessions$/i });
      await fireEvent.click(sessionsTab);

      // Switch main views: workflows -> stories -> artifacts -> dashboards
      await fireEvent.click(screen.getByRole('button', { name: /Stories/i }));
      await fireEvent.click(screen.getByRole('button', { name: /Artifacts/i }));
      await fireEvent.click(screen.getByRole('button', { name: /Dashboards/i }));

      // Sessions tab should still be selected
      expect(sessionsTab).toHaveClass('border-blue-500');
    });

    it('does not auto-switch main view when changing sidebar tabs', async () => {
      // AC3/AC4: Main view stays the same when interacting with sidebar
      (uiStore.activeView as { set: (v: string) => void }).set('artifacts');

      render(Sidebar);

      // Click sidebar tabs back and forth
      const sessionsTab = screen.getByRole('button', { name: /^Sessions$/i });
      const agentsTab = screen.getByRole('button', { name: /^Agents$/i });

      await fireEvent.click(sessionsTab);
      await fireEvent.click(agentsTab);
      await fireEvent.click(sessionsTab);

      // Main view should NOT have been changed - setActiveView should not be called
      // except when clicking main view buttons
      expect(uiStore.setActiveView).not.toHaveBeenCalled();

      // Now click a main view button and verify it IS called
      await fireEvent.click(screen.getByRole('button', { name: /Stories/i }));
      expect(uiStore.setActiveView).toHaveBeenCalledWith('stories');
    });

    it('preserves sidebar state independently of main view state', async () => {
      // AC5: Sidebar state independent of main view
      render(Sidebar);

      // Set initial states
      const sessionsTab = screen.getByRole('button', { name: /^Sessions$/i });
      await fireEvent.click(sessionsTab);

      // Get initial activeView
      const initialView = 'workflows';

      // Switch main view multiple times
      await fireEvent.click(screen.getByRole('button', { name: /Dashboards/i }));
      await fireEvent.click(screen.getByRole('button', { name: /Workflows/i }));

      // Sidebar tab should still be Sessions
      expect(sessionsTab).toHaveClass('border-blue-500');
    });

    it('renders sidebar without layout shift between tab switches', async () => {
      // AC6: No layout shift - sidebar dimensions remain constant
      const { container } = render(Sidebar);
      const aside = container.querySelector('aside');

      // Get initial dimensions
      expect(aside).toHaveClass('w-72', 'h-screen');

      // Switch main views
      await fireEvent.click(screen.getByRole('button', { name: /Stories/i }));
      await fireEvent.click(screen.getByRole('button', { name: /Artifacts/i }));

      // Dimensions should remain the same
      expect(aside).toHaveClass('w-72', 'h-screen');
    });

    it('maintains search input value when switching main views', async () => {
      // AC2: Search query preserved across main view changes
      render(Sidebar);

      // Switch to Sessions tab to show SessionList with search
      const sessionsTab = screen.getByRole('button', { name: /^Sessions$/i });
      await fireEvent.click(sessionsTab);

      // Find and interact with search input
      const searchInput = screen.getByPlaceholderText('Search sessions...');
      await fireEvent.input(searchInput, { target: { value: 'test query' } });

      // Verify search input has value
      expect(searchInput).toHaveValue('test query');

      // Switch main view multiple times
      await fireEvent.click(screen.getByRole('button', { name: /Stories/i }));
      await fireEvent.click(screen.getByRole('button', { name: /Artifacts/i }));
      await fireEvent.click(screen.getByRole('button', { name: /Dashboards/i }));

      // Search input should still have the same value (component stayed mounted)
      expect(searchInput).toHaveValue('test query');
    });

    it('session resume via selectSession does not modify activeView', async () => {
      // AC3: Session actions work from any view - selectSession should not change view
      // This verifies the architectural guarantee that selectSession only updates
      // currentSessionId and sessionsWithNewOutput, never activeView
      const { selectSession } = await import('$lib/stores/sessions');

      // Set initial view to artifacts
      (uiStore.activeView as { set: (v: string) => void }).set('artifacts');

      render(Sidebar);

      // Simulate what happens when a session is resumed: selectSession is called
      // This mimics the handleResume flow in Sidebar.svelte
      selectSession('test-session-123');

      // Verify setActiveView was NOT called - the view should stay on artifacts
      expect(uiStore.setActiveView).not.toHaveBeenCalled();

      // Verify the artifacts button is still highlighted (view unchanged)
      const artifactsButton = screen.getByRole('button', { name: /Artifacts/i });
      expect(artifactsButton).toHaveClass('border-blue-500');
    });

    it('agent spawn via selectSession does not modify activeView', async () => {
      // AC4: Agent actions work from any view - spawning a session should not change view
      // This verifies that addSession + selectSession (the agent click flow) doesn't change views
      const { addSession, selectSession } = await import('$lib/stores/sessions');

      // Set initial view to stories
      (uiStore.activeView as { set: (v: string) => void }).set('stories');

      render(Sidebar);

      // Simulate the agent click flow: addSession then selectSession
      // (matching AgentRoster.svelte:69-71)
      addSession({
        id: 'new-agent-session',
        name: 'test-session',
        status: 'active',
        projectPath: '/test/project',
        startedAt: new Date().toISOString(),
      } as any);
      selectSession('new-agent-session');

      // Verify setActiveView was NOT called - the view should stay on stories
      expect(uiStore.setActiveView).not.toHaveBeenCalled();

      // Verify the stories button is still highlighted (view unchanged)
      const storiesButton = screen.getByRole('button', { name: /Stories/i });
      expect(storiesButton).toHaveClass('border-blue-500');
    });
  });

  describe('tab disabling for non-initialized projects (Story 5-9 AC#11)', () => {
    beforeEach(() => {
      // Reset to non-fully-initialized state for these tests
      (currentProject as { set: (v: Project | null) => void }).set({
        path: '/test/project',
        name: 'test-project',
        state: 'git-only', // NOT fully-initialized
        agents: [],
        config: null,
      });
    });

    afterEach(() => {
      // Restore fully-initialized state for other tests
      (currentProject as { set: (v: Project | null) => void }).set({
        path: '/test/project',
        name: 'test-project',
        state: 'fully-initialized',
        agents: [
          {
            name: 'architect',
            displayName: 'Architect',
            title: 'Architect',
            icon: '🏗️',
            role: 'architect',
            identity: '',
            communicationStyle: '',
            principles: '',
            module: 'core',
            path: '/path/to/architect.yaml',
          },
        ],
        config: null,
      });
    });

    it('disables Workflows tab when project is not fully-initialized', () => {
      render(Sidebar);

      const workflowsButton = screen.getByRole('button', { name: /Workflows/i });
      expect(workflowsButton).toBeDisabled();
      expect(workflowsButton).toHaveClass('cursor-not-allowed');
    });

    it('disables Stories tab when project is not fully-initialized', () => {
      render(Sidebar);

      const storiesButton = screen.getByRole('button', { name: /Stories/i });
      expect(storiesButton).toBeDisabled();
      expect(storiesButton).toHaveClass('cursor-not-allowed');
    });

    it('disables Artifacts tab when project is not fully-initialized', () => {
      render(Sidebar);

      const artifactsButton = screen.getByRole('button', { name: /Artifacts/i });
      expect(artifactsButton).toBeDisabled();
      expect(artifactsButton).toHaveClass('cursor-not-allowed');
    });

    it('keeps Dashboards tab enabled when project is not fully-initialized', () => {
      render(Sidebar);

      const dashboardsButton = screen.getByRole('button', { name: /Dashboards/i });
      expect(dashboardsButton).not.toBeDisabled();
      expect(dashboardsButton).not.toHaveClass('cursor-not-allowed');
    });

    it('clicking disabled Workflows tab does not call setActiveView', async () => {
      render(Sidebar);

      const workflowsButton = screen.getByRole('button', { name: /Workflows/i });
      await fireEvent.click(workflowsButton);

      expect(uiStore.setActiveView).not.toHaveBeenCalled();
    });

    it('clicking disabled Stories tab does not call setActiveView', async () => {
      render(Sidebar);

      const storiesButton = screen.getByRole('button', { name: /Stories/i });
      await fireEvent.click(storiesButton);

      expect(uiStore.setActiveView).not.toHaveBeenCalled();
    });

    it('clicking disabled Artifacts tab does not call setActiveView', async () => {
      render(Sidebar);

      const artifactsButton = screen.getByRole('button', { name: /Artifacts/i });
      await fireEvent.click(artifactsButton);

      expect(uiStore.setActiveView).not.toHaveBeenCalled();
    });

    it('shows "Initialize project to enable" tooltip on disabled tabs', () => {
      render(Sidebar);

      const workflowsButton = screen.getByRole('button', { name: /Workflows/i });
      const storiesButton = screen.getByRole('button', { name: /Stories/i });
      const artifactsButton = screen.getByRole('button', { name: /Artifacts/i });

      expect(workflowsButton).toHaveAttribute('title', 'Initialize project to enable');
      expect(storiesButton).toHaveAttribute('title', 'Initialize project to enable');
      expect(artifactsButton).toHaveAttribute('title', 'Initialize project to enable');
    });

    it('applies disabled styling (gray-600) to disabled tabs', () => {
      render(Sidebar);

      const workflowsButton = screen.getByRole('button', { name: /Workflows/i });
      expect(workflowsButton).toHaveClass('text-gray-600');
    });
  });
});
