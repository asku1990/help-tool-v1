import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';

// Mock next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...props} />;
  },
}));

describe('Main Page', () => {
  it('renders an image with correct attributes', () => {
    render(<Page />);

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/car.png');
    expect(image).toHaveAttribute('alt', 'Profile');
    expect(image).toHaveAttribute('width', '100');
    expect(image).toHaveAttribute('height', '100');
  });
});
