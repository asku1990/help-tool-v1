import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import ExpenseList from '../../ExpenseList';
import FillUpList from '../../FillUpList';
import type { AttachmentRecord } from '@/queries/attachments';

vi.mock('../RecordAttachments', () => ({
  default: ({
    vehicleId,
    record,
    onUploadingChange,
    disabled,
  }: {
    vehicleId: string;
    record: AttachmentRecord;
    onUploadingChange: (_value: boolean) => void;
    disabled?: boolean;
  }) => (
    <section aria-label="Attachments">
      <span>{`${vehicleId}/${record.type}/${record.id}`}</span>
      <button type="button" disabled={disabled} onClick={() => onUploadingChange(true)}>
        Begin test upload
      </button>
      <button type="button" onClick={() => onUploadingChange(false)}>
        Finish test upload
      </button>
    </section>
  ),
}));

describe.each([
  { type: 'expense', Component: ExpenseList, dialog: 'Edit expense' },
  { type: 'fillup', Component: FillUpList, dialog: 'Edit fill-up' },
])('$type edit dialog', ({ type, Component, dialog }) => {
  it('keeps attachments separate and protects unsaved changes on dismissal', async () => {
    const saveRecord = vi.fn();
    const resource = type === 'expense' ? 'expenses' : 'fillups';
    let savedDate = '2026-11-16';
    let finishRefresh = () => {};
    const refresh = new Promise<void>(resolve => {
      finishRefresh = resolve;
    });
    server.use(
      http.patch(
        `/api/vehicles/car/${resource}/parent`,
        async ({ request }: { request: Request }) => {
          const body = (await request.json()) as { date: string };
          saveRecord(body);
          savedDate = body.date;
          return HttpResponse.json({ data: { id: 'parent' } });
        }
      ),
      http.get('/api/vehicles/car/expenses', async () => {
        if (savedDate !== '2026-11-16') await refresh;
        return HttpResponse.json({
          data: {
            expenses: [{ id: 'parent', date: savedDate, category: 'OTHER', amount: 10 }],
            expensesTotal: 10,
            nextCursor: null,
            canWrite: true,
          },
        });
      }),
      http.get('/api/vehicles/car/fillups', async () => {
        if (savedDate !== '2026-11-16') await refresh;
        return HttpResponse.json({
          data: {
            fillUps: [
              {
                id: 'parent',
                date: savedDate,
                odometerKm: 100,
                liters: 10,
                pricePerLiter: 2,
                totalCost: 20,
                isFull: true,
              },
            ],
            nextCursor: null,
            canWrite: true,
          },
        });
      })
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Component vehicleId="car" />
      </QueryClientProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: /actions for/ }));
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(screen.queryByRole('region', { name: 'Attachments' })).not.toBeInTheDocument();
    fireEvent.click(edit);
    const panel = await screen.findByRole('region', { name: 'Attachments' });
    await waitFor(() => expect(screen.getByRole('heading', { name: dialog })).toHaveFocus());
    expect(panel).toHaveTextContent(`car/${type}/parent`);
    expect(panel.closest('form')).toBeNull();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const save = screen.getByRole('button', { name: 'Save changes' });
    const date = screen.getByLabelText('Date');
    expect(panel.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(save).toBeDisabled();
    fireEvent.change(date, { target: { value: '2026-11-17' } });
    expect(save).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Begin test upload' }));
    expect(save).toBeDisabled();
    expect(cancel).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog', { name: dialog }), { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish test upload' }));
    expect(save).toBeEnabled();
    fireEvent.change(date, { target: { value: '2026-11-16' } });
    expect(save).toBeDisabled();
    fireEvent.click(cancel);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Attachments' })).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /actions for/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-17' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      fireEvent.keyDown(screen.getByRole('dialog', { name: dialog }), { key: 'Escape' });
      expect(confirm).toHaveBeenCalledOnce();
      expect(screen.getByLabelText('Date')).toHaveValue('2026-11-17');

      confirm.mockReturnValue(true);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: dialog })).toBeNull());

      fireEvent.click(screen.getByRole('button', { name: /actions for/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByLabelText('Date')).toHaveValue('2026-11-16');
    } finally {
      confirm.mockRestore();
    }

    expect(saveRecord).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-18' } });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: dialog })).toBeNull());
      expect(saveRecord).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ date: '2026-11-18' })
      );

      fireEvent.click(screen.getByRole('button', { name: /actions for/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(screen.getByLabelText('Date')).toHaveValue('2026-11-18');
    } finally {
      finishRefresh();
    }
  });
});
