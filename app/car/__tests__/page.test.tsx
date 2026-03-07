import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import CarHomePage from '@/app/car/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useUiStore } from '@/stores/ui';

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
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: vi.fn(() => null),
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  useUiStore.setState({
    isVehicleDialogOpen: false,
    isFillUpDialogOpen: false,
    isExpenseDialogOpen: false,
  });
});

it('renders vehicles list and opens add vehicle dialog', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () =>
      HttpResponse.json({ data: { vehicles: [{ id: 'v1', name: 'Car A' }] } })
    )
  );
  renderWithProviders(<CarHomePage />);
  await waitFor(() => expect(screen.getByText(/Vehicles/i)).toBeInTheDocument());
  expect(await screen.findByText(/Car A/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
  expect(await screen.findByLabelText(/Add vehicle dialog/i)).toBeInTheDocument();
});

it('shows admin link for admin user', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: true } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } }))
  );
  renderWithProviders(<CarHomePage />);
  expect(await screen.findByText('Admin', { selector: 'a' })).toBeInTheDocument();
});

it('hides admin link for non-admin user', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } }))
  );
  renderWithProviders(<CarHomePage />);
  await waitFor(() => expect(screen.getByText(/vehicles/i)).toBeInTheDocument());
  expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
});

it('shows toast success when vehicle creation succeeds', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } })),
    http.post('/api/vehicles', () => HttpResponse.json({ data: { id: 'v2' } }))
  );

  renderWithProviders(<CarHomePage />);
  await waitFor(() => expect(screen.getByText(/vehicles/i)).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Car B' } });
  fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

  await waitFor(() => {
    expect(toast.success).toHaveBeenCalledWith('Vehicle created');
  });
});

it('shows toast error when vehicle creation fails', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } })),
    http.post('/api/vehicles', () =>
      HttpResponse.json(
        {
          error: { code: 'VALIDATION_ERROR', message: 'Vehicle name is required' },
        },
        { status: 400 }
      )
    )
  );

  renderWithProviders(<CarHomePage />);
  await waitFor(() => expect(screen.getByText(/vehicles/i)).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Car C' } });
  fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

  await waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith('Vehicle name is required');
  });
});
