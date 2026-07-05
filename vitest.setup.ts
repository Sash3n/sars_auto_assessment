import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { vi } from "vitest";

// jsdom ships getRandomValues but not SubtleCrypto. The encryption module
// needs the real Web Crypto API, which Node provides.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto,
  });
}

// jsdom does not implement matchMedia. The theme resolver only reads
// `matches`, but the full listener surface is stubbed so any consumer works.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  });
}
