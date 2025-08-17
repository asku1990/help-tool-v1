import { NextRequest } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { badRequest } from './response';

export async function parseJson<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  try {
    const json = await req.json();
    const data = schema.parse(json);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        response: badRequest('VALIDATION_ERROR', 'Invalid request body', err.flatten()),
      };
    }
    return { ok: false, response: badRequest('INVALID_JSON', 'Malformed JSON') };
  }
}
