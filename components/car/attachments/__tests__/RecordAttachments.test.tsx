import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecordAttachments from '@/components/car/attachments/RecordAttachments';
import {
  listAttachments,
  deleteAttachment,
  renameAttachment,
  uploadAttachment,
  type AttachmentDto,
  type AttachmentListDto,
  type AttachmentRecord,
} from '@/queries/attachments';
import { ApiClientError } from '@/lib/api/client';

vi.mock('@/queries/attachments', async importOriginal => ({
  ...(await importOriginal<typeof import('@/queries/attachments')>()),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  renameAttachment: vi.fn(),
}));

const receipt: AttachmentDto = {
  id: 'a1',
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
  sizeBytes: 100,
  createdAtUtc: '2026-11-16T00:00:00.000Z',
  updatedAtUtc: '2026-11-16T00:00:00.000Z',
};
function metadata(attachments: AttachmentDto[] = [], canUpload = true): AttachmentListDto {
  return { attachments, canUpload, maxAttachments: 5, remainingCapacity: 5 - attachments.length };
}
function renderPanel(record: AttachmentRecord = { type: 'expense', id: 'e1' }, readOnly = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const onUploadingChange = vi.fn();
  const result = render(
    <QueryClientProvider client={client}>
      <RecordAttachments
        vehicleId="car"
        record={record}
        onUploadingChange={onUploadingChange}
        readOnly={readOnly}
      />
    </QueryClientProvider>
  );
  return { ...result, client, onUploadingChange };
}
async function select(file = new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' })) {
  const input = await screen.findByLabelText('Attachment file');
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

describe('Record attachments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listAttachments).mockResolvedValue(metadata());
    vi.mocked(uploadAttachment).mockResolvedValue(receipt);
    vi.mocked(deleteAttachment).mockResolvedValue({ id: receipt.id });
    vi.mocked(renameAttachment).mockResolvedValue({
      id: receipt.id,
      filename: 'Service receipt.pdf',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  it('shows filenames, capacity, a safe Open link, and a separate delete button', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    renderPanel();
    expect(await screen.findByText('receipt.pdf')).toBeInTheDocument();
    expect(screen.getByText('4 of 5 attachment slots remaining')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    const open = screen.getByRole('link', { name: 'Open receipt.pdf in a new tab' });
    expect(open).toHaveAttribute('href', '/api/vehicles/car/expenses/e1/attachments/a1/open');
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
    expect(open).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(open).not.toHaveAttribute('download');
    expect(open).toHaveTextContent('receipt.pdf');
    expect(open).toHaveClass('inline-flex', 'items-center', 'min-h-0');
    expect(screen.getByRole('button', { name: 'Delete receipt.pdf' })).toHaveAttribute(
      'type',
      'button'
    );
    expect(screen.getByRole('button', { name: 'Delete receipt.pdf' })).toHaveClass(
      'h-6',
      'min-h-0',
      'min-w-6'
    );
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /remove|download|preview/i })
    ).not.toBeInTheDocument();
  });

  it('offers only attachment links in read-only mode even when the caller can write', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    renderPanel({ type: 'expense', id: 'e1' }, true);
    expect(
      await screen.findByRole('link', { name: 'Open receipt.pdf in a new tab' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Attachment file')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upload|Rename|Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/attachment slots remaining/)).not.toBeInTheDocument();
    expect(uploadAttachment).not.toHaveBeenCalled();
    expect(renameAttachment).not.toHaveBeenCalled();
    expect(deleteAttachment).not.toHaveBeenCalled();
  });

  it('does not delete when confirmation is cancelled', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    vi.mocked(window.confirm).mockReturnValue(false);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete receipt.pdf' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete “receipt.pdf”? This cannot be undone.');
    expect(deleteAttachment).not.toHaveBeenCalled();
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument();
  });

  it('opens a name-only editor and cancels without sending a rename', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename receipt.pdf' }));
    expect(screen.getByRole('textbox', { name: 'Attachment name' })).toHaveValue('receipt');
    expect(screen.getByText('.pdf')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Attachment name' }), {
      target: { value: 'Changed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel rename' }));
    expect(screen.queryByRole('textbox', { name: 'Attachment name' })).not.toBeInTheDocument();
    expect(renameAttachment).not.toHaveBeenCalled();
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument();
  });

  it.each(['expense', 'fillup'] as const)(
    'edits the whole extensionless %s filename without inventing an extension',
    async type => {
      vi.mocked(listAttachments).mockResolvedValue(metadata([{ ...receipt, filename: 'pdf' }]));
      renderPanel({ type, id: 'parent' });
      fireEvent.click(await screen.findByRole('button', { name: 'Rename pdf' }));
      const input = screen.getByRole('textbox', { name: 'Attachment name' });
      expect(input).toHaveValue('pdf');
      expect(input).toHaveAttribute('maxlength', '255');
      fireEvent.change(input, { target: { value: 'Receipt' } });
      vi.mocked(renameAttachment).mockResolvedValue({ id: receipt.id, filename: 'Receipt' });
      vi.mocked(listAttachments).mockResolvedValue(metadata([{ ...receipt, filename: 'Receipt' }]));
      fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
      expect(
        await screen.findByRole('link', { name: 'Open Receipt in a new tab' })
      ).toBeInTheDocument();
      expect(renameAttachment).toHaveBeenCalledWith(
        'car',
        { type, id: 'parent' },
        receipt.id,
        'Receipt',
        expect.any(AbortSignal)
      );
    }
  );

  it.each(['expense', 'fillup'] as const)(
    'renames a %s attachment independently and blocks conflicting actions until refreshed',
    async type => {
      vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
      let complete: (_result: { id: string; filename: string }) => void = () => {};
      vi.mocked(renameAttachment).mockImplementation(
        () =>
          new Promise(resolve => {
            complete = resolve;
          })
      );
      const { onUploadingChange } = renderPanel({ type, id: 'parent' });
      fireEvent.click(await screen.findByRole('button', { name: 'Rename receipt.pdf' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Attachment name' }), {
        target: { value: 'Service receipt' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
      await waitFor(() => expect(renameAttachment).toHaveBeenCalledOnce());
      expect(renameAttachment).toHaveBeenCalledWith(
        'car',
        { type, id: 'parent' },
        'a1',
        'Service receipt',
        expect.any(AbortSignal)
      );
      expect(screen.getByText('receipt.pdf')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete receipt.pdf' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel rename' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
      expect(onUploadingChange).toHaveBeenCalledWith(true);
      vi.mocked(listAttachments).mockResolvedValue(
        metadata([{ ...receipt, filename: 'Service receipt.pdf' }])
      );
      await act(async () => complete({ id: 'a1', filename: 'Service receipt.pdf' }));
      expect(
        await screen.findByRole('link', { name: 'Open Service receipt.pdf in a new tab' })
      ).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Attachment name' })).not.toBeInTheDocument();
      expect(screen.getByText('4 of 5 attachment slots remaining')).toBeInTheDocument();
      expect(onUploadingChange).toHaveBeenLastCalledWith(false);
      expect(listAttachments).toHaveBeenCalledTimes(2);
    }
  );

  it('keeps the draft and permits manual retry after a failed rename', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    vi.mocked(renameAttachment).mockRejectedValueOnce(new Error('Could not rename attachment.'));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename receipt.pdf' }));
    const input = screen.getByRole('textbox', { name: 'Attachment name' });
    fireEvent.change(input, { target: { value: 'Service receipt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not rename attachment.');
    expect(input).toHaveValue('Service receipt');
    expect(listAttachments).toHaveBeenCalledTimes(2);
    expect(renameAttachment).toHaveBeenCalledOnce();
    vi.mocked(listAttachments).mockResolvedValue(
      metadata([{ ...receipt, filename: 'Service receipt.pdf' }])
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Service receipt.pdf')).toBeInTheDocument();
    expect(renameAttachment).toHaveBeenCalledTimes(2);
  });

  it('disables saving an empty name', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename receipt.pdf' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Attachment name' }), {
      target: { value: '  ' },
    });
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
    expect(renameAttachment).not.toHaveBeenCalled();
  });

  it('blocks another rename after a failed list refresh until manually refreshed', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    vi.mocked(renameAttachment).mockRejectedValueOnce(new Error('Connection failed.'));
    const { onUploadingChange } = renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename receipt.pdf' }));
    vi.mocked(listAttachments).mockRejectedValue(new Error('List unavailable.'));
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    const refresh = await screen.findByRole('button', { name: 'Refresh attachments' });
    await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false));
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete receipt.pdf' })).toBeDisabled();
    expect(renameAttachment).toHaveBeenCalledOnce();
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    fireEvent.click(refresh);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save name' })).toBeEnabled());
  });

  it('fails offline without queuing a rename or leaving the dialog locked', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    vi.mocked(renameAttachment).mockRejectedValue(new Error('Connection failed.'));
    const { onUploadingChange } = renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename receipt.pdf' }));
    act(() => onlineManager.setOnline(false));
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed.');
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    expect(renameAttachment).toHaveBeenCalledOnce();
    await act(async () => onlineManager.setOnline(true));
    expect(renameAttachment).toHaveBeenCalledOnce();
  });

  it.each(['expense', 'fillup'] as const)(
    'deletes a %s attachment and refreshes capacity while blocking conflicting actions',
    async type => {
      vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
      let complete: (_result: { id: string }) => void = () => {};
      vi.mocked(deleteAttachment).mockImplementation(
        () =>
          new Promise(resolve => {
            complete = resolve;
          })
      );
      const { onUploadingChange } = renderPanel({ type, id: 'parent' });
      fireEvent.click(await screen.findByRole('button', { name: 'Delete receipt.pdf' }));
      await waitFor(() => expect(deleteAttachment).toHaveBeenCalledOnce());
      expect(deleteAttachment).toHaveBeenCalledWith(
        'car',
        { type, id: 'parent' },
        'a1',
        expect.any(AbortSignal)
      );
      expect(screen.getByRole('button', { name: 'Delete receipt.pdf' })).toBeDisabled();
      expect(screen.getByText('Deleting…')).toBeInTheDocument();
      expect(screen.getByLabelText('Attachment file')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(onUploadingChange).toHaveBeenCalledWith(true);
      vi.mocked(listAttachments).mockResolvedValue(metadata());
      await act(async () => complete({ id: 'a1' }));
      expect(await screen.findByText('No attachments yet.')).toBeInTheDocument();
      expect(screen.getByText('5 of 5 attachment slots remaining')).toBeInTheDocument();
      expect(onUploadingChange).toHaveBeenLastCalledWith(false);
      expect(listAttachments).toHaveBeenCalledTimes(2);
    }
  );

  it('refreshes after deletion failure and only retries when clicked again', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    vi.mocked(deleteAttachment).mockRejectedValueOnce(new Error('Could not delete attachment.'));
    const { onUploadingChange } = renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete receipt.pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete attachment.');
    expect(listAttachments).toHaveBeenCalledTimes(2);
    expect(deleteAttachment).toHaveBeenCalledOnce();
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    vi.mocked(listAttachments).mockResolvedValue(metadata());
    fireEvent.click(screen.getByRole('button', { name: 'Delete receipt.pdf' }));
    expect(await screen.findByText('No attachments yet.')).toBeInTheDocument();
    expect(deleteAttachment).toHaveBeenCalledTimes(2);
  });

  it('blocks deletion when the list refresh fails until manually refreshed', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    renderPanel();
    const button = await screen.findByRole('button', { name: 'Delete receipt.pdf' });
    vi.mocked(listAttachments).mockRejectedValue(new Error('List unavailable.'));
    fireEvent.click(button);
    expect(await screen.findByRole('button', { name: 'Refresh attachments' })).toBeInTheDocument();
    expect(button).toBeDisabled();
    vi.mocked(listAttachments).mockResolvedValue(metadata());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh attachments' }));
    expect(await screen.findByText('No attachments yet.')).toBeInTheDocument();
  });

  it('fails offline without queuing deletion or leaving the dialog locked', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    vi.mocked(deleteAttachment).mockRejectedValue(new Error('Connection failed.'));
    const { onUploadingChange } = renderPanel();
    const button = await screen.findByRole('button', { name: 'Delete receipt.pdf' });
    act(() => onlineManager.setOnline(false));
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed.');
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    expect(deleteAttachment).toHaveBeenCalledOnce();
    await act(async () => onlineManager.setOnline(true));
    expect(deleteAttachment).toHaveBeenCalledOnce();
  });

  it('does not upload on file selection and uses a separate non-submit action', async () => {
    renderPanel();
    const file = await select();
    expect(uploadAttachment).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Upload' });
    expect(button).toHaveAttribute('type', 'button');
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    fireEvent.click(button);
    expect(await screen.findByText('Attachment uploaded.')).toBeInTheDocument();
    expect(uploadAttachment).toHaveBeenCalledWith(
      'car',
      { type: 'expense', id: 'e1' },
      {
        file,
        signal: expect.any(AbortSignal),
        onProgress: expect.any(Function),
      }
    );
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument();
    expect(screen.getByText('4 of 5 attachment slots remaining')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('shows real progress and waits for server confirmation before success', async () => {
    let complete: (_item: AttachmentDto) => void = () => {};
    let progress: (_percent: number | null) => void = () => {};
    vi.mocked(uploadAttachment).mockImplementation((_vehicleId, _record, options) => {
      progress = options.onProgress;
      return new Promise(resolve => {
        complete = resolve;
      });
    });
    const { onUploadingChange } = renderPanel();
    await select();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledOnce());
    act(() => progress(40));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40');
    expect(screen.getByText('Uploading… 40%')).toBeInTheDocument();
    expect(onUploadingChange).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText('Attachment file')).toBeDisabled();
    act(() => progress(null));
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value');
    act(() => progress(100));
    expect(
      screen.getByText('File sent. Confirming upload and refreshing attachments…')
    ).toBeInTheDocument();
    expect(screen.queryByText('Attachment uploaded.')).not.toBeInTheDocument();
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    await act(async () => complete(receipt));
    expect(await screen.findByText('Attachment uploaded.')).toBeInTheDocument();
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
  });

  it('refreshes after a lost response before permitting a manual retry, without auto-retrying', async () => {
    vi.mocked(uploadAttachment).mockRejectedValueOnce(new ApiClientError('Connection failed.', 0));
    renderPanel();
    await select();
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    const retry = await screen.findByRole('button', { name: 'Retry upload' });
    expect(await screen.findByText('receipt.pdf')).toBeInTheDocument();
    expect(listAttachments).toHaveBeenCalledTimes(2);
    expect(uploadAttachment).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('a retry may create a duplicate');
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(await screen.findByText('Attachment uploaded.')).toBeInTheDocument();
    expect(uploadAttachment).toHaveBeenCalledTimes(2);
  });

  it('blocks retries when the post-failure list refresh fails, until a successful refresh', async () => {
    vi.mocked(uploadAttachment).mockRejectedValueOnce(new ApiClientError('Connection failed.', 0));
    renderPanel();
    await select();
    vi.mocked(listAttachments).mockRejectedValue(new Error('List unavailable.'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('button', { name: 'Refresh attachments' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry upload' })).not.toBeInTheDocument()
    );
    expect(uploadAttachment).toHaveBeenCalledOnce();
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh attachments' }));
    expect(await screen.findByRole('button', { name: 'Retry upload' })).toBeEnabled();
    expect(screen.getByText('Selected file: receipt.pdf')).toBeInTheDocument();
  });

  it.each(['expense', 'fillup'] as const)(
    'unlocks the %s dialog after an offline failure without queuing another upload',
    async type => {
      const { onUploadingChange } = renderPanel({ type, id: 'parent' });
      await select();
      act(() => onlineManager.setOnline(false));
      vi.mocked(uploadAttachment).mockRejectedValueOnce(
        new ApiClientError('Connection failed.', 0)
      );
      vi.mocked(listAttachments).mockRejectedValueOnce(new Error('List unavailable.'));

      fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

      expect(
        await screen.findByRole('button', { name: 'Refresh attachments' })
      ).toBeInTheDocument();
      await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false));
      expect(uploadAttachment).toHaveBeenCalledOnce();
      expect(listAttachments).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('button', { name: 'Retry upload' })).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

      await act(async () => onlineManager.setOnline(true));
      expect(uploadAttachment).toHaveBeenCalledOnce();
    }
  );

  it('keeps confirmed metadata even when refreshing after success fails', async () => {
    renderPanel();
    await select();
    vi.mocked(listAttachments).mockRejectedValue(new Error('List unavailable.'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Attachment uploaded.')).toBeInTheDocument();
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh attachments' })).toBeInTheDocument();
  });

  it('shows filenames but no upload controls for a viewer', async () => {
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt], false));
    renderPanel();
    expect(await screen.findByText('receipt.pdf')).toBeInTheDocument();
    expect(screen.getByText(/View-only access/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open receipt.pdf in a new tab' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Attachment file')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete receipt.pdf' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename receipt.pdf' })).not.toBeInTheDocument();
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  it('disables uploads when five attachments are present', async () => {
    vi.mocked(listAttachments).mockResolvedValue(
      metadata(
        Array.from({ length: 5 }, (_, i) => ({
          ...receipt,
          id: `a${i}`,
          filename: `receipt-${i}.pdf`,
        }))
      )
    );
    renderPanel();
    expect(await screen.findByText('0 of 5 attachment slots remaining')).toBeInTheDocument();
    expect(screen.getByLabelText('Attachment file')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('refreshes capacity after a competing upload fills the last slot', async () => {
    vi.mocked(uploadAttachment).mockRejectedValue(
      new ApiClientError('Record is full.', 409, 'ATTACHMENT_LIMIT')
    );
    renderPanel();
    await select();
    vi.mocked(listAttachments).mockResolvedValue(
      metadata(
        Array.from({ length: 5 }, (_, i) => ({
          ...receipt,
          id: `a${i}`,
          filename: `receipt-${i}.pdf`,
        }))
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('button', { name: 'Retry upload' })).toBeDisabled();
    expect(screen.getByText('0 of 5 attachment slots remaining')).toBeInTheDocument();
    expect(uploadAttachment).toHaveBeenCalledOnce();
  });

  it.each([
    new File(['gif'], 'photo.gif'),
    new File([], 'empty.pdf'),
    new File([new Uint8Array(4_000_001)], 'large.pdf'),
  ])('rejects an invalid selection before uploading: $name', async file => {
    renderPanel();
    await select(file);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  it('provides a refresh action after initial list failure', async () => {
    vi.mocked(listAttachments).mockRejectedValueOnce(new Error('List unavailable.'));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('List unavailable.');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh attachments' }));
    expect(await screen.findByLabelText('Attachment file')).toBeEnabled();
  });

  it('reloads filenames and capacity when reopening the same record', async () => {
    const { unmount, client } = renderPanel();
    await screen.findByLabelText('Attachment file');
    unmount();
    vi.mocked(listAttachments).mockResolvedValue(metadata([receipt]));
    render(
      <QueryClientProvider client={client}>
        <RecordAttachments
          vehicleId="car"
          record={{ type: 'expense', id: 'e1' }}
          onUploadingChange={vi.fn()}
        />
      </QueryClientProvider>
    );
    expect(await screen.findByText('receipt.pdf')).toBeInTheDocument();
    expect(screen.getByText('4 of 5 attachment slots remaining')).toBeInTheDocument();
    expect(listAttachments).toHaveBeenCalledTimes(2);
  });

  it('cancels its browser request on unmount', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(uploadAttachment).mockImplementation((_vehicleId, _record, options) => {
      signal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('Cancelled.')), {
          once: true,
        });
      });
    });
    const { unmount } = renderPanel();
    await select();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledOnce());
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
