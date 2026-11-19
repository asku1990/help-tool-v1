import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import VehiclePage from '@/app/car/[vehicleId]/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { computeVehicleSummary } from '@/lib/consumption';

beforeEach(() => {
  server.use(
    http.get('/api/vehicles', () =>
      HttpResponse.json({ data: { vehicles: [{ id: 'v1', name: 'Car A' }] } })
    ),
    http.get('/api/vehicles/:vehicleId', () =>
      HttpResponse.json({ data: { vehicle: { id: 'v1', name: 'Car A', canEdit: false } } })
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
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

it('renders vehicle header and lists', async () => {
  renderWithProviders(<VehiclePage />);
  await waitFor(() => expect(screen.getAllByText(/Car A/).length).toBeGreaterThan(0));
  expect(screen.getByRole('heading', { name: /Fill-ups/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Expenses/i })).toBeInTheDocument();
  expect(await screen.findByText('Lifetime cost per km')).toBeInTheDocument();
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
      HttpResponse.json({ data: { vehicle: { id: 'v1', name: 'Car A', canEdit: true } } })
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

it('opens read-only vehicle details for a non-owner and restores menu focus', async () => {
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
          },
        },
      })
    )
  );
  renderWithProviders(<VehiclePage />);
  const menu = await screen.findByRole('button', { name: 'Vehicle actions' });
  fireEvent.click(menu);
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
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
  await waitFor(() => expect(menu).toHaveFocus());

  const vehicleName = screen.getByRole('button', { name: 'View vehicle details for Car A' });
  fireEvent.click(vehicleName);
  const reopened = await screen.findByRole('dialog', { name: 'Vehicle details' });
  fireEvent.click(within(reopened).getAllByRole('button', { name: 'Close' })[1]);
  await waitFor(() => expect(vehicleName).toHaveFocus());
});
