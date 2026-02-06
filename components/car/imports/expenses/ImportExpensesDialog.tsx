'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import { useImportExpenses } from '@/hooks';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import { splitSemicolonCsv, tryParseDate } from '@/utils/csv';
import { normalizeExpenseCategory, expenseCategories } from '@/utils';
import type { ExpenseDto } from '@/queries/expenses';

type ParsedRow = {
  id: string;
  include: boolean;
  raw: string;
  date?: string;
  km?: number;
  amount?: number;
  category?: ExpenseDto['category'];
  vendor?: string;
  liters?: number;
  notes?: string;
  valid: boolean;
};

function parseExpensesCsv(input: string): ParsedRow[] {
  const lines = input
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return [];

  const headerTokens = splitSemicolonCsv(lines[0]).map(t => t.toLowerCase());
  const hasHeader = ['date', 'km', 'amount', 'category', 'vendor', 'liters', 'notes'].some(h =>
    headerTokens.includes(h)
  );

  const out: ParsedRow[] = [];

  if (hasHeader) {
    const idx = {
      date: headerTokens.indexOf('date'),
      km: headerTokens.indexOf('km'),
      amount: headerTokens.indexOf('amount'),
      category: headerTokens.indexOf('category'),
      vendor: headerTokens.indexOf('vendor'),
      liters: headerTokens.indexOf('liters'),
      notes: headerTokens.indexOf('notes'),
    };
    for (let li = 1; li < lines.length; li++) {
      const line = lines[li];
      const tokens = splitSemicolonCsv(line);
      const rawDate = idx.date >= 0 ? tokens[idx.date] : undefined;
      const dateTok =
        rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
          ? rawDate
          : rawDate
            ? tryParseDate(rawDate)
            : undefined;
      if (!dateTok) continue;
      const kmStr = idx.km >= 0 ? tokens[idx.km] : undefined;
      const km =
        kmStr && kmStr.length > 0 ? parseInt(kmStr.replace(/[^0-9-]/g, ''), 10) : undefined;
      const amountStr = idx.amount >= 0 ? tokens[idx.amount] : undefined;
      const amount =
        amountStr && amountStr.length > 0 ? Number(amountStr.replace(',', '.')) : undefined;
      const category = normalizeExpenseCategory(
        idx.category >= 0 ? tokens[idx.category] : undefined
      ) as ExpenseDto['category'] | undefined;
      const vendor = idx.vendor >= 0 ? tokens[idx.vendor] : undefined;
      const litersStr = idx.liters >= 0 ? tokens[idx.liters] : undefined;
      const liters =
        litersStr && litersStr.length > 0 ? Number(litersStr.replace(',', '.')) : undefined;
      const notes = idx.notes >= 0 ? tokens[idx.notes] : undefined;
      const valid =
        (amount !== undefined && Number.isFinite(amount)) ||
        !!notes ||
        (liters !== undefined && Number.isFinite(liters));
      out.push({
        id: `${dateTok}-${out.length}`,
        include: valid,
        raw: line,
        date: dateTok,
        km: Number.isFinite(km as number) ? (km as number) : undefined,
        amount: Number.isFinite(amount as number)
          ? Number((amount as number).toFixed(2))
          : undefined,
        category,
        vendor,
        liters: Number.isFinite(liters as number) ? (liters as number) : undefined,
        notes,
        valid,
      });
    }
    return out;
  }

  // No header fallback
  for (const line of lines) {
    const tokens = splitSemicolonCsv(line);
    const nonEmpty = tokens.filter(s => s.length > 0);
    if (nonEmpty.length < 2) continue;
    const dateTok = tryParseDate(nonEmpty[0]);
    if (!dateTok) continue;
    let km: number | undefined;
    let amount: number | undefined;
    let notes: string | undefined;
    for (let i = 1; i < nonEmpty.length; i++) {
      const v = nonEmpty[i];
      const num = Number(v.replace(',', '.'));
      if (Number.isFinite(num)) {
        if (km === undefined && num > 1000) {
          km = Math.round(num);
          continue;
        }
        if (amount === undefined) {
          amount = Number(num.toFixed(2));
          continue;
        }
      }
      if (notes === undefined) notes = v;
    }
    const valid = amount !== undefined || !!notes;
    out.push({
      id: `${dateTok}-${out.length}`,
      include: valid,
      raw: line,
      date: dateTok,
      km,
      amount,
      notes,
      valid,
    });
  }
  return out;
}

