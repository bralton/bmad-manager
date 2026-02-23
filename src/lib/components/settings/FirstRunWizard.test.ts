/**
 * Unit tests for FirstRunWizard.svelte component.
 * Tests step navigation, form rendering, completion flow, and validation.
 */

import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FirstRunWizard from './FirstRunWizard.svelte';
import type { DependencyStatus } from '$lib/types/settings';
import * as settingsStore from '$lib/stores/settings';

// Mock the settings store
const mockCheckDependencies = vi.fn();
const mockCompleteWizard = vi.fn();

vi.mock('$lib/stores/settings', async () => {
  const { writable, derived } = await import('svelte/store');

  // Create mock dependencies data
  const mockDeps: DependencyStatus[] = [
    {
      name: 'Git',
      installed: true,
      versionOk: true,
      version: '2.40.0',
      minVersion: '2.0.0',
      installCommand: null,
    },
    {
      name: 'Node.js',
      installed: true,
      versionOk: true,
      version: '20.0.0',
      minVersion: '18.0.0',
      installCommand: null,
    },
    {
      name: 'Claude CLI',
      installed: true,
      versionOk: true,
      version: '1.0.0',
      minVersion: '1.0.0',
      installCommand: null,
    },
  ];

  const dependencies = writable(mockDeps);
  const dependenciesLoading = writable(false);
  const dependenciesError = writable<string | null>(null);
  const allDependenciesSatisfied = derived(dependencies, ($deps) =>
    $deps.every((d) => d.installed && d.versionOk)
  );
  const settings = writable({
    user: { name: 'ExistingUser' },
    bmad: { default_workflow: 'QuickFlow' },
    tools: { ide_command: 'code .' },
  });

  return {
    dependencies,
    dependenciesLoading,
    dependenciesError,
    allDependenciesSatisfied,
    settings,
    checkDependencies: vi.fn(),
    completeWizard: vi.fn(),
  };
});

describe('FirstRunWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('initial step', () => {
    it('renders BMAD Manager Setup heading', () => {
      render(FirstRunWizard);

      expect(screen.getByText('BMAD Manager Setup')).toBeInTheDocument();
    });

    it('shows Step 1 of 3', () => {
      render(FirstRunWizard);

      expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument();
    });

    it('shows Check Dependencies step title', () => {
      render(FirstRunWizard);

      // Text is split across elements in "Step 1 of 3: Check Dependencies"
      expect(screen.getByText(/Check Dependencies/)).toBeInTheDocument();
    });

    it('shows dependency list', () => {
      render(FirstRunWizard);

      expect(screen.getByText('Git')).toBeInTheDocument();
      expect(screen.getByText('Node.js')).toBeInTheDocument();
      expect(screen.getByText('Claude CLI')).toBeInTheDocument();
    });

    it('shows Re-check Dependencies button', () => {
      render(FirstRunWizard);

      expect(
        screen.getByRole('button', { name: 'Re-check Dependencies' })
      ).toBeInTheDocument();
    });

    it('shows Next button', () => {
      render(FirstRunWizard);

      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    });

    it('does not show Back button on first step', () => {
      render(FirstRunWizard);

      expect(
        screen.queryByRole('button', { name: 'Back' })
      ).not.toBeInTheDocument();
    });
  });

  describe('step navigation', () => {
    it('clicking Next moves to step 2', async () => {
      render(FirstRunWizard);

      const nextButton = screen.getByRole('button', { name: 'Next' });
      await fireEvent.click(nextButton);

      expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();
      expect(screen.getByText(/Your Profile/)).toBeInTheDocument();
    });

    it('clicking Back from step 2 returns to step 1', async () => {
      render(FirstRunWizard);

      // Go to step 2
      const nextButton = screen.getByRole('button', { name: 'Next' });
      await fireEvent.click(nextButton);

      // Go back to step 1
      const backButton = screen.getByRole('button', { name: 'Back' });
      await fireEvent.click(backButton);

      expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument();
    });

    it('navigating to step 3 shows Confirmation', async () => {
      render(FirstRunWizard);

      // Go to step 2
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      // Go to step 3
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByText(/Step 3 of 3/)).toBeInTheDocument();
      expect(screen.getByText(/Confirmation/)).toBeInTheDocument();
    });
  });

  describe('step 2 - profile form', () => {
    beforeEach(async () => {
      render(FirstRunWizard);
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    });

    it('renders Your Name input', () => {
      expect(screen.getByLabelText('Your Name')).toBeInTheDocument();
    });

    it('renders Default Workflow Style select', () => {
      expect(screen.getByLabelText('Default Workflow Style')).toBeInTheDocument();
    });

    it('renders IDE Command input', () => {
      expect(screen.getByLabelText('IDE Command (optional)')).toBeInTheDocument();
    });

    it('pre-fills name from existing settings', () => {
      const nameInput = screen.getByLabelText('Your Name') as HTMLInputElement;
      expect(nameInput.value).toBe('ExistingUser');
    });

    it('shows character count', () => {
      expect(screen.getByText(/\/100 characters/)).toBeInTheDocument();
    });
  });

  describe('step 3 - confirmation', () => {
    beforeEach(async () => {
      render(FirstRunWizard);
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    });

    it('shows Setup Summary heading', () => {
      expect(screen.getByText('Setup Summary')).toBeInTheDocument();
    });

    it('shows Complete Setup button', () => {
      expect(
        screen.getByRole('button', { name: 'Complete Setup' })
      ).toBeInTheDocument();
    });

    it('shows user settings summary', () => {
      expect(screen.getByText('Name:')).toBeInTheDocument();
      expect(screen.getByText('Workflow:')).toBeInTheDocument();
      expect(screen.getByText('IDE:')).toBeInTheDocument();
    });

    it('shows dependencies satisfied message', () => {
      expect(screen.getByText('All dependencies satisfied')).toBeInTheDocument();
    });
  });

  describe('completion flow', () => {
    it('clicking Complete Setup calls completeWizard', async () => {
      render(FirstRunWizard);

      // Navigate to step 3
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      // Click Complete Setup
      await fireEvent.click(screen.getByRole('button', { name: 'Complete Setup' }));

      await waitFor(() => {
        expect(settingsStore.completeWizard).toHaveBeenCalled();
      });
    });
  });

  describe('form validation', () => {
    it('disables Next button when name is empty', async () => {
      render(FirstRunWizard);
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      const nameInput = screen.getByLabelText('Your Name') as HTMLInputElement;
      await fireEvent.input(nameInput, { target: { value: '' } });

      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton).toBeDisabled();
    });

    it('enables Next button when name is provided', async () => {
      render(FirstRunWizard);
      await fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      const nameInput = screen.getByLabelText('Your Name') as HTMLInputElement;
      await fireEvent.input(nameInput, { target: { value: 'TestUser' } });

      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('modal structure', () => {
    it('renders as a modal overlay', () => {
      render(FirstRunWizard);

      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay).toBeInTheDocument();
    });

    it('renders modal content card', () => {
      render(FirstRunWizard);

      const card = document.querySelector('.bg-gray-800.rounded-lg');
      expect(card).toBeInTheDocument();
    });
  });
});
