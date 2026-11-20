'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAttachments,
  useDeleteAttachment,
  useRenameAttachment,
  useUploadAttachment,
} from '@/hooks/attachments';
import { MAX_ATTACHMENT_BYTES } from '@/lib/attachments/limits';
import {
  attachmentAccept,
  attachmentFormatList,
  matchesAttachmentUploadFormat,
} from '@/lib/attachments/formats';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import { attachmentOpenUrl, type AttachmentRecord } from '@/queries/attachments';

type Props = {
  vehicleId: string;
  record: AttachmentRecord;
  onUploadingChange?: (_uploading: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  uploadFirst?: boolean;
};

export default function RecordAttachments({
  vehicleId,
  record,
  onUploadingChange,
  disabled = false,
  readOnly: forceReadOnly = false,
  uploadFirst = false,
}: Props) {
  const list = useAttachments(vehicleId, record);
  const upload = useUploadAttachment(vehicleId, record);
  const deletion = useDeleteAttachment(vehicleId, record);
  const rename = useRenameAttachment(vehicleId, record);
  const [managing, setManaging] = useState(false);
  const vehicleDocuments = record.type === 'vehicle';
  const title = vehicleDocuments ? 'Documents' : 'Attachments';
  const readOnly = forceReadOnly || (vehicleDocuments && !managing);
  const [editing, setEditing] = useState<{ id: string; name: string; extension: string } | null>(
    null
  );
  const [renameError, setRenameError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [deleteError, setDeleteError] = useState('');
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
      setFileError(
        `Choose a non-empty file of at most ${MAX_ATTACHMENT_BYTES.toLocaleString('en-US')} bytes.`
      );
    } else if (!matchesAttachmentUploadFormat(selected.name.trim())) {
      setFileError(`Choose a file in one of these formats: ${attachmentFormatList}.`);
    }
  }

  async function submitUpload() {
    if (
      readOnly ||
      disabled ||
      controller.current ||
      !file ||
      fileError ||
      upload.isPending ||
      deletion.isPending ||
      rename.isPending ||
      list.isFetching ||
      list.isError ||
      !list.data?.canUpload ||
      list.data.remainingCapacity === 0
    )
      return;
    const activeController = new AbortController();
    controller.current = activeController;
    setUploadError('');
    setDeleteError('');
    setRenameError('');
    setSuccess(false);
    setProgress(0);
    onUploadingChange?.(true);
    try {
      await upload.mutateAsync({ file, signal: activeController.signal, onProgress: setProgress });
      setSuccess(true);
      setFile(null);
      if (input.current) input.current.value = '';
    } catch (error) {
      setUploadError(getUiErrorMessage(error, 'Failed to upload attachment.'));
    } finally {
      controller.current = null;
      onUploadingChange?.(false);
    }
  }

  async function removeAttachment(id: string, filename: string) {
    if (
      readOnly ||
      disabled ||
      controller.current ||
      upload.isPending ||
      deletion.isPending ||
      rename.isPending ||
      list.isFetching ||
      list.isError ||
      !list.data?.canUpload
    )
      return;
    if (!confirm(`Delete “${filename}”? This cannot be undone.`)) return;
    const activeController = new AbortController();
    controller.current = activeController;
    setDeleteError('');
    setUploadError('');
    setRenameError('');
    setSuccess(false);
    onUploadingChange?.(true);
    try {
      await deletion.mutateAsync({ id, signal: activeController.signal });
    } catch (error) {
      setDeleteError(getUiErrorMessage(error, 'Could not delete the attachment. Try again.'));
    } finally {
      controller.current = null;
      onUploadingChange?.(false);
    }
  }

  async function saveName() {
    if (
      readOnly ||
      !editing ||
      !editing.name.trim() ||
      disabled ||
      controller.current ||
      upload.isPending ||
      deletion.isPending ||
      rename.isPending ||
      list.isFetching ||
      list.isError ||
      !list.data?.canUpload
    )
      return;
    const activeController = new AbortController();
    controller.current = activeController;
    setRenameError('');
    setSuccess(false);
    onUploadingChange?.(true);
    try {
      await rename.mutateAsync({
        id: editing.id,
        name: editing.name,
        signal: activeController.signal,
      });
      setEditing(null);
    } catch (error) {
      setRenameError(getUiErrorMessage(error, 'Could not rename the attachment. Try again.'));
    } finally {
      controller.current = null;
      onUploadingChange?.(false);
    }
  }

  const full = list.data?.remainingCapacity === 0;
  const busy = upload.isPending || deletion.isPending || rename.isPending;
  const canWrite = !readOnly && list.data?.canUpload;
  const canUpload = canWrite && !list.isError;
  const uploadControls = canUpload ? (
    <div className="space-y-2">
      {full && list.data ? (
        <p className="text-sm">
          This record has reached its limit of {list.data.maxAttachments} attachments.
        </p>
      ) : null}
      <div
        className={
          uploadFirst ? 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end' : 'space-y-2'
        }
      >
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span>Attachment file</span>
          <input
            ref={input}
            type="file"
            accept={attachmentAccept}
            disabled={disabled || busy || full || list.isFetching}
            onChange={event => selectFile(event.target.files?.[0] ?? null)}
            className={`w-full min-w-0 rounded-md border px-3 py-2${uploadFirst ? ' min-h-11' : ''}`}
            aria-invalid={Boolean(fileError)}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size={uploadFirst ? 'default' : 'sm'}
          className={uploadFirst ? 'min-h-11' : undefined}
          disabled={disabled || !file || Boolean(fileError) || busy || full || list.isFetching}
          onClick={() => {
            void submitUpload();
          }}
        >
          {upload.isPending
            ? 'Uploading…'
            : uploadError
              ? 'Retry upload'
              : uploadFirst
                ? 'Upload file'
                : 'Upload'}
        </Button>
      </div>
      {uploadFirst ? (
        <p className="text-xs text-gray-500">Attachment changes are saved separately.</p>
      ) : null}
      {file ? <p className="break-all text-xs text-gray-500">Selected file: {file.name}</p> : null}
      {fileError ? (
        <p role="alert" className="text-sm text-red-600">
          {fileError}
        </p>
      ) : null}
    </div>
  ) : null;
  return (
    <section className="space-y-3 border-t pt-4" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {vehicleDocuments &&
        !forceReadOnly &&
        (managing || (list.data?.canUpload && !list.isFetching && !list.isError)) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            onClick={() => {
              if (managing) {
                selectFile(null);
                setEditing(null);
                setDeleteError('');
                setRenameError('');
              }
              setManaging(!managing);
            }}
          >
            {managing ? 'Done managing' : 'Manage documents'}
          </Button>
        ) : null}
      </div>
      {!readOnly ? (
        <p className="text-xs text-gray-500">
          {attachmentFormatList} · Max {MAX_ATTACHMENT_BYTES / 1_000_000} MB
        </p>
      ) : null}
      {list.isPending ? (
        <p role="status" className="text-sm">
          Loading attachments…
        </p>
      ) : null}
      {list.isError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-red-600">
            {getUiErrorMessage(list.error, 'Could not load attachments.')}
            {!readOnly ? ' Refresh the list before uploading, renaming, or deleting.' : null}
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
          {!readOnly ? (
            <p className="text-sm text-gray-600">
              {list.data.remainingCapacity} of {list.data.maxAttachments} attachment slots remaining
            </p>
          ) : null}
          {uploadFirst ? uploadControls : null}
          {list.data.attachments.length ? (
            <ul className="space-y-1 text-sm" aria-label="Saved attachments">
              {list.data.attachments.map(item => (
                <li key={item.id} className="space-y-1">
                  <div className="flex items-center gap-1">
                    <a
                      href={attachmentOpenUrl(vehicleId, record, item.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      aria-label={`Open ${item.filename} in a new tab`}
                      className="inline-flex min-h-0 min-w-0 items-center break-all underline underline-offset-2 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {item.filename}
                    </a>
                    {canWrite ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 min-h-0 min-w-6 shrink-0 cursor-pointer px-1 hover:text-blue-600"
                          aria-label={`Rename ${item.filename}`}
                          title={`Rename ${item.filename}`}
                          disabled={disabled || busy || list.isFetching || list.isError}
                          onClick={() => {
                            const dot = item.filename.lastIndexOf('.');
                            setEditing({
                              id: item.id,
                              name: dot === -1 ? item.filename : item.filename.slice(0, dot),
                              extension: dot === -1 ? '' : item.filename.slice(dot),
                            });
                            setRenameError('');
                          }}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 min-h-0 min-w-6 shrink-0 cursor-pointer px-1 hover:bg-red-100 hover:text-red-600"
                          aria-label={`Delete ${item.filename}`}
                          title={`Delete ${item.filename}`}
                          disabled={disabled || busy || list.isFetching || list.isError}
                          onClick={() => {
                            void removeAttachment(item.id, item.filename);
                          }}
                        >
                          {deletion.isPending && deletion.variables?.id === item.id
                            ? 'Deleting…'
                            : '×'}
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {editing?.id === item.id && canWrite ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <input
                        autoFocus
                        aria-label="Attachment name"
                        value={editing.name}
                        maxLength={255 - editing.extension.length}
                        disabled={disabled || busy}
                        onChange={event => setEditing({ ...editing, name: event.target.value })}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void saveName();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!busy) {
                              setEditing(null);
                              setRenameError('');
                            }
                          }
                        }}
                        className="min-w-0 flex-1 rounded-md border px-2 py-1"
                      />
                      <span className="text-gray-500">{editing.extension}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 min-h-0 cursor-pointer px-2"
                        disabled={
                          disabled ||
                          busy ||
                          list.isFetching ||
                          list.isError ||
                          !editing.name.trim()
                        }
                        onClick={() => {
                          void saveName();
                        }}
                      >
                        {rename.isPending ? 'Saving…' : 'Save name'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 min-h-0 cursor-pointer px-2"
                        disabled={busy}
                        onClick={() => {
                          setEditing(null);
                          setRenameError('');
                        }}
                      >
                        Cancel rename
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              {vehicleDocuments ? 'No documents yet.' : 'No attachments yet.'}
            </p>
          )}
          {!readOnly && !list.data.canUpload ? (
            <p className="text-sm text-gray-500">
              View-only access. Only owners and editors may upload, rename, or delete.
            </p>
          ) : null}
        </>
      ) : null}
      {!uploadFirst ? uploadControls : null}
      {upload.isPending ? (
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
      {renameError ? (
        <p role="alert" className="text-sm text-red-600">
          {renameError}
        </p>
      ) : null}
      {deleteError ? (
        <p role="alert" className="text-sm text-red-600">
          {deleteError}
        </p>
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
