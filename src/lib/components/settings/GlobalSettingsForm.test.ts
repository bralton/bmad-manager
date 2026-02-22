/**
 * Tests for GlobalSettingsForm component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import GlobalSettingsForm from './GlobalSettingsForm.svelte';
import type { GlobalSettings } from '$lib/types/settings';

// Test data
const mockSettings: GlobalSettings = {
  wizard_completed: true,
  user: { name: 'TestUser' },
  bmad: { default_workflow: 'QuickFlow' },
  tools: { ide_command: 'code .' },
  git: { branch_pattern: 'story/{story_id}-{slug}', worktree_location: 'sibling' },
  ui: { theme: 'dark', show_agent_icons: true },
};

describe('GlobalSettingsForm', () => {
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

  it('renders all form sections', async () => {
    render(GlobalSettingsForm, {
      props: { settings: mockSettings, onUpdate, onValidChange },
    });

    await waitFor(() => {
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('Git')).toBeInTheDocument();
    });
  });

  it('displays initial values from settings', async () => {
    render(GlobalSettingsForm, {
      props: { settings: mockSettings, onUpdate, onValidChange },
    });

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
      expect(nameInput.value).toBe('TestUser');

      const ideInput = screen.getByLabelText('IDE Command') as HTMLInputElement;
      expect(ideInput.value).toBe('code .');

      const themeSelect = screen.getByLabelText('Theme') as HTMLSelectElement;
      expect(themeSelect.value).toBe('dark');
    });
  });

  it('calls onUpdate when field changes', async () => {
    render(GlobalSettingsForm, {
      props: { settings: mockSettings, onUpdate, onValidChange },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Name');
    await fireEvent.input(nameInput, { target: { value: 'NewUser' } });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.user.name).toBe('NewUser');
    });
  });

  it('shows validation error for empty user name', async () => {
    render(GlobalSettingsForm, {
      props: { settings: mockSettings, onUpdate, onValidChange },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Name');
    await fireEvent.input(nameInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByText('User name is required')).toBeInTheDocument();
      expect(onValidChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows validation error for branch pattern without placeholders', async () => {
    render(GlobalSettingsForm, {
      props: { settings: mockSettings, onUpdate, onValidChange },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Branch Pattern')).toBeInTheDocument();
    });

    const patternInput = screen.getByLabelText('Branch Pattern');
    await fireEvent.input(patternInput, { target: { value: 'feature/test' } });

    await waitFor(() => {
      expect(screen.getByText('Pattern must include {story_id} or {slug}')).toBeInTheDocument();
      expect(onValidChange).toHaveBeenCalledWith(false);
    });
  });

  it('calls onValidChange with true when all fields valid', async () => {
    render(GlobalSettingsForm, {
      props: { settings: mockSettings, onUpdate, onValidChange },
    });

    // Initial load should be valid
    await waitFor(() => {
      expect(onValidChange).toHaveBeenCalledWith(true);
    });
  });

  it('updates theme when dropdown changes', async () => {
    render(GlobalSettingsForm, {
      props: { settings: mockSettings, onUpdate, onValidChange },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Theme')).toBeInTheDocument();
    });

    const themeSelect = screen.getByLabelText('Theme');
    await fireEvent.change(themeSelect, { target: { value: 'light' } });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.ui.theme).toBe('light');
    });
  });

  it('toggles show agent icons checkbox', async () => {
    render(GlobalSettingsForm, {
      props: { settings: mockSettings, onUpdate, onValidChange },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Show agent icons in roster')).toBeInTheDocument();
    });

    const checkbox = screen.getByLabelText('Show agent icons in roster') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    await fireEvent.click(checkbox);

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.ui.show_agent_icons).toBe(false);
    });
  });
});
