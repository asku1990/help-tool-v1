import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import VehiclePage from '@/app/car/[vehicleId]/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { computeVehicleSummary } from '@/lib/consumption';
import { useUiStore } from '@/stores/ui';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

beforeEach(() => {
  push.mockClear();
  useUiStore.setState({ isFillUpDialogOpen: false, isExpenseDialogOpen: false });
  server.use(
    http.get('/api/vehicles', () =>
      HttpResponse.json({ data: { vehicles: [{ id: 'v1', name: 'Car A' }] } })
    ),
    http.get('/api/vehicles/:vehicleId', () =>
      HttpResponse.json({
        data: { vehicle: { id: 'v1', name: 'Car A', canEdit: false, canWrite: false } },
      })
    ),
    http.get('/api/vehicles/:vehicleId/summary', () =>
      HttpResponse.json({ data: computeVehicleSummary([], []) })
    ),
    http.get('/api/vehicles/:vehicleId/fillups', () =>
      HttpResponse.json({ data: { fillUps: [], nextCursor: null } })
    ),
    http.get('/api/vehicles/:vehicleId/expenses', () =>
      HttpResponse.json({ data: { expenses: [], expensesTotal: 0, nextCursor: null } })
    ),
    http.get('/api/vehicles/:vehicleId/tires', () => HttpResponse.json({ data: { tireSets: [] } })),
    http.get('/api/vehicles/:vehicleId/tires/change-log', () =>
      HttpResponse.json({ data: { history: [] } })
    )
  );
});

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'u@e' } }, status: 'authenticated' }),
}));
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useParams: () => ({ vehicleId: 'v1' }),
    useRouter: () => ({ push, replace: vi.fn() }),
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

it('renders vehicle header and lists', async () => {
  renderWithProviders(<VehiclePage />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Car A' })).toBeInTheDocument();
  expect(screen.getAllByText('Car A')).toHaveLength(1);
  expect(screen.queryByRole('combobox', { name: 'Switch vehicle' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Fill-ups/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Expenses/i })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Vehicle costs' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Fuel consumption' })).toBeVisible();
  expect(screen.getByText('Lifetime cost per km')).toBeInTheDocument();
});

it('offers a switcher only when another vehicle is available', async () => {
  server.use(
    http.get('/api/vehicles', () =>
      HttpResponse.json({
        data: {
          vehicles: [
            { id: 'v1', name: 'Car A' },
            { id: 'v2', name: 'Car B' },
          ],
        },
      })
    )
  );
  renderWithProviders(<VehiclePage />);
  const switcher = await screen.findByRole('combobox', { name: 'Switch vehicle' });
  expect(within(switcher).queryByRole('option', { name: 'Car A' })).not.toBeInTheDocument();
  fireEvent.change(switcher, { target: { value: 'v2' } });
  expect(push).toHaveBeenCalledWith('/car/v2');
});

it('switches between the fill-up list and chart and announces the selected view', async () => {
  renderWithProviders(<VehiclePage />);
  const views = within(screen.getByRole('group', { name: 'Fill-up view' }));
  const list = views.getByRole('button', { name: 'List', pressed: true });
  const chart = views.getByRole('button', { name: 'Chart', pressed: false });
  expect(await screen.findByText(/No fill-ups yet/)).toBeVisible();

  fireEvent.click(chart);
  expect(chart).toHaveAttribute('aria-pressed', 'true');
  expect(list).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('combobox', { name: 'Range' })).toBeVisible();
  expect(screen.queryByText(/No fill-ups yet/)).not.toBeInTheDocument();

  fireEvent.click(list);
  expect(await screen.findByText(/No fill-ups yet/)).toBeVisible();
  expect(list).toHaveAttribute('aria-pressed', 'true');
});

it('shows a retryable error rather than zero-valued summaries when the summary request fails', async () => {
  server.use(
    http.get('/api/vehicles/:vehicleId/summary', () => HttpResponse.json({}, { status: 500 }))
  );
  renderWithProviders(<VehiclePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load vehicle summary.');
  expect(screen.queryByText('Lifetime cost per km')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /retry/i }).length).toBeGreaterThan(0);
});

it('offers Retry when vehicle details fail and restores the actions after recovery', async () => {
  server.use(
    http.get('/api/vehicles/:vehicleId', () => HttpResponse.json({}, { status: 500 }), {
      once: true,
    })
  );
  renderWithProviders(<VehiclePage />);
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Could not load vehicle details.');
  expect(screen.queryByRole('button', { name: 'Vehicle actions' })).not.toBeInTheDocument();
  fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Vehicle actions' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('opens the edit vehicle dialog from the actions menu for an owner', async () => {
  server.use(
    http.get('/api/vehicles/:vehicleId', () =>
      HttpResponse.json({
        data: { vehicle: { id: 'v1', name: 'Car A', canEdit: true, canWrite: true } },
      })
    )
  );

  renderWithProviders(<VehiclePage />);
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: /^Car A$/i })).toBeInTheDocument()
  );

  fireEvent.click(screen.getByRole('button', { name: 'Vehicle actions' }));
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  expect(await screen.findByLabelText(/Edit vehicle dialog/i)).toBeInTheDocument();
});

