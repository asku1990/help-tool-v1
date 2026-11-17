// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_ATTACHMENT_BYTES, readAttachment, validateAttachment } from '../validation';

const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9xkAAAAASUVORK5CYII=',
    'base64'
  )
);

function request(form: FormData) {
  return new Request('http://localhost/upload', { method: 'POST', body: form });
}

describe('Attachment validation', () => {
  it.each([
    ['receipt.pdf', 'application/pdf', pdf],
    ['photo.PNG', 'image/png', png],
    ['photo.jpeg', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])],
    ['photo.webp', 'image/webp', new TextEncoder().encode('RIFF\x10\x00\x00\x00WEBPVP8 ')],
  ])('identifies supported content in %s', async (filename, contentType, bytes) => {
    const result = await validateAttachment(new File([bytes], filename, { type: contentType }));
    expect(result).toEqual({ filename, contentType, bytes });
  });

  it('allows a generic or absent declared MIME type when content and extension match', async () => {
    for (const type of ['', 'application/octet-stream']) {
      await expect(
        validateAttachment(new File([pdf], 'receipt.pdf', { type }))
      ).resolves.toMatchObject({ contentType: 'application/pdf' });
    }
  });

  it('accepts exactly 4,000,000 bytes', async () => {
    const bytes = new Uint8Array(MAX_ATTACHMENT_BYTES);
    bytes.set(pdf);
    await expect(validateAttachment(new File([bytes], 'receipt.pdf'))).resolves.toMatchObject({
      contentType: 'application/pdf',
    });
  });

  it('rejects an oversized file', async () => {
    await expect(
      validateAttachment(new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'receipt.pdf'))
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', status: 413 });
  });

  it('rejects empty files', async () => {
    await expect(validateAttachment(new File([], 'receipt.pdf'))).rejects.toMatchObject({
      code: 'INVALID_FILE',
    });
  });

  it.each([
    ['receipt.pdf', 'application/pdf', 'not a pdf'],
    ['photo.png', 'image/png', pdf],
    ['receipt.pdf', 'image/jpeg', pdf],
    ['receipt.exe', 'application/pdf', pdf],
    ['photo.gif', 'image/gif', 'GIF89a1234567890'],
    ['photo.png', 'image/png', new Uint8Array([0x89, 0x50])],
  ])('rejects unsupported or misleading content (%s, %s)', async (filename, type, bytes) => {
    await expect(validateAttachment(new File([bytes], filename, { type }))).rejects.toMatchObject({
      code: 'INVALID_FILE_TYPE',
      status: 415,
    });
  });

  it.each([
    '../receipt.pdf',
    'folder\\receipt.pdf',
    'bad\u0000.pdf',
    ' ',
    `${'x'.repeat(256)}.pdf`,
  ])('rejects an unsafe filename', async filename => {
    await expect(validateAttachment(new File([pdf], filename))).rejects.toMatchObject({
      code: 'INVALID_FILENAME',
    });
  });

  it('reads one binary multipart file', async () => {
    const form = new FormData();
    form.append('file', new File([pdf], 'receipt.pdf', { type: 'application/pdf' }));
    await expect(readAttachment(request(form))).resolves.toEqual({
      filename: 'receipt.pdf',
      contentType: 'application/pdf',
      bytes: pdf,
    });
  });

  it.each(['empty', 'text', 'multiple', 'extra-field', 'wrong-field'])(
    'rejects invalid form shape: %s',
    async shape => {
      const form = new FormData();
      if (shape === 'text') form.append('file', 'not a file');
      if (shape === 'multiple') {
        form.append('file', new File([pdf], 'first.pdf'));
        form.append('file', new File([pdf], 'second.pdf'));
      }
      if (shape === 'extra-field') {
        form.append('file', new File([pdf], 'receipt.pdf'));
        form.append('other', 'unexpected');
      }
      if (shape === 'wrong-field') form.append('upload', new File([pdf], 'receipt.pdf'));
      await expect(readAttachment(request(form))).rejects.toMatchObject({ code: 'INVALID_UPLOAD' });
    }
  );

  it('rejects malformed multipart bodies', async () => {
    await expect(
      readAttachment(
        new Request('http://localhost/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'multipart/form-data; boundary=broken' },
          body: 'invalid',
        })
      )
    ).rejects.toMatchObject({ code: 'INVALID_UPLOAD' });
  });

  it('rejects JSON/base64 uploads', async () => {
    await expect(
      readAttachment(
        new Request('http://localhost/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      )
    ).rejects.toMatchObject({ code: 'INVALID_UPLOAD' });
  });

  it('bounds multipart request size even without a Content-Length header', async () => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(4_100_001)], 'receipt.pdf'));
    await expect(readAttachment(request(form))).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });

  it('rejects a declared oversized request before reading it', async () => {
    const req = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': '5000000' },
      body: 'unused',
    });
    await expect(readAttachment(req)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(req.bodyUsed).toBe(false);
  });
});
