import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Page from '../page';
import { SessionProvider } from 'next-auth/react';

// Mock next/navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

// Mock the entire sonner module
vi.mock('sonner', () => ({
  toast: vi.fn(),
  Toaster: vi.fn(() => null),
}));

// Mock the custom Toaster component
vi.mock('@/components/ui/sonner', () => ({
  Toaster: vi.fn(() => null),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

// Mock dialog component to prevent portal issues
vi.mock('@/components/ui/dialog', () => ({
  Dialog: vi.fn(({ children }) => children),
  DialogContent: vi.fn(({ children }) => <div>{children}</div>),
  DialogHeader: vi.fn(({ children }) => <div>{children}</div>),
  DialogTitle: vi.fn(({ children }) => <div>{children}</div>),
  DialogDescription: vi.fn(({ children }) => <div>{children}</div>),
  DialogTrigger: vi.fn(({ children }) => children),
}));

// Reset push mock per test
beforeEach(() => {
  pushMock.mockClear();
});

describe('Main Page', () => {
  it('renders main sections correctly', () => {
    render(
      <SessionProvider>
        <Page />
      </SessionProvider>
    );

    // Check hero section
    expect(screen.getByText('Personal Project')).toBeInTheDocument();
    expect(screen.getByText('Personal Helper Tools')).toBeInTheDocument();

    // Check current project section
    expect(screen.getByText('Car Expenses')).toBeInTheDocument();
    expect(screen.getByText('Currently Building')).toBeInTheDocument();

    // Check buttons
    expect(screen.getByRole('link', { name: /view source/i })).toHaveAttribute(
      'href',
      'https://github.com/asku1990/help-tool-v1'
    );
  });

  it('displays all project features', () => {
    render(
      <SessionProvider>
        <Page />
      </SessionProvider>
    );

    const features = [
      'Add vehicles',
      'Log fuel fill-ups',
      'Track expenses',
      'L/100km and cost/km stats',
    ];

    features.forEach(feature => {
      expect(screen.getByText(feature)).toBeInTheDocument();
    });
  });

  it('shows tech stack items', () => {
    render(
      <SessionProvider>
        <Page />
      </SessionProvider>
    );

    const techStack = ['Next.js', 'TypeScript', 'Tailwind CSS', 'shadcn/ui'];

    techStack.forEach(tech => {
      expect(screen.getByText(tech)).toBeInTheDocument();
    });
  });

  it('displays future plans', () => {
    render(
      <SessionProvider>
        <Page />
      </SessionProvider>
    );

    expect(screen.getByText('Recipe Collection')).toBeInTheDocument();
    expect(screen.getByText('Workout App')).toBeInTheDocument();
    expect(screen.getByText(/future plan: personal cookbook/i)).toBeInTheDocument();
    expect(screen.getByText(/future plan: track sets, weights, and notes/i)).toBeInTheDocument();
  });

  it('redirects to /dashboard when authenticated', async () => {
    // Reset module cache so our next-auth mock applies to a fresh import
    vi.resetModules();

    // Re-apply base mocks after reset
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: pushMock }),
    }));
    vi.doMock('sonner', () => ({ toast: vi.fn(), Toaster: vi.fn(() => null) }));
    vi.doMock('@/components/ui/sonner', () => ({ Toaster: vi.fn(() => null) }));
    vi.doMock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
    vi.doMock('@/components/ui/dialog', () => ({
      Dialog: vi.fn(({ children }) => children),
      DialogContent: vi.fn(({ children }) => <div>{children}</div>),
      DialogHeader: vi.fn(({ children }) => <div>{children}</div>),
      DialogTitle: vi.fn(({ children }) => <div>{children}</div>),
      DialogDescription: vi.fn(({ children }) => <div>{children}</div>),
      DialogTrigger: vi.fn(({ children }) => children),
    }));

    // Authenticated session mock
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({ status: 'authenticated', data: { user: { name: 'U' } } }),
      SessionProvider: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    }));

    const { default: AuthedPage } = await import('../page');
    render(<AuthedPage />);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'));
  });
});
