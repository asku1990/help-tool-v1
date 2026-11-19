import React from 'react';
import { render, screen } from '@testing-library/react';
import ExportMenu from '@/components/car/exports/ExportMenu';

describe('ExportMenu', () => {
  it('renders download backup link with correct href', () => {
    render(<ExportMenu vehicleId="vid" />);
    const link = screen.getByRole('link', { name: 'Download backup' });
    expect(link).toHaveAttribute('href', '/api/vehicles/vid/export');
    expect(link).toHaveAttribute('download');
  });
});
