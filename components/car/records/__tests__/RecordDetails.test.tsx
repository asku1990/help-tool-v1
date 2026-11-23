import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import ExpenseList from '../../expenses/ExpenseList';
import FillUpList from '../../fillups/FillUpList';
import {
  deleteAttachment,
  listAttachments,
  renameAttachment,
  uploadAttachment,
} from '@/queries/attachments';

vi.mock('@/queries/attachments', async importOriginal => ({
  ...(await importOriginal<typeof import('@/queries/attachments')>()),
  listAttachments: vi.fn(),
  deleteAttachment: vi.fn(),
  renameAttachment: vi.fn(),
  uploadAttachment: vi.fn(),
}));

const attachment = {
  id: 'a1',
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
  sizeBytes: 100,
  createdAtUtc: '2026-11-16T00:00:00.000Z',
  updatedAtUtc: '2026-11-16T00:00:00.000Z',
};
const metadata = {
  attachments: [attachment],
  maxAttachments: 10,
  remainingCapacity: 9,
  canUpload: true,
};

describe.each([
  { type: 'expense', Component: ExpenseList, title: 'Expense details', resource: 'expenses' },
  { type: 'fillup', Component: FillUpList, title: 'Fill-up details', resource: 'fillups' },
])('$type details from the list', ({ type, Component, title, resource }) => {
  let canWrite: boolean | undefined;
  let notes: string;
  let longValues: boolean;
  beforeEach(() => {
    canWrite = true;
    notes = 'Saved notes\nSecond line';
    longValues = false;
    vi.resetAllMocks();
    vi.mocked(listAttachments).mockResolvedValue(metadata);
    server.use(
      http.get('/api/vehicles/car/expenses', () =>
        HttpResponse.json({
          data: {
            expenses: [
              {
                id: 'parent',
                date: '2026-11-16',
                category: 'OIL_TOP_UP',
                amount: 10,
                vendor: 'Test workshop',
                odometerKm: longValues ? 2147483647 : 0,
                liters: 0,
                oilConsumption: longValues ? 12345.6 : 0,
                notes,
              },
            ],
            expensesTotal: 10,
            nextCursor: null,
            canWrite,
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
                odometerKm: longValues ? -2147483648 : 100,
                liters: longValues ? 12345.67 : 10,
                pricePerLiter: longValues ? 12.345 : 2,
                totalCost: longValues ? 152407.3 : 20,
                isFull: true,
                notes,
                segment: {
                  distanceKm: 200,
                  litersUsed: 15,
                  lPer100: 7.5,
                  fuelCost: 30,
                  costPer100: 15,
                  prevLPer100: 6.5,
                },
              },
            ],
            nextCursor: null,
            canWrite,
          },
        })
      )
    );
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderList() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return render(
      <QueryClientProvider client={client}>
        <Component vehicleId="car" />
      </QueryClientProvider>
    );
  }

  const name = type === 'expense' ? 'expense' : 'fill-up';
  it.each(['moved', 'retry'])('reconciles Details after saving: %s', async outcome => {
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /View .* details/ }));
    const view = within(screen.getByRole('dialog'));
    fireEvent.click(view.getByRole('button', { name: 'Edit details' }));
    let reads = 0;
    const saved = vi.fn(() => HttpResponse.json({ data: { id: 'parent' } }));
    server.use(
      http.patch(`/api/vehicles/car/${resource}/parent`, saved),
      http.get(`/api/vehicles/car/${resource}`, () => {
        reads++;
        if (outcome === 'retry' && reads === 1) return HttpResponse.json({}, { status: 500 });
        const row = {
          id: outcome === 'moved' ? 'other' : 'parent',
          date: '2026-11-01',
          notes: 'From refreshed list',
          category: 'OTHER',
          amount: 10,
          odometerKm: 100,
          liters: 10,
          pricePerLiter: 2,
          totalCost: 20,
          isFull: true,
        };
        return HttpResponse.json({
          data: {
            [type === 'expense' ? 'expenses' : 'fillUps']: [row],
            expensesTotal: 10,
            nextCursor: null,
            canWrite: true,
          },
        });
      })
    );
    fireEvent.change(view.getByLabelText('Date'), { target: { value: '2026-11-01' } });
    fireEvent.click(view.getByRole('button', { name: 'Save changes' }));
    if (outcome === 'moved') {
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() =>
        expect(screen.getByRole('table').closest('[tabindex="-1"]')).toHaveFocus()
      );
    } else {
      fireEvent.click(await view.findByRole('button', { name: 'Retry refresh' }));
      expect(await view.findByText('From refreshed list', { selector: 'dd' })).toBeVisible();
    }
    expect(saved).toHaveBeenCalledOnce();
    expect(reads).toBe(outcome === 'moved' ? 1 : 2);
  });
  it('keeps the draft after a failed save and asks before discarding it back to Details', async () => {
    server.use(
      http.patch(`/api/vehicles/car/${resource}/parent`, () =>
        HttpResponse.json({ error: { message: 'Expense could not be saved.' } }, { status: 500 })
      )
    );
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /View .* details/ }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Edit details' }));
    fireEvent.change(dialog.getByLabelText('Notes'), { target: { value: 'Unsaved draft' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
    expect(await dialog.findByRole('alert')).toBeVisible();
    expect(dialog.getByLabelText('Notes')).toHaveValue('Unsaved draft');
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(dialog.getByLabelText('Notes')).toHaveValue('Unsaved draft');
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(dialog.getByRole('button', { name: 'Edit details' })).toHaveFocus();
    expect(dialog.queryByText('Unsaved draft')).toBeNull();
  });
  it('switches tasks inside one dialog, keeps Escape local to rename, and shows the saved summary', async () => {
    server.use(
      http.patch(`/api/vehicles/car/${resource}/parent`, async ({ request }) => {
        const body = (await request.json()) as { notes: string };
        notes = body.notes;
        return HttpResponse.json({ data: { id: 'parent' } });
      })
    );
    renderList();
    const trigger = await screen.findByRole('button', { name: /View .* details/ });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    const view = within(dialog);
    const manage = await view.findByRole('button', { name: 'Manage files' });
    fireEvent.click(manage);
    expect(screen.getByRole('dialog', { name: `Manage ${name} files` })).toBe(dialog);
    expect(view.getByRole('heading', { name: `Manage ${name} files` })).toHaveFocus();
    expect(view.queryByRole('term')).toBeNull();
    expect(view.getByText(type === 'expense' ? /Test workshop ·/ : /100 km ·/)).toBeVisible();
    expect(view.getByText('File changes are saved immediately.')).toBeVisible();
    expect(view.getByText('9 of 10 attachment slots remaining')).toBeVisible();
    expect(view.getByRole('button', { name: 'Upload file' })).toBeVisible();
    expect(view.queryByRole('button', { name: 'Edit details' })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Rename receipt.pdf' }));
    fireEvent.keyDown(view.getByRole('textbox', { name: 'Attachment name' }), { key: 'Escape' });
    expect(view.queryByRole('textbox')).toBeNull();
    expect(view.getByRole('button', { name: 'Done' })).toBeVisible();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    const reopened = view.getByRole('button', { name: 'Manage files' });
    expect(reopened).toHaveFocus();
    fireEvent.click(reopened);
    fireEvent.click(view.getByRole('button', { name: 'Done' }));
    expect(view.getByRole('button', { name: 'Manage files' })).toHaveFocus();
    expect(view.getByText(type === 'expense' ? 'Amount' : 'Total cost')).toBeVisible();
    fireEvent.click(view.getByRole('button', { name: 'Edit details' }));
    expect(screen.getByRole('dialog', { name: `Edit ${name}` })).toBe(dialog);
    expect(view.queryByRole('region', { name: 'Files' })).toBeNull();
    fireEvent.change(view.getByLabelText('Notes'), { target: { value: 'Corrected notes' } });
    fireEvent.click(view.getByRole('button', { name: 'Save changes' }));
    expect(await view.findByText('Corrected notes', { selector: 'dd' })).toBeVisible();
    expect(view.getByRole('button', { name: 'Edit details' })).toHaveFocus();
    fireEvent.click(view.getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('limits long note previews without shortening the full notes in Details', async () => {
    notes = 'A long saved note with useful record information. '.repeat(30).trim();
    renderList();
    const preview = await screen.findByText(notes);
    const tableTruncation = `@min-[56rem]/${type === 'expense' ? 'expenses' : 'fillups'}:truncate`;
    expect(preview).toHaveClass('line-clamp-2', 'wrap-anywhere', tableTruncation);
    if (type === 'fillup') {
      expect(preview).not.toContainElement(screen.getByText('Full tank'));
      expect(preview).not.toContainElement(screen.getByTitle('Higher than previous trip'));
    }
    fireEvent.click(screen.getByRole('button', { name: /View .* details for/ }));
    const dialog = within(await screen.findByRole('dialog', { name: title }));
    const fullNotes = dialog.getByText(notes);
    expect(fullNotes).toHaveTextContent(notes);
    expect(fullNotes).not.toHaveClass('line-clamp-2');
    expect(fullNotes).not.toHaveClass(tableTruncation);
    if (type === 'fillup') {
      expect(dialog.getByText('Full tank')).toBeInTheDocument();
      expect(dialog.getByText('7.50 L/100 km')).toBeInTheDocument();
    }
  });

  it('keeps long numeric values in the list and in Details', async () => {
    longValues = true;
    renderList();
    const details = await screen.findByRole('button', { name: /View .* details for/ });
    const cells = screen.getAllByRole('cell');
    if (type === 'expense') {
      expect(cells[1]).toHaveTextContent('2147483647 km');
      expect(cells[1]).toHaveTextContent('12345.6 L/10k');
    } else {
      expect(cells[1]).toHaveTextContent('-2147483648 km');
      expect(cells[2]).toHaveTextContent('12345.67 L ×');
      expect(cells[2]).toHaveTextContent(
        new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(152407.3)
      );
    }

    fireEvent.click(details);
    const dialog = within(await screen.findByRole('dialog', { name: title }));
    const values =
      type === 'expense'
        ? ['2147483647 km', '12345.6 L/10,000 km']
        : [
            '-2147483648 km',
            '12345.67 L',
            '12.345 €/L',
            new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(
              152407.3
            ),
          ];
    for (const value of values) expect(dialog.getByText(value)).toBeVisible();
  });

  it('shows the odometer with km in the list column and directly below Date in Details', async () => {
    renderList();
    const details = await screen.findByRole('button', { name: /View .* details for/ });
    const odometer = type === 'expense' ? '0 km' : '100 km';
    const cells = screen.getAllByRole('cell');
    expect(details).toHaveAccessibleName(expect.stringContaining(odometer));
    expect(within(details).getByText(odometer)).toBeInTheDocument();
    expect(cells[1]).toHaveTextContent(odometer);
    if (type === 'expense') expect(cells[2]).toHaveTextContent('OIL TOP UP');

    fireEvent.click(details);
    const dialog = within(await screen.findByRole('dialog', { name: title }));
    expect(
      dialog
        .getAllByRole('term')
        .slice(0, 2)
        .map(term => term.textContent)
    ).toEqual(['Date', 'Odometer']);
    expect(dialog.getByText(odometer)).toBeVisible();
  });

  it.each([true, false])(
    'opens read-only fields and safe attachment links with canUpload=%s',
    async canUpload => {
      vi.mocked(listAttachments).mockResolvedValue({ ...metadata, canUpload });
      renderList();
      const details = await screen.findByRole('button', { name: /View .* details for/ });
      expect(listAttachments).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /actions for/ })).toBeInTheDocument();
      fireEvent.click(details);
      const dialog = await screen.findByRole('dialog', { name: title });
      const view = within(dialog);
      expect(view.getByText('Saved notes Second line')).toBeInTheDocument();
      expect(view.getByText('Date')).toBeInTheDocument();
      if (type === 'expense') {
        expect(view.getByText('OIL TOP UP')).toBeInTheDocument();
        expect(view.getByText('Test workshop')).toBeInTheDocument();
        expect(view.getByText('0 km')).toBeInTheDocument();
        expect(view.getByText('0 L')).toBeInTheDocument();
        expect(view.getByText('0.0 L/10,000 km')).toBeInTheDocument();
      } else {
        expect(view.getByText('2.000 €/L')).toBeInTheDocument();
        expect(view.getByText('Full tank')).toBeInTheDocument();
        expect(view.getByText('7.50 L/100 km')).toBeInTheDocument();
        expect(view.getByText('6.50 L/100 km')).toBeInTheDocument();
      }
      const link = await view.findByRole('link', { name: 'Open receipt.pdf in a new tab' });
      expect(link).toHaveAttribute(
        'href',
        `/api/vehicles/car/${resource}/parent/attachments/a1/open`
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(dialog.querySelector('form, input, select, textarea')).toBeNull();
      expect(view.queryByRole('button', { name: /^(Save|Upload|Rename|Delete)/ })).toBeNull();
      expect(view.getByRole('button', { name: 'Edit details' })).toBeVisible();
      expect(Boolean(view.queryByRole('button', { name: 'Manage files' }))).toBe(canUpload);
      expect(view.queryByText(/attachment slots remaining/)).not.toBeInTheDocument();
      fireEvent.click(view.getAllByRole('button', { name: 'Close' })[0]);
      await waitFor(() => expect(screen.queryByRole('dialog', { name: title })).toBeNull());
      expect(uploadAttachment).not.toHaveBeenCalled();
      expect(renameAttachment).not.toHaveBeenCalled();
      expect(deleteAttachment).not.toHaveBeenCalled();
    }
  );

  it('refreshes attachments when reopening without entering edit mode', async () => {
    renderList();
    const details = await screen.findByRole('button', { name: /View .* details for/ });
    fireEvent.click(details);
    let dialog = within(await screen.findByRole('dialog', { name: title }));
    await dialog.findByText('receipt.pdf');
    fireEvent.click(dialog.getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: title })).toBeNull());
    vi.mocked(listAttachments).mockResolvedValue({
      ...metadata,
      attachments: [{ ...attachment, filename: 'renamed.pdf' }],
    });
    fireEvent.click(details);
    dialog = within(await screen.findByRole('dialog', { name: title }));
    expect(await dialog.findByText('renamed.pdf')).toBeInTheDocument();
    expect(listAttachments).toHaveBeenCalledTimes(2);
  });

  it('keeps details readable and allows refresh or close after attachment loading fails', async () => {
    vi.mocked(listAttachments).mockRejectedValueOnce(new Error('Attachments unavailable.'));
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /View .* details for/ }));
    const view = within(await screen.findByRole('dialog', { name: title }));
    expect(await view.findByRole('alert')).toHaveTextContent('Attachments unavailable.');
    expect(view.getByText('Saved notes Second line')).toBeInTheDocument();
    expect(view.queryByText('No attachments yet.')).not.toBeInTheDocument();
    fireEvent.click(view.getByRole('button', { name: 'Refresh attachments' }));
    expect(await view.findByText('receipt.pdf')).toBeInTheDocument();
    expect(view.getAllByRole('button', { name: 'Close' })[0]).toBeEnabled();
  });

  it('shows an explicit empty attachment list', async () => {
    vi.mocked(listAttachments).mockResolvedValue({
      ...metadata,
      attachments: [],
      remainingCapacity: 5,
    });
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /View .* details for/ }));
    const view = within(await screen.findByRole('dialog', { name: title }));
    expect(await view.findByText('No files yet.')).toBeInTheDocument();
  });

  it.each([false, undefined])('hides record mutations when canWrite is %s', async permission => {
    canWrite = permission;
    renderList();
    const details = await screen.findByRole('button', { name: /View .* details for/ });
    expect(screen.queryByRole('button', { name: /actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    fireEvent.click(details);
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument();
  });

  it('keeps Details on the row summary and returns focus there', async () => {
    renderList();
    const actions = await screen.findByRole('button', { name: /actions for/ });
    fireEvent.click(actions);
    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeVisible();
    fireEvent.keyDown(actions, { key: 'Escape' });
    const details = screen.getByRole('button', { name: /View .* details for/ });
    fireEvent.click(details);
    const dialog = within(await screen.findByRole('dialog', { name: title }));
    expect(await dialog.findByText('receipt.pdf')).toBeInTheDocument();
    fireEvent.click(dialog.getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(details).toHaveFocus());
  });

  it('opens Edit from the menu and returns focus to the collapsed menu trigger on close', async () => {
    renderList();
    const actions = await screen.findByRole('button', { name: /actions for/ });
    fireEvent.click(actions);
    expect(actions).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const edit = await screen.findByRole('dialog', {
      name: type === 'expense' ? 'Edit expense' : 'Edit fill-up',
    });
    expect(actions).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: title })).not.toBeInTheDocument();
    fireEvent.click(within(edit).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(actions).toHaveFocus());
  });

  it('keeps Delete behind confirmation without opening Details', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const remove = vi.fn(() => HttpResponse.json({ data: { id: 'parent' } }));
    server.use(http.delete(`/api/vehicles/car/${resource}/parent`, remove));
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /actions for/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith(
      `Delete this ${type === 'expense' ? 'expense' : 'fill-up'}?`
    );
    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    confirm.mockRestore();
  });
});
