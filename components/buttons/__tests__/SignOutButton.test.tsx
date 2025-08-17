import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignOutButton } from '../SignOutButton';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('SignOutButton', () => {
  it('calls signOut with callbackUrl on click', async () => {
    const { signOut } = await import('next-auth/react');
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });
});
