import '@testing-library/jest-dom';
import React from 'react';
import { vi, expect, beforeAll, afterEach, afterAll } from 'vitest';

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Global mock for next-auth to avoid network fetches during tests
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// MSW setup for tests
import { server } from './msw/server';
import { handlers } from './msw/handlers';

// Real-database suites must not intercept Testcontainers' Docker socket traffic.
const isIntegrationTest = /\.int\.test\.[jt]sx?$/.test(expect.getState().testPath ?? '');
if (!isIntegrationTest) {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'bypass' });
    server.use(...handlers);
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
