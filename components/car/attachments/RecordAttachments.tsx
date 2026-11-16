'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAttachments, useUploadAttachment } from '@/hooks/attachments';
import { MAX_ATTACHMENT_BYTES } from '@/lib/attachments/limits';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import { attachmentOpenUrl, type AttachmentRecord } from '@/queries/attachments';

type Props = {
  vehicleId: string;
  record: AttachmentRecord;
  onUploadingChange: (_uploading: boolean) => void;
  disabled?: boolean;
};

export default function RecordAttachments({
  vehicleId,
  record,
  onUploadingChange,
  disabled = false,
}: Props) {
  const list = useAttachments(vehicleId, record);
  const upload = useUploadAttachment(vehicleId, record);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState<number | null>(0);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function selectFile(selected: File | null) {
    setSuccess(false);
    setUploadError('');
    setFileError('');
    setFile(selected);
    if (!selected) return;
    if (selected.size === 0 || selected.size > MAX_ATTACHMENT_BYTES) {
      setFileError('Choose a non-empty file of at most 4,000,000 bytes.');
    } else if (!/\.(pdf|jpe?g|png|webp)$/i.test(selected.name)) {
      setFileError('Choose a PDF, JPEG, PNG, or WebP file.');
    }
  }

  async function submitUpload() {
    if (
      disabled ||
      controller.current ||
      !file ||
      fileError ||
      upload.isPending ||
      list.isFetching ||
      list.isError ||
      !list.data?.canUpload ||
      list.data.remainingCapacity === 0
    )
      return;
    const activeController = new AbortController();
    controller.current = activeController;
    setUploadError('');
    setSuccess(false);
    setProgress(0);
    onUploadingChange(true);
    try {
      await upload.mutateAsync({ file, signal: activeController.signal, onProgress: setProgress });
      setSuccess(true);
      setFile(null);
      if (input.current) input.current.value = '';
    } catch (error) {
      setUploadError(getUiErrorMessage(error, 'Failed to upload attachment.'));
    } finally {
      controller.current = null;
      onUploadingChange(false);
    }
  }

  const full = list.data?.remainingCapacity === 0;
  const busy = upload.isPending;
  const canUpload = list.data?.canUpload && !list.isError;
  return (
    <section className="space-y-3 border-t pt-4" aria-label="Attachments">
      <h3 className="text-sm font-medium">Attachments</h3>
      <p className="text-xs text-gray-500">PDF, JPG, PNG, WebP · Max 4 MB</p>
      {list.isPending ? (
        <p role="status" className="text-sm">
          Loading attachments…
        </p>
      ) : null}
      {list.isError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-red-600">
            {getUiErrorMessage(list.error, 'Could not load attachments.')} Refresh the list before
            uploading.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={list.isFetching || busy}
            onClick={() => {
              void list.refetch();
            }}
          >
            {list.isFetching ? 'Refreshing…' : 'Refresh attachments'}
          </Button>
        </div>
      ) : null}
      {list.data ? (
        <>
          <p className="text-sm text-gray-600">
            {list.data.remainingCapacity} of {list.data.maxAttachments} attachment slots remaining
          </p>
          {list.data.attachments.length ? (
            <ul className="space-y-1 text-sm" aria-label="Saved attachments">
              {list.data.attachments.map(item => (
                <li key={item.id} className="break-all">
                  <a
                    href={attachmentOpenUrl(vehicleId, record, item.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    aria-label={`Open ${item.filename} in a new tab`}
                    className="underline underline-offset-2 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {item.filename}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No attachments yet.</p>
          )}
          {!list.data.canUpload ? (
            <p className="text-sm text-gray-500">
              View-only access. Only owners and editors may upload.
            </p>
          ) : null}
        </>
      ) : null}
      {canUpload ? (
        <div className="space-y-2">
          {full ? (
            <p className="text-sm">This record has reached its five-attachment limit.</p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span>Attachment file</span>
            <input
              ref={input}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              disabled={disabled || busy || full || list.isFetching}
              onChange={event => selectFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-md border px-3 py-2"
              aria-invalid={Boolean(fileError)}
            />
          </label>
          {file ? <p className="text-xs text-gray-500">Selected file: {file.name}</p> : null}
          {fileError ? (
            <p role="alert" className="text-sm text-red-600">
              {fileError}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !file || Boolean(fileError) || busy || full || list.isFetching}
            onClick={() => {
              void submitUpload();
            }}
          >
            {busy ? 'Uploading…' : uploadError ? 'Retry upload' : 'Upload'}
          </Button>
        </div>
      ) : null}
      {busy ? (
        <div className="space-y-1" role="status">
          <progress
            className="w-full"
            max={100}
            value={progress ?? undefined}
            aria-label="Attachment upload progress"
          />
          <p className="text-xs text-gray-500">
            {progress === 100
              ? 'File sent. Confirming upload and refreshing attachments…'
              : progress === null
                ? 'Uploading…'
                : `Uploading… ${progress}%`}
          </p>
        </div>
      ) : null}
      {uploadError ? (
        <p role="alert" className="text-sm text-red-600">
          {uploadError} Check the refreshed filename list before retrying; a retry may create a
          duplicate.
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-sm text-green-700">
          Attachment uploaded.
        </p>
      ) : null}
    </section>
  );
}
