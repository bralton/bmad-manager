/**
 * Unit tests for InitializeProject.svelte component.
 * Tests form rendering, validation, submission flow, error handling, and success state.
 */

import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InitializeProject from './InitializeProject.svelte';
import * as tauriApi from '$lib/services/tauri';
import * as projectStore from '$lib/stores/project';

// Mock Tauri event listener
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock project stores
vi.mock('$lib/stores/project', async () => {
  const { writable } = await import('svelte/store');
  return {
    currentProject: writable(null),
    projectLoading: writable(false),
  };
});

// Mock settings store
vi.mock('$lib/stores/settings', async () => {
  const { writable } = await import('svelte/store');
  return {
    settings: writable({
      user: { name: 'TestUser' },
      bmad: { default_workflow: 'QuickFlow' },
    }),
  };
});

// Mock Tauri API
vi.mock('$lib/services/tauri', () => ({
  api: {
    initializeProject: vi.fn(),
    initBmadOnly: vi.fn(),
    initGitOnly: vi.fn(),
  },
}));

describe('InitializeProject', () => {
  const defaultProps = {
    projectPath: '/test/my-project',
    currentState: 'empty' as const,
    onComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('form rendering', () => {
    it('renders Initialize Project heading', () => {
      render(InitializeProject, { props: defaultProps });

      expect(screen.getByText('Initialize Project')).toBeInTheDocument();
    });

    it('renders Project Name input for empty state', () => {
      render(InitializeProject, { props: defaultProps });

      expect(screen.getByLabelText('Project Name')).toBeInTheDocument();
    });

    it('renders Your Name input for empty state', () => {
      render(InitializeProject, { props: defaultProps });

      expect(screen.getByLabelText('Your Name')).toBeInTheDocument();
    });

    it('renders Workflow Style selector for empty state', () => {
      render(InitializeProject, { props: defaultProps });

      expect(screen.getByLabelText('Workflow Style')).toBeInTheDocument();
    });

    it('pre-fills project name from folder path', () => {
      render(InitializeProject, { props: defaultProps });

      const input = screen.getByLabelText('Project Name') as HTMLInputElement;
      expect(input.value).toBe('my-project');
    });

    it('pre-fills user name from settings', () => {
      render(InitializeProject, { props: defaultProps });

      const input = screen.getByLabelText('Your Name') as HTMLInputElement;
      expect(input.value).toBe('TestUser');
    });

    it('renders Initialize Git + BMAD button for empty state', () => {
      render(InitializeProject, { props: defaultProps });

      expect(
        screen.getByRole('button', { name: 'Initialize Git + BMAD' })
      ).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(InitializeProject, { props: defaultProps });

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('button labels by state', () => {
    it('shows Initialize BMAD for git-only state', () => {
      render(InitializeProject, {
        props: { ...defaultProps, currentState: 'git-only' },
      });

      expect(
        screen.getByRole('button', { name: 'Initialize BMAD' })
      ).toBeInTheDocument();
    });

    it('shows Initialize Git for bmad-only state', () => {
      render(InitializeProject, {
        props: { ...defaultProps, currentState: 'bmad-only' },
      });

      expect(
        screen.getByRole('button', { name: 'Initialize Git' })
      ).toBeInTheDocument();
    });

    it('shows git-only message for bmad-only state (no form fields)', () => {
      render(InitializeProject, {
        props: { ...defaultProps, currentState: 'bmad-only' },
      });

      expect(
        screen.getByText(/This will initialize a Git repository/)
      ).toBeInTheDocument();
      // Should not show form fields
      expect(screen.queryByLabelText('Project Name')).not.toBeInTheDocument();
    });
  });

  describe('validation attributes', () => {
    it('project name input has required attribute', () => {
      render(InitializeProject, { props: defaultProps });

      const input = screen.getByLabelText('Project Name') as HTMLInputElement;
      expect(input).toHaveAttribute('required');
    });

    it('user name input has required attribute', () => {
      render(InitializeProject, { props: defaultProps });

      const input = screen.getByLabelText('Your Name') as HTMLInputElement;
      expect(input).toHaveAttribute('required');
    });

    it('project name input has maxlength attribute', () => {
      render(InitializeProject, { props: defaultProps });

      const input = screen.getByLabelText('Project Name') as HTMLInputElement;
      expect(input).toHaveAttribute('maxlength', '100');
    });

    it('user name input has maxlength attribute', () => {
      render(InitializeProject, { props: defaultProps });

      const input = screen.getByLabelText('Your Name') as HTMLInputElement;
      expect(input).toHaveAttribute('maxlength', '100');
    });
  });

  describe('submission flow', () => {
    it('calls initializeProject for empty state', async () => {
      const mockProject = {
        path: '/test/my-project',
        name: 'my-project',
        state: 'fully-initialized',
      };
      (tauriApi.api.initializeProject as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProject
      );

      render(InitializeProject, { props: defaultProps });

      const submitButton = screen.getByRole('button', {
        name: 'Initialize Git + BMAD',
      });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(tauriApi.api.initializeProject).toHaveBeenCalledWith(
          '/test/my-project',
          expect.objectContaining({
            projectName: 'my-project',
            userName: 'TestUser',
            workflowStyle: 'quick-flow',
          })
        );
      });
    });

    it('calls initBmadOnly for git-only state', async () => {
      const mockProject = {
        path: '/test/my-project',
        name: 'my-project',
        state: 'fully-initialized',
      };
      (tauriApi.api.initBmadOnly as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProject
      );

      render(InitializeProject, {
        props: { ...defaultProps, currentState: 'git-only' },
      });

      const submitButton = screen.getByRole('button', { name: 'Initialize BMAD' });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(tauriApi.api.initBmadOnly).toHaveBeenCalledWith(
          '/test/my-project',
          expect.any(Object)
        );
      });
    });

    it('calls initGitOnly for bmad-only state', async () => {
      const mockProject = {
        path: '/test/my-project',
        name: 'my-project',
        state: 'fully-initialized',
      };
      (tauriApi.api.initGitOnly as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProject
      );

      render(InitializeProject, {
        props: { ...defaultProps, currentState: 'bmad-only' },
      });

      const submitButton = screen.getByRole('button', { name: 'Initialize Git' });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(tauriApi.api.initGitOnly).toHaveBeenCalledWith('/test/my-project');
      });
    });

    it('calls onComplete after successful initialization', async () => {
      const mockProject = {
        path: '/test/my-project',
        name: 'my-project',
        state: 'fully-initialized',
      };
      (tauriApi.api.initializeProject as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProject
      );

      const onComplete = vi.fn();
      render(InitializeProject, { props: { ...defaultProps, onComplete } });

      const submitButton = screen.getByRole('button', {
        name: 'Initialize Git + BMAD',
      });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('shows error message when initialization fails', async () => {
      (tauriApi.api.initializeProject as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Git initialization failed')
      );

      render(InitializeProject, { props: defaultProps });

      const submitButton = screen.getByRole('button', {
        name: 'Initialize Git + BMAD',
      });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Git initialization failed')).toBeInTheDocument();
      });
    });

    it('shows dismiss button on error', async () => {
      (tauriApi.api.initializeProject as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed')
      );

      render(InitializeProject, { props: defaultProps });

      const submitButton = screen.getByRole('button', {
        name: 'Initialize Git + BMAD',
      });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
      });
    });
  });

  describe('cancel action', () => {
    it('calls onComplete when Cancel is clicked', async () => {
      const onComplete = vi.fn();
      render(InitializeProject, { props: { ...defaultProps, onComplete } });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await fireEvent.click(cancelButton);

      expect(onComplete).toHaveBeenCalled();
    });
  });
});
