export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init });
  const body = await res.json();
  if (!res.ok || body?.error) {
    const msg = body?.error?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return body.data as T;
}

export async function apiPost<T>(url: string, payload: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(payload),
    ...init,
  });
  const body = await res.json();
  if (!res.ok || body?.error) {
    const msg = body?.error?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return body.data as T;
}

export async function apiPatch<T>(url: string, payload: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(payload),
    ...init,
  });
  const body = await res.json();
  if (!res.ok || body?.error) {
    const msg = body?.error?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return body.data as T;
}
