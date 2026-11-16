import type { AttachmentRecord } from './types';

export function attachmentUrl(vehicleId: string, record: AttachmentRecord) {
  const resource = record.type === 'expense' ? 'expenses' : 'fillups';
  return `/api/vehicles/${encodeURIComponent(vehicleId)}/${resource}/${encodeURIComponent(record.id)}/attachments`;
}

export function attachmentOpenUrl(
  vehicleId: string,
  record: AttachmentRecord,
  attachmentId: string
) {
  return `${attachmentUrl(vehicleId, record)}/${encodeURIComponent(attachmentId)}/open`;
}
