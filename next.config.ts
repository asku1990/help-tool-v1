import type { NextConfig } from 'next';

// Node 25+ defines a stub `localStorage` object on the server process even when
// no backing store is configured. Libraries that check for the existence of
// `localStorage` now see the stub and attempt to call `.getItem()`, which throws
// because the stub does not implement any of the Storage methods. We remove the
// stub so that server-side code observes the classic "localStorage is undefined"
// behavior and continues to guard browser-only logic correctly.
if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
  const maybeLocalStorage = (globalThis as Record<string, unknown>).localStorage as
    | undefined
    | { getItem?: unknown };

  if (maybeLocalStorage && typeof maybeLocalStorage.getItem !== 'function') {
    delete (globalThis as Record<string, unknown>).localStorage;
  }
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
