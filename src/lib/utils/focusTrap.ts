/**
 * Focus trap utility for modal dialogs.
 *
 * Provides a Svelte action and standalone functions for trapping focus
 * within modal elements, improving keyboard navigation and accessibility.
 *
 * Story 6-8: Focus Trap Utility
 */

/**
 * Selector for focusable elements.
 * Excludes disabled elements and those with tabindex="-1".
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Options for the focus trap action.
 */
export interface FocusTrapOptions {
  /** Focus the first element on mount (default: true) */
  autoFocus?: boolean;
  /** Restore focus to trigger element on destroy (default: true) */
  restoreFocus?: boolean;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
}

/**
 * Gets all focusable elements within a container.
 *
 * @param container - The container element
 * @returns Array of focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Handles Tab key press for focus trapping.
 *
 * @param event - The keyboard event
 * @param container - The container element to trap focus within
 * @returns true if the event was handled, false otherwise
 */
export function handleFocusTrap(event: KeyboardEvent, container: HTMLElement): boolean {
  if (event.key !== 'Tab') {
    return false;
  }

  const focusable = getFocusableElements(container);

  // Edge case: no focusable elements
  if (focusable.length === 0) {
    event.preventDefault();
    return true;
  }

  // Edge case: single focusable element
  if (focusable.length === 1) {
    event.preventDefault();
    focusable[0].focus();
    return true;
  }

  const firstElement = focusable[0];
  const lastElement = focusable[focusable.length - 1];

  if (event.shiftKey) {
    // Shift+Tab: if on first element, wrap to last
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return true;
    }
  } else {
    // Tab: if on last element, wrap to first
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
      return true;
    }
  }

  return false;
}

/**
 * Svelte action for focus trapping.
 *
 * Usage:
 * ```svelte
 * <div use:focusTrap={{ onEscape: handleClose }}>
 *   <!-- modal content -->
 * </div>
 * ```
 *
 * @param node - The element to trap focus within
 * @param options - Focus trap options
 * @returns Action lifecycle object
 */
export function focusTrap(node: HTMLElement, options: FocusTrapOptions = {}) {
  const { autoFocus = true, restoreFocus = true, onEscape } = options;

  // Store the previously focused element to restore on destroy
  const previouslyFocused = document.activeElement as HTMLElement | null;

  function handleKeyDown(event: KeyboardEvent) {
    // Handle Escape key
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }

    // Handle Tab focus trapping
    handleFocusTrap(event, node);
  }

  // Set up event listener
  node.addEventListener('keydown', handleKeyDown);

  // Auto-focus first element
  if (autoFocus) {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const focusable = getFocusableElements(node);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        // If no focusable elements, focus the container itself
        node.tabIndex = -1;
        node.focus();
      }
    });
  }

  return {
    update(newOptions: FocusTrapOptions) {
      // Update onEscape handler if changed
      // Note: This creates a new closure, so the old handler reference
      // in handleKeyDown is stale. For full reactivity, we'd need to
      // store options in a ref and access it in handleKeyDown.
      // For simplicity, we don't support updating onEscape dynamically.
    },
    destroy() {
      node.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the previously focused element
      if (restoreFocus && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    },
  };
}
