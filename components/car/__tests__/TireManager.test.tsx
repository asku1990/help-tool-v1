import type { FC, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TireChangeLogDto, TireSetDto } from '@/queries/tires';
import { toast } from 'sonner';

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
    useLatestOdometer: vi.fn(),
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
  odometerKm: overrides.odometerKm ?? 10000,
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
    vi.mocked(hooks.useLatestOdometer).mockReturnValue(null);
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
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading tires...')).toBeInTheDocument();
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
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Current: Summer Tires/)).toBeInTheDocument();
    });

    expect(screen.getByText('Winter Tires')).toBeInTheDocument();
    // The "Stored" heading for stored tire sets section
    expect(screen.getByRole('heading', { name: 'Stored', level: 4 })).toBeInTheDocument();
  });

  it('shows add tire set dialog when clicking Add Set', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);

    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Add Set/i });
    await user.click(addButton);

    expect(screen.getAllByText('Add Tire Set')[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nokian Hakkapeliitta/i)).toBeInTheDocument();
  });

  it('creates a tire set through the dialog', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: { tireSets: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useTireSets>);

    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Add Set/i }));
    await user.type(screen.getByPlaceholderText(/Nokian Hakkapeliitta/i), 'Winter Set');
    await user.selectOptions(screen.getByLabelText('Type'), 'WINTER');
    await user.type(screen.getByLabelText('Purchase Date'), '2024-12-01');

    await user.click(screen.getByRole('button', { name: /Add Tire Set/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Winter Set',
          type: 'WINTER',
          purchaseDate: '2024-12-01',
        })
      );
    });
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
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    // Click the delete button (×)
    const deleteButtons = screen.getAllByRole('button', { name: /×/ });
    await user.click(deleteButtons[0]);

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
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Swap/i }));

    await user.selectOptions(screen.getByLabelText('Select Set to Mount'), 'stored');
    await user.type(screen.getByLabelText('Odometer (km)'), '12000');

    await user.click(screen.getByRole('button', { name: /Confirm Swap/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          tireSetId: 'stored',
          odometerKm: 12000,
        })
      );
    });
  });

  it('shows toast when trying to swap without stored sets', async () => {
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

    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Swap/i }));

    expect(toast.info).toHaveBeenCalledWith('Add another tire set first to swap.');
  });

  it('shows computed km when totalKm is 0 but history exists', async () => {
    const hooks = await import('@/hooks');
    vi.mocked(hooks.useTireSets).mockReturnValue({
      data: {
        tireSets: [
          buildTireSet({
            id: 'active',
            name: 'Mounted',
            status: 'ACTIVE',
            totalKm: 0,
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
          buildChangeLog({ tireSetId: 'stored', date: '2024-01-01', odometerKm: 10000 }),
          buildChangeLog({ tireSetId: 'active', date: '2024-04-01', odometerKm: 15000 }),
        ],
      },
    } as unknown as ReturnType<typeof hooks.useTireChangeHistory>);

    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      // The "Stored" heading for stored tire sets section
      expect(screen.getByRole('heading', { name: 'Stored', level: 4 })).toBeInTheDocument();
    });

    const totalLines = screen.getAllByText(/Total:/i);
    const has5000km = totalLines.some(line =>
      (line.textContent ?? '').replace(/\D/g, '').includes('5000')
    );
    expect(has5000km).toBe(true);
  });
});
