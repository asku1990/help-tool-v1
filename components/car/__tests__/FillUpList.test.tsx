import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FillUpList from '@/components/car/FillUpList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

it('renders empty state and CTA opens dialog via store', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: { fillUps: [], nextCursor: null } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  renderWithProviders(<FillUpList vehicleId="vid" />);
  expect(
    await screen.findByText(
      /No fill-ups yet\. Add your first to see real consumption and cost\/km\./i
    )
  ).toBeInTheDocument();
  const btn = screen.getByRole('button', { name: /add fill-up/i });
  fireEvent.click(btn);
  vi.restoreAllMocks();
});