it.each([
  ['owner', true],
  ['editor', false],
])('keeps logging visible and moves backup actions into the menu for an %s', async (_, canEdit) => {
  const clearRecords = vi.fn(() => HttpResponse.json({ data: {} }));
  server.use(
    http.get('/api/vehicles/:vehicleId', () =>
      HttpResponse.json({
        data: { vehicle: { id: 'v1', name: 'Car A', canEdit, canWrite: true } },
      })
    ),
    http.delete('/api/vehicles/v1/clear', clearRecords),
    http.post('/api/vehicles/v1/fillups', () => HttpResponse.json({}, { status: 500 }))
  );
  renderWithProviders(<VehiclePage />);
  const fillUp = await screen.findByRole('button', { name: 'Add fill-up' });
  expect(screen.getByRole('button', { name: 'Add expense' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Download backup' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Import backup' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete vehicle' })).not.toBeInTheDocument();

  fireEvent.click(fillUp);
  const fillUpDialog = await screen.findByRole('dialog', { name: 'Add fill-up' });
  fireEvent.click(within(fillUpDialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(fillUp).toHaveFocus());

  const menu = screen.getByRole('button', { name: 'Vehicle actions' });
  fireEvent.click(menu);
  expect(screen.getByRole('link', { name: 'Download backup' })).toHaveAttribute(
    'href',
    '/api/vehicles/v1/export'
  );
  expect(screen.getByRole('link', { name: 'Download for spreadsheet' })).toHaveAttribute(
    'href',
    '/api/vehicles/v1/export?format=spreadsheet'
  );
  if (canEdit) {
    fireEvent.click(screen.getByRole('button', { name: 'Delete vehicle' }));
    const confirmation = await screen.findByRole('dialog', { name: 'Delete vehicle' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(menu).toHaveFocus());
    fireEvent.click(menu);
  } else {
    expect(screen.queryByRole('button', { name: 'Delete vehicle' })).not.toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Import backup' }));
  const backup = await screen.findByRole('dialog', { name: 'Import Backup' });
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  fireEvent.change(within(backup).getByLabelText('Or paste CSV content'), {
    target: {
      value:
        '[FILLUPS]\nId;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes\nf1;2025-01-15;10000;45.5;1.65;75.08;1;Full tank',
    },
  });
  fireEvent.click(within(backup).getByRole('button', { name: 'Parse' }));
  expect(within(backup).queryByRole('checkbox', { name: /clear existing data/i })).toBeNull();
  fireEvent.click(within(backup).getByRole('button', { name: 'Import' }));
  expect(await within(backup).findByText('Error: Imported 0/1 fill-ups; 1 failed')).toBeVisible();
  expect(clearRecords).not.toHaveBeenCalled();
  fireEvent.click(within(backup).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(menu).toHaveFocus());
});

it('opens read-only vehicle details from the name and restores focus to it', async () => {
  server.use(
    http.get('/api/vehicles/:vehicleId', () =>
      HttpResponse.json({
        data: {
          vehicle: {
            id: 'v1',
            name: 'Car A',
            make: 'Volvo',
            initialOdometer: 0,
            inspectionDueDate: '2027-12-04T00:00:00.000Z',
            inspectionIntervalMonths: 12,
            canEdit: false,
            canWrite: false,
          },
        },
      })
    )
  );
  renderWithProviders(<VehiclePage />);
  const menu = await screen.findByRole('button', { name: 'Vehicle actions' });
  fireEvent.click(menu);
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Import backup' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete vehicle' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
  fireEvent.keyDown(menu, { key: 'Escape' });
  const vehicleName = screen.getByRole('button', { name: 'Car A' });
  fireEvent.click(vehicleName);
  const dialog = await screen.findByRole('dialog', { name: 'Vehicle details' });
  expect(dialog).toHaveTextContent('Volvo');
  expect(dialog).toHaveTextContent('0 km');
  expect(dialog).toHaveTextContent('04.12.2027');
  expect(dialog).toHaveTextContent('12 months');
  expect(dialog).toHaveTextContent('—');
  expect(within(dialog).queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  const [footerClose, cornerClose] = within(dialog).getAllByRole('button', { name: 'Close' });
  expect(footerClose).toBeVisible();
  expect(cornerClose).toBeVisible();
  fireEvent.click(footerClose);
  await waitFor(() => expect(vehicleName).toHaveFocus());
  expect(screen.queryByRole('button', { name: 'Add fill-up' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
});
