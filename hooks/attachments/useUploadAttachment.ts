import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachmentKeys } from '@/queries/keys';
import {
  uploadAttachment,
  type AttachmentListDto,
  type AttachmentRecord,
  type UploadAttachmentOptions,
} from '@/queries/attachments';

export function useUploadAttachment(vehicleId: string, record: AttachmentRecord) {
  const client = useQueryClient();
  const queryKey = attachmentKeys.byRecord(vehicleId, record.type, record.id);
  return useMutation({
    mutationFn: (options: UploadAttachmentOptions) => uploadAttachment(vehicleId, record, options),
    retry: false,
    onSuccess: async attachment => {
      await client.cancelQueries({ queryKey });
      // Preserve a confirmed upload even if the subsequent list refresh fails.
      client.setQueryData<AttachmentListDto>(queryKey, current => {
        if (!current) return current;
        const attachments = [
          ...current.attachments.filter(item => item.id !== attachment.id),
          attachment,
        ];
        return {
          ...current,
          attachments,
          remainingCapacity: Math.max(0, current.maxAttachments - attachments.length),
        };
      });
    },
    // Refresh even after failure: a response can be lost after the server committed.
    // No upload is automatically retried.
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
}
