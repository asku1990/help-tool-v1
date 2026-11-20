import { useQuery } from '@tanstack/react-query';
import { attachmentKeys } from '@/queries/keys';
import { listAttachments, type AttachmentRecord } from '@/queries/attachments';

export function useAttachments(vehicleId: string, record: AttachmentRecord) {
  return useQuery({
    // A failed offline refresh must block retries, not leave stale capacity usable.
    networkMode: 'always',
    queryKey: attachmentKeys.byRecord(vehicleId, record),
    queryFn: ({ signal }) => listAttachments(vehicleId, record, signal),
    enabled: Boolean(vehicleId && (record.type === 'vehicle' || record.id)),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}
