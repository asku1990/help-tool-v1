import { describe, it, expect } from 'vitest';
import { parseJson } from '@/lib/api/validation';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('parseJson', () => {
  it('returns ok with parsed data when schema passes', async () => {
    const schema = z.object({ name: z.string(), age: z.number().int() });
    const req = makeReq({ name: 'Alice', age: 30 });
    const result = await parseJson(req as unknown as NextRequest, schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('returns badRequest response when schema fails', async () => {
    const schema = z.object({ name: z.string(), age: z.number().int() });
    const req = makeReq({ name: 'Alice', age: 'x' });
    const result = await parseJson(req as unknown as NextRequest, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });
});
