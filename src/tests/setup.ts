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

// Mock Element.scrollIntoView for jsdom
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = function () {
    // No-op in tests
  };
}

// Mock Element.animate for jsdom (Web Animations API)
// Used by Svelte's slide transition
if (typeof Element.prototype.animate === 'undefined') {
  Element.prototype.animate = function () {
    const animation: Partial<Animation> & { onfinish: ((ev: AnimationPlaybackEvent) => void) | null } = {
      cancel: () => {},
      finish: () => {},
      play: () => {},
      pause: () => {},
      reverse: () => {},
      finished: Promise.resolve() as unknown as Promise<Animation>,
      ready: Promise.resolve() as unknown as Promise<Animation>,
      onfinish: null,
      oncancel: null,
      playState: 'finished',
      currentTime: 0,
      startTime: 0,
      effect: null,
      timeline: null,
      playbackRate: 1,
      pending: false,
      id: '',
      replaceState: 'active',
      persist: () => {},
      commitStyles: () => {},
      updatePlaybackRate: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };

    // Schedule onfinish callback to fire after animation "completes"
    setTimeout(() => {
      if (animation.onfinish) {
        animation.onfinish({} as AnimationPlaybackEvent);
      }
    }, 0);

    return animation as unknown as Animation;
  };
}
