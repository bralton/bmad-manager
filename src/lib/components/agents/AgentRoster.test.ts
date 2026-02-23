/**
 * Unit tests for AgentRoster.svelte component.
 * Tests agent list rendering, agent selection, loading state, and empty state.
 */

import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AgentRoster from './AgentRoster.svelte';
import type { Agent } from '$lib/types/agent';
import * as sessionStore from '$lib/stores/sessions';
import * as processService from '$lib/services/process';
import * as projectStore from '$lib/stores/project';

// Mock stores
vi.mock('$lib/stores/sessions', () => ({
  addSession: vi.fn(),
  selectSession: vi.fn(),
}));

// Mock project store with controllable value
vi.mock('$lib/stores/project', async () => {
  const { writable } = await import('svelte/store');
  return {
    currentProject: writable(null),
  };
});

// Mock process service
vi.mock('$lib/services/process', () => ({
  spawnClaudeSession: vi.fn(),
  generateSessionName: vi.fn().mockReturnValue('test-session-name'),
}));

describe('AgentRoster', () => {
  const mockAgents: Agent[] = [
    {
      name: 'architect',
      displayName: 'Architect',
      title: 'Solution Architect',
      icon: '🏗️',
      role: 'Designs systems',
      identity: '',
      communicationStyle: '',
      principles: '',
      module: 'core',
      path: '/path/to/architect.yaml',
    },
    {
      name: 'developer',
      displayName: 'Developer',
      title: 'Software Developer',
      icon: '💻',
      role: 'Writes code',
      identity: '',
      communicationStyle: '',
      principles: '',
      module: 'bmm',
      path: '/path/to/developer.yaml',
    },
    {
      name: 'tester',
      displayName: 'Tester',
      title: 'QA Engineer',
      icon: '🧪',
      role: 'Tests software',
      identity: '',
      communicationStyle: '',
      principles: '',
      module: 'core',
      path: '/path/to/tester.yaml',
    },
  ];

  const mockProject = {
    path: '/test/project',
    name: 'test-project',
    agents: mockAgents,
  };

  // Helper to set project
  function setProject(project: typeof mockProject | null) {
    (projectStore.currentProject as { set: (v: typeof mockProject | null) => void }).set(
      project
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setProject(null);
  });

  afterEach(() => {
    cleanup();
  });

  describe('header', () => {
    it('renders Agents header', () => {
      render(AgentRoster);

      expect(screen.getByText('Agents')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no project is selected', () => {
      setProject(null);
      render(AgentRoster);

      expect(screen.getByText('No agents found')).toBeInTheDocument();
      expect(
        screen.getByText(/Open a BMAD-initialized project/)
      ).toBeInTheDocument();
    });

    it('shows empty state when project has no agents', () => {
      setProject({
        path: '/test/project',
        name: 'test-project',
        agents: [],
      });
      render(AgentRoster);

      expect(screen.getByText('No agents found')).toBeInTheDocument();
      expect(
        screen.getByText(/This project doesn't have any BMAD agents/)
      ).toBeInTheDocument();
    });
  });

  describe('agent list rendering', () => {
    it('renders list of agents', () => {
      setProject(mockProject);
      render(AgentRoster);

      expect(screen.getByText('Architect')).toBeInTheDocument();
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('Tester')).toBeInTheDocument();
    });
  });

  describe('agent selection', () => {
    it('calls spawnClaudeSession when clicking an agent', async () => {
      setProject(mockProject);
      (processService.spawnClaudeSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'new-session-id',
        claudeSessionId: 'uuid-new',
        projectPath: '/test/project',
        agent: 'architect',
        startedAt: new Date().toISOString(),
        status: 'active',
      });

      render(AgentRoster);

      // Find the Architect card and click it
      const architectCard = screen.getByText('Architect').closest('button');
      await fireEvent.click(architectCard!);

      await waitFor(() => {
        expect(processService.spawnClaudeSession).toHaveBeenCalledWith(
          expect.objectContaining({
            projectPath: '/test/project',
            initialCommand: '/bmad-agent-architect',
          })
        );
      });
    });

    it('calls addSession and selectSession on successful spawn', async () => {
      setProject(mockProject);
      const mockSession = {
        id: 'new-session-id',
        claudeSessionId: 'uuid-new',
        projectPath: '/test/project',
        agent: 'architect',
        startedAt: new Date().toISOString(),
        status: 'active',
      };
      (processService.spawnClaudeSession as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSession
      );

      render(AgentRoster);

      const architectCard = screen.getByText('Architect').closest('button');
      await fireEvent.click(architectCard!);

      await waitFor(() => {
        expect(sessionStore.addSession).toHaveBeenCalledWith(mockSession);
        expect(sessionStore.selectSession).toHaveBeenCalledWith('new-session-id');
      });
    });

    it('shows success feedback after spawning', async () => {
      setProject(mockProject);
      (processService.spawnClaudeSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'new-session-id',
        claudeSessionId: 'uuid-new',
        projectPath: '/test/project',
        agent: 'architect',
        startedAt: new Date().toISOString(),
        status: 'active',
      });

      render(AgentRoster);

      const architectCard = screen.getByText('Architect').closest('button');
      await fireEvent.click(architectCard!);

      await waitFor(() => {
        expect(screen.getByText(/Session started/)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('shows error feedback when spawn fails', async () => {
      setProject(mockProject);
      (processService.spawnClaudeSession as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection failed')
      );

      render(AgentRoster);

      const architectCard = screen.getByText('Architect').closest('button');
      await fireEvent.click(architectCard!);

      await waitFor(() => {
        expect(screen.getByText(/Failed to start session/)).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows starting message when clicking agent', async () => {
      setProject(mockProject);
      // Use a never-resolving promise to keep loading state
      (processService.spawnClaudeSession as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      render(AgentRoster);

      const architectCard = screen.getByText('Architect').closest('button');
      await fireEvent.click(architectCard!);

      expect(screen.getByText(/Starting session with Architect/)).toBeInTheDocument();
    });
  });
});
