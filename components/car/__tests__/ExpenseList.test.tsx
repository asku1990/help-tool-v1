import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpenseList from '@/components/car/ExpenseList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

it('renders empty state and CTA opens dialog via store', async () => {
  // Mock fetch to return empty expenses
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: { expenses: [], expensesTotal: 0, nextCursor: null } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  renderWithProviders(<ExpenseList vehicleId="vid" />);
  expect(
    await screen.findByText(/No expenses yet\. Log one to track maintenance and total cost\./i)
  ).toBeInTheDocument();
  const btn = screen.getByRole('button', { name: /add expense/i });
  fireEvent.click(btn);
  vi.restoreAllMocks();
});
