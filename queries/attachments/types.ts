export type { AttachmentParent as AttachmentRecord } from '@/lib/attachments/types';

export type AttachmentDto = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type AttachmentListDto = {
  attachments: AttachmentDto[];
  maxAttachments: number;
  remainingCapacity: number;
  canUpload: boolean;
};

export type UploadAttachmentOptions = {
  file: File;
  onProgress: (_percent: number | null) => void;
  signal: AbortSignal;
};
