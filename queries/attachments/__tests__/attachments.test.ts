import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listAttachments, uploadAttachment } from '..';
import { ApiClientError } from '@/lib/api/client';

type ProgressHandler = ((_event: ProgressEvent) => void) | null;

class TestRequest {
  static requests: unknown[] = [];
  upload: { onprogress: ProgressHandler } = { onprogress: null };
  onload: ProgressHandler = null;
  onerror: ProgressHandler = null;
  ontimeout: ProgressHandler = null;
  onabort: ProgressHandler = null;
  status = 0;
  responseText = '';
  withCredentials = false;
  timeout = 0;
  method = '';
  url = '';
  body: FormData | null = null;
  headers: Record<string, string> = {};

  constructor() {
    TestRequest.requests.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.onabort?.(new ProgressEvent('abort'));
  }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.(new ProgressEvent('load'));
  }
}

const item = {
  id: 'a1',
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
  sizeBytes: 100,
  createdAtUtc: '2026-11-16T00:00:00.000Z',
  updatedAtUtc: '2026-11-16T00:00:00.000Z',
};
const record = { type: 'expense', id: 'e1' } as const;

function startUpload(target = record) {
  const controller = new AbortController();
  const file = new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' });
  const progress = vi.fn();
  const result = uploadAttachment('car', target, {
    file,
    onProgress: progress,
    signal: controller.signal,
  });
  const xhr = TestRequest.requests[TestRequest.requests.length - 1];
  if (!(xhr instanceof TestRequest)) throw new Error('Expected an upload request');
  return { result, xhr, controller, progress, file };
}

describe('Attachment browser requests', () => {
  beforeEach(() => {
    TestRequest.requests = [];
    vi.stubGlobal('XMLHttpRequest', TestRequest);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['expense', 'fillup'] as const)(
    'lists %s metadata using the shared API client',
    async type => {
      const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { attachments: [item], canUpload: true, remainingCapacity: 4, maxAttachments: 5 },
            error: null,
          }),
          { status: 200 }
        )
      );
      const signal = new AbortController().signal;
      const result = await listAttachments('car', { type, id: 'parent' }, signal);
      expect(result.attachments).toEqual([item]);
      expect(fetch).toHaveBeenCalledWith(
        `/api/vehicles/car/${type === 'expense' ? 'expenses' : 'fillups'}/parent/attachments`,
        { signal, cache: 'no-store' }
      );
    }
  );

  it('uploads one binary file without overriding the browser multipart boundary', async () => {
    const { result, xhr, file } = startUpload();
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/vehicles/car/expenses/e1/attachments');
    expect(xhr.body?.get('file')).toBe(file);
    expect(Array.from(xhr.body?.keys() ?? [])).toEqual(['file']);
    expect(xhr.headers).toEqual({});
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.timeout).toBe(120_000);
    xhr.respond(201, { data: item, error: null });
    await expect(result).resolves.toEqual(item);
  });

  it('uses the fill-up endpoint and encodes resource IDs', async () => {
    const promise = uploadAttachment(
      'car/id',
      { type: 'fillup', id: 'fuel/id' },
      {
        file: new File(['pdf'], 'r.pdf'),
        signal: new AbortController().signal,
        onProgress: vi.fn(),
      }
    );
    const xhr = TestRequest.requests[0];
    if (!(xhr instanceof TestRequest)) throw new Error('Expected an upload request');
    expect(xhr.url).toBe('/api/vehicles/car%2Fid/fillups/fuel%2Fid/attachments');
    xhr.respond(201, { data: item });
    await promise;
  });

  it('reports actual transfer progress, including indeterminate progress', async () => {
    const { result, xhr, progress } = startUpload();
    xhr.upload.onprogress?.(
      new ProgressEvent('progress', { lengthComputable: true, loaded: 1, total: 4 })
    );
    expect(progress).toHaveBeenLastCalledWith(25);
    xhr.upload.onprogress?.(new ProgressEvent('progress', { lengthComputable: false }));
    expect(progress).toHaveBeenLastCalledWith(null);
    xhr.respond(201, { data: item });
    await result;
  });

  it('does not resolve when only the byte transfer has finished', async () => {
    const { result, xhr } = startUpload();
    const resolved = vi.fn();
    void result.then(resolved);
    xhr.upload.onprogress?.(
      new ProgressEvent('progress', { lengthComputable: true, loaded: 4, total: 4 })
    );
    await Promise.resolve();
    expect(resolved).not.toHaveBeenCalled();
    xhr.respond(201, { data: item });
    await result;
    expect(resolved).toHaveBeenCalledWith(item);
  });

  it('preserves server error codes and messages without retrying', async () => {
    const { result, xhr } = startUpload();
    xhr.respond(409, {
      data: null,
      error: { code: 'ATTACHMENT_LIMIT', message: 'Five attachments maximum.' },
    });
    await expect(result).rejects.toMatchObject({
      status: 409,
      code: 'ATTACHMENT_LIMIT',
      message: 'Five attachments maximum.',
    });
    expect(TestRequest.requests).toHaveLength(1);
  });

  it.each(['network', 'timeout', 'abort'] as const)('handles %s failures', async kind => {
    const { result, xhr, controller } = startUpload();
    if (kind === 'network') xhr.onerror?.(new ProgressEvent('error'));
    if (kind === 'timeout') xhr.ontimeout?.(new ProgressEvent('timeout'));
    if (kind === 'abort') controller.abort();
    await expect(result).rejects.toBeInstanceOf(ApiClientError);
    expect(TestRequest.requests).toHaveLength(1);
  });

  it('rejects an already-cancelled upload without sending it', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      uploadAttachment('car', record, {
        file: new File(['pdf'], 'r.pdf'),
        signal: controller.signal,
        onProgress: vi.fn(),
      })
    ).rejects.toMatchObject({ code: 'ABORTED' });
    expect(TestRequest.requests).toHaveLength(0);
  });

  it.each(['not json', '{}', 'null'])('rejects an unconfirmed response (%s)', async response => {
    const { result, xhr } = startUpload();
    xhr.status = 201;
    xhr.responseText = response;
    xhr.onload?.(new ProgressEvent('load'));
    await expect(result).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
