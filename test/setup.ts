import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Global mock for next-auth to avoid network fetches during tests
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  SessionProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
