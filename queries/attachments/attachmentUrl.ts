import type { AttachmentRecord } from './types';

export function attachmentUrl(vehicleId: string, record: AttachmentRecord) {
  const vehicleUrl = `/api/vehicles/${encodeURIComponent(vehicleId)}`;
  if (record.type === 'vehicle') return `${vehicleUrl}/attachments`;
  const resource = record.type === 'expense' ? 'expenses' : 'fillups';
  return `${vehicleUrl}/${resource}/${encodeURIComponent(record.id)}/attachments`;
}

export function attachmentOpenUrl(
  vehicleId: string,
  record: AttachmentRecord,
  attachmentId: string
) {
  return `${attachmentUrl(vehicleId, record)}/${encodeURIComponent(attachmentId)}/open`;
}
