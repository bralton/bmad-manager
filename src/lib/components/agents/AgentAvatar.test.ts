/**
 * Unit tests for AgentAvatar.svelte component.
 * Tests avatar rendering with different sizes and icon display.
 */

import { render, screen, cleanup } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AgentAvatar from './AgentAvatar.svelte';

describe('AgentAvatar', () => {
  beforeEach(() => {
    // No mocks needed
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders avatar with icon', () => {
      render(AgentAvatar, { props: { icon: '🏗️' } });

      expect(screen.getByText('🏗️')).toBeInTheDocument();
    });

    it('renders with role=img', () => {
      render(AgentAvatar, { props: { icon: '🔧' } });

      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has aria-label for accessibility', () => {
      render(AgentAvatar, { props: { icon: '📝' } });

      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        'Agent avatar'
      );
    });
  });

  describe('size variants', () => {
    it('applies small size classes', () => {
      render(AgentAvatar, { props: { icon: '🔧', size: 'sm' } });

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('w-6');
      expect(avatar).toHaveClass('h-6');
    });

    it('applies medium size classes (default)', () => {
      render(AgentAvatar, { props: { icon: '🔧' } });

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('w-10');
      expect(avatar).toHaveClass('h-10');
    });

    it('applies large size classes', () => {
      render(AgentAvatar, { props: { icon: '🔧', size: 'lg' } });

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('w-12');
      expect(avatar).toHaveClass('h-12');
    });
  });

  describe('styling', () => {
    it('has rounded background', () => {
      render(AgentAvatar, { props: { icon: '🔧' } });

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('rounded-full');
      expect(avatar).toHaveClass('bg-gray-700');
    });

    it('centers the icon', () => {
      render(AgentAvatar, { props: { icon: '🔧' } });

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveClass('flex');
      expect(avatar).toHaveClass('items-center');
      expect(avatar).toHaveClass('justify-center');
    });
  });

  describe('different icons', () => {
    it('displays emoji icon', () => {
      render(AgentAvatar, { props: { icon: '🚀' } });

      expect(screen.getByText('🚀')).toBeInTheDocument();
    });

    it('displays text icon', () => {
      render(AgentAvatar, { props: { icon: 'A' } });

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('displays symbol icon', () => {
      render(AgentAvatar, { props: { icon: '⚙️' } });

      expect(screen.getByText('⚙️')).toBeInTheDocument();
    });
  });
});
