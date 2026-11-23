import type { FC, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TireChangeLogDto, TireSetDto } from '@/queries/tires';

// Mock the tire queries
vi.mock('@/queries/tires', () => ({
  listTireSets: vi.fn(),
  createTireSet: vi.fn(),
  deleteTireSet: vi.fn(),
  logTireChange: vi.fn(),
  getTireChangeHistory: vi.fn(),
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useFillUps: vi.fn(),
    useTireSets: vi.fn(),
    useTireChangeHistory: vi.fn(),
    useCreateTireSet: vi.fn(),
    useUpdateTireSet: vi.fn(),
    useDeleteTireSet: vi.fn(),
    useLogTireChange: vi.fn(),
    useUpdateTireChangeLog: vi.fn(),
    useDeleteTireChangeLog: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: vi.fn(() => null),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Provider: FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Provider.displayName = 'QueryClientWrapper';
  return Provider;
};

const buildChangeLog = (overrides: Partial<TireChangeLogDto> = {}): TireChangeLogDto => ({
  id: overrides.id ?? 'log-id',
  vehicleId: overrides.vehicleId ?? 'v1',
  tireSetId: overrides.tireSetId ?? 't1',
  date: overrides.date ?? '2024-06-01',
  odometerKm: overrides.odometerKm === undefined ? 10000 : overrides.odometerKm,
  odometerConfirmed: overrides.odometerConfirmed ?? true,
  notes: overrides.notes ?? null,
});

const buildTireSet = (overrides: Partial<TireSetDto> = {}): TireSetDto => ({
  id: overrides.id ?? 't1',
  vehicleId: overrides.vehicleId ?? 'v1',
  name: overrides.name ?? 'Summer Tires',
  type: overrides.type ?? 'SUMMER',
  status: overrides.status ?? 'ACTIVE',
  totalKm: overrides.totalKm ?? 0,
  purchaseDate: overrides.purchaseDate ?? null,
  notes: overrides.notes ?? null,
  createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00.000Z',
  changeLogs: overrides.changeLogs ?? [],
});

describe('TireManager', () => {
  const mockMutateAsync = vi.fn();
  const mockMutation = {
    mutateAsync: mockMutateAsync,
    isPending: false,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});

    const hooks = await import('@/hooks');
    vi.mocked(hooks.useFillUps).mockReturnValue({
      data: { fillUps: [] },
    } as unknown as ReturnType<typeof hooks.useFillUps>);
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    vi.mocked(hooks.useTireChangeHistory).mockReturnValue({
      data: { history: [] },
    } as unknown as ReturnType<typeof hooks.useTireChangeHistory>);
    vi.mocked(hooks.useCreateTireSet).mockReturnValue(
      mockMutation as unknown as ReturnType<typeof hooks.useCreateTireSet>
    );
    vi.mocked(hooks.useUpdateTireSet).mockReturnValue(
      mockMutation as unknown as ReturnType<typeof hooks.useUpdateTireSet>
    );
    vi.mocked(hooks.useDeleteTireSet).mockReturnValue(
      mockMutation as unknown as ReturnType<typeof hooks.useDeleteTireSet>
    );
    vi.mocked(hooks.useLogTireChange).mockReturnValue(
      mockMutation as unknown as ReturnType<typeof hooks.useLogTireChange>
    );
    vi.mocked(hooks.useUpdateTireChangeLog).mockReturnValue(
      mockMutation as unknown as ReturnType<typeof hooks.useUpdateTireChangeLog>
    );
    vi.mocked(hooks.useDeleteTireChangeLog).mockReturnValue(
      mockMutation as unknown as ReturnType<typeof hooks.useDeleteTireChangeLog>
    );
  });

  it('renders loading state initially', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof hooks.useTireSets>);

    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    expect(screen.getByRole('status')).toHaveTextContent('Loading tires');
  });

  it('renders tire sets when loaded', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: {
        tireSets: [
          buildTireSet({
            id: 't1',
            status: 'ACTIVE',
            changeLogs: [buildChangeLog({ tireSetId: 't1', odometerKm: 10000 })],
          }),
          buildTireSet({
            id: 't2',
            name: 'Winter Tires',
            type: 'WINTER',
            status: 'STORED',
            changeLogs: [],
          }),
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);

    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Summer Tires' })).toBeInTheDocument();
    });

    expect(screen.getByText('Winter Tires')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Other tire sets' })).toBeInTheDocument();
  });

  it('focuses the Add tire set title instead of a form field on open', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);

    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: 'Add tire set' });
    await user.click(addButton);

    const dialog = within(screen.getByRole('dialog', { name: 'Add tire set' }));
    expect(dialog.getByRole('heading', { name: 'Add tire set' })).toHaveFocus();
    await user.tab();
    expect(dialog.getByLabelText('Name')).toHaveFocus();
  });

  it('creates a tire set through the dialog', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);

    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Add tire set' }));
    await user.type(screen.getByPlaceholderText(/Nokian Hakkapeliitta/i), 'Winter Set');
    await user.selectOptions(screen.getByLabelText('Type'), 'WINTER');
    await user.type(screen.getByLabelText('Purchase date (optional)'), '2024-12-01');
    await user.type(screen.getByLabelText('Notes (optional)'), 'Stored at home');

    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Add tire set' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Winter Set',
          type: 'WINTER',
          purchaseDate: '2024-12-01',
          notes: 'Stored at home',
        })
      );
    });
  });

  it('edits an existing set and can clear optional fields', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [buildTireSet({ notes: 'Old notes', purchaseDate: '2024-06-01' })] },
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    expect(screen.getByText('Old notes')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Edit details' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit tire set' }));
    expect(dialog.getByRole('heading', { name: 'Edit tire set' })).toHaveFocus();
    expect(dialog.getByLabelText('Name')).toHaveValue('Summer Tires');
    await user.clear(dialog.getByLabelText('Name'));
    await user.type(dialog.getByLabelText('Name'), 'New name');
    await user.clear(dialog.getByLabelText('Notes (optional)'));
    await user.clear(dialog.getByLabelText('Purchase date (optional)'));
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      tireSetId: 't1',
      name: 'New name',
      type: 'SUMMER',
      notes: null,
      purchaseDate: null,
    });
  });

  it('preselects the first stored set when mounting and restores focus on cancel', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [buildTireSet({ status: 'STORED' })] },
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    const mount = screen.getByRole('button', { name: 'Mount this set' });
    await user.click(mount);
    const dialog = within(screen.getByRole('dialog', { name: 'Mount tire set' }));
    expect(dialog.getByRole('heading', { name: 'Mount tire set' })).toHaveFocus();
    expect(dialog.getByLabelText('Set to mount')).toHaveValue('t1');
    expect(dialog.getByLabelText(/car odometer at tire change/i)).not.toBeRequired();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(mount).toHaveFocus());
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('keeps a used set out of the delete flow', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [buildTireSet({ status: 'STORED', changeLogs: [buildChangeLog()] })] },
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await user.click(screen.getByText('More actions'));
    expect(screen.getByRole('button', { name: 'Retire' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete set' })).not.toBeInTheDocument();
  });

  it('offers a retry when history fails rather than displaying an empty history', async () => {
    const hooks = await import('@/hooks');
    const retrySets = vi.fn();
    const retryHistory = vi.fn();
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [] },
      refetch: retrySets,
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    vi.mocked(hooks.useTireChangeHistory).mockReturnValue({
      error: new Error('Request failed'),
      refetch: retryHistory,
    } as unknown as ReturnType<typeof hooks.useTireChangeHistory>);
    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByText('No tire changes recorded.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retrySets).toHaveBeenCalled();
    expect(retryHistory).toHaveBeenCalled();
  });

  it('deletes a tire set after confirmation', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: {
        tireSets: [
          buildTireSet({
            id: 'active',
            name: 'Mounted',
            changeLogs: [buildChangeLog({ tireSetId: 'active' })],
          }),
          buildTireSet({
            id: 'stored',
            name: 'Stored',
            type: 'WINTER',
            status: 'STORED',
            changeLogs: [],
          }),
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('More actions'));
    await user.click(screen.getByRole('button', { name: 'Delete set' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('stored');
    });
  });

  it('logs a tire change when swapping sets', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: {
        tireSets: [
          buildTireSet({
            id: 'active',
            name: 'Mounted',
            changeLogs: [buildChangeLog({ tireSetId: 'active' })],
          }),
          buildTireSet({
            id: 'stored',
            name: 'Stored',
            type: 'WINTER',
            status: 'STORED',
            changeLogs: [],
          }),
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Change tires' }));
    expect(screen.getByRole('heading', { name: 'Change tires' })).toHaveFocus();
    expect(screen.getByText(/Mounted will move to storage\./)).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Set to mount'), 'stored');
    await user.type(screen.getByLabelText(/odometer at tire change/i), '12000');
    await user.type(screen.getByLabelText('Notes (optional)'), 'Switched before a trip');

    await user.click(screen.getByRole('button', { name: 'Confirm change' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          tireSetId: 'stored',
          odometerKm: 12000,
          notes: 'Switched before a trip',
        })
      );
    });
  });

  it('offers adding another set instead of a change action when there is no spare', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: {
        tireSets: [
          buildTireSet({
            id: 'active',
            name: 'Mounted',
            status: 'ACTIVE',
            changeLogs: [buildChangeLog({ tireSetId: 'active' })],
          }),
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);

    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Change tires' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add tire set' })).toBeEnabled();
  });

  it('shows confirmed mileage separately from the current fill-up estimate and legacy totals', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: {
        tireSets: [
          buildTireSet({
            id: 'active',
            name: 'Mounted',
            status: 'ACTIVE',
            totalKm: 4000,
            changeLogs: [
              buildChangeLog({ tireSetId: 'active', date: '2024-04-01', odometerKm: 15000 }),
            ],
          }),
          buildTireSet({
            id: 'stored',
            name: 'Stored',
            type: 'WINTER',
            status: 'STORED',
            totalKm: 0,
            changeLogs: [],
          }),
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    vi.mocked(hooks.useTireChangeHistory).mockReturnValue({
      data: {
        history: [
          buildChangeLog({ id: 'old', tireSetId: 'stored', date: '2024-01-01', odometerKm: 10000 }),
          buildChangeLog({ id: 'new', tireSetId: 'active', date: '2024-04-01', odometerKm: 15000 }),
        ],
      },
    } as unknown as ReturnType<typeof hooks.useTireChangeHistory>);
    vi.mocked(hooks.useFillUps).mockReturnValue({
      data: { fillUps: [{ date: '2024-04-15', odometerKm: 16200 }] },
    } as unknown as ReturnType<typeof hooks.useFillUps>);

    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Other tire sets' })).toBeInTheDocument();
    });

    expect(screen.getByText(`${(5000).toLocaleString()} km confirmed`)).toBeVisible();
    expect(screen.getByText(/km since install · through .* fill-up/)).toHaveTextContent(
      `~${(1200).toLocaleString()} km`
    );
    expect(screen.getByText(/Previous tracked total/)).toHaveTextContent(
      `${(4000).toLocaleString()} km`
    );
  });

  it('saves a mount without a reading even when a fill-up exists', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [buildTireSet({ status: 'STORED' })] },
    } as unknown as ReturnType<typeof hooks.useTireSets>);
    vi.mocked(hooks.useFillUps).mockReturnValue({
      data: { fillUps: [{ date: '2026-11-22', odometerKm: 12000 }] },
    } as unknown as ReturnType<typeof hooks.useFillUps>);
    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });
    await user.click(screen.getByRole('button', { name: 'Mount this set' }));
    expect(screen.getByLabelText(/car odometer at tire change/i)).toHaveValue(null);
    await user.click(screen.getByRole('button', { name: 'Mount tire set' }));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tireSetId: 't1', odometerKm: null })
    );
  });

  it('lets the user enter an exact reading for an unverified change', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireChangeHistory).mockReturnValue({
      data: { history: [buildChangeLog({ odometerConfirmed: false })] },
    } as unknown as ReturnType<typeof hooks.useTireChangeHistory>);
    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await user.click(screen.getByText('View tire changes (1)'));
    await user.click(screen.getByRole('button', { name: 'Edit change' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit tire change' }));
    expect(dialog.getByRole('heading', { name: 'Edit tire change' })).toHaveFocus();
    await user.tab();
    expect(dialog.getByLabelText('Date')).toHaveFocus();
    const reading = screen.getByRole('spinbutton');
    expect(reading).toHaveValue(null);
    expect(screen.getByText(/Previous reading:/)).toBeVisible();
    await user.type(reading, '10500');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ logId: 'log-id', odometerKm: 10500 })
    );
  });

  it('loads a change note from history and can clear it without changing mileage', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireChangeHistory).mockReturnValue({
      data: { history: [buildChangeLog({ notes: 'Tread 5 mm' })] },
    } as unknown as ReturnType<typeof hooks.useTireChangeHistory>);
    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" canWrite />, { wrapper: createWrapper() });

    await user.click(screen.getByText('View tire changes (1)'));
    expect(screen.getByText('Tread 5 mm')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Edit change' }));
    const notes = screen.getByLabelText('Notes (optional)');
    expect(notes).toHaveValue('Tread 5 mm');
    await user.clear(notes);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(mockMutateAsync).toHaveBeenCalledWith({ logId: 'log-id', notes: null });
  });
});
