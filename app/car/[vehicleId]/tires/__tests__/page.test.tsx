import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import TiresPage from '../page';

vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useParams: () => ({ vehicleId: 'v1' }),
}));

it.each([true, false])(
  'shows tire details and respects canWrite=%s from the vehicle',
  async canWrite => {
    const log = { id: 'log1', tireSetId: 't1', date: '2024-06-01', odometerKm: 12000 };
    server.use(
      http.get('/api/vehicles/v1', () =>
        HttpResponse.json({ data: { vehicle: { id: 'v1', name: 'Car A', canWrite } } })
      ),
      http.get('/api/vehicles/v1/tires', () =>
        HttpResponse.json({
          data: {
            tireSets: [
              {
                id: 't1',
                name: 'Summer Set',
                status: 'ACTIVE',
                type: 'SUMMER',
                totalKm: 0,
                notes: 'Garage shelf',
                changeLogs: [log],
              },
            ],
          },
        })
      ),
      http.get('/api/vehicles/v1/tires/change-log', () =>
        HttpResponse.json({ data: { history: [log] } })
      ),
      http.get('/api/vehicles/v1/fillups', () => HttpResponse.json({ data: { fillUps: [] } })),
      http.get('/api/vehicles/v1/expenses', () => HttpResponse.json({ data: { expenses: [] } }))
    );

    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TiresPage />
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Tires' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to vehicle' })).toHaveAttribute(
      'href',
      '/car/v1'
    );
    expect(await screen.findByText('Garage shelf')).toBeVisible();
    await user.click(screen.getByText('View tire changes (1)'));
    expect(screen.getByText('Summer Set', { selector: 'p' })).toBeVisible();
    for (const name of ['Edit details', 'Add tire set', 'Edit change', 'Delete change']) {
      const action = screen.queryByRole('button', { name });
      if (canWrite) expect(action).toBeVisible();
      else expect(action).not.toBeInTheDocument();
    }
  }
);
