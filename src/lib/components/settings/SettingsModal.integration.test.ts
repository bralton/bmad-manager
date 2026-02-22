/**
 * Integration tests for settings persistence flow.
 * Tests the full flow from SettingsModal through to API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import SettingsModal from './SettingsModal.svelte';
import { currentProject } from '$lib/stores/project';
import { settings } from '$lib/stores/settings';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Import invoke after mocking
import { invoke } from '@tauri-apps/api/core';
const mockInvoke = invoke as ReturnType<typeof vi.fn>;

// Test data
const mockGlobalSettings = {
  wizard_completed: true,
  user: { name: 'TestUser' },
  bmad: { default_workflow: 'QuickFlow' as const },
  tools: { ide_command: 'code .' },
  git: { branch_pattern: 'story/{story_id}-{slug}', worktree_location: 'sibling' },
  ui: { theme: 'dark', show_agent_icons: true },
};

const mockProjectSettings = {
  branchPattern: undefined,
  worktreeLocation: undefined,
  ideCommand: undefined,
};

describe('Settings Persistence Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();

    // Set up default mock responses
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_settings') {
        return Promise.resolve(mockGlobalSettings);
      }
      if (cmd === 'get_project_settings') {
        return Promise.resolve(mockProjectSettings);
      }
      if (cmd === 'save_settings') {
        return Promise.resolve();
      }
      if (cmd === 'save_project_settings') {
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    // Set up stores
    settings.set(mockGlobalSettings);
    currentProject.set(null);
  });

  afterEach(() => {
    cleanup();
    currentProject.set(null);
  });

  describe('Global Settings Persistence', () => {
    it('loads global settings on mount', async () => {
      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_settings');
      });

      // Form should show loaded values
      await waitFor(() => {
        const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
        expect(nameInput.value).toBe('TestUser');
      });
    });

    it('saves global settings with correct data', async () => {
      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
      });

      // Change the user name
      const nameInput = screen.getByLabelText('Name');
      await fireEvent.input(nameInput, { target: { value: 'UpdatedUser' } });

      // Click save
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).not.toBeDisabled();
      });

      await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

      // Verify save was called with updated settings
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('save_settings', {
          settingsData: expect.objectContaining({
            user: { name: 'UpdatedUser' },
          }),
        });
      });
    });

    it('closes modal after successful save', async () => {
      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
      });

      // Make a change
      const nameInput = screen.getByLabelText('Name');
      await fireEvent.input(nameInput, { target: { value: 'NewUser' } });

      // Save
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).not.toBeDisabled();
      });

      await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

      // Modal should close
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('preserves all settings fields during save', async () => {
      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
      });

      // Change only the name
      const nameInput = screen.getByLabelText('Name');
      await fireEvent.input(nameInput, { target: { value: 'ChangedName' } });

      // Save
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).not.toBeDisabled();
      });

      await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

      // Verify all original fields are preserved
      await waitFor(() => {
        const saveCall = mockInvoke.mock.calls.find(
          (call) => call[0] === 'save_settings'
        );
        expect(saveCall).toBeDefined();
        const savedData = saveCall![1].settingsData;

        // Changed field
        expect(savedData.user.name).toBe('ChangedName');

        // Preserved fields
        expect(savedData.wizard_completed).toBe(true);
        expect(savedData.bmad.default_workflow).toBe('QuickFlow');
        expect(savedData.tools.ide_command).toBe('code .');
        expect(savedData.git.branch_pattern).toBe('story/{story_id}-{slug}');
        expect(savedData.git.worktree_location).toBe('sibling');
        expect(savedData.ui.theme).toBe('dark');
        expect(savedData.ui.show_agent_icons).toBe(true);
      });
    });
  });

  describe('Project Settings Persistence', () => {
    const mockProject = {
      name: 'test-project',
      path: '/test/path',
      state: 'fully-initialized' as const,
      config: null,
      agents: [],
    };

    beforeEach(() => {
      currentProject.set(mockProject);
    });

    it('loads project settings when project is open', async () => {
      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_project_settings', {
          projectPath: '/test/path',
        });
      });
    });

    it('saves project settings with correct project path', async () => {
      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Project/i })).toBeInTheDocument();
      });

      // Switch to project tab
      await fireEvent.click(screen.getByRole('button', { name: /Project/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('IDE Command Override')).toBeInTheDocument();
      });

      // Set a project-specific override
      const ideInput = screen.getByLabelText('IDE Command Override');
      await fireEvent.input(ideInput, { target: { value: 'cursor .' } });

      // Save
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).not.toBeDisabled();
      });

      await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

      // Verify project settings were saved
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('save_project_settings', {
          projectPath: '/test/path',
          settingsData: expect.objectContaining({
            ideCommand: 'cursor .',
          }),
        });
      });
    });

    it('saves both global and project settings when both changed', async () => {
      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      // Change global setting
      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('Name');
      await fireEvent.input(nameInput, { target: { value: 'BothChanged' } });

      // Switch to project tab and change project setting
      await fireEvent.click(screen.getByRole('button', { name: /Project/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('IDE Command Override')).toBeInTheDocument();
      });

      const ideInput = screen.getByLabelText('IDE Command Override');
      await fireEvent.input(ideInput, { target: { value: 'both .' } });

      // Save
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).not.toBeDisabled();
      });

      await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

      // Both should be called
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('save_settings', expect.any(Object));
        expect(mockInvoke).toHaveBeenCalledWith('save_project_settings', expect.any(Object));
      });
    });
  });

  describe('Error Handling', () => {
    it('keeps modal open when global save fails', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_settings') return Promise.resolve(mockGlobalSettings);
        if (cmd === 'get_project_settings') return Promise.resolve(mockProjectSettings);
        if (cmd === 'save_settings') return Promise.reject(new Error('Network error'));
        return Promise.reject(new Error(`Unknown: ${cmd}`));
      });

      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('Name');
      await fireEvent.input(nameInput, { target: { value: 'FailTest' } });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).not.toBeDisabled();
      });

      await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

      // Modal should remain open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it('keeps modal open when project save fails', async () => {
      const mockProject = {
        name: 'test-project',
        path: '/test/path',
        state: 'fully-initialized' as const,
        config: null,
        agents: [],
      };
      currentProject.set(mockProject);

      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_settings') return Promise.resolve(mockGlobalSettings);
        if (cmd === 'get_project_settings') return Promise.resolve(mockProjectSettings);
        if (cmd === 'save_settings') return Promise.resolve();
        if (cmd === 'save_project_settings') return Promise.reject(new Error('Disk full'));
        return Promise.reject(new Error(`Unknown: ${cmd}`));
      });

      const onClose = vi.fn();
      render(SettingsModal, { props: { onClose } });

      // Switch to project tab
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Project/i })).toBeInTheDocument();
      });

      await fireEvent.click(screen.getByRole('button', { name: /Project/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('IDE Command Override')).toBeInTheDocument();
      });

      const ideInput = screen.getByLabelText('IDE Command Override');
      await fireEvent.input(ideInput, { target: { value: 'fail .' } });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).not.toBeDisabled();
      });

      await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

      // Modal should remain open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
      });
    });
  });
});
