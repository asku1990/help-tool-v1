import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { toast } from 'sonner';
import CarHomePage from '@/app/car/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useUiStore } from '@/stores/ui';
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

it('keeps Add vehicle visible and puts Restore Backup in the actions menu', async () => {
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () => HttpResponse.json({ data: { vehicles: [] } }))
  );

  renderWithProviders(<CarHomePage />);

  await screen.findByText('No vehicles yet.');
  const addVehicleButton = screen.getByRole('button', { name: /add vehicle/i });
  const menu = screen.getByRole('button', { name: 'Vehicle list actions' });

  expect(addVehicleButton).toHaveClass('w-full');
  expect(addVehicleButton).toHaveClass('sm:w-auto');
  expect(screen.queryByRole('button', { name: 'Restore Backup' })).not.toBeInTheDocument();

  fireEvent.click(menu);
  fireEvent.click(screen.getByRole('button', { name: 'Restore Backup' }));
  const dialog = await screen.findByRole('dialog', { name: 'Restore from Backup' });
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(menu).toHaveFocus());
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
  expect(signOutButton).not.toBeVisible();
});

it('restores records to an existing vehicle without clearing it', async () => {
  const clearRecords = vi.fn(() => HttpResponse.json({ data: {} }));
  server.use(
    http.get('/api/admin/me', () => HttpResponse.json({ data: { isAdmin: false } })),
    http.get('/api/vehicles', () =>
      HttpResponse.json({ data: { vehicles: [{ id: 'v1', name: 'Car A' }] } })
    ),
    http.delete('/api/vehicles/v1/clear', clearRecords),
    http.post('/api/vehicles/v1/fillups', () => HttpResponse.json({ data: { id: 'f1' } }))
  );

  renderWithProviders(<CarHomePage />);
  await screen.findByText('Car A');
  fireEvent.click(screen.getByRole('button', { name: 'Vehicle list actions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restore Backup' }));
  const backup = within(await screen.findByRole('dialog', { name: 'Restore from Backup' }));
  fireEvent.change(backup.getByLabelText('Or paste CSV content'), {
    target: {
      value: [
        '[VEHICLE]',
        'Id;Name;Make;Model;Year;LicensePlate',
        'v1;Car A;;;;',
        '[FILLUPS]',
        'Id;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes',
        'f1;2025-01-15;10000;45.5;1.65;75.08;1;Full tank',
      ].join('\n'),
    },
  });
  fireEvent.click(backup.getByRole('button', { name: 'Parse' }));
  fireEvent.click(backup.getByRole('radio', { name: /update existing vehicle/i }));
  expect(backup.queryByRole('checkbox', { name: /clear existing data/i })).toBeNull();
  fireEvent.click(backup.getByRole('button', { name: 'Restore' }));

  expect(await backup.findByText('Import complete!')).toBeVisible();
  expect(clearRecords).not.toHaveBeenCalled();
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
  await waitFor(() => expect(screen.getByText(/vehicles/i)).toBeInTheDocument());
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
