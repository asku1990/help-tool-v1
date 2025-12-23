import type { FC, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ExpenseDto } from '@/queries/expenses';
import type { useExpenses as useExpensesHook } from '@/hooks/useExpenses';
import type { useFillUps as useFillUpsHook } from '@/hooks/useFillUps';

vi.mock('@/hooks/useExpenses', () => ({
  useExpenses: vi.fn(),
}));

vi.mock('@/hooks/useFillUps', () => ({
  useFillUps: vi.fn(),
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

type UseExpensesResult = ReturnType<typeof useExpensesHook>;
type UseFillUpsResult = ReturnType<typeof useFillUpsHook>;

const buildExpense = (overrides: Partial<ExpenseDto> = {}): ExpenseDto => ({
  id: overrides.id ?? 'expense-id',
  date: overrides.date ?? '2024-01-01',
  category: overrides.category ?? 'MAINTENANCE',
  amount: overrides.amount ?? 0,
  vendor: overrides.vendor,
  odometerKm: overrides.odometerKm,
  liters: overrides.liters,
  notes: overrides.notes,
});

const buildExpensesResult = (expenses: ExpenseDto[]): UseExpensesResult =>
  ({
    data: { expenses, expensesTotal: expenses.length, nextCursor: null },
  }) as UseExpensesResult;

const buildFillUpsResult = (
  fillUps: Array<{ odometerKm: number; date: string }>
): UseFillUpsResult =>
  ({
    data: { fillUps, nextCursor: null },
  }) as unknown as UseFillUpsResult;

describe('OilConsumptionChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows message when no oil changes recorded', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    const { useFillUps } = await import('@/hooks/useFillUps');
    vi.mocked(useExpenses).mockReturnValue(buildExpensesResult([]));
    vi.mocked(useFillUps).mockReturnValue(buildFillUpsResult([]));

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/No oil changes recorded yet/i)).toBeInTheDocument();
  });

  it('displays last oil change info', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    const { useFillUps } = await import('@/hooks/useFillUps');
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-15',
          category: 'OIL_CHANGE',
          liters: 4,
          odometerKm: 50000,
        }),
      ])
    );
    vi.mocked(useFillUps).mockReturnValue(
      buildFillUpsResult([{ odometerKm: 55000, date: '2024-02-01' }])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Last Oil Change/i)).toBeInTheDocument();
    expect(screen.getByText(/50,000 km/i)).toBeInTheDocument();
    expect(screen.getByText(/5,000/i)).toBeInTheDocument(); // km since change (shown as number in Km box)
  });

  it('shows top-ups since last oil change', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    const { useFillUps } = await import('@/hooks/useFillUps');
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-01',
          category: 'OIL_CHANGE',
          liters: 4,
          odometerKm: 50000,
        }),
        buildExpense({
          id: 'e2',
          date: '2024-02-01',
          category: 'OIL_TOP_UP',
          liters: 0.5,
          odometerKm: 55000,
        }),
      ])
    );
    vi.mocked(useFillUps).mockReturnValue(
      buildFillUpsResult([{ odometerKm: 60000, date: '2024-03-01' }])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Topped up/i)).toBeInTheDocument();
    // Multiple elements show 0.5 L (summary + list item), so use getAllByText
    expect(screen.getAllByText(/0\.5 L/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Top-ups since last change/i)).toBeInTheDocument();
  });

  it('shows consumption rate when top-ups exist', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    const { useFillUps } = await import('@/hooks/useFillUps');
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-01',
          category: 'OIL_CHANGE',
          liters: 4,
          odometerKm: 50000,
        }),
        buildExpense({
          id: 'e2',
          date: '2024-02-01',
          category: 'OIL_TOP_UP',
          liters: 1,
          odometerKm: 55000,
        }),
      ])
    );
    vi.mocked(useFillUps).mockReturnValue(
      buildFillUpsResult([{ odometerKm: 60000, date: '2024-03-01' }])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Consumption Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/L \/ 10,000 km/i)).toBeInTheDocument();
  });

  it('shows None for topped up when no top-ups', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    const { useFillUps } = await import('@/hooks/useFillUps');
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-01',
          category: 'OIL_CHANGE',
          liters: 4,
          odometerKm: 50000,
        }),
      ])
    );
    vi.mocked(useFillUps).mockReturnValue(
      buildFillUpsResult([{ odometerKm: 60000, date: '2024-03-01' }])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Topped up/i)).toBeInTheDocument();
    expect(screen.getByText(/None/i)).toBeInTheDocument();
  });

  it('includes same-day top-up when odometer is higher than oil change', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    const { useFillUps } = await import('@/hooks/useFillUps');
    // Same day: oil change at 50000km, top-up at 50100km
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-01',
          category: 'OIL_CHANGE',
          liters: 4,
          odometerKm: 50000,
        }),
        buildExpense({
          id: 'e2',
          date: '2024-01-01', // Same day!
          category: 'OIL_TOP_UP',
          liters: 0.5,
          odometerKm: 50100, // Higher odometer = happened after
        }),
      ])
    );
    vi.mocked(useFillUps).mockReturnValue(
      buildFillUpsResult([{ odometerKm: 55000, date: '2024-02-01' }])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    // Should show the top-up, not "None"
    expect(screen.getAllByText(/0\.5 L/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Top-ups since last change/i)).toBeInTheDocument();
  });

  it('excludes same-day top-up when odometer is lower than oil change', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    const { useFillUps } = await import('@/hooks/useFillUps');
    // Same day: top-up at 49900km (before oil change), oil change at 50000km
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-01',
          category: 'OIL_CHANGE',
          liters: 4,
          odometerKm: 50000,
        }),
        buildExpense({
          id: 'e2',
          date: '2024-01-01', // Same day!
          category: 'OIL_TOP_UP',
          liters: 0.5,
          odometerKm: 49900, // Lower odometer = happened before (shouldn't count)
        }),
      ])
    );
    vi.mocked(useFillUps).mockReturnValue(
      buildFillUpsResult([{ odometerKm: 55000, date: '2024-02-01' }])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    // Should show "None" because top-up was before oil change
    expect(screen.getByText(/Topped up/i)).toBeInTheDocument();
    expect(screen.getByText(/None/i)).toBeInTheDocument();
  });
});
