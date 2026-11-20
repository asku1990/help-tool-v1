// Browser-safe policy. Accepting a new upload and serving stored files inline are separate decisions.
const formats = [
  { mime: 'application/pdf', extensions: ['pdf'], label: 'PDF', upload: true, inline: true },
  { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], label: 'JPEG', upload: true, inline: true },
  { mime: 'image/png', extensions: ['png'], label: 'PNG', upload: true, inline: true },
  { mime: 'image/webp', extensions: ['webp'], label: 'WebP', upload: true, inline: true },
];

const uploadFormats = formats.filter(format => format.upload);

export const attachmentAccept = uploadFormats
  .flatMap(format => format.extensions.map(extension => `.${extension}`))
  .join(',');

export const attachmentFormatList = new Intl.ListFormat('en-US', { type: 'disjunction' }).format(
  uploadFormats.map(format => format.label)
);

export function matchesAttachmentUploadFormat(filename: string, detectedMime?: string): boolean {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return false;
  const extension = filename.slice(dot + 1).toLowerCase();
  return uploadFormats.some(
    format =>
      (detectedMime === undefined || format.mime === detectedMime) &&
      format.extensions.includes(extension)
  );
}

export function canOpenAttachmentInline(mime: string): boolean {
  return formats.some(format => format.inline && format.mime === mime);
}
