import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportMenu from '@/components/car/exports/ExportMenu';

describe('ExportMenu', () => {
  it('shows export options when opened', () => {
    render(<ExportMenu vehicleId="vid" />);
    const btn = screen.getByRole('button', { name: /export/i });
    fireEvent.click(btn);
    const exp = screen.getByRole('menuitem', { name: /expenses csv/i });
    const fill = screen.getByRole('menuitem', { name: /fill-ups csv/i });
    expect(exp).toHaveAttribute('href', '/api/vehicles/vid/expenses/export');
    expect(fill).toHaveAttribute('href', '/api/vehicles/vid/fillups/export');
  });
});
