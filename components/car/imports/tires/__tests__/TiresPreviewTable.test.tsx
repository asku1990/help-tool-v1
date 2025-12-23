import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TiresPreviewTable from '../TiresPreviewTable';
import type { ParsedTireSet, ParsedChangeLog } from '@/utils/csv';

describe('TiresPreviewTable', () => {
  const mockTireSets: ParsedTireSet[] = [
    {
      id: 'ts-0',
      include: true,
      exportId: 'export1',
      name: 'Summer Tires',
      type: 'SUMMER',
      status: 'ACTIVE',
      purchaseDate: '2024-06-01',
      notes: 'Michelin',
      valid: true,
    },
    {
      id: 'ts-1',
      include: true,
      name: 'Winter Tires',
      type: 'WINTER',
      status: 'STORED',
      valid: true,
    },
  ];

  const mockChangeLogs: ParsedChangeLog[] = [
    {
      id: 'cl-0',
      include: true,
      tireSetId: 'export1',
      date: '2024-06-15',
      odometerKm: 10000,
      notes: 'Mounted',
      valid: true,
    },
  ];

  it('renders tire sets section', () => {
    render(
      <TiresPreviewTable
        tireSets={mockTireSets}
        changeLogs={mockChangeLogs}
        onToggleTireSet={vi.fn()}
        onToggleChangeLog={vi.fn()}
      />
    );

    // "Summer Tires" appears twice (tire set + change log match)
    expect(screen.getAllByText('Summer Tires')).toHaveLength(2);
    expect(screen.getByText('SUMMER')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Michelin')).toBeInTheDocument();
  });

  it('renders change logs section', () => {
    render(
      <TiresPreviewTable
        tireSets={mockTireSets}
        changeLogs={mockChangeLogs}
        onToggleTireSet={vi.fn()}
        onToggleChangeLog={vi.fn()}
      />
    );

    expect(screen.getByText('2024-06-15')).toBeInTheDocument();
    expect(screen.getByText('10000')).toBeInTheDocument();
    expect(screen.getByText('Mounted')).toBeInTheDocument();
  });

  it('calls onToggleTireSet when tire set checkbox is clicked', () => {
    const onToggleTireSet = vi.fn();
    render(
      <TiresPreviewTable
        tireSets={mockTireSets}
        changeLogs={mockChangeLogs}
        onToggleTireSet={onToggleTireSet}
        onToggleChangeLog={vi.fn()}
      />
    );

    // Get checkboxes - first ones are for tire sets
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(onToggleTireSet).toHaveBeenCalledWith(0, false);
  });

  it('calls onToggleChangeLog when change log checkbox is clicked', () => {
    const onToggleChangeLog = vi.fn();
    render(
      <TiresPreviewTable
        tireSets={mockTireSets}
        changeLogs={mockChangeLogs}
        onToggleTireSet={vi.fn()}
        onToggleChangeLog={onToggleChangeLog}
      />
    );

    // Get checkboxes - tire sets are first, then change logs
    const checkboxes = screen.getAllByRole('checkbox');
    // Last checkbox should be for the change log
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    expect(onToggleChangeLog).toHaveBeenCalledWith(0, false);
  });
});
