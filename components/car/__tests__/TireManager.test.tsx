import type { FC, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/hooks', () => ({
  useLatestOdometer: vi.fn(),
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
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getTireChangeHistory } = await import('@/queries/tires');
    vi.mocked(getTireChangeHistory).mockResolvedValue({ history: [] });

    const { useLatestOdometer } = await import('@/hooks');
    vi.mocked(useLatestOdometer).mockReturnValue(null);
  });

  it('renders loading state initially', async () => {
    const { listTireSets } = await import('@/queries/tires');
    vi.mocked(listTireSets).mockReturnValue(new Promise(() => {})); // Never resolves

    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading tires...')).toBeInTheDocument();
  });

  it('renders tire sets when loaded', async () => {
    const { listTireSets } = await import('@/queries/tires');
    vi.mocked(listTireSets).mockResolvedValue({
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
    });

    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Current: Summer Tires/)).toBeInTheDocument();
    });

    expect(screen.getByText('Winter Tires')).toBeInTheDocument();
    expect(screen.getByText('Stored Sets')).toBeInTheDocument();
  });

  it('shows add tire set dialog when clicking Add Set', async () => {
    const { listTireSets } = await import('@/queries/tires');
    vi.mocked(listTireSets).mockResolvedValue({ tireSets: [] });

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
    const { listTireSets, createTireSet } = await import('@/queries/tires');
    vi.mocked(listTireSets).mockResolvedValue({ tireSets: [] });
    vi.mocked(createTireSet).mockResolvedValue({ id: 't1' });

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
      expect(createTireSet).toHaveBeenCalledWith(
        'v1',
        expect.objectContaining({
          name: 'Winter Set',
          type: 'WINTER',
          purchaseDate: '2024-12-01',
        })
      );
    });
  });

  it('deletes a tire set after confirmation', async () => {
    const { listTireSets, deleteTireSet } = await import('@/queries/tires');
    vi.mocked(listTireSets).mockResolvedValue({
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
    });
    vi.mocked(deleteTireSet).mockResolvedValue({ id: 'stored' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByText('Loading tires...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(deleteTireSet).toHaveBeenCalledWith('v1', 'stored');
    });
  });

  it('logs a tire change when swapping sets', async () => {
    const { listTireSets, logTireChange } = await import('@/queries/tires');
    vi.mocked(listTireSets).mockResolvedValue({
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
    });
    vi.mocked(logTireChange).mockResolvedValue({ id: 'log1' });
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);

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
      expect(logTireChange).toHaveBeenCalledWith(
        'v1',
        expect.objectContaining({
          tireSetId: 'stored',
          odometerKm: 12000,
        })
      );
    });
  });

  it('shows computed km when totalKm is 0 but history exists', async () => {
    const { listTireSets, getTireChangeHistory } = await import('@/queries/tires');
    vi.mocked(listTireSets).mockResolvedValue({
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
    });
    vi.mocked(getTireChangeHistory).mockResolvedValue({
      history: [
        buildChangeLog({ tireSetId: 'stored', date: '2024-01-01', odometerKm: 10000 }),
        buildChangeLog({ tireSetId: 'active', date: '2024-04-01', odometerKm: 15000 }),
      ],
    });

    const TireManager = (await import('../TireManager')).default;
    render(<TireManager vehicleId="v1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Stored')).toBeInTheDocument();
    });

    const totalLines = screen.getAllByText(/Total:/i);
    const has5000km = totalLines.some(line =>
      (line.textContent ?? '').replace(/\D/g, '').includes('5000')
    );
    expect(has5000km).toBe(true);
  });
});
