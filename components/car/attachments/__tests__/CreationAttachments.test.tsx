import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useUiStore } from '@/stores/ui';
import ExpenseForm from '../../ExpenseForm';
import FillUpForm from '../../FillUpForm';
import { listAttachments, uploadAttachment, type AttachmentDto } from '@/queries/attachments';

vi.mock('@/queries/attachments', async importOriginal => ({
  ...(await importOriginal<typeof import('@/queries/attachments')>()),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
}));

const receipt: AttachmentDto = {
  id: 'attachment',
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
  sizeBytes: 100,
  createdAtUtc: '2026-11-16T00:00:00.000Z',
  updatedAtUtc: '2026-11-16T00:00:00.000Z',
};
const metadata = { attachments: [], canUpload: true, maxAttachments: 5, remainingCapacity: 5 };

describe.each([
  { type: 'expense', Component: ExpenseForm, label: 'expense', resource: 'expenses' },
  { type: 'fillup', Component: FillUpForm, label: 'fill-up', resource: 'fillups' },
])('$type creation attachments', ({ type, Component, label, resource }) => {
  const create = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    useUiStore.setState({ isExpenseDialogOpen: false, isFillUpDialogOpen: false });
    create.mockImplementation(() =>
      HttpResponse.json({ data: { id: 'saved-record' } }, { status: 201 })
    );
    vi.mocked(listAttachments).mockResolvedValue(metadata);
    vi.mocked(uploadAttachment).mockResolvedValue(receipt);
    server.use(
      http.get('/api/vehicles/car', () =>
        HttpResponse.json({
          data: { vehicle: { id: 'car', name: 'Car', inspectionIntervalMonths: 12 } },
        })
      ),
      http.get('/api/vehicles/car/expenses', () =>
        HttpResponse.json({
          data: { expenses: [], expensesTotal: 0, nextCursor: null, canWrite: true },
        })
      ),
      http.get('/api/vehicles/car/fillups', () =>
        HttpResponse.json({ data: { fillUps: [], nextCursor: null, canWrite: true } })
      ),
      http.post(`/api/vehicles/car/${resource}`, create)
    );
  });
  afterEach(() => {
    cleanup();
    useUiStore.setState({ isExpenseDialogOpen: false, isFillUpDialogOpen: false });
  });

  async function openForm() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const onCreated = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <Component vehicleId="car" onCreated={onCreated} />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: `Add ${label}` }));
    await screen.findByRole('dialog', { name: `Add ${label}` });
    if (type === 'fillup') {
      fireEvent.change(screen.getByLabelText('Odometer km'), { target: { value: '1000' } });
      fireEvent.change(screen.getByLabelText('Liters'), { target: { value: '30' } });
      fireEvent.change(screen.getByLabelText('Price per liter'), { target: { value: '1.5' } });
    } else {
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } });
    }
    return { onCreated };
  }

  async function saveWithAttachments() {
    fireEvent.click(screen.getByRole('button', { name: 'Save & add attachments' }));
    const dialog = await screen.findByRole('dialog', {
      name: `${type === 'expense' ? 'Expense' : 'Fill-up'} saved`,
    });
    const input = await within(dialog).findByLabelText('Attachment file');
    await waitFor(() => expect(input).toBeEnabled());
    return { dialog, input };
  }

  function selectFile(input: HTMLElement) {
    fireEvent.change(input, {
      target: { files: [new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' })] },
    });
  }

  it('keeps ordinary Save unchanged and never opens attachment requests', async () => {
    const { onCreated } = await openForm();
    fireEvent.click(screen.getByRole('button', { name: `Save ${label}` }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(create).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledOnce();
    expect(listAttachments).not.toHaveBeenCalled();
  });

  it('waits for confirmed creation and blocks dismissal and duplicate submits while saving', async () => {
    let complete: (_response: Response) => void = () => {};
    create.mockImplementationOnce(
      () =>
        new Promise<Response>(resolve => {
          complete = resolve;
        })
    );
    await openForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save & add attachments' }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(listAttachments).not.toHaveBeenCalled();
    const form = screen.getByRole('form', {
      name: type === 'expense' ? 'Expense information' : 'Fill-up information',
    });
    fireEvent.submit(form);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(dialog).toBeInTheDocument();
    await act(async () =>
      complete(HttpResponse.json({ data: { id: 'saved-record' } }, { status: 201 }))
    );
    expect(await screen.findByRole('region', { name: 'Attachments' })).toBeInTheDocument();
    expect(create).toHaveBeenCalledOnce();
  });

  it('allows Done without uploading and leaves the saved record intact', async () => {
    await openForm();
    await saveWithAttachments();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(uploadAttachment).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
  });

  it('uses the saved ID, locks record fields, and keeps attachments outside the form', async () => {
    const { onCreated } = await openForm();
    expect(listAttachments).not.toHaveBeenCalled();
    const { dialog, input } = await saveWithAttachments();
    expect(listAttachments).toHaveBeenCalledWith(
      'car',
      { type, id: 'saved-record' },
      expect.any(AbortSignal)
    );
    const saved = within(dialog).getByRole('form', {
      name: type === 'expense' ? 'Saved expense' : 'Saved fill-up',
    });
    for (const field of saved.querySelectorAll('input, select, textarea')) {
      expect(field).toBeDisabled();
    }
    expect(input.closest('form')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: `Save ${label}` })).not.toBeInTheDocument();
    expect(onCreated).toHaveBeenCalledOnce();
    selectFile(input);
    vi.mocked(listAttachments).mockResolvedValue({
      ...metadata,
      attachments: [receipt],
      remainingCapacity: 4,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Attachment uploaded.')).toBeInTheDocument();
    expect(create).toHaveBeenCalledOnce();
    expect(uploadAttachment).toHaveBeenCalledWith(
      'car',
      { type, id: 'saved-record' },
      expect.objectContaining({ file: expect.any(File) })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: `Add ${label}` }));
    expect(await screen.findByRole('button', { name: `Save ${label}` })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Attachments' })).not.toBeInTheDocument();
  });

  it('retries a failed upload without creating the record or notifying creation again', async () => {
    const { onCreated } = await openForm();
    const { input } = await saveWithAttachments();
    selectFile(input);
    vi.mocked(uploadAttachment).mockRejectedValueOnce(new Error('Upload failed.'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    const retry = await screen.findByRole('button', { name: 'Retry upload' });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(screen.getByRole('alert')).toHaveTextContent('Upload failed.');
    fireEvent.click(retry);
    expect(await screen.findByText('Attachment uploaded.')).toBeInTheDocument();
    expect(uploadAttachment).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it('blocks Done, Escape, and the close button while an upload is processing', async () => {
    await openForm();
    const { dialog, input } = await saveWithAttachments();
    let complete: (_attachment: AttachmentDto) => void = () => {};
    vi.mocked(uploadAttachment).mockImplementation(
      () =>
        new Promise(resolve => {
          complete = resolve;
        })
    );
    selectFile(input);
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(dialog).toBeInTheDocument();
    await act(async () => complete(receipt));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled());
    expect(create).toHaveBeenCalledOnce();
  });

  it('keeps the form editable when creation fails and opens no attachment requests', async () => {
    create.mockReturnValueOnce(
      HttpResponse.json(
        {
          error: { code: 'SERVER_ERROR', message: 'Could not create record.' },
        },
        { status: 500 }
      )
    );
    const { onCreated } = await openForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save & add attachments' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `Save ${label}` })).toBeEnabled()
    );
    expect(screen.getByLabelText(type === 'expense' ? 'Amount' : 'Liters')).toBeEnabled();
    expect(listAttachments).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    await saveWithAttachments();
    expect(create).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledOnce();
  });

  if (type === 'expense') {
    it.each([false, true])(
      'does not recreate a saved inspection expense if its follow-up fails (attachments=%s)',
      async addAttachments => {
        const update = vi.fn(() =>
          HttpResponse.json(
            {
              error: { message: 'Inspection update failed.' },
            },
            { status: 500 }
          )
        );
        server.use(http.patch('/api/vehicles/car', update));
        const { onCreated } = await openForm();
        fireEvent.change(screen.getByLabelText('Expense category'), {
          target: { value: 'INSPECTION' },
        });
        fireEvent.click(
          screen.getByRole('button', {
            name: addAttachments ? 'Save & add attachments' : 'Save expense',
          })
        );
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(
          'Expense saved, but the vehicle inspection dates could not be updated.'
        );
        expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
        expect(screen.queryByRole('button', { name: 'Save expense' })).not.toBeInTheDocument();
        const form = screen.getByRole('form', { name: 'Saved expense' });
        fireEvent.submit(form);
        expect(create).toHaveBeenCalledOnce();
        expect(update).toHaveBeenCalledOnce();
        expect(onCreated).toHaveBeenCalledOnce();
        expect(Boolean(screen.queryByRole('region', { name: 'Attachments' }))).toBe(addAttachments);
      }
    );
  }
});
