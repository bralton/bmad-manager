/**
 * Tests for EmptyState component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EmptyState from './EmptyState.svelte';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(EmptyState, {
      props: {
        title: 'No sessions yet',
        description: 'Start a conversation with an agent to begin.',
      },
    });
    expect(screen.getByText('No sessions yet')).toBeTruthy();
    expect(screen.getByText('Start a conversation with an agent to begin.')).toBeTruthy();
  });

  it('renders action button when actionLabel and onAction are provided', async () => {
    const onAction = vi.fn();
    render(EmptyState, {
      props: {
        title: 'No results',
        description: 'Try different keywords.',
        actionLabel: 'Clear Search',
        onAction,
      },
    });

    const button = screen.getByText('Clear Search');
    expect(button).toBeTruthy();

    await fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when actionLabel is not provided', () => {
    render(EmptyState, {
      props: {
        title: 'No data',
        description: 'Nothing to display.',
      },
    });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render action button when only actionLabel is provided without onAction', () => {
    render(EmptyState, {
      props: {
        title: 'No data',
        description: 'Nothing to display.',
        actionLabel: 'Click me',
        // onAction is not provided
      },
    });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders chat icon when icon is "chat"', () => {
    render(EmptyState, {
      props: {
        icon: 'chat',
        title: 'No sessions',
        description: 'Start chatting.',
      },
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
    // Chat icon has speech bubble path
    expect(svg?.querySelector('path')).toBeTruthy();
  });

  it('renders clipboard icon when icon is "clipboard"', () => {
    render(EmptyState, {
      props: {
        icon: 'clipboard',
        title: 'No stories',
        description: 'Create a story.',
      },
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders search icon when icon is "search"', () => {
    render(EmptyState, {
      props: {
        icon: 'search',
        title: 'No results',
        description: 'Try again.',
      },
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders person icon when icon is "person"', () => {
    render(EmptyState, {
      props: {
        icon: 'person',
        title: 'No agents',
        description: 'Open a project.',
      },
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders workflow icon when icon is "workflow"', () => {
    render(EmptyState, {
      props: {
        icon: 'workflow',
        title: 'No workflow',
        description: 'Start a workflow.',
      },
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders document icon when icon is "document"', () => {
    render(EmptyState, {
      props: {
        icon: 'document',
        title: 'No artifacts',
        description: 'Create artifacts.',
      },
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders branch icon when icon is "branch"', () => {
    render(EmptyState, {
      props: {
        icon: 'branch',
        title: 'No worktree',
        description: 'Create a worktree.',
      },
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('does not render icon when icon prop is not provided', () => {
    render(EmptyState, {
      props: {
        title: 'Empty',
        description: 'No content.',
      },
    });

    const svg = document.querySelector('svg');
    expect(svg).toBeNull();
  });

  it('has proper accessibility attributes', () => {
    render(EmptyState, {
      props: {
        title: 'No data available',
        description: 'Nothing to show.',
      },
    });

    const container = screen.getByRole('status');
    expect(container).toBeTruthy();
    expect(container.getAttribute('aria-label')).toBe('No data available');
  });

  it('renders secondary description when provided', () => {
    render(EmptyState, {
      props: {
        title: 'No artifacts found',
        description: 'Artifacts will appear here.',
        secondaryDescription: 'Expected locations: _bmad-output/',
      },
    });

    expect(screen.getByText('Expected locations: _bmad-output/')).toBeTruthy();
  });

  it('applies centered layout styles', () => {
    const { container } = render(EmptyState, {
      props: {
        title: 'Test',
        description: 'Test description.',
      },
    });

    const element = container.querySelector('[role="status"]');
    expect(element?.className).toContain('flex');
    expect(element?.className).toContain('flex-col');
    expect(element?.className).toContain('items-center');
    expect(element?.className).toContain('justify-center');
  });
});
