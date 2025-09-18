import React from 'react';
import { render, screen } from '@testing-library/react';
import ExportExpensesButtons from '@/components/car/ExportExpensesButtons';

describe('ExportExpensesButtons', () => {
  it('renders CSV link', () => {
    render(<ExportExpensesButtons vehicleId="vid" />);
    const csv = screen.getByRole('link', { name: /export csv/i });
    expect(csv).toHaveAttribute('href', '/api/vehicles/vid/expenses/export?format=csv');
  });
});
