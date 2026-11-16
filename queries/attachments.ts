import { apiGet, ApiClientError } from '@/lib/api/client';

export type AttachmentRecord = { type: 'expense' | 'fillup'; id: string };

export type AttachmentDto = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type AttachmentListDto = {
  attachments: AttachmentDto[];
  maxAttachments: number;
  remainingCapacity: number;
  canUpload: boolean;
};

export type UploadAttachmentOptions = {
  file: File;
  onProgress: (_percent: number | null) => void;
  signal: AbortSignal;
};

function url(vehicleId: string, record: AttachmentRecord) {
  const resource = record.type === 'expense' ? 'expenses' : 'fillups';
  return `/api/vehicles/${encodeURIComponent(vehicleId)}/${resource}/${encodeURIComponent(record.id)}/attachments`;
}

export function listAttachments(vehicleId: string, record: AttachmentRecord, signal?: AbortSignal) {
  return apiGet<AttachmentListDto>(url(vehicleId, record), { signal, cache: 'no-store' });
}

export function uploadAttachment(
  vehicleId: string,
  record: AttachmentRecord,
  { file, onProgress, signal }: UploadAttachmentOptions
): Promise<AttachmentDto> {
  return new Promise((resolve, reject) => {
    const cancelled = () =>
      new ApiClientError('Upload cancelled. Refresh the list before retrying.', 0, 'ABORTED');
    if (signal.aborted) {
      reject(cancelled());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url(vehicleId, record));
    xhr.withCredentials = true;
    xhr.timeout = 120_000;
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener('abort', abort);
    const fail = (error: ApiClientError) => {
      cleanup();
      reject(error);
    };
    xhr.upload.onprogress = event => {
      onProgress(
        event.lengthComputable && event.total > 0
          ? Math.min(100, Math.round((event.loaded / event.total) * 100))
          : null
      );
    };
    xhr.onerror = () =>
      fail(
        new ApiClientError(
          'Upload connection failed. Refresh the list before retrying.',
          0,
          'NETWORK_ERROR'
        )
      );
    xhr.ontimeout = () =>
      fail(new ApiClientError('Upload timed out. Refresh the list before retrying.', 0, 'TIMEOUT'));
    xhr.onabort = () => fail(cancelled());
    xhr.onload = () => {
      let body: {
        data?: AttachmentDto;
        error?: { message?: string; code?: string } | null;
      };
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        fail(
          new ApiClientError(
            'Upload response could not be confirmed. Refresh the list before retrying.',
            xhr.status,
            'INVALID_RESPONSE'
          )
        );
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300 || body?.error) {
        fail(
          new ApiClientError(
            body?.error?.message || `Upload failed (${xhr.status}).`,
            xhr.status,
            body?.error?.code
          )
        );
        return;
      }
      if (!body?.data || typeof body.data.id !== 'string') {
        fail(
          new ApiClientError(
            'Upload response could not be confirmed. Refresh the list before retrying.',
            xhr.status,
            'INVALID_RESPONSE'
          )
        );
        return;
      }
      cleanup();
      resolve(body.data);
    };
    const form = new FormData();
    form.append('file', file);
    signal.addEventListener('abort', abort, { once: true });
    // Let the browser generate Content-Type, including its multipart boundary.
    xhr.send(form);
  });
}
