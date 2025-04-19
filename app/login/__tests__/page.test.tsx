import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';

describe('Login Page', () => {
  it('renders the login form', () => {
    render(<Page />);

    const helloText = screen.getByText('Hello');
    expect(helloText).toBeInTheDocument();
  });
});
