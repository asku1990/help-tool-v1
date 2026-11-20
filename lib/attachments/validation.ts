import { fileTypeFromBuffer, type FileTypeResult } from 'file-type';
import { attachmentFormatList, matchesAttachmentUploadFormat } from './formats';
import { MAX_ATTACHMENT_BYTES } from './limits';

// Leave bounded room for the multipart boundary and filename, not additional files.
const MAX_REQUEST_BYTES = MAX_ATTACHMENT_BYTES + 100_000;

export class AttachmentError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AttachmentError';
    this.code = code;
    this.status = status;
  }
}

export type ValidatedAttachment = {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

export async function validateAttachment(file: File): Promise<ValidatedAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentError(
      'FILE_TOO_LARGE',
      `Files must not exceed ${MAX_ATTACHMENT_BYTES.toLocaleString('en-US')} bytes.`,
      413
    );
  }
  if (file.size === 0) {
    throw new AttachmentError('INVALID_FILE', 'Empty files are not supported.', 400);
  }
  const filename = file.name.trim();
  const hasControlCharacters = Array.from(filename).some(character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (!filename || filename.length > 255 || /[/\\]/.test(filename) || hasControlCharacters) {
    throw new AttachmentError(
      'INVALID_FILENAME',
      'Provide a filename of at most 255 characters.',
      400
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentError('FILE_TOO_LARGE', 'Invalid file size.', 413);
  }
  let detected: FileTypeResult | undefined;
  try {
    detected = await fileTypeFromBuffer(bytes);
  } catch {
    throw new AttachmentError(
      'INVALID_FILE_TYPE',
      'The file content could not be identified.',
      415
    );
  }
  if (
    !detected ||
    !matchesAttachmentUploadFormat(filename, detected.mime) ||
    (file.type && file.type !== 'application/octet-stream' && file.type !== detected.mime)
  ) {
    throw new AttachmentError(
      'INVALID_FILE_TYPE',
      `Upload a file (${attachmentFormatList}) whose filename and content match.`,
      415
    );
  }
  return { filename, contentType: detected.mime, bytes };
}

export async function readAttachment(req: Request): Promise<ValidatedAttachment> {
  const contentType = req.headers.get('content-type');
  if (!contentType?.toLowerCase().startsWith('multipart/form-data;')) {
    throw new AttachmentError('INVALID_UPLOAD', 'Send one file using multipart/form-data.', 400);
  }
  const declaredSize = Number(req.headers.get('content-length'));
  if (declaredSize > MAX_REQUEST_BYTES) {
    throw new AttachmentError('FILE_TOO_LARGE', 'The upload request is too large.', 413);
  }
  if (!req.body) {
    throw new AttachmentError('INVALID_UPLOAD', 'Select one file to upload.', 400);
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new AttachmentError('FILE_TOO_LARGE', 'The upload request is too large.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { 'Content-Type': contentType },
    }).formData();
  } catch {
    throw new AttachmentError('INVALID_UPLOAD', 'Invalid multipart upload.', 400);
  }
  const entries = Array.from(form.entries());
  const entry = entries[0];
  if (entries.length !== 1 || entry?.[0] !== 'file' || typeof entry[1] === 'string') {
    throw new AttachmentError('INVALID_UPLOAD', 'Send exactly one file in the file field.', 400);
  }
  return validateAttachment(entry[1]);
}
