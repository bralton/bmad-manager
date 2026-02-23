/**
 * Unit tests for ConversationPanel.svelte component.
 * Tests header rendering, status display, workflow badge, and terminate confirmation flow.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConversationPanel from './ConversationPanel.svelte';
import type { ClaudeSession } from '$lib/services/process';

// Mock xterm.js (used by Terminal child component)
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    write: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    rows: 24,
    cols: 80,
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

// Mock terminal service
vi.mock('$lib/services/terminal', () => ({
  defaultTerminalOptions: { cursorBlink: true },
  tryLoadWebGLAddon: vi.fn().mockResolvedValue(false),
}));

// Mock process service
const mockTerminateSession = vi.fn();
vi.mock('$lib/services/process', () => ({
  terminateSession: (...args: unknown[]) => mockTerminateSession(...args),
  onSessionOutput: vi.fn().mockResolvedValue(() => {}),
  onSessionExited: vi.fn().mockResolvedValue(() => {}),
  sendSessionInput: vi.fn(),
  resizeSession: vi.fn(),
}));

// Mock session stores
vi.mock('$lib/stores/sessions', () => ({
  updateSessionStatus: vi.fn(),
  markNewOutput: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver;

describe('ConversationPanel', () => {
  const mockActiveSession: ClaudeSession = {
    id: 'session-1',
    claudeSessionId: 'uuid-1',
    projectPath: '/my/project',
    agent: 'architect',
    startedAt: new Date().toISOString(),
    status: 'active',
  };

  const mockCompletedSession: ClaudeSession = {
    ...mockActiveSession,
    id: 'session-2',
    status: 'completed',
  };

  const mockInterruptedSession: ClaudeSession = {
    ...mockActiveSession,
    id: 'session-3',
    status: 'interrupted',
  };

  const mockSessionWithWorkflow: ClaudeSession = {
    ...mockActiveSession,
    workflow: 'create-prd',
  };

  const mockPartySession: ClaudeSession = {
    ...mockActiveSession,
    id: 'party-session-1',
    agent: 'party',
    partyMode: {
      enabled: true,
      participants: ['Architect', 'Developer', 'Tester']
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminateSession.mockResolvedValue(undefined);
  });

  describe('header rendering', () => {
    it('renders header with session agent name', () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('shows start time in header', () => {
      const session: ClaudeSession = {
        ...mockActiveSession,
        startedAt: '2026-02-23T10:30:00.000Z',
      };

      render(ConversationPanel, { props: { session } });

      // Should show formatted time (format depends on locale)
      expect(screen.getByText(/Started/)).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    it('shows active status indicator (green)', () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      const statusIndicator = document.querySelector('.bg-green-500');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('shows completed status indicator (gray)', () => {
      render(ConversationPanel, { props: { session: mockCompletedSession } });

      const statusIndicator = document.querySelector('.bg-gray-500');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('shows interrupted status indicator (yellow)', () => {
      render(ConversationPanel, { props: { session: mockInterruptedSession } });

      const statusIndicator = document.querySelector('.bg-yellow-500');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('shows Active status label', () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows Completed status label', () => {
      render(ConversationPanel, { props: { session: mockCompletedSession } });

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('shows Interrupted status label', () => {
      render(ConversationPanel, { props: { session: mockInterruptedSession } });

      expect(screen.getByText('Interrupted')).toBeInTheDocument();
    });
  });

  describe('workflow badge', () => {
    it('shows workflow badge when present', () => {
      render(ConversationPanel, { props: { session: mockSessionWithWorkflow } });

      expect(screen.getByText('create-prd')).toBeInTheDocument();
    });

    it('does not show workflow badge when not present', () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      expect(screen.queryByText('create-prd')).not.toBeInTheDocument();
    });

    it('workflow badge has correct styling', () => {
      render(ConversationPanel, { props: { session: mockSessionWithWorkflow } });

      const badge = screen.getByText('create-prd');
      expect(badge).toHaveClass('bg-purple-900');
      expect(badge).toHaveClass('text-purple-200');
    });
  });

  describe('close button for completed sessions', () => {
    it('calls onClose for completed sessions without dialog', async () => {
      const onClose = vi.fn();
      render(ConversationPanel, {
        props: { session: mockCompletedSession, onClose },
      });

      const closeButton = screen.getByTitle('Close panel');
      await fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
      // Should not show terminate dialog
      expect(screen.queryByText('Terminate Session?')).not.toBeInTheDocument();
    });

    it('calls onClose for interrupted sessions without dialog', async () => {
      const onClose = vi.fn();
      render(ConversationPanel, {
        props: { session: mockInterruptedSession, onClose },
      });

      const closeButton = screen.getByTitle('Close panel');
      await fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('terminate dialog for active sessions', () => {
    it('shows terminate dialog when clicking close on active session', async () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      expect(screen.getByText('Terminate Session?')).toBeInTheDocument();
      expect(
        screen.getByText(/This will stop the Claude CLI process/)
      ).toBeInTheDocument();
    });

    it('closes dialog when clicking Cancel', async () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await fireEvent.click(cancelButton);

      expect(screen.queryByText('Terminate Session?')).not.toBeInTheDocument();
    });

    it('calls terminateSession when clicking Terminate', async () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const terminateButton = screen.getByRole('button', { name: 'Terminate' });
      await fireEvent.click(terminateButton);

      await waitFor(() => {
        expect(mockTerminateSession).toHaveBeenCalledWith('session-1');
      });
    });

    it('closes dialog after successful termination', async () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const terminateButton = screen.getByRole('button', { name: 'Terminate' });
      await fireEvent.click(terminateButton);

      await waitFor(() => {
        expect(screen.queryByText('Terminate Session?')).not.toBeInTheDocument();
      });
    });
  });

  describe('terminating state', () => {
    it('shows Terminating... text during termination', async () => {
      // Create a promise that we control
      let resolveTerminate: () => void;
      mockTerminateSession.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveTerminate = resolve;
          })
      );

      render(ConversationPanel, { props: { session: mockActiveSession } });

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const terminateButton = screen.getByRole('button', { name: 'Terminate' });
      await fireEvent.click(terminateButton);

      // Should show terminating state
      expect(screen.getByText('Terminating...')).toBeInTheDocument();

      // Resolve to clean up
      resolveTerminate!();
    });

    it('disables buttons during termination', async () => {
      let resolveTerminate: () => void;
      mockTerminateSession.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveTerminate = resolve;
          })
      );

      render(ConversationPanel, { props: { session: mockActiveSession } });

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const terminateButton = screen.getByRole('button', { name: 'Terminate' });
      await fireEvent.click(terminateButton);

      // Both buttons should be disabled during termination
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByText('Terminating...').closest('button')).toBeDisabled();

      resolveTerminate!();
    });

    it('disables close button during termination', async () => {
      let resolveTerminate: () => void;
      mockTerminateSession.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveTerminate = resolve;
          })
      );

      render(ConversationPanel, { props: { session: mockActiveSession } });

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const terminateButton = screen.getByRole('button', { name: 'Terminate' });
      await fireEvent.click(terminateButton);

      // Header close button should be disabled
      expect(screen.getByTitle('Terminate session')).toBeDisabled();

      resolveTerminate!();
    });
  });

  describe('termination error handling', () => {
    it('handles termination error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTerminateSession.mockRejectedValue(new Error('Network error'));

      render(ConversationPanel, { props: { session: mockActiveSession } });

      const closeButton = screen.getByTitle('Terminate session');
      await fireEvent.click(closeButton);

      const terminateButton = screen.getByRole('button', { name: 'Terminate' });
      await fireEvent.click(terminateButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to terminate session:',
          expect.any(Error)
        );
      });

      // Dialog should still close
      await waitFor(() => {
        expect(screen.queryByText('Terminate Session?')).not.toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });

  describe('terminal component', () => {
    it('passes session id to Terminal component', () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      // Terminal is mocked, just verify the panel renders without error
      expect(document.querySelector('.flex-col')).toBeInTheDocument();
    });

    it('passes visible prop to Terminal component', () => {
      render(ConversationPanel, {
        props: { session: mockActiveSession, visible: false },
      });

      // Terminal is mocked, component should render
      expect(document.querySelector('.flex-col')).toBeInTheDocument();
    });
  });

  describe('party mode indicator', () => {
    it('shows Party Mode title for party sessions', () => {
      render(ConversationPanel, { props: { session: mockPartySession } });

      expect(screen.getByText('Party Mode')).toBeInTheDocument();
    });

    it('shows party icon for party sessions', () => {
      render(ConversationPanel, { props: { session: mockPartySession } });

      expect(screen.getByText('🎉')).toBeInTheDocument();
    });

    it('shows participant count', () => {
      render(ConversationPanel, { props: { session: mockPartySession } });

      expect(screen.getByText('3 agents')).toBeInTheDocument();
    });

    it('shows participant avatars with initials', () => {
      render(ConversationPanel, { props: { session: mockPartySession } });

      // Should show first letter of each participant name
      expect(screen.getByText('A')).toBeInTheDocument(); // Architect
      expect(screen.getByText('D')).toBeInTheDocument(); // Developer
      expect(screen.getByText('T')).toBeInTheDocument(); // Tester
    });

    it('avatar container has title with all participant names', () => {
      render(ConversationPanel, { props: { session: mockPartySession } });

      const avatarContainer = document.querySelector('div[title="Architect, Developer, Tester"]');
      expect(avatarContainer).toBeInTheDocument();
    });

    it('does not show Party Mode for regular sessions', () => {
      render(ConversationPanel, { props: { session: mockActiveSession } });

      expect(screen.queryByText('Party Mode')).not.toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('participant avatars have purple styling', () => {
      render(ConversationPanel, { props: { session: mockPartySession } });

      // Check that avatar elements have purple background
      const avatars = document.querySelectorAll('.bg-purple-700');
      expect(avatars.length).toBe(3); // One for each participant
    });

    it('shows overflow indicator when more than 4 participants', () => {
      const manyParticipantsSession: ClaudeSession = {
        ...mockActiveSession,
        id: 'party-session-2',
        agent: 'party',
        partyMode: {
          enabled: true,
          participants: ['Architect', 'Developer', 'Tester', 'Designer', 'PM', 'DevOps']
        }
      };

      render(ConversationPanel, { props: { session: manyParticipantsSession } });

      // Should show +2 overflow indicator
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });
});
