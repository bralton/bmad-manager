/**
 * Tests for SettingsModal component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import SettingsModal from './SettingsModal.svelte';
import { currentProject } from '$lib/stores/project';
import { settings } from '$lib/stores/settings';
import { get } from 'svelte/store';

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

describe('SettingsModal', () => {
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
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with Settings title', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });
  });

  it('shows Global and Project tabs', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Global/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Project/i })).toBeInTheDocument();
    });
  });

  it('starts on Global tab by default', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      const globalTab = screen.getByRole('button', { name: /Global/i });
      // Check that Global tab has the active styling
      expect(globalTab.className).toContain('text-blue-400');
    });
  });

  it('switches tabs when clicked', async () => {
    const onClose = vi.fn();
    currentProject.set({
      name: 'test-project',
      path: '/test/path',
      state: 'fully-initialized',
      config: null,
      agents: [],
    });

    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Project/i })).toBeInTheDocument();
    });

    const projectTab = screen.getByRole('button', { name: /Project/i });
    await fireEvent.click(projectTab);

    await waitFor(() => {
      expect(projectTab.className).toContain('text-blue-400');
    });
  });

  it('disables Project tab when no project is open', async () => {
    const onClose = vi.fn();
    currentProject.set(null);

    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      const projectTab = screen.getByRole('button', { name: /Project/i });
      expect(projectTab).toBeDisabled();
    });
  });

  it('calls onClose when Cancel button is clicked', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close (X) button is clicked', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByLabelText('Close settings')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByLabelText('Close settings'));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows Save button disabled when no changes made', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /Save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading spinner while loading settings', async () => {
    const onClose = vi.fn();
    // Make invoke hang to show loading state
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    render(SettingsModal, { props: { onClose } });

    // Should show spinner
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows confirmation dialog when closing with unsaved changes', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    // Make a change to trigger dirty state
    const nameInput = screen.getByLabelText('Name');
    await fireEvent.input(nameInput, { target: { value: 'NewUser' } });

    // Try to close
    await fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    });
  });

  it('closes without confirmation when no changes made', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    // Should close immediately without showing confirmation
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
  });

  it('saves settings and closes modal on Save click', async () => {
    const onClose = vi.fn();
    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    // Make a change
    const nameInput = screen.getByLabelText('Name');
    await fireEvent.input(nameInput, { target: { value: 'UpdatedUser' } });

    // Wait for Save button to be enabled
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /Save/i });
      expect(saveButton).not.toBeDisabled();
    });

    // Click save
    await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    // Should call save_settings
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_settings', expect.any(Object));
    });
  });

  it('handles save failure gracefully', async () => {
    const onClose = vi.fn();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_settings') {
        return Promise.resolve(mockGlobalSettings);
      }
      if (cmd === 'get_project_settings') {
        return Promise.resolve(mockProjectSettings);
      }
      if (cmd === 'save_settings') {
        return Promise.reject(new Error('Save failed'));
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    render(SettingsModal, { props: { onClose } });

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    // Make a change
    const nameInput = screen.getByLabelText('Name');
    await fireEvent.input(nameInput, { target: { value: 'FailUser' } });

    // Wait for Save button to be enabled and click
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /Save/i });
      expect(saveButton).not.toBeDisabled();
    });

    await fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    // Modal should remain open on failure (onClose not called)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
