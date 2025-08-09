import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthErrorPage from '../page';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

// Mock useSearchParams to return an error message
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => 'User not authorized' }),
}));

// Mock SignInButton
vi.mock('@/components/buttons/SignInButton', () => ({
  SignInButton: () => <button>Sign in with GitHub</button>,
}));

describe('AuthErrorPage', () => {
  it('renders the error message from search params and logs it', async () => {
    const { logger } = await import('@/lib/logger');
    render(<AuthErrorPage />);
    expect(screen.getByText('Authentication Error')).toBeInTheDocument();
    expect(screen.getByText('User not authorized')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
    expect(logger.error).toHaveBeenCalled();
  });
});
