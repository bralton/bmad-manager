/**
 * Tests for settings validation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  validateUserName,
  validateIdeCommand,
  validateBranchPattern,
  validateWorktreeLocation,
  validateTheme,
  THEME_OPTIONS,
  WORKFLOW_STYLE_OPTIONS,
  WORKTREE_LOCATION_OPTIONS,
} from './settings-validation';

describe('validateUserName', () => {
  it('returns valid for non-empty string', () => {
    const result = validateUserName('TestUser');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns invalid for empty string', () => {
    const result = validateUserName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('User name is required');
  });

  it('returns invalid for whitespace-only string', () => {
    const result = validateUserName('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('User name is required');
  });

  it('returns invalid for string over 100 characters', () => {
    const longName = 'a'.repeat(101);
    const result = validateUserName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('User name must be 100 characters or less');
  });

  it('returns valid for exactly 100 characters', () => {
    const maxName = 'a'.repeat(100);
    const result = validateUserName(maxName);
    expect(result.valid).toBe(true);
  });

  it('trims whitespace before validation', () => {
    const result = validateUserName('  TestUser  ');
    expect(result.valid).toBe(true);
  });
});

describe('validateIdeCommand', () => {
  it('returns valid for non-empty command', () => {
    const result = validateIdeCommand('code .');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns invalid for empty string', () => {
    const result = validateIdeCommand('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('IDE command is required');
  });

  it('returns invalid for whitespace-only string', () => {
    const result = validateIdeCommand('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('IDE command is required');
  });

  it('accepts various IDE commands', () => {
    expect(validateIdeCommand('cursor .').valid).toBe(true);
    expect(validateIdeCommand('vim').valid).toBe(true);
    expect(validateIdeCommand('subl --new-window').valid).toBe(true);
  });
});

describe('validateBranchPattern', () => {
  it('returns valid for pattern with {story_id}', () => {
    const result = validateBranchPattern('story/{story_id}');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid for pattern with {slug}', () => {
    const result = validateBranchPattern('feature/{slug}');
    expect(result.valid).toBe(true);
  });

  it('returns valid for pattern with both placeholders', () => {
    const result = validateBranchPattern('story/{story_id}-{slug}');
    expect(result.valid).toBe(true);
  });

  it('returns invalid for empty string', () => {
    const result = validateBranchPattern('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Branch pattern is required');
  });

  it('returns invalid for pattern without placeholders', () => {
    const result = validateBranchPattern('feature/test');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Pattern must include {story_id} or {slug}');
  });

  it('returns invalid for pattern with wrong placeholder names', () => {
    const result = validateBranchPattern('feature/{id}');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Pattern must include {story_id} or {slug}');
  });
});

describe('validateWorktreeLocation', () => {
  it('returns valid for "sibling"', () => {
    const result = validateWorktreeLocation('sibling');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid for "subdirectory"', () => {
    const result = validateWorktreeLocation('subdirectory');
    expect(result.valid).toBe(true);
  });

  it('returns invalid for other values', () => {
    const result = validateWorktreeLocation('parent');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Must be "sibling" or "subdirectory"');
  });

  it('returns invalid for empty string', () => {
    const result = validateWorktreeLocation('');
    expect(result.valid).toBe(false);
  });
});

describe('validateTheme', () => {
  it('returns valid for "system"', () => {
    const result = validateTheme('system');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid for "dark"', () => {
    const result = validateTheme('dark');
    expect(result.valid).toBe(true);
  });

  it('returns valid for "light"', () => {
    const result = validateTheme('light');
    expect(result.valid).toBe(true);
  });

  it('returns invalid for other values', () => {
    const result = validateTheme('auto');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Must be "system", "dark", or "light"');
  });
});

describe('Option constants', () => {
  it('THEME_OPTIONS has correct values', () => {
    expect(THEME_OPTIONS).toHaveLength(3);
    expect(THEME_OPTIONS.map(o => o.value)).toEqual(['system', 'dark', 'light']);
  });

  it('WORKFLOW_STYLE_OPTIONS has correct values', () => {
    expect(WORKFLOW_STYLE_OPTIONS).toHaveLength(2);
    expect(WORKFLOW_STYLE_OPTIONS.map(o => o.value)).toEqual(['QuickFlow', 'FullBMM']);
  });

  it('WORKTREE_LOCATION_OPTIONS has correct values', () => {
    expect(WORKTREE_LOCATION_OPTIONS).toHaveLength(2);
    expect(WORKTREE_LOCATION_OPTIONS.map(o => o.value)).toEqual(['sibling', 'subdirectory']);
  });
});
