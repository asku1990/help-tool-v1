import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { toast } from 'sonner';
import CarHomePage from '@/app/car/page';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useUiStore } from '@/stores/ui';
import { vehicleKeys } from '@/queries/keys';
import { signOut } from 'next-auth/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'u@e' } }, status: 'authenticated' }),
  signOut: vi.fn(),
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

function renderWithProviders(
  ui: React.ReactElement,
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 1, retryDelay: 0 } },
  })
) {
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

it('renders each vehicle as one link and opens the add vehicle dialog', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () =>
      HttpResponse.json({
        data: {
          vehicles: [
            {
              id: 'v1',
              name: 'Car A',
              make: 'Volvo',
              model: 'V60',
              year: 2020,
              licensePlate: 'abc-123',
            },
          ],
        },
      })
    )
  );
  renderWithProviders(<CarHomePage />);
  expect(screen.getByRole('heading', { name: 'Vehicles' })).toBeVisible();
  const vehicle = await screen.findByRole('link', { name: /Car A/i });
  expect(vehicle).toHaveAttribute('href', '/car/v1');
  expect(within(vehicle).getByText('Volvo V60 2020')).toBeVisible();
  expect(within(vehicle).getByText('ABC-123')).toBeVisible();
  expect(within(vehicle).getByText('Inspection: Not scheduled')).toBeVisible();
  expect(screen.queryByText(/choose add vehicle/i)).not.toBeInTheDocument();
  const menu = screen.getByRole('button', { name: 'Vehicle list actions' });
  fireEvent.click(menu);
  fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add vehicle' });
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(menu).toHaveFocus());
});

it('keeps Add vehicle in the actions menu without Restore Backup', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } }))
  );

  renderWithProviders(<CarHomePage />);

  await screen.findByText('No vehicles yet.');
  expect(screen.getByText(/choose add vehicle/i)).toBeVisible();
  const menu = screen.getByRole('button', { name: 'Vehicle list actions' });

  expect(screen.queryByRole('button', { name: 'Add vehicle' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Restore Backup' })).not.toBeInTheDocument();

  fireEvent.click(menu);
  expect(screen.getByRole('button', { name: 'Add vehicle' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Restore Backup' })).not.toBeInTheDocument();
});

it('shows a retry instead of the empty garage when vehicles fail to load', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({}, { status: 500 }))
  );
  renderWithProviders(<CarHomePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load vehicles.');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  expect(screen.queryByText(/choose add vehicle/i)).not.toBeInTheDocument();
});

it('points to the archive when the last active vehicle has been archived', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () =>
      HttpResponse.json({ data: { vehicles: [], hasArchivedVehicles: true } })
    )
  );
  renderWithProviders(<CarHomePage />);
  expect(await screen.findByText('No active vehicles.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'View archived vehicles' })).toHaveAttribute(
    'href',
    '/car?view=archived'
  );
});

it('lets users sign out directly from the vehicle list', () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } }))
  );
  renderWithProviders(<CarHomePage />);

  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Vehicle list actions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

  expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  expect(screen.getByRole('button', { name: 'Vehicle list actions' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
});

it('closes the actions menu when the vehicles heading is clicked', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } }))
  );
  renderWithProviders(<CarHomePage />);
  const heading = await screen.findByRole('heading', { name: 'Vehicles' });
  const menu = screen.getByRole('button', { name: 'Vehicle list actions' });

  fireEvent.click(menu);
  const signOutButton = screen.getByRole('button', { name: 'Sign out' });
  expect(signOutButton).toBeVisible();

  fireEvent.click(heading);
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(signOutButton).not.toBeInTheDocument();
});

it('shows admin link for admin user', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: true } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } }))
  );
  renderWithProviders(<CarHomePage />);
  fireEvent.click(screen.getByRole('button', { name: 'Vehicle list actions' }));
  expect(await screen.findByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/car/admin');
});

it('hides admin link for non-admin user', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } }))
  );
  renderWithProviders(<CarHomePage />);
  expect(screen.getByRole('heading', { name: 'Vehicles' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Vehicle list actions' }));
  expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
});

it('shows toast success when vehicle creation succeeds', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } })),
    http.post('/api/vehicles', () => HttpResponse.json({ data: { id: 'v2' } }))
  );

  renderWithProviders(<CarHomePage />);
  expect(screen.getByRole('heading', { name: 'Vehicles' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Vehicle list actions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Car B' } });
  fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

  await waitFor(() => {
    expect(toast.success).toHaveBeenCalledWith('Vehicle created');
  });
});

it('reports a failed create without automatically submitting a second POST', async () => {
  const create = vi.fn(() =>
    HttpResponse.json({ error: { message: 'Response lost' } }, { status: 503 })
  );
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } })),
    http.post('/api/vehicles', create)
  );

  renderWithProviders(<CarHomePage />);
  expect(screen.getByRole('heading', { name: 'Vehicles' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Vehicle list actions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Car C' } });
  fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

  await waitFor(() => {
    expect(toast.error).toHaveBeenCalled();
  });
  expect(create).toHaveBeenCalledTimes(1);
});

it('shows Retry instead of a cached empty garage when refreshing fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(vehicleKeys.byStatus('active'), { vehicles: [] });
  server.use(http.get('/api/vehicles', () => HttpResponse.json({}, { status: 503 })));
  renderWithProviders(<CarHomePage />, client);
  expect(await screen.findByRole('button', { name: 'Retry' })).toBeVisible();
  expect(screen.queryByText('No vehicles yet.')).not.toBeInTheDocument();
});

it('keeps cached cards visible and offers Retry when refreshing fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(vehicleKeys.byStatus('active'), { vehicles: [{ id: 'v1', name: 'Volvo' }] });
  server.use(http.get('/api/vehicles', () => HttpResponse.json({}, { status: 503 })));
  renderWithProviders(<CarHomePage />, client);

  expect(await screen.findByRole('button', { name: 'Retry' })).toBeVisible();
  expect(screen.getByRole('link', { name: /Volvo/ })).toBeVisible();
});

it('does not report an empty garage when the first request is paused offline', () => {
  onlineManager.setOnline(false);
  const page = renderWithProviders(<CarHomePage />);
  try {
    expect(screen.queryByText('No vehicles yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  } finally {
    page.unmount();
    onlineManager.setOnline(true);
  }
});

it('announces an archive on arrival, focuses Vehicles, and does not replay it on return', () => {
  useUiStore.setState({ vehicleListNotice: 'Volvo archived' });
  const page = renderWithProviders(<CarHomePage />);
  expect(screen.getByRole('heading', { name: 'Vehicles' })).toHaveFocus();
  expect(toast.success).toHaveBeenCalledWith('Volvo archived');
  page.unmount();
  renderWithProviders(<CarHomePage />);
  expect(toast.success).toHaveBeenCalledTimes(1);
});
