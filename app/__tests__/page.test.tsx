import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Page from '../page';

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

describe('Main Page', () => {
  it('renders main sections correctly', () => {
    render(<Page />);

    // Check hero section
    expect(screen.getByText('Personal Project')).toBeInTheDocument();
    expect(screen.getByText('Personal Helper Tools')).toBeInTheDocument();

    // Check current project section
    expect(screen.getByText('Gym Progress Notes')).toBeInTheDocument();
    expect(screen.getByText('Currently Building')).toBeInTheDocument();

    // Check buttons
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test mode/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view source/i })).toHaveAttribute(
      'href',
      'https://github.com/asku1990/help-tool-v1'
    );
  });

  it('displays all project features', () => {
    render(<Page />);

    const features = [
      'Quick set and weight logging',
      'Progress tracking over time',
      'Personal notes for each workout',
      'Simple and intuitive interface',
    ];

    features.forEach(feature => {
      expect(screen.getByText(feature)).toBeInTheDocument();
    });
  });

  it('shows tech stack items', () => {
    render(<Page />);

    const techStack = ['Next.js', 'TypeScript', 'Tailwind CSS', 'shadcn/ui'];

    techStack.forEach(tech => {
      expect(screen.getByText(tech)).toBeInTheDocument();
    });
  });

  it('displays future plans', () => {
    render(<Page />);

    expect(screen.getByText('Recipe Collection')).toBeInTheDocument();
    expect(screen.getByText('Vehicle Expenses')).toBeInTheDocument();
    expect(screen.getByText(/future plan: personal cookbook/i)).toBeInTheDocument();
    expect(screen.getByText(/future plan: track fuel consumption/i)).toBeInTheDocument();
  });

  it('shows toast on Test Mode click', async () => {
    const user = userEvent.setup();
    const { toast: mockToast } = await import('sonner');
    render(<Page />);

    const testModeButton = screen.getByRole('button', { name: /test mode/i });
    await user.click(testModeButton);

    // Check if toast was called with correct arguments
    expect(mockToast).toHaveBeenCalledWith('Not Implemented', {
      description: 'This feature is coming soon!',
    });
  });
});
