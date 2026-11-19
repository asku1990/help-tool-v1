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

  it('offers a separate download for spreadsheet use', () => {
    render(<ExportMenu vehicleId="vid" />);
    const link = screen.getByRole('link', { name: 'Download for spreadsheet' });
    expect(link).toHaveAttribute('href', '/api/vehicles/vid/export?format=spreadsheet');
    expect(link).toHaveAttribute('download');
  });
});
