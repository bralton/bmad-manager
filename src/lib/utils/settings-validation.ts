/**
 * Validation helpers for settings forms.
 * Provides field-level validation with error messages.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a user name field.
 * - Required (non-empty)
 * - Max 100 characters
 */
export function validateUserName(value: string): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, error: 'User name is required' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'User name must be 100 characters or less' };
  }

  return { valid: true };
}

/**
 * Validates an IDE command field.
 * - Required (non-empty)
 */
export function validateIdeCommand(value: string): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, error: 'IDE command is required' };
  }

  return { valid: true };
}

/**
 * Validates a branch pattern field.
 * - Required (non-empty)
 * - Must contain {story_id} or {slug} placeholder
 */
export function validateBranchPattern(value: string): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, error: 'Branch pattern is required' };
  }

  if (!trimmed.includes('{story_id}') && !trimmed.includes('{slug}')) {
    return { valid: false, error: 'Pattern must include {story_id} or {slug}' };
  }

  return { valid: true };
}

/**
 * Validates a worktree location field.
 * - Must be "sibling" or "subdirectory"
 */
export function validateWorktreeLocation(value: string): ValidationResult {
  if (value !== 'sibling' && value !== 'subdirectory') {
    return { valid: false, error: 'Must be "sibling" or "subdirectory"' };
  }

  return { valid: true };
}

/**
 * Validates a theme field.
 * - Must be "system", "dark", or "light"
 */
export function validateTheme(value: string): ValidationResult {
  if (!['system', 'dark', 'light'].includes(value)) {
    return { valid: false, error: 'Must be "system", "dark", or "light"' };
  }

  return { valid: true };
}

/**
 * Valid theme options for dropdown.
 */
export const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
] as const;

/**
 * Valid workflow style options for dropdown.
 */
export const WORKFLOW_STYLE_OPTIONS = [
  { value: 'QuickFlow', label: 'QuickFlow' },
  { value: 'FullBMM', label: 'Full BMM' },
] as const;

/**
 * Valid worktree location options for dropdown.
 */
export const WORKTREE_LOCATION_OPTIONS = [
  { value: 'sibling', label: 'Sibling Directory' },
  { value: 'subdirectory', label: 'Subdirectory' },
] as const;
