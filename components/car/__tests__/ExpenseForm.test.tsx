import React from 'react';
import { render, screen } from '@testing-library/react';
import ExpenseForm from '@/components/car/ExpenseForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

it('renders and validates presence of Save button', async () => {
  renderWithProviders(<ExpenseForm vehicleId="vid" />);
  expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
});
