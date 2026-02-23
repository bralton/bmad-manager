/**
 * Types for the EmptyState component.
 */

/**
 * Available icon types for the EmptyState component.
 */
export type EmptyStateIcon = 'chat' | 'clipboard' | 'search' | 'person' | 'workflow' | 'document' | 'branch';

/**
 * Props interface for the EmptyState component.
 */
export interface EmptyStateProps {
  /** Icon to display above the title */
  icon?: EmptyStateIcon;
  /** Main title text */
  title: string;
  /** Primary description text */
  description: string;
  /** Optional secondary description (smaller text below main description) */
  secondaryDescription?: string;
  /** Label for optional action button */
  actionLabel?: string;
  /** Callback when action button is clicked (required if actionLabel is provided) */
  onAction?: () => void;
}
