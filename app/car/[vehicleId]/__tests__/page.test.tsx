import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import VehiclePage from '@/app/car/[vehicleId]/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { computeVehicleSummary } from '@/lib/consumption';
import { useUiStore } from '@/stores/ui';

beforeEach(() => {
  useUiStore.setState({ isFillUpDialogOpen: false, isExpenseDialogOpen: false });
  server.use(
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
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
  const navigation = within(screen.getByRole('navigation', { name: 'Vehicle navigation' }));
  expect(navigation.getByRole('link', { name: 'Back to vehicles' })).toHaveAttribute(
    'href',
    '/car'
  );
  expect(navigation.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Fill-ups/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Expenses/i })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Vehicle costs' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Fuel consumption' })).toBeVisible();
  expect(screen.getByText('Lifetime cost per km')).toBeInTheDocument();
});

it('offers retry after archive fails and keeps a saved expense through archive and restore', async () => {
  let archived = false;
  let rejectFirstArchive = true;
  server.use(
    http.get('/api/vehicles/v1', () =>
      HttpResponse.json({
        data: {
          vehicle: {
            id: 'v1',
            name: 'Sold car',
            canEdit: true,
            archivedAtUtc: archived ? '2026-11-24T12:00:00Z' : null,
          },
        },
      })
    ),
    http.put('/api/vehicles/v1/archive', async ({ request }) => {
      if (rejectFirstArchive) {
        rejectFirstArchive = false;
        return HttpResponse.json({}, { status: 503 });
      }
      const body = (await request.json()) as { archived: boolean };
      archived = body.archived;
      return HttpResponse.json({ data: { id: 'v1' } });
    }),
    http.get('/api/vehicles/v1/expenses', () =>
      HttpResponse.json({
        data: {
          expenses: [{ id: 'expense-1', date: '2026-10-01', amount: 80, category: 'MAINTENANCE' }],
          expensesTotal: 80,
          nextCursor: null,
        },
      })
    )
  );
  renderWithProviders(<VehiclePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'More vehicle actions' }));
  fireEvent.click(screen.getByRole('button', { name: /Archive vehicle/ }));
  const retry = await screen.findByRole('button', { name: 'Retry' });
  expect(screen.queryByRole('button', { name: 'Restore vehicle' })).not.toBeInTheDocument();
  fireEvent.click(retry);
  const restore = await screen.findByRole('button', { name: 'Restore vehicle' });
  expect(screen.getByRole('link', { name: 'Back to vehicles' })).toHaveAttribute(
    'href',
    '/car?view=archived'
  );
  expect(
    within(screen.getByRole('table', { name: 'Expense records' })).getAllByRole('row')
  ).toHaveLength(2);
  await waitFor(() => expect(restore).toBeEnabled());
  fireEvent.click(restore);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Restore vehicle' })).not.toBeInTheDocument()
  );
  expect(
    within(screen.getByRole('table', { name: 'Expense records' })).getAllByRole('row')
  ).toHaveLength(2);
});