export default function ImportExpensesDialog({
  vehicleId,
  onImported,
  open: _open,
  onOpenChange,
  hideTrigger,
}: {
  vehicleId: string;
  onImported?: () => void;
  open?: boolean;
  onOpenChange?: (__open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = _open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [text, setText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importMutation = useImportExpenses(vehicleId);

  const validCount = useMemo(() => rows.filter(r => r.include && r.valid).length, [rows]);

  useEffect(() => {
    if (open) {
      setText('');
      setRows([]);
      setIsParsing(false);
      setIsImporting(false);
    }
  }, [open]);

  function handleParse() {
    setIsParsing(true);
    try {
      setRows(parseExpensesCsv(text));
    } finally {
      setIsParsing(false);
    }
  }

  async function handleImport() {
    setIsImporting(true);
    try {
      const payload = rows
        .filter(r => r.include && r.valid)
        .map(r => ({
          date: r.date!,
          category: (normalizeExpenseCategory(r.category) ??
            'MAINTENANCE') as ExpenseDto['category'],
          amount: r.amount ?? 0,
          vendor: r.vendor || undefined,
          odometerKm: typeof r.km === 'number' ? r.km : undefined,
          liters: typeof r.liters === 'number' ? r.liters : undefined,
          notes: r.notes || undefined,
        }));
      await importMutation.mutateAsync(payload);
      toast.success('Expenses imported');
      onImported?.();
      setOpen(false);
      setText('');
      setRows([]);
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Failed to import expenses'));
    } finally {
      setIsImporting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setText(String(ev.target?.result || ''));
    reader.readAsText(file);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button variant="outline">Import CSV</Button>
        </DialogTrigger>
      )}
      <DialogContent
        aria-label="Import expenses CSV"
        className="sm:max-w-4xl max-w-[95vw] w-full h-[85vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Import expenses from CSV</DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex items-center gap-2">
            <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFileChange} />
            <Button variant="outline" onClick={handleParse} disabled={!text || isParsing}>
              {isParsing ? 'Parsing…' : 'Parse'}
            </Button>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Or paste CSV content</span>
            <textarea
              className="border rounded-md px-3 py-2 h-40"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste semicolon-delimited CSV here"
            />
          </label>
          {rows.length > 0 && (
            <div className="border rounded-md flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Import</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-left">Km</th>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Vendor</th>
                    <th className="p-2 text-left">Liters</th>
                    <th className="p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.id} className={!r.valid ? 'opacity-60' : ''}>
                      <td className="p-2 align-top">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], include: e.target.checked };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="date"
                          className="border rounded px-2 py-1"
                          value={r.date || ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], date: e.target.value };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <select
                          className="border rounded px-2 py-1 text-xs"
                          value={r.category || 'MAINTENANCE'}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              clone[idx] = {
                                ...clone[idx],
                                category: e.target.value as ExpenseDto['category'],
                              };
                              return clone;
                            })
                          }
                        >
                          {expenseCategories.map(cat => (
                            <option key={cat} value={cat}>
                              {cat.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          inputMode="numeric"
                          className="border rounded px-2 py-1 w-28"
                          value={r.km ?? ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              clone[idx] = {
                                ...clone[idx],
                                km: e.target.value ? parseInt(e.target.value, 10) : undefined,
                              };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="^[0-9]*[.,]?[0-9]*$"
                          className="border rounded px-2 py-1 w-28"
                          value={typeof r.amount === 'number' ? String(r.amount) : ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              const v = e.target.value.replace(',', '.');
                              clone[idx] = { ...clone[idx], amount: v ? parseFloat(v) : undefined };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-28"
                          placeholder="Vendor"
                          value={r.vendor || ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], vendor: e.target.value || undefined };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="^[0-9]*[.,]?[0-9]*$"
                          className="border rounded px-2 py-1 w-20"
                          placeholder="L"
                          value={typeof r.liters === 'number' ? String(r.liters) : ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              const v = e.target.value.replace(',', '.');
                              clone[idx] = { ...clone[idx], liters: v ? parseFloat(v) : undefined };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={r.notes || ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], notes: e.target.value };
                              return clone;
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">Ready to import: {validCount}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button onClick={handleImport} disabled={!validCount || isImporting}>
                {isImporting ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
