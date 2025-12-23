import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock useImportTires
const mockMutateAsync = vi.fn();
vi.mock('@/hooks/tires', () => ({
  useImportTires: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import ImportTiresDialog from '../ImportTiresDialog';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('ImportTiresDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it('renders trigger button and opens dialog', () => {
    render(<ImportTiresDialog vehicleId="v1" />, { wrapper: createWrapper() });

    const trigger = screen.getByRole('button', { name: /import csv/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByText('Import tires from CSV')).toBeInTheDocument();
  });

  it('parses section-based CSV and shows tire sets', async () => {
    render(<ImportTiresDialog vehicleId="v1" open onOpenChange={() => {}} />, {
      wrapper: createWrapper(),
    });

    const textarea = screen.getByPlaceholderText(/semicolon-delimited csv/i);
    const csv = `[TIRE_SETS]
Id;Name;Type;Status;TotalKm;PurchaseDate;Notes
ts1;Summer Set;SUMMER;STORED;5000;2024-01-01;Good tires

[CHANGE_LOGS]
Id;TireSetId;Date;OdometerKm;Notes
log1;ts1;2024-06-01;10000;Mounted`;

    fireEvent.change(textarea, { target: { value: csv } });

    const parseBtn = screen.getByRole('button', { name: /^parse$/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText('Tire Sets (1)')).toBeInTheDocument();
    });

    expect(screen.getByText('Summer Set')).toBeInTheDocument();
    expect(screen.getByText('Change Logs (1)')).toBeInTheDocument();
  });

  it('validates and marks invalid rows', async () => {
    render(<ImportTiresDialog vehicleId="v1" open onOpenChange={() => {}} />, {
      wrapper: createWrapper(),
    });

    const textarea = screen.getByPlaceholderText(/semicolon-delimited csv/i);
    // Missing name = invalid
    const csv = `[TIRE_SETS]
Id;Name;Type;Status
ts1;;SUMMER;STORED`;

    fireEvent.change(textarea, { target: { value: csv } });

    const parseBtn = screen.getByRole('button', { name: /^parse$/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText('Tire Sets (1)')).toBeInTheDocument();
    });

    // Invalid row should be unchecked by default
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('imports valid tire sets and change logs', async () => {
    const onImported = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ImportTiresDialog vehicleId="v1" open onOpenChange={onOpenChange} onImported={onImported} />,
      { wrapper: createWrapper() }
    );

    const textarea = screen.getByPlaceholderText(/semicolon-delimited csv/i);
    const csv = `[TIRE_SETS]
Id;Name;Type;Status
ts1;Winter Set;WINTER;STORED`;

    fireEvent.change(textarea, { target: { value: csv } });

    const parseBtn = screen.getByRole('button', { name: /^parse$/i });
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(screen.getByText('Tire Sets (1)')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /^import$/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        tireSets: [
          {
            name: 'Winter Set',
            type: 'WINTER',
            status: 'STORED',
            purchaseDate: undefined,
            notes: undefined,
          },
        ],
        changeLogs: [],
        tireSetIdMap: new Map([['ts1', 'Winter Set']]),
      });
    });
  });
});
