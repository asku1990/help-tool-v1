import React from 'react';
import { render, screen } from '@testing-library/react';
import ExportFillUpsButton from '@/components/car/ExportFillUpsButton';

describe('ExportFillUpsButton', () => {
  it('renders CSV link', () => {
    render(<ExportFillUpsButton vehicleId="vid" />);
    const csv = screen.getByRole('link', { name: /export fill-ups csv/i });
    expect(csv).toHaveAttribute('href', '/api/vehicles/vid/fillups/export');
  });
});
