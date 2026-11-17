import { apiDelete } from '@/lib/api/client';
import { attachmentUrl } from './attachmentUrl';
import type { AttachmentRecord } from './types';

export function deleteAttachment(
  vehicleId: string,
  record: AttachmentRecord,
  attachmentId: string,
  signal?: AbortSignal
) {
  return apiDelete<{ id: string }>(
    `${attachmentUrl(vehicleId, record)}/${encodeURIComponent(attachmentId)}`,
    { signal }
  );
}
