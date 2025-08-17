import { ok, created, badRequest, unauthorized, notFound, serverError } from '@/lib/api/response';

it('ok returns 200 with data', async () => {
  const res = ok({ x: 1 }, { headers: { 'Cache-Control': 'no-store' } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ data: { x: 1 }, error: null });
});

it('created returns 201', async () => {
  const res = created({ id: '1' });
  expect(res.status).toBe(201);
});

it('badRequest carries code and message', async () => {
  const res = badRequest('VALIDATION_ERROR', 'Invalid');
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe('VALIDATION_ERROR');
});

it('unauthorized and notFound and serverError have expected status', async () => {
  expect(unauthorized().status).toBe(401);
  expect(notFound().status).toBe(404);
  expect(serverError().status).toBe(500);
});
