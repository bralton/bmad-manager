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
  const activeView = writable<'workflows' | 'stories' | 'artifacts'>('workflows');

  return {
    activeView,
    setActiveView: vi.fn((view: 'workflows' | 'stories' | 'artifacts') => {
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
vi.mock('$lib/stores/project', async () => {
  const { writable } = await import('svelte/store');
  return {
    currentProject: writable({
      path: '/test/project',
      name: 'test-project',
      agents: [
        {
          name: 'architect',
          displayName: 'Architect',
          module: 'core',
          path: '/path/to/architect.yaml',
          customizations: {},
        },
      ],
    }),
  };
});

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
});
