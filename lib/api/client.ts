type ApiErrorBody = {
  code?: string;
  message?: string;
  details?: unknown;
};

type ApiEnvelope<T> = {
  data?: T;
  error?: ApiErrorBody | null;
};

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseResponseBody<T>(res: Response): Promise<ApiEnvelope<T> | undefined> {
  try {
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    return undefined;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await parseResponseBody<T>(res);
  const error = body?.error ?? null;

  if (!res.ok || error) {
    const message = error?.message || `Request failed: ${res.status}`;
    throw new ApiClientError(message, res.status, error?.code, error?.details);
  }

  return body?.data as T;
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  return request<T>(url, { ...init });
}

export async function apiPost<T>(url: string, payload: unknown, init?: RequestInit): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(payload),
    ...init,
  });
}

export async function apiPatch<T>(url: string, payload: unknown, init?: RequestInit): Promise<T> {
  return request<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(payload),
    ...init,
  });
}

export async function apiPut<T>(url: string, payload: unknown, init?: RequestInit): Promise<T> {
  return request<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(payload),
    ...init,
  });
}

export async function apiDelete<T>(url: string, init?: RequestInit): Promise<T> {
  return request<T>(url, { method: 'DELETE', ...(init || {}) });
}
