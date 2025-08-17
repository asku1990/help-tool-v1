export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiError | null;
}

function withDefaults(init?: ResponseInit, defaults?: ResponseInit): ResponseInit {
  return {
    ...defaults,
    headers: {
      ...(defaults?.headers || {}),
      ...(init?.headers || {}),
    },
    status: init?.status ?? defaults?.status,
    statusText: init?.statusText ?? defaults?.statusText,
  };
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  const body: ApiEnvelope<T> = { data, error: null };
  return Response.json(body, withDefaults(init, { status: 200 }));
}

export function created<T>(data: T, init?: ResponseInit): Response {
  const body: ApiEnvelope<T> = { data, error: null };
  return Response.json(body, withDefaults(init, { status: 201 }));
}

export function badRequest(
  code: string,
  message: string,
  details?: unknown,
  init?: ResponseInit
): Response {
  const body: ApiEnvelope<null> = { data: null, error: { code, message, details } };
  return Response.json(body, withDefaults(init, { status: 400 }));
}

export function unauthorized(
  message = 'Unauthorized',
  details?: unknown,
  init?: ResponseInit
): Response {
  const body: ApiEnvelope<null> = { data: null, error: { code: 'UNAUTHORIZED', message, details } };
  return Response.json(body, withDefaults(init, { status: 401 }));
}

export function notFound(message = 'Not found', details?: unknown, init?: ResponseInit): Response {
  const body: ApiEnvelope<null> = { data: null, error: { code: 'NOT_FOUND', message, details } };
  return Response.json(body, withDefaults(init, { status: 404 }));
}

export function serverError(
  message = 'Internal Server Error',
  details?: unknown,
  init?: ResponseInit
): Response {
  const body: ApiEnvelope<null> = {
    data: null,
    error: { code: 'INTERNAL_SERVER_ERROR', message, details },
  };
  return Response.json(body, withDefaults(init, { status: 500 }));
}
