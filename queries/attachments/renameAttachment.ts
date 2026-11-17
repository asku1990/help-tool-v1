import { apiPatch } from '@/lib/api/client';
import { attachmentUrl } from './attachmentUrl';
import type { AttachmentRecord } from './types';

export function renameAttachment(
  vehicleId: string,
  record: AttachmentRecord,
  attachmentId: string,
  name: string,
  signal?: AbortSignal
) {
  return apiPatch<{ id: string; filename: string }>(
    `${attachmentUrl(vehicleId, record)}/${encodeURIComponent(attachmentId)}`,
    { name },
    { signal }
  );
}
