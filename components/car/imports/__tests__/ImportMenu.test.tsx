import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImportMenu from '../ImportMenu';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'ImportMenuTestWrapper';
  return Wrapper;
};

describe('ImportMenu', () => {
  it('renders import button', () => {
    render(<ImportMenu vehicleId="v1" onImported={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('button', { name: /import backup/i })).toBeInTheDocument();
  });

  it('opens dialog when button is clicked', async () => {
    render(<ImportMenu vehicleId="v1" onImported={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const button = screen.getByRole('button', { name: /import backup/i });
    fireEvent.click(button);

    // Dialog should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
