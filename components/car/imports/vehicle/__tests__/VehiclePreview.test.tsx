import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VehiclePreview from '../VehiclePreview';
import type { ParsedVehicle } from '@/utils/csv';

describe('VehiclePreview', () => {
  const mockVehicle: ParsedVehicle = {
    id: 'v1',
    name: 'Test Car',
    make: 'Toyota',
    model: 'Corolla',
    year: 2020,
    licensePlate: 'ABC-123',
    initialOdometer: 50000,
    valid: true,
  };

  const existingVehicles = [
    { id: 'existing1', name: 'Existing Car 1' },
    { id: 'existing2', name: 'Existing Car 2' },
  ];

  it('renders vehicle data', () => {
    render(
      <VehiclePreview
        vehicle={mockVehicle}
        matchingVehicle={null}
        existingVehicles={existingVehicles}
        restoreMode="pending"
        selectedVehicleId=""
        onModeChange={vi.fn()}
        onVehicleSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Test Car')).toBeInTheDocument();
    expect(screen.getByText('Toyota')).toBeInTheDocument();
    expect(screen.getByText('Corolla')).toBeInTheDocument();
    expect(screen.getByText('2020')).toBeInTheDocument();
    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.getByText(/50000 km/)).toBeInTheDocument();
  });

  it('shows warning when matching vehicle exists', () => {
    const matchingVehicle = { id: 'existing1', name: 'Test Car' };

    render(
      <VehiclePreview
        vehicle={mockVehicle}
        matchingVehicle={matchingVehicle}
        existingVehicles={existingVehicles}
        restoreMode="pending"
        selectedVehicleId=""
        onModeChange={vi.fn()}
        onVehicleSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/A vehicle named "Test Car" already exists/)).toBeInTheDocument();
  });

  it('calls onModeChange when selecting create new', () => {
    const onModeChange = vi.fn();

    render(
      <VehiclePreview
        vehicle={mockVehicle}
        matchingVehicle={null}
        existingVehicles={existingVehicles}
        restoreMode="pending"
        selectedVehicleId=""
        onModeChange={onModeChange}
        onVehicleSelect={vi.fn()}
      />
    );

    const createRadio = screen.getByRole('radio', { name: /create new vehicle/i });
    fireEvent.click(createRadio);

    expect(onModeChange).toHaveBeenCalledWith('create');
  });

  it('calls onModeChange and onVehicleSelect when selecting update existing', () => {
    const onModeChange = vi.fn();
    const onVehicleSelect = vi.fn();

    render(
      <VehiclePreview
        vehicle={mockVehicle}
        matchingVehicle={null}
        existingVehicles={existingVehicles}
        restoreMode="pending"
        selectedVehicleId=""
        onModeChange={onModeChange}
        onVehicleSelect={onVehicleSelect}
      />
    );

    const updateRadio = screen.getByRole('radio', { name: /update existing vehicle/i });
    fireEvent.click(updateRadio);

    expect(onModeChange).toHaveBeenCalledWith('update');
    expect(onVehicleSelect).toHaveBeenCalledWith('existing1');
  });

  it('shows vehicle selector when update mode is selected', () => {
    render(
      <VehiclePreview
        vehicle={mockVehicle}
        matchingVehicle={null}
        existingVehicles={existingVehicles}
        restoreMode="update"
        selectedVehicleId="existing1"
        onModeChange={vi.fn()}
        onVehicleSelect={vi.fn()}
      />
    );

    const selector = screen.getByRole('combobox');
    expect(selector).toBeInTheDocument();
    expect(screen.getByText('Existing Car 1')).toBeInTheDocument();
    expect(screen.getByText('Existing Car 2')).toBeInTheDocument();
  });

  it('shows error when no existing vehicles in update mode', () => {
    render(
      <VehiclePreview
        vehicle={mockVehicle}
        matchingVehicle={null}
        existingVehicles={[]}
        restoreMode="update"
        selectedVehicleId=""
        onModeChange={vi.fn()}
        onVehicleSelect={vi.fn()}
      />
    );

    expect(screen.getByText('No existing vehicles found')).toBeInTheDocument();
  });
});