it('shows all-time fuel and expense totals before and after loading older records', async () => {
  const fillUps = [30, 50].map((totalCost, i) => ({
    id: `fuel-${i}`,
    date: i === 0 ? '2026-11-01' : '2025-01-01',
    odometerKm: 2000 - i * 1000,
    liters: 20,
    pricePerLiter: totalCost / 20,
    totalCost,
    isFull: i === 1,
  }));
  const expenses = [12, 100].map((amount, i) => ({
    id: `expense-${i}`,
    date: i === 0 ? '2026-11-01' : '2025-01-01',
    category: i === 0 ? 'MAINTENANCE' : 'FUEL',
    amount,
  }));
  server.use(
    http.get('/api/vehicles/v1/summary', () =>
      HttpResponse.json({ data: computeVehicleSummary(fillUps, expenses) })
    ),
    http.get('/api/vehicles/v1/fillups', ({ request }) => {
      const older = new URL(request.url).searchParams.has('cursor');
      return HttpResponse.json({
        data: { fillUps: [fillUps[older ? 1 : 0]], nextCursor: older ? null : 'fuel-0' },
      });
    }),
    http.get('/api/vehicles/v1/expenses', ({ request }) => {
      const older = new URL(request.url).searchParams.has('cursor');
      return HttpResponse.json({
        data: {
          expenses: [expenses[older ? 1 : 0]],
          expensesTotal: 123,
          nextCursor: older ? null : 'expense-0',
        },
      });
    })
  );

  renderWithProviders(<VehiclePage />);
  const fuelTotal = await screen.findByText(/^All-time fuel cost:/);
  const expenseTotal = screen.getByText(/^All-time expenses:/);
  const fuelRows = within(await screen.findByRole('table', { name: 'Fill-up records' }));
  const expenseRows = within(await screen.findByRole('table', { name: 'Expense records' }));
  expect(fuelRows.getAllByRole('row')).toHaveLength(2);
  expect(expenseRows.getAllByRole('row')).toHaveLength(2);
  expect(fuelTotal).toHaveTextContent(/80[.,]00/);
  expect(expenseTotal).toHaveTextContent(/112[.,]00/);

  const buttons = screen.getAllByRole('button', { name: 'Load more' });
  expect(buttons).toHaveLength(2);
  buttons.forEach(button => fireEvent.click(button));
  await waitFor(() => {
    expect(fuelRows.getAllByRole('row')).toHaveLength(3);
    expect(expenseRows.getAllByRole('row')).toHaveLength(3);
  });
  expect(screen.getByText(/^All-time fuel cost:/)).toHaveTextContent(/80[.,]00/);
  expect(screen.getByText(/^All-time expenses:/)).toHaveTextContent(/112[.,]00/);
});

it('shows the saved fuel cost when the first summary request started before the save', async () => {
  let releaseFirstSummary!: () => void;
  const firstSummary = new Promise<void>(resolve => {
    releaseFirstSummary = resolve;
  });
  let summaryStarted = false;
  let fuelCostLifetime = 0;
  server.use(
    http.get('/api/vehicles/v1', () =>
      HttpResponse.json({ data: { vehicle: { id: 'v1', name: 'Car A', canWrite: true } } })
    ),
    http.get('/api/vehicles/v1/summary', async () => {
      const data = { ...computeVehicleSummary([], []), fuelCostLifetime };
      if (!summaryStarted) {
        summaryStarted = true;
        await firstSummary;
      }
      return HttpResponse.json({ data });
    }),
    http.post('/api/vehicles/v1/fillups', () => {
      fuelCostLifetime = 45;
      return HttpResponse.json({ data: { id: 'f1' } }, { status: 201 });
    })
  );

  renderWithProviders(<VehiclePage />);
  try {
    await waitFor(() => expect(summaryStarted).toBe(true));
    fireEvent.click(await screen.findByRole('button', { name: 'Add fill-up' }));
    const dialog = within(await screen.findByLabelText(/Add fill-up dialog/i));
    fireEvent.change(dialog.getByLabelText(/Odometer km/i), { target: { value: '1000' } });
    fireEvent.change(dialog.getByLabelText(/Liters/i), { target: { value: '30' } });
    fireEvent.change(dialog.getByLabelText(/Price per liter/i), { target: { value: '1.5' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save fill-up' }));
    await waitFor(() => expect(screen.queryByLabelText(/Add fill-up dialog/i)).toBeNull());
  } finally {
    releaseFirstSummary();
  }
  await waitFor(() =>
    expect(screen.getByText(/^All-time fuel cost:/)).toHaveTextContent(/45[.,]00/)
  );
});

it('shows a mounted-tire summary and links to tire management without inline write controls', async () => {
  server.use(
    http.get('/api/vehicles/v1/tires', () =>
      HttpResponse.json({
        data: { tireSets: [{ id: 't1', name: 'Nokian Winter', status: 'ACTIVE' }] },
      })
    )
  );
  renderWithProviders(<VehiclePage />);
  expect(await screen.findByText('Nokian Winter mounted')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Manage tires' })).toHaveAttribute(
    'href',
    '/car/v1/tires'
  );
  expect(screen.queryByRole('button', { name: /add (tire )?set/i })).not.toBeInTheDocument();
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
  expect(screen.queryByText(/^All-time (fuel cost|expenses):/)).not.toBeInTheDocument();
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
  expect(screen.queryByRole('button', { name: 'More vehicle actions' })).not.toBeInTheDocument();
  fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'More vehicle actions' })).toBeInTheDocument();
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

  fireEvent.click(screen.getByRole('button', { name: 'More vehicle actions' }));
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Edit vehicle' }));
  expect(dialog.getByLabelText('Name')).toHaveValue('Car A');
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'More vehicle actions' })).toHaveFocus()
  );
});

