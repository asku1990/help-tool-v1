import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FillUpsPreviewTable from '../FillUpsPreviewTable';
import type { ParsedFillUp } from '@/utils/csv';

describe('FillUpsPreviewTable', () => {
  const mockData: ParsedFillUp[] = [
    {
      id: 'fu-0',
      include: true,
      date: '2025-01-15',
      odometerKm: 10000,
      liters: 45.5,
      pricePerLiter: 1.65,
      totalCost: 75.08,
      isFull: true,
      notes: 'Full tank',
      valid: true,
    },
    {
      id: 'fu-1',
      include: false,
      date: '2025-01-20',
      odometerKm: 10500,
      liters: 30,
      pricePerLiter: 1.7,
      totalCost: 51,
      isFull: false,
      valid: false,
    },
  ];

  it('renders fill-up data in table', () => {
    render(<FillUpsPreviewTable data={mockData} onToggle={vi.fn()} />);

    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('10000')).toBeInTheDocument();
    expect(screen.getByText('45.50')).toBeInTheDocument();
    expect(screen.getByText('1.650')).toBeInTheDocument();
    expect(screen.getByText('75.08')).toBeInTheDocument();
    expect(screen.getByText('Full tank')).toBeInTheDocument();
  });

  it('calls onToggle when checkbox is clicked', () => {
    const onToggle = vi.fn();
    render(<FillUpsPreviewTable data={mockData} onToggle={onToggle} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(onToggle).toHaveBeenCalledWith(0, false);
  });

  it('shows invalid rows with opacity styling', () => {
    render(<FillUpsPreviewTable data={mockData} onToggle={vi.fn()} />);

    const rows = screen.getAllByRole('row');
    // First row is header, second is valid, third is invalid
    expect(rows[2]).toHaveClass('opacity-50');
  });
});
