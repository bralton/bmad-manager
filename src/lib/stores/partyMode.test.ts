/**
 * Tests for party mode store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  selectedAgentsForParty,
  canStartParty,
  clearPartySelection,
  toggleAgentSelection,
  isAgentSelected
} from './partyMode';
import type { Agent } from '$lib/types/agent';

// Mock agents for testing
const mockAgent1: Agent = {
  name: 'architect',
  displayName: 'Architect',
  title: 'Solution Architect',
  icon: '🏛️',
  role: 'Designs system architecture',
  identity: 'architect-identity',
  communicationStyle: 'technical',
  principles: 'scalability, simplicity',
  module: 'core',
  path: '/path/to/architect'
};

const mockAgent2: Agent = {
  name: 'developer',
  displayName: 'Developer',
  title: 'Senior Developer',
  icon: '💻',
  role: 'Implements features',
  identity: 'developer-identity',
  communicationStyle: 'practical',
  principles: 'clean code',
  module: 'core',
  path: '/path/to/developer'
};

const mockAgent3: Agent = {
  name: 'tester',
  displayName: 'Tester',
  title: 'QA Engineer',
  icon: '🧪',
  role: 'Tests software',
  identity: 'tester-identity',
  communicationStyle: 'detail-oriented',
  principles: 'quality first',
  module: 'core',
  path: '/path/to/tester'
};

describe('partyMode store', () => {
  beforeEach(() => {
    // Reset store state before each test
    clearPartySelection();
  });

  describe('selectedAgentsForParty', () => {
    it('starts with empty array', () => {
      expect(get(selectedAgentsForParty)).toEqual([]);
    });
  });

  describe('canStartParty', () => {
    it('returns false when no agents selected', () => {
      expect(get(canStartParty)).toBe(false);
    });

    it('returns false when only one agent selected', () => {
      toggleAgentSelection(mockAgent1);
      expect(get(canStartParty)).toBe(false);
    });

    it('returns true when two or more agents selected', () => {
      toggleAgentSelection(mockAgent1);
      toggleAgentSelection(mockAgent2);
      expect(get(canStartParty)).toBe(true);
    });

    it('returns true when three agents selected', () => {
      toggleAgentSelection(mockAgent1);
      toggleAgentSelection(mockAgent2);
      toggleAgentSelection(mockAgent3);
      expect(get(canStartParty)).toBe(true);
    });
  });

  describe('toggleAgentSelection', () => {
    it('adds agent when not selected', () => {
      toggleAgentSelection(mockAgent1);
      expect(get(selectedAgentsForParty)).toContainEqual(mockAgent1);
    });

    it('removes agent when already selected', () => {
      toggleAgentSelection(mockAgent1);
      toggleAgentSelection(mockAgent1);
      expect(get(selectedAgentsForParty)).not.toContainEqual(mockAgent1);
    });

    it('can select multiple agents', () => {
      toggleAgentSelection(mockAgent1);
      toggleAgentSelection(mockAgent2);
      const selected = get(selectedAgentsForParty);
      expect(selected).toContainEqual(mockAgent1);
      expect(selected).toContainEqual(mockAgent2);
      expect(selected).toHaveLength(2);
    });
  });

  describe('isAgentSelected', () => {
    it('returns false for unselected agent', () => {
      expect(isAgentSelected(mockAgent1)).toBe(false);
    });

    it('returns true for selected agent', () => {
      toggleAgentSelection(mockAgent1);
      expect(isAgentSelected(mockAgent1)).toBe(true);
    });

    it('returns false after agent is deselected', () => {
      toggleAgentSelection(mockAgent1);
      toggleAgentSelection(mockAgent1);
      expect(isAgentSelected(mockAgent1)).toBe(false);
    });
  });

  describe('clearPartySelection', () => {
    it('clears all selected agents', () => {
      toggleAgentSelection(mockAgent1);
      toggleAgentSelection(mockAgent2);
      expect(get(selectedAgentsForParty)).toHaveLength(2);

      clearPartySelection();
      expect(get(selectedAgentsForParty)).toEqual([]);
    });

    it('canStartParty becomes false after clear', () => {
      toggleAgentSelection(mockAgent1);
      toggleAgentSelection(mockAgent2);
      expect(get(canStartParty)).toBe(true);

      clearPartySelection();
      expect(get(canStartParty)).toBe(false);
    });
  });
});