it.each(['Add expense', 'Add fill-up'])('%s opens without focusing the date field', async name => {
  server.use(
    http.get('/api/vehicles/:vehicleId', () =>
      HttpResponse.json({
        data: { vehicle: { id: 'v1', name: 'Car A', canEdit: true, canWrite: true } },
      })
    )
  );
  renderWithProviders(<VehiclePage />);
  const trigger = await screen.findByRole('button', { name });
  fireEvent.click(trigger);

  const dialog = within(await screen.findByRole('dialog', { name }));
  expect(dialog.getByRole('heading', { name })).toHaveFocus();
  expect(dialog.getByLabelText('Date', { exact: true })).toBeEnabled();

  fireEvent.click(dialog.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it.each([
  ['touch', fireEvent.touchStart],
  ['click', fireEvent.click],
])('dismisses the header actions on an outside %s without a pointer event', async (_, press) => {
  renderWithProviders(<VehiclePage />);
  const menu = await screen.findByRole('button', { name: 'More vehicle actions' });

  fireEvent.click(menu);
  const download = screen.getByRole('link', { name: 'Download for spreadsheet' });
  fireEvent.touchStart(download);
  expect(menu).toHaveAttribute('aria-expanded', 'true');

  press(screen.getByRole('main'));
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(download).not.toBeInTheDocument();
});

it.each([
  ['owner', true],
  ['editor', false],
])(
  'keeps logging visible and offers spreadsheet export without backup actions for an %s',
  async (_, canEdit) => {
    server.use(
      http.get('/api/vehicles/:vehicleId', () =>
        HttpResponse.json({
          data: { vehicle: { id: 'v1', name: 'Car A', canEdit, canWrite: true } },
        })
      )
    );
    renderWithProviders(<VehiclePage />);
    const controls = within(await screen.findByRole('group', { name: 'Vehicle controls' }));
    const fillUp = controls.getByRole('button', { name: 'Add fill-up' });
    expect(fillUp).toBeVisible();
    expect(controls.getByRole('button', { name: 'Add expense' })).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Download for spreadsheet' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete vehicle' })).not.toBeInTheDocument();

    fireEvent.click(fillUp);
    const fillUpDialog = await screen.findByRole('dialog', { name: 'Add fill-up' });
    fireEvent.click(within(fillUpDialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(fillUp).toHaveFocus());

    const menu = controls.getByRole('button', { name: 'More vehicle actions' });
    expect(menu).toHaveTextContent('More');
    fireEvent.click(menu);
    expect(screen.queryByRole('link', { name: 'Download backup' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import backup' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download for spreadsheet' })).toHaveAttribute(
      'href',
      '/api/vehicles/v1/export'
    );
    if (canEdit) {
      fireEvent.click(screen.getByRole('button', { name: 'Delete vehicle' }));
      const confirmation = await screen.findByRole('dialog', { name: 'Delete vehicle' });
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(menu).toHaveFocus());
    } else {
      expect(screen.queryByRole('button', { name: 'Delete vehicle' })).not.toBeInTheDocument();
    }
  }
);

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
    ),
    http.get('/api/vehicles/v1/attachments', () =>
      HttpResponse.json({
        data: {
          attachments: [{ id: 'file1', filename: 'receipt.pdf' }],
          canUpload: false,
          maxAttachments: 10,
          remainingCapacity: 9,
        },
        error: null,
      })
    )
  );
  renderWithProviders(<VehiclePage />);
  const menu = await screen.findByRole('button', { name: 'More vehicle actions' });
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
  expect(
    await within(dialog).findByRole('link', { name: 'Open receipt.pdf in a new tab' })
  ).toHaveAttribute('href', '/api/vehicles/v1/attachments/file1/open');
  expect(within(dialog).queryByRole('button', { name: 'Manage files' })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  const [footerClose, cornerClose] = within(dialog).getAllByRole('button', { name: 'Close' });
  expect(footerClose).toBeVisible();
  expect(cornerClose).toBeVisible();
  fireEvent.click(footerClose);
  await waitFor(() => expect(vehicleName).toHaveFocus());
  expect(screen.queryByRole('button', { name: 'Add fill-up' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
});

it('loads documents only when details open and lets users retry without hiding vehicle fields', async () => {
  const list = vi.fn().mockReturnValueOnce(HttpResponse.json({}, { status: 500 }));
  list.mockImplementation(() =>
    HttpResponse.json({
      data: { attachments: [], canUpload: true, maxAttachments: 10, remainingCapacity: 10 },
      error: null,
    })
  );
  server.use(
    http.get('/api/vehicles/v1/attachments', () => list()),
    http.get('/api/vehicles/v1', () =>
      HttpResponse.json({
        data: { vehicle: { id: 'v1', name: 'Car A', canEdit: false, canWrite: true } },
      })
    )
  );
  renderWithProviders(<VehiclePage />);
  const vehicleName = await screen.findByRole('button', { name: 'Car A' });
  expect(list).not.toHaveBeenCalled();
  fireEvent.click(vehicleName);
  const dialog = within(await screen.findByRole('dialog', { name: 'Vehicle details' }));
  const refresh = await dialog.findByRole('button', { name: 'Refresh attachments' });
  expect(dialog.getByText('Car A')).toBeVisible();
  expect(dialog.queryByRole('button', { name: 'Manage files' })).not.toBeInTheDocument();
  fireEvent.click(refresh);
  expect(await dialog.findByText('No files yet.')).toBeVisible();
  expect(dialog.queryByRole('button', { name: 'Edit details' })).toBeNull();
  fireEvent.click(dialog.getByRole('button', { name: 'Manage files' }));
  expect(dialog.getByRole('heading', { name: 'Manage vehicle files' })).toHaveFocus();
  expect(dialog.queryByRole('term')).toBeNull();
  expect(dialog.getByRole('button', { name: 'Upload file' })).toBeVisible();
  fireEvent.click(dialog.getByRole('button', { name: 'Done' }));
  expect(dialog.getByRole('button', { name: 'Manage files' })).toHaveFocus();
});

it('returns an owner to the updated vehicle summary and preserves a zero odometer', async () => {
  let name = 'Car A';
  const patch = vi.fn();
  server.use(
    http.get('/api/vehicles/v1', () =>
      HttpResponse.json({
        data: { vehicle: { id: 'v1', name, initialOdometer: 0, canEdit: true, canWrite: true } },
      })
    ),
    http.get('/api/vehicles/v1/attachments', () =>
      HttpResponse.json({
        data: { attachments: [], canUpload: true, maxAttachments: 10, remainingCapacity: 10 },
      })
    ),
    http.patch('/api/vehicles/v1', async ({ request }) => {
      const body = (await request.json()) as { name: string };
      patch(body);
      name = body.name;
      return HttpResponse.json({ data: { id: 'v1' } });
    })
  );
  renderWithProviders(<VehiclePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Car A' }));
  const dialog = within(screen.getByRole('dialog'));
  fireEvent.click(dialog.getByRole('button', { name: 'Edit details' }));
  expect(dialog.getByLabelText('Initial Odometer')).toHaveValue(0);
  fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Car B' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
  expect(await dialog.findByText('Car B', { selector: 'dd' })).toBeVisible();
  expect(patch).toHaveBeenCalledExactlyOnceWith({ name: 'Car B' });
  expect(dialog.getByRole('button', { name: 'Edit details' })).toHaveFocus();
});

it('waits for the saved vehicle to refresh before reopening More → Edit', async () => {
  let saved = false;
  let release!: () => void;
  const refresh = new Promise<void>(resolve => {
    release = resolve;
  });
  server.use(
    http.get('/api/vehicles/v1', async () => {
      if (saved) await refresh;
      return HttpResponse.json({
        data: {
          vehicle: { id: 'v1', name: saved ? 'Car B' : 'Car A', canEdit: true, canWrite: true },
        },
      });
    }),
    http.patch('/api/vehicles/v1', () => {
      saved = true;
      return HttpResponse.json({ data: { id: 'v1' } });
    })
  );
  renderWithProviders(<VehiclePage />);
  const menu = await screen.findByRole('button', { name: 'More vehicle actions' });
  fireEvent.click(menu);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Car B' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  try {
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(menu);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
  } finally {
    release();
  }
  const edit = screen.getByRole('button', { name: 'Edit' });
  await waitFor(() => expect(edit).toBeEnabled());
  fireEvent.click(edit);
  expect(screen.getByLabelText('Name')).toHaveValue('Car B');
});
