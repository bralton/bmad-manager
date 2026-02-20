/**
 * Vitest setup file for frontend testing.
 * Configures jest-dom matchers and any global test utilities.
 */

import '@testing-library/jest-dom/vitest';

// Mock crypto.randomUUID for jsdom environment (used by showToast)
// WARNING: This uses Math.random() which is NOT cryptographically secure.
// This is acceptable ONLY for test environments. Never use this pattern in production code.
if (typeof crypto.randomUUID === 'undefined') {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  });
}
