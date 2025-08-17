import { http, HttpResponse } from 'msw';

export const handlers = [
  // Relative URL handlers
  http.get('/api/vehicles/:vehicleId/expenses', ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const expenses = Array.from({ length: Math.min(limit, 2) }).map((_, i) => ({
      id: `e${i + 1}`,
      date: new Date().toISOString(),
      category: 'MAINTENANCE',
      amount: 42.5,
    }));
    return HttpResponse.json({ data: { expenses, expensesTotal: 85, nextCursor: null } });
  }),
  http.post('/api/vehicles/:vehicleId/expenses', async () => {
    return HttpResponse.json({ data: { id: 'new-expense' } }, { status: 201 });
  }),
  http.get('/api/vehicles/:vehicleId', async ({ params }: { params: any }) => {
    const { vehicleId } = params as { vehicleId: string };
    return HttpResponse.json({ data: { vehicle: { id: vehicleId, name: 'Car A' } } });
  }),

  // Absolute URL handlers to cover Node fetch defaults
  http.get(
    'http://localhost:3000/api/vehicles/:vehicleId/expenses',
    ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const expenses = Array.from({ length: Math.min(limit, 2) }).map((_, i) => ({
        id: `e${i + 1}`,
        date: new Date().toISOString(),
        category: 'MAINTENANCE',
        amount: 42.5,
      }));
      return HttpResponse.json({ data: { expenses, expensesTotal: 85, nextCursor: null } });
    }
  ),
  http.post('http://localhost:3000/api/vehicles/:vehicleId/expenses', async () => {
    return HttpResponse.json({ data: { id: 'new-expense' } }, { status: 201 });
  }),
  http.get('http://localhost:3000/api/vehicles/:vehicleId', async ({ params }: { params: any }) => {
    const { vehicleId } = params as { vehicleId: string };
    return HttpResponse.json({ data: { vehicle: { id: vehicleId, name: 'Car A' } } });
  }),
];
