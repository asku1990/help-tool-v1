import '@testing-library/jest-dom';
import React from 'react';
import { vi, beforeAll, afterEach, afterAll } from 'vitest';

// Global mock for next-auth to avoid network fetches during tests
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// MSW setup for tests
import { server } from './msw/server';
import { handlers } from './msw/handlers';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
  server.use(...handlers);
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
