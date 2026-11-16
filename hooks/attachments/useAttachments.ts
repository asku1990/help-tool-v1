import { useQuery } from '@tanstack/react-query';
import { attachmentKeys } from '@/queries/keys';
import { listAttachments, type AttachmentRecord } from '@/queries/attachments';

export function useAttachments(vehicleId: string, record: AttachmentRecord) {
  return useQuery({
    queryKey: attachmentKeys.byRecord(vehicleId, record.type, record.id),
    queryFn: ({ signal }) => listAttachments(vehicleId, record, signal),
    enabled: Boolean(vehicleId && record.id),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}
