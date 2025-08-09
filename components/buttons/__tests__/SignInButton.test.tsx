import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignInButton } from '../SignInButton';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

describe('SignInButton', () => {
  it('calls signIn with github provider on click', async () => {
    const { signIn } = await import('next-auth/react');
    render(<SignInButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign in with github/i }));
    expect(signIn).toHaveBeenCalledWith('github');
  });
});
