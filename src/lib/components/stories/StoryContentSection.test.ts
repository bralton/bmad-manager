/**
 * Unit tests for StoryContentSection component.
 * Story 5-13: Story Detail Panel - Full Content View
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StoryContentSection from './StoryContentSection.svelte';

describe('StoryContentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('displays section title', () => {
      render(StoryContentSection, {
        props: { title: 'Test Section', content: 'Test content' },
      });

      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    it('shows content when defaultExpanded is true', () => {
      render(StoryContentSection, {
        props: { title: 'Story', content: 'As a user, I want...', defaultExpanded: true },
      });

      expect(screen.getByText('As a user, I want...')).toBeInTheDocument();
    });

    it('hides content when defaultExpanded is false', () => {
      render(StoryContentSection, {
        props: { title: 'Dev Notes', content: 'Hidden content', defaultExpanded: false },
      });

      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse', () => {
    it('toggles content visibility on click', async () => {
      render(StoryContentSection, {
        props: { title: 'Story', content: 'Toggle me', defaultExpanded: false },
      });

      // Initially hidden
      expect(screen.queryByText('Toggle me')).not.toBeInTheDocument();

      // Click to expand
      const header = screen.getByText('Story');
      await fireEvent.click(header);

      // Now visible
      expect(screen.getByText('Toggle me')).toBeInTheDocument();

      // Click to collapse
      await fireEvent.click(header);

      // Hidden again
      expect(screen.queryByText('Toggle me')).not.toBeInTheDocument();
    });

    it('expands on Enter key', async () => {
      render(StoryContentSection, {
        props: { title: 'Story', content: 'Keyboard test', defaultExpanded: false },
      });

      const button = screen.getByRole('button');
      await fireEvent.keyDown(button, { key: 'Enter' });

      expect(screen.getByText('Keyboard test')).toBeInTheDocument();
    });

    it('expands on Space key', async () => {
      render(StoryContentSection, {
        props: { title: 'Story', content: 'Space key test', defaultExpanded: false },
      });

      const button = screen.getByRole('button');
      await fireEvent.keyDown(button, { key: ' ' });

      expect(screen.getByText('Space key test')).toBeInTheDocument();
    });
  });

  describe('task rendering (AC2)', () => {
    it('renders tasks with checkboxes when showTasks is true', async () => {
      const taskContent = '- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3';
      render(StoryContentSection, {
        props: { title: 'Tasks', content: taskContent, defaultExpanded: true, showTasks: true },
      });

      // Should see task text
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();

      // Should have task list
      expect(screen.getByRole('list', { name: 'Task list' })).toBeInTheDocument();
    });

    it('applies completed styling to checked tasks', async () => {
      const taskContent = '- [x] Completed task';
      render(StoryContentSection, {
        props: { title: 'Tasks', content: taskContent, defaultExpanded: true, showTasks: true },
      });

      const taskText = screen.getByText('Completed task');
      expect(taskText).toHaveClass('line-through');
      expect(taskText).toHaveClass('text-gray-500');
    });

    it('does not apply completed styling to unchecked tasks', async () => {
      const taskContent = '- [ ] Pending task';
      render(StoryContentSection, {
        props: { title: 'Tasks', content: taskContent, defaultExpanded: true, showTasks: true },
      });

      const taskText = screen.getByText('Pending task');
      expect(taskText).not.toHaveClass('line-through');
    });

    it('handles indented subtasks', async () => {
      const taskContent = '- [ ] Parent task\n  - [ ] Subtask 1\n  - [x] Subtask 2';
      render(StoryContentSection, {
        props: { title: 'Tasks', content: taskContent, defaultExpanded: true, showTasks: true },
      });

      expect(screen.getByText('Parent task')).toBeInTheDocument();
      expect(screen.getByText('Subtask 1')).toBeInTheDocument();
      expect(screen.getByText('Subtask 2')).toBeInTheDocument();
    });

    it('renders as plain text when showTasks is false', async () => {
      const taskContent = '- [ ] Task 1\n- [x] Task 2';
      render(StoryContentSection, {
        props: { title: 'Story', content: taskContent, defaultExpanded: true, showTasks: false },
      });

      // Should render as plain text, not as task list
      expect(screen.queryByRole('list', { name: 'Task list' })).not.toBeInTheDocument();
      // Content should still be visible
      expect(screen.getByText(/Task 1/)).toBeInTheDocument();
    });

    it('handles tasks without trailing space after checkbox', async () => {
      // Edge case: "- [ ]Task" instead of "- [ ] Task"
      const taskContent = '- [ ]No space task\n- [x]Completed no space';
      render(StoryContentSection, {
        props: { title: 'Tasks', content: taskContent, defaultExpanded: true, showTasks: true },
      });

      expect(screen.getByText('No space task')).toBeInTheDocument();
      expect(screen.getByText('Completed no space')).toBeInTheDocument();
    });

    it('handles empty task text gracefully', async () => {
      const taskContent = '- [ ] \n- [x] ';
      render(StoryContentSection, {
        props: { title: 'Tasks', content: taskContent, defaultExpanded: true, showTasks: true },
      });

      // Should have task list but with empty text items
      expect(screen.getByRole('list', { name: 'Task list' })).toBeInTheDocument();
    });

    it('handles mixed list markers (* and -)', async () => {
      const taskContent = '- [ ] Dash task\n* [ ] Asterisk task\n- [x] Dash completed\n* [X] Asterisk completed';
      render(StoryContentSection, {
        props: { title: 'Tasks', content: taskContent, defaultExpanded: true, showTasks: true },
      });

      expect(screen.getByText('Dash task')).toBeInTheDocument();
      expect(screen.getByText('Asterisk task')).toBeInTheDocument();
      expect(screen.getByText('Dash completed')).toBeInTheDocument();
      expect(screen.getByText('Asterisk completed')).toBeInTheDocument();
    });

    it('handles deeply nested tasks', async () => {
      // 8 spaces = level 4 indentation
      const taskContent = '- [ ] Level 0\n  - [ ] Level 1\n    - [ ] Level 2\n      - [ ] Level 3\n        - [ ] Level 4';
      render(StoryContentSection, {
        props: { title: 'Tasks', content: taskContent, defaultExpanded: true, showTasks: true },
      });

      expect(screen.getByText('Level 0')).toBeInTheDocument();
      expect(screen.getByText('Level 4')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has button role on header', () => {
      render(StoryContentSection, {
        props: { title: 'Story', content: 'Content', defaultExpanded: false },
      });

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has aria-expanded attribute', async () => {
      render(StoryContentSection, {
        props: { title: 'Story', content: 'Content', defaultExpanded: false },
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('scrolling (AC3)', () => {
    it('content area has overflow-y-auto for scrolling', async () => {
      const { container } = render(StoryContentSection, {
        props: { title: 'Story', content: 'Long content', defaultExpanded: true },
      });

      // Find the content container with scroll classes (the outer container)
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('content area has max height for scrolling', async () => {
      const { container } = render(StoryContentSection, {
        props: { title: 'Story', content: 'Long content', defaultExpanded: true },
      });

      const maxHeightContainer = container.querySelector('.max-h-64');
      expect(maxHeightContainer).toBeInTheDocument();
    });
  });
});
