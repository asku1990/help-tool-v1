import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Keep a shared replace mock to assert navigations
const replaceMock = vi.fn();

function applyBaseMocks() {
  // Mock Toaster to avoid portal/theme issues
  vi.doMock('@/components/ui/sonner', () => ({
    Toaster: vi.fn(() => null),
  }));

  // Mock next/navigation router
  vi.doMock('next/navigation', () => ({
    useRouter: () => ({
      replace: replaceMock,
    }),
  }));
}

describe('DashboardPage', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    vi.resetModules();
    applyBaseMocks();
  });

  it('redirects to home when unauthenticated', () => {
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({ data: null, status: 'unauthenticated' }),
    }));

    // Re-require after doMock so the mock applies
    return import('@/app/dashboard/page').then(mod => {
      const Page = mod.default;
      render(<Page />);
      expect(replaceMock).toHaveBeenCalledWith('/');
    });
  });

  it('shows loading state while session is loading', () => {
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({ data: null, status: 'loading' }),
    }));

    return import('@/app/dashboard/page').then(mod => {
      const Page = mod.default;
      render(<Page />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  it('renders content when authenticated', () => {
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({
        status: 'authenticated',
        data: { user: { name: 'Alice', email: 'alice@example.com' } },
      }),
    }));

    return import('@/app/dashboard/page').then(mod => {
      const Page = mod.default;
      render(<Page />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText(/Welcome, Alice|Welcome, alice@example.com/)).toBeInTheDocument();
    });
  });
});
