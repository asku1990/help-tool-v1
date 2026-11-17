import { apiGet } from '@/lib/api/client';
import { attachmentUrl } from './attachmentUrl';
import type { AttachmentListDto, AttachmentRecord } from './types';

export function listAttachments(vehicleId: string, record: AttachmentRecord, signal?: AbortSignal) {
  return apiGet<AttachmentListDto>(attachmentUrl(vehicleId, record), { signal, cache: 'no-store' });
}
