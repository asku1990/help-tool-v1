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
  { type: 'expense', Component: ExpenseList, dialog: 'Edit expense', save: 'Save expense' },
  { type: 'fillup', Component: FillUpList, dialog: 'Edit fill-up', save: 'Save' },
])('$type attachment integration', ({ type, Component, dialog, save }) => {
  it('mounts attachments only in the open saved-record dialog and outside its edit form', async () => {
    server.use(
      http.get('/api/vehicles/car/expenses', () =>
        HttpResponse.json({
          data: {
            expenses: [{ id: 'parent', date: '2026-11-16', category: 'OTHER', amount: 10 }],
            expensesTotal: 10,
            nextCursor: null,
          },
        })
      ),
      http.get('/api/vehicles/car/fillups', () =>
        HttpResponse.json({
          data: {
            fillUps: [
              {
                id: 'parent',
                date: '2026-11-16',
                odometerKm: 100,
                liters: 10,
                pricePerLiter: 2,
                totalCost: 20,
                isFull: true,
              },
            ],
            nextCursor: null,
          },
        })
      )
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Component vehicleId="car" />
      </QueryClientProvider>
    );
    const edit = await screen.findByRole('button', { name: 'Edit' });
    expect(screen.queryByRole('region', { name: 'Attachments' })).not.toBeInTheDocument();
    fireEvent.click(edit);
    const panel = await screen.findByRole('region', { name: 'Attachments' });
    expect(panel).toHaveTextContent(`car/${type}/parent`);
    expect(panel.closest('form')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Begin test upload' }));
    expect(screen.getByRole('button', { name: save })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog', { name: dialog }), { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finish test upload' }));
    expect(screen.getByRole('button', { name: save })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Attachments' })).not.toBeInTheDocument()
    );
  });
});
