import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import AdminPage from '@/app/car/admin/page';
import { server } from '@/test/msw/server';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { email: 'admin@example.com' } }, status: 'authenticated' }),
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  const router = { push: vi.fn(), replace: vi.fn() };
  return {
    ...actual,
    useRouter: () => router,
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

it('loads users, vehicles, and access list', async () => {
  server.use(
    http.get('/api/admin/users', () =>
      HttpResponse.json({
        data: {
          users: [
            {
              id: 'u1',
              email: 'admin@example.com',
              username: 'admin',
              userType: 'ADMIN',
              createdAt: new Date().toISOString(),
            },
          ],
        },
      })
    ),
    http.get('/api/admin/vehicles', () =>
      HttpResponse.json({
        data: {
          vehicles: [
            {
              id: 'v1',
              name: 'Car A',
              make: null,
              model: null,
              year: null,
              userId: 'u1',
              ownerEmail: 'admin@example.com',
              createdAt: new Date().toISOString(),
              accessCount: 1,
            },
          ],
        },
      })
    ),
    http.get('/api/admin/vehicles/:vehicleId/access', () =>
      HttpResponse.json({
        data: {
          vehicle: { id: 'v1', name: 'Car A' },
          access: [
            {
              id: 'a1',
              userId: 'u1',
              userEmail: 'admin@example.com',
              username: 'admin',
              role: 'OWNER',
              createdAt: new Date().toISOString(),
            },
          ],
        },
      })
    )
  );

  renderWithProviders(<AdminPage />);

  expect(await screen.findByText('Users')).toBeInTheDocument();
  expect(await screen.findByText('Vehicles')).toBeInTheDocument();
  expect(await screen.findByText('Access Manager')).toBeInTheDocument();
  expect((await screen.findAllByText('admin@example.com')).length).toBeGreaterThan(0);
});
