import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
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

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: vi.fn(() => null),
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

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

it('shows toast success when access update succeeds', async () => {
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
          access: [],
        },
      })
    ),
    http.put('/api/admin/vehicles/:vehicleId/access', () =>
      HttpResponse.json({
        data: { access: { id: 'a1' } },
      })
    )
  );

  renderWithProviders(<AdminPage />);

  fireEvent.click(await screen.findByRole('button', { name: 'Grant / Update Access' }));

  await waitFor(() => {
    expect(toast.success).toHaveBeenCalledWith('Access updated for admin@example.com');
  });
});

it('shows toast error when access update fails', async () => {
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
          access: [],
        },
      })
    ),
    http.put('/api/admin/vehicles/:vehicleId/access', () =>
      HttpResponse.json(
        {
          error: { code: 'LAST_OWNER', message: 'Cannot update owner access' },
        },
        { status: 400 }
      )
    )
  );

  renderWithProviders(<AdminPage />);

  fireEvent.click(await screen.findByRole('button', { name: 'Grant / Update Access' }));

  await waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith('Cannot update owner access');
  });
});

it('shows one toast when admin query load fails', async () => {
  server.use(
    http.get('/api/admin/users', () =>
      HttpResponse.json(
        {
          error: { code: 'SERVER_ERROR', message: 'Failed to load admin data' },
        },
        { status: 500 }
      )
    ),
    http.get('/api/admin/vehicles', () =>
      HttpResponse.json({
        data: {
          vehicles: [],
        },
      })
    )
  );

  renderWithProviders(<AdminPage />);

  await waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith('Failed to load admin data');
  });
  expect(toast.error).toHaveBeenCalledTimes(1);
});
