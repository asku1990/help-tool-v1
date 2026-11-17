import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachmentKeys } from '@/queries/keys';
import { deleteAttachment, type AttachmentRecord } from '@/queries/attachments';

export function useDeleteAttachment(vehicleId: string, record: AttachmentRecord) {
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: ({ id, signal }: { id: string; signal: AbortSignal }) =>
      deleteAttachment(vehicleId, record, id, signal),
    // A lost response can still mean deletion committed. Always reconcile the list.
    onSettled: () =>
      client.invalidateQueries({
        queryKey: attachmentKeys.byRecord(vehicleId, record.type, record.id),
      }),
  });
}
