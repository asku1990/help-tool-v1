import React from 'react';
import { render, screen } from '@testing-library/react';
import SpreadsheetExportLink from '../SpreadsheetExportLink';

describe('SpreadsheetExportLink', () => {
  it('offers only the spreadsheet download', () => {
    render(<SpreadsheetExportLink vehicleId="vid" />);
    const link = screen.getByRole('link', { name: 'Download for spreadsheet' });
    expect(link).toHaveAttribute('href', '/api/vehicles/vid/export');
    expect(link).toHaveAttribute('download');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
