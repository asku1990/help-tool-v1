import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CarHomePage from '@/app/car/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'u@e' } }, status: 'authenticated' }),
}));
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

it('renders vehicles list and opens add vehicle dialog', async () => {
  server.use(
    http.get('/api/vehicles', () =>
      HttpResponse.json({ data: { vehicles: [{ id: 'v1', name: 'Car A' }] } })
    )
  );
  renderWithProviders(<CarHomePage />);
  await waitFor(() => expect(screen.getByText(/Vehicles/i)).toBeInTheDocument());
  expect(screen.getByText(/Car A/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
  expect(await screen.findByLabelText(/Add vehicle dialog/i)).toBeInTheDocument();
});
