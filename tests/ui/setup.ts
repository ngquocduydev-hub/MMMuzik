import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/**
 * jsdom polyfills for the Radix primitives the re-skinned UI uses (Slider /
 * ScrollArea / Avatar / Dialog). jsdom ships none of these. They are no-ops —
 * enough to let components mount and assert on markup.
 *
 * NOTE: this setup file runs in EVERY test environment. Unit/integration tests
 * use the `node` environment where `window`/`Element` are undefined, so the DOM
 * polyfills are gated behind a `window` check (only the jsdom UI tests apply them).
 */
if (typeof window !== 'undefined') {
  // Radix Slider / ScrollArea measure with ResizeObserver.
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

  // MessageList autoscrolls via scrollIntoView (undefined in jsdom).
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }

  // Radix Slider/Dialog touch the Pointer Capture API on interaction.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};

  // useBreakpoint and a few primitives read matchMedia.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
}
