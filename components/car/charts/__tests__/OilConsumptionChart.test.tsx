import type { FC, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ExpenseDto } from '@/queries/expenses';
import type { useExpenses as useExpensesHook } from '@/hooks/useExpenses';

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  Bar: () => <div />,
  Line: () => <div />,
}));

vi.mock('@/hooks/useExpenses', () => ({
  useExpenses: vi.fn(),
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

const buildExpense = (overrides: Partial<ExpenseDto> = {}): ExpenseDto => ({
  id: overrides.id ?? 'expense-id',
  date: overrides.date ?? '2024-01-01',
  category: overrides.category ?? 'MAINTENANCE',
  amount: overrides.amount ?? 0,
  vendor: overrides.vendor,
  odometerKm: overrides.odometerKm,
  liters: overrides.liters,
  isOilChange: overrides.isOilChange,
  notes: overrides.notes,
});

const buildExpensesResult = (expenses: ExpenseDto[]): UseExpensesResult =>
  ({
    data: { expenses, expensesTotal: expenses.length, nextCursor: null },
  }) as UseExpensesResult;

describe('OilConsumptionChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows message when not enough data', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-01',
          liters: 1,
          odometerKm: 10000,
          isOilChange: false,
        }),
      ])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Not enough data to calculate consumption/i)).toBeInTheDocument();
  });

  it('displays chart with oil consumption data', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-01',
          liters: 1,
          odometerKm: 10000,
          isOilChange: true,
        }),
        buildExpense({
          id: 'e2',
          date: '2024-02-01',
          liters: 0.5,
          odometerKm: 15000,
          isOilChange: false,
        }),
        buildExpense({
          id: 'e3',
          date: '2024-03-01',
          liters: 0.5,
          odometerKm: 20000,
          isOilChange: false,
        }),
      ])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Average Consumption:/i)).toBeInTheDocument();
    expect(screen.getByText(/L\/10,000km/i)).toBeInTheDocument();
  });

  it('handles empty expense data', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    vi.mocked(useExpenses).mockReturnValue(buildExpensesResult([]));

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Not enough data to calculate consumption/i)).toBeInTheDocument();
  });

  it('shows zero average when no consumption values can be computed', async () => {
    const { useExpenses } = await import('@/hooks/useExpenses');
    vi.mocked(useExpenses).mockReturnValue(
      buildExpensesResult([
        buildExpense({
          id: 'e1',
          date: '2024-01-01',
          isOilChange: true,
        }),
        buildExpense({
          id: 'e2',
          date: '2024-02-01',
          liters: 1,
          isOilChange: false,
        }),
      ])
    );

    const OilConsumptionChart = (await import('../../charts/OilConsumptionChart')).default;
    render(<OilConsumptionChart vehicleId="v1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Average Consumption:/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.00 L\/10,000km/i)).toBeInTheDocument();
  });
});
