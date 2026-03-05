/**
 * Unit tests for TaskListInline component.
 * Tests rendering of task list with various states.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TaskListInline from './TaskListInline.svelte';
import type { StoryTask } from '$lib/types/workflow';

describe('TaskListInline', () => {
  const createTask = (overrides: Partial<StoryTask> = {}): StoryTask => ({
    text: 'Test task',
    completed: false,
    level: 0,
    ...overrides,
  });

  describe('rendering', () => {
    it('renders task list with correct structure', () => {
      const tasks = [createTask({ text: 'Task 1' }), createTask({ text: 'Task 2' })];
      render(TaskListInline, { props: { tasks } });

      expect(screen.getByRole('list', { name: 'Task list' })).toBeInTheDocument();
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });

    it('displays completed tasks with checkmark icon', () => {
      const tasks = [createTask({ text: 'Completed task', completed: true })];
      const { container } = render(TaskListInline, { props: { tasks } });

      // Check for green checkmark icon (completed)
      const checkmarkIcon = container.querySelector('.text-green-500');
      expect(checkmarkIcon).toBeInTheDocument();
    });

    it('displays pending tasks with circle icon', () => {
      const tasks = [createTask({ text: 'Pending task', completed: false })];
      const { container } = render(TaskListInline, { props: { tasks } });

      // Check for gray circle icon (pending) - the icon has the text-gray-500 class on the svg
      const circleIcon = container.querySelector('svg.text-gray-500 circle');
      expect(circleIcon).toBeInTheDocument();
    });

    it('applies line-through style to completed tasks', () => {
      const tasks = [createTask({ text: 'Completed task', completed: true })];
      const { container } = render(TaskListInline, { props: { tasks } });

      const taskText = container.querySelector('.line-through');
      expect(taskText).toBeInTheDocument();
      expect(taskText?.textContent).toBe('Completed task');
    });

    it('indents subtasks (level > 0)', () => {
      const tasks = [
        createTask({ text: 'Parent task', level: 0 }),
        createTask({ text: 'Subtask', level: 1 }),
      ];
      const { container } = render(TaskListInline, { props: { tasks } });

      const listItems = container.querySelectorAll('li');
      expect(listItems[0]).not.toHaveClass('pl-3');
      expect(listItems[1]).toHaveClass('pl-3');
    });
  });

  describe('truncation', () => {
    it('truncates task text with truncate class', () => {
      const tasks = [
        createTask({ text: 'A very long task description that should be truncated' }),
      ];
      const { container } = render(TaskListInline, { props: { tasks } });

      const truncatedText = container.querySelector('.truncate');
      expect(truncatedText).toBeInTheDocument();
    });

    it('limits display to maxDisplay tasks by default (6)', () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTask({ text: `Task ${i + 1}` })
      );
      render(TaskListInline, { props: { tasks } });

      // Should show 6 tasks + "... and X more"
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 6')).toBeInTheDocument();
      expect(screen.queryByText('Task 7')).not.toBeInTheDocument();
      expect(screen.getByText('... and 4 more')).toBeInTheDocument();
    });

    it('respects custom maxDisplay prop', () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTask({ text: `Task ${i + 1}` })
      );
      render(TaskListInline, { props: { tasks, maxDisplay: 3 } });

      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();
      expect(screen.queryByText('Task 4')).not.toBeInTheDocument();
      expect(screen.getByText('... and 7 more')).toBeInTheDocument();
    });

    it('does not show "and X more" when all tasks fit', () => {
      const tasks = [createTask({ text: 'Task 1' }), createTask({ text: 'Task 2' })];
      render(TaskListInline, { props: { tasks } });

      expect(screen.queryByText(/and .* more/)).not.toBeInTheDocument();
    });
  });

  describe('mixed states', () => {
    it('renders mix of completed and pending tasks', () => {
      const tasks = [
        createTask({ text: 'Done task', completed: true }),
        createTask({ text: 'Pending task', completed: false }),
        createTask({ text: 'Another done', completed: true, level: 1 }),
      ];
      const { container } = render(TaskListInline, { props: { tasks } });

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBe(3);

      // Check completed count via icons
      const completedIcons = container.querySelectorAll('.text-green-500');
      expect(completedIcons.length).toBe(2);
    });
  });
});
