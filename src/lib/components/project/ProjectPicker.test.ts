/**
 * Unit tests for ProjectPicker.svelte component.
 * Tests project selection, recent projects display, browse action, and empty state.
 */

import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ProjectPicker from './ProjectPicker.svelte';
import type { Project } from '$lib/types/project';
import * as projectStore from '$lib/stores/project';
import * as tauriApi from '$lib/services/tauri';

// Mock Tauri dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock project stores
vi.mock('$lib/stores/project', async () => {
  const { writable } = await import('svelte/store');
  return {
    currentProject: writable(null),
    projectLoading: writable(false),
    projectError: writable(null),
  };
});

// Mock Tauri API
vi.mock('$lib/services/tauri', () => ({
  api: {
    openProject: vi.fn(),
    refreshProject: vi.fn(),
  },
}));

// Mock project type helpers
vi.mock('$lib/types/project', () => ({
  getStateLabel: vi.fn((state: string) => {
    const labels: Record<string, string> = {
      'fully-initialized': 'Fully Initialized',
      'git-only': 'Git Only',
      'bmad-only': 'BMAD Only',
      empty: 'Not Initialized',
    };
    return labels[state] || state;
  }),
  getStateDescription: vi.fn((state: string) => {
    const descriptions: Record<string, string> = {
      'fully-initialized': 'Project is ready to use with both Git and BMAD.',
      'git-only': 'Git repository found but BMAD not initialized.',
      'bmad-only': 'BMAD found but not a Git repository.',
      empty: 'Neither Git nor BMAD initialized.',
    };
    return descriptions[state] || '';
  }),
}));

describe('ProjectPicker', () => {
  const mockProject: Project = {
    path: '/test/project',
    name: 'test-project',
    state: 'fully-initialized',
    agents: [],
    config: {
      project_name: 'test-project',
      user_name: 'testuser',
      output_folder: '_bmad-output',
      communication_language: 'English',
    },
  };

  // Helper to set project
  function setProject(project: Project | null) {
    (projectStore.currentProject as { set: (v: Project | null) => void }).set(
      project
    );
  }

  // Helper to set loading state
  function setLoading(loading: boolean) {
    (projectStore.projectLoading as { set: (v: boolean) => void }).set(loading);
  }

  // Helper to set error
  function setError(error: string | null) {
    (projectStore.projectError as { set: (v: string | null) => void }).set(error);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setProject(null);
    setLoading(false);
    setError(null);
  });

  afterEach(() => {
    cleanup();
  });

  describe('empty state (no project)', () => {
    it('shows Open a Project heading', () => {
      render(ProjectPicker);

      expect(screen.getByText('Open a Project')).toBeInTheDocument();
    });

    it('shows description text', () => {
      render(ProjectPicker);

      expect(
        screen.getByText(/Select a folder to detect its initialization state/)
      ).toBeInTheDocument();
    });

    it('shows Select Folder button', () => {
      render(ProjectPicker);

      expect(
        screen.getByRole('button', { name: 'Select Folder' })
      ).toBeInTheDocument();
    });
  });

  describe('folder selection', () => {
    it('clicking Select Folder triggers dialog', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as ReturnType<typeof vi.fn>).mockResolvedValue('/selected/folder');
      (tauriApi.api.openProject as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProject
      );

      render(ProjectPicker);

      const selectButton = screen.getByRole('button', { name: 'Select Folder' });
      await fireEvent.click(selectButton);

      expect(open).toHaveBeenCalledWith({
        directory: true,
        multiple: false,
        title: 'Select Project Folder',
      });
    });

    it('shows loading state while selecting', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      // Create a pending promise
      let resolveOpen: (value: string) => void;
      (open as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveOpen = resolve;
          })
      );

      render(ProjectPicker);

      const selectButton = screen.getByRole('button', { name: 'Select Folder' });
      await fireEvent.click(selectButton);

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Cleanup
      resolveOpen!(null as unknown as string);
    });

    it('disables button while loading', async () => {
      setLoading(true);

      render(ProjectPicker);

      const selectButton = screen.getByRole('button', { name: 'Loading...' });
      expect(selectButton).toBeDisabled();
    });
  });

  describe('project loaded state', () => {
    it('shows project name in heading', () => {
      setProject(mockProject);

      render(ProjectPicker);

      // Project name appears both in heading and config, use getByRole
      expect(
        screen.getByRole('heading', { name: 'test-project' })
      ).toBeInTheDocument();
    });

    it('shows project path', () => {
      setProject(mockProject);

      render(ProjectPicker);

      expect(screen.getByText('/test/project')).toBeInTheDocument();
    });

    it('shows state label', () => {
      setProject(mockProject);

      render(ProjectPicker);

      expect(screen.getByText('Fully Initialized')).toBeInTheDocument();
    });

    it('shows state description', () => {
      setProject(mockProject);

      render(ProjectPicker);

      expect(
        screen.getByText(/Project is ready to use with both Git and BMAD/)
      ).toBeInTheDocument();
    });

    it('shows BMAD configuration when available', () => {
      setProject(mockProject);

      render(ProjectPicker);

      expect(screen.getByText('BMAD Configuration')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('_bmad-output')).toBeInTheDocument();
    });
  });

  describe('actions on loaded project', () => {
    it('shows Open Different Folder button', () => {
      setProject(mockProject);

      render(ProjectPicker);

      expect(
        screen.getByRole('button', { name: 'Open Different Folder' })
      ).toBeInTheDocument();
    });

    it('shows Refresh button', () => {
      setProject(mockProject);

      render(ProjectPicker);

      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });

    it('clicking refresh calls refreshProject', async () => {
      setProject(mockProject);
      (tauriApi.api.refreshProject as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProject
      );

      render(ProjectPicker);

      const refreshButton = screen.getByRole('button', { name: 'Refresh' });
      await fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(tauriApi.api.refreshProject).toHaveBeenCalledWith('/test/project');
      });
    });
  });

  describe('initialization buttons', () => {
    it('shows Initialize BMAD for git-only state', () => {
      setProject({
        ...mockProject,
        state: 'git-only',
        config: null,
      });

      render(ProjectPicker);

      expect(
        screen.getByRole('button', { name: 'Initialize BMAD' })
      ).toBeInTheDocument();
    });

    it('shows Initialize Git for bmad-only state', () => {
      setProject({
        ...mockProject,
        state: 'bmad-only',
      });

      render(ProjectPicker);

      expect(
        screen.getByRole('button', { name: 'Initialize Git' })
      ).toBeInTheDocument();
    });

    it('shows Initialize Git + BMAD for empty state', () => {
      setProject({
        ...mockProject,
        state: 'empty',
        config: null,
      });

      render(ProjectPicker);

      expect(
        screen.getByRole('button', { name: 'Initialize Git + BMAD' })
      ).toBeInTheDocument();
    });

    it('does not show initialization button for fully-initialized', () => {
      setProject(mockProject);

      render(ProjectPicker);

      expect(
        screen.queryByRole('button', { name: /Initialize/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows error message when error state is set', () => {
      setError('Failed to open project');

      render(ProjectPicker);

      expect(screen.getByText('Failed to open project')).toBeInTheDocument();
    });

    it('shows error with project loaded', () => {
      setProject(mockProject);
      setError('Refresh failed');

      render(ProjectPicker);

      expect(screen.getByText('Refresh failed')).toBeInTheDocument();
    });
  });
});
