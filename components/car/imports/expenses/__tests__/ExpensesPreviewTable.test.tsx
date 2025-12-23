import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpensesPreviewTable from '../ExpensesPreviewTable';
import type { ParsedExpense } from '@/utils/csv';

describe('ExpensesPreviewTable', () => {
  const mockData: ParsedExpense[] = [
    {
      id: 'ex-0',
      include: true,
      date: '2025-02-01',
      odometerKm: 12000,
      amount: 150,
      category: 'MAINTENANCE',
      vendor: 'AutoShop',
      notes: 'Oil change',
      valid: true,
    },
    {
      id: 'ex-1',
      include: false,
      date: '2025-02-15',
      amount: 50,
      category: 'PARKING',
      valid: true,
    },
  ];

  it('renders expense data in table', () => {
    render(<ExpensesPreviewTable data={mockData} onToggle={vi.fn()} />);

    expect(screen.getByText('2025-02-01')).toBeInTheDocument();
    expect(screen.getByText('12000')).toBeInTheDocument();
    expect(screen.getByText('150.00')).toBeInTheDocument();
    expect(screen.getByText('MAINTENANCE')).toBeInTheDocument();
    expect(screen.getByText('AutoShop')).toBeInTheDocument();
    expect(screen.getByText('Oil change')).toBeInTheDocument();
  });

  it('calls onToggle when checkbox is clicked', () => {
    const onToggle = vi.fn();
    render(<ExpensesPreviewTable data={mockData} onToggle={onToggle} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(onToggle).toHaveBeenCalledWith(0, false);
  });
});
