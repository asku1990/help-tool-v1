import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachmentKeys } from '@/queries/keys';
import { renameAttachment, type AttachmentRecord } from '@/queries/attachments';

export function useRenameAttachment(vehicleId: string, record: AttachmentRecord) {
  const client = useQueryClient();
  return useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: ({ id, name, signal }: { id: string; name: string; signal: AbortSignal }) =>
      renameAttachment(vehicleId, record, id, name, signal),
    onSettled: () =>
      client.invalidateQueries({
        queryKey: attachmentKeys.byRecord(vehicleId, record.type, record.id),
      }),
  });
}
