/**
 * Tests for ProjectSettingsForm component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import ProjectSettingsForm from './ProjectSettingsForm.svelte';
import type { GlobalSettings, ProjectSettings } from '$lib/types/settings';

// Test data
const mockGlobalSettings: GlobalSettings = {
  wizard_completed: true,
  user: { name: 'TestUser' },
  bmad: { default_workflow: 'QuickFlow' },
  tools: { ide_command: 'code .' },
  git: { branch_pattern: 'story/{story_id}-{slug}', worktree_location: 'sibling' },
  ui: { theme: 'dark', show_agent_icons: true },
};

const mockProjectSettings: ProjectSettings = {
  branchPattern: undefined,
  worktreeLocation: undefined,
  ideCommand: undefined,
};

describe('ProjectSettingsForm', () => {
  let onUpdate: ReturnType<typeof vi.fn>;
  let onValidChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    onUpdate = vi.fn();
    onValidChange = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders override info message', async () => {
    render(ProjectSettingsForm, {
      props: {
        settings: mockProjectSettings,
        globalSettings: mockGlobalSettings,
        onUpdate,
        onValidChange,
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Override global settings/i)).toBeInTheDocument();
    });
  });

  it('shows global values as placeholders', async () => {
    render(ProjectSettingsForm, {
      props: {
        settings: mockProjectSettings,
        globalSettings: mockGlobalSettings,
        onUpdate,
        onValidChange,
      },
    });

    await waitFor(() => {
      // The IDE command input should show global value as placeholder
      const ideInput = screen.getByLabelText('IDE Command Override') as HTMLInputElement;
      expect(ideInput.placeholder).toBe('code .');

      // Check the "Using global" text
      expect(screen.getAllByText(/Using global/i).length).toBeGreaterThan(0);
    });
  });

  it('calls onUpdate when override is set', async () => {
    render(ProjectSettingsForm, {
      props: {
        settings: mockProjectSettings,
        globalSettings: mockGlobalSettings,
        onUpdate,
        onValidChange,
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('IDE Command Override')).toBeInTheDocument();
    });

    const ideInput = screen.getByLabelText('IDE Command Override');
    await fireEvent.input(ideInput, { target: { value: 'cursor .' } });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.ideCommand).toBe('cursor .');
    });
  });

  it('clears override when clear button is clicked', async () => {
    const settingsWithOverride: ProjectSettings = {
      branchPattern: undefined,
      worktreeLocation: undefined,
      ideCommand: 'cursor .',
    };

    render(ProjectSettingsForm, {
      props: {
        settings: settingsWithOverride,
        globalSettings: mockGlobalSettings,
        onUpdate,
        onValidChange,
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Clear IDE command override')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByLabelText('Clear IDE command override'));

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.ideCommand).toBeUndefined();
    });
  });

  it('validates branch pattern override when set', async () => {
    render(ProjectSettingsForm, {
      props: {
        settings: mockProjectSettings,
        globalSettings: mockGlobalSettings,
        onUpdate,
        onValidChange,
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Branch Pattern Override')).toBeInTheDocument();
    });

    const patternInput = screen.getByLabelText('Branch Pattern Override');
    await fireEvent.input(patternInput, { target: { value: 'invalid-pattern' } });

    await waitFor(() => {
      expect(screen.getByText('Pattern must include {story_id} or {slug}')).toBeInTheDocument();
      expect(onValidChange).toHaveBeenCalledWith(false);
    });
  });

  it('accepts valid branch pattern override', async () => {
    render(ProjectSettingsForm, {
      props: {
        settings: mockProjectSettings,
        globalSettings: mockGlobalSettings,
        onUpdate,
        onValidChange,
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Branch Pattern Override')).toBeInTheDocument();
    });

    const patternInput = screen.getByLabelText('Branch Pattern Override');
    await fireEvent.input(patternInput, { target: { value: 'feature/{story_id}' } });

    await waitFor(() => {
      // Should not show error
      expect(screen.queryByText('Pattern must include {story_id} or {slug}')).not.toBeInTheDocument();
      expect(onValidChange).toHaveBeenCalledWith(true);
    });
  });

  it('shows worktree location dropdown with "Use Global" option', async () => {
    render(ProjectSettingsForm, {
      props: {
        settings: mockProjectSettings,
        globalSettings: mockGlobalSettings,
        onUpdate,
        onValidChange,
      },
    });

    await waitFor(() => {
      const locationSelect = screen.getByLabelText('Worktree Location Override') as HTMLSelectElement;
      expect(locationSelect).toBeInTheDocument();

      // Check the "Use Global" option exists
      const options = Array.from(locationSelect.options);
      expect(options.some(opt => opt.textContent?.includes('Use Global'))).toBe(true);
    });
  });

  it('updates worktree location when selected', async () => {
    render(ProjectSettingsForm, {
      props: {
        settings: mockProjectSettings,
        globalSettings: mockGlobalSettings,
        onUpdate,
        onValidChange,
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Worktree Location Override')).toBeInTheDocument();
    });

    const locationSelect = screen.getByLabelText('Worktree Location Override');
    await fireEvent.change(locationSelect, { target: { value: 'subdirectory' } });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.worktreeLocation).toBe('subdirectory');
    });
  });
});
