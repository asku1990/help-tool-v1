'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import { useImportFillUps } from '@/hooks';

type ParsedRow = {
  id: string;
  include: boolean;
  raw: string;
  date?: string;
  odometerKm?: number;
  liters?: number;
  pricePerLiter?: number;
  totalCost?: number;
  isFull?: boolean;
  notes?: string;
  valid: boolean;
};

export default function ImportFillUpsDialog({
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
  const importMutation = useImportFillUps(vehicleId);

  const validCount = useMemo(() => rows.filter(r => r.include && r.valid).length, [rows]);

  useEffect(() => {
    if (open) {
      setText('');
      setRows([]);
      setIsParsing(false);
      setIsImporting(false);
    }
  }, [open]);

  function splitSemicolonCsv(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ';' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result.map(s => s.trim());
  }

  function tryParseDate(token: string): string | undefined {
    const t = token.trim();
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return t;
    const m1 = t.match(/^([0-3]?\d)\.([0-1]?\d)\.(\d{4})$/);
    if (m1) {
      const d = Number(m1[1]);
      const mo = Number(m1[2]) - 1;
      const y = Number(m1[3]);
      const dt = new Date(Date.UTC(y, mo, d));
      return dt.toISOString().slice(0, 10);
    }
    return undefined;
  }

  function toNum(v?: string): number | undefined {
    if (!v) return undefined;
    const num = Number(v.replace(',', '.'));
    return Number.isFinite(num) ? num : undefined;
  }

  function toBool(v?: string): boolean | undefined {
    if (!v) return undefined;
    const t = v.trim().toLowerCase();
    if (t === '1' || t === 'true' || t === 'yes') return true;
    if (t === '0' || t === 'false' || t === 'no') return false;
    return undefined;
  }

  function parseCsv(input: string): ParsedRow[] {
    const lines = input
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const header = splitSemicolonCsv(lines[0]).map(h => h.toLowerCase());
    const hasHeader = [
      'date',
      'odometerkm',
      'liters',
      'priceperliter',
      'totalcost',
      'isfull',
      'notes',
    ].some(h => header.includes(h));

    const out: ParsedRow[] = [];
    if (hasHeader) {
      const idx = {
        date: header.indexOf('date'),
        odometerKm: header.indexOf('odometerkm'),
        liters: header.indexOf('liters'),
        pricePerLiter: header.indexOf('priceperliter'),
        totalCost: header.indexOf('totalcost'),
        isFull: header.indexOf('isfull'),
        notes: header.indexOf('notes'),
      };
      for (let i = 1; i < lines.length; i++) {
        const tokens = splitSemicolonCsv(lines[i]);
        const date = idx.date >= 0 ? tryParseDate(tokens[idx.date]) : undefined;
        if (!date) continue;
        const odometerKm =
          idx.odometerKm >= 0
            ? parseInt(tokens[idx.odometerKm].replace(/[^0-9-]/g, ''), 10)
            : undefined;
        const liters = toNum(idx.liters >= 0 ? tokens[idx.liters] : undefined);
        const pricePerLiter = toNum(idx.pricePerLiter >= 0 ? tokens[idx.pricePerLiter] : undefined);
        const totalCost = toNum(idx.totalCost >= 0 ? tokens[idx.totalCost] : undefined);
        const isFull = toBool(idx.isFull >= 0 ? tokens[idx.isFull] : undefined);
        const notes = idx.notes >= 0 ? tokens[idx.notes] : undefined;
        const valid =
          Number.isFinite(odometerKm as number) &&
          Number.isFinite(liters as number) &&
          Number.isFinite(pricePerLiter as number) &&
          Number.isFinite(totalCost as number);
        out.push({
          id: `${date}-${out.length}`,
          include: valid,
          raw: lines[i],
          date,
          odometerKm: Number.isFinite(odometerKm as number) ? (odometerKm as number) : undefined,
          liters: liters as number | undefined,
          pricePerLiter: pricePerLiter as number | undefined,
          totalCost: totalCost as number | undefined,
          isFull,
          notes,
          valid,
        });
      }
      return out;
    }

    // No header fallback: expect minimal order: date;odometer;liters;pricePerLiter;totalCost;isFull;notes
    for (let i = 0; i < lines.length; i++) {
      const tokens = splitSemicolonCsv(lines[i]);
      const date = tryParseDate(tokens[0]);
      if (!date) continue;
      const odometerKm = tokens[1] ? parseInt(tokens[1].replace(/[^0-9-]/g, ''), 10) : undefined;
      const liters = toNum(tokens[2]);
      const pricePerLiter = toNum(tokens[3]);
      const totalCost = toNum(tokens[4]);
      const isFull = toBool(tokens[5]);
      const notes = tokens[6];
      const valid =
        Number.isFinite(odometerKm as number) &&
        Number.isFinite(liters as number) &&
        Number.isFinite(pricePerLiter as number) &&
        Number.isFinite(totalCost as number);
      out.push({
        id: `${date}-${out.length}`,
        include: valid,
        raw: lines[i],
        date,
        odometerKm: Number.isFinite(odometerKm as number) ? (odometerKm as number) : undefined,
        liters: liters as number | undefined,
        pricePerLiter: pricePerLiter as number | undefined,
        totalCost: totalCost as number | undefined,
        isFull,
        notes,
        valid,
      });
    }
    return out;
  }

  async function doParse() {
    setIsParsing(true);
    try {
      const parsed = parseCsv(text);
      setRows(parsed);
    } finally {
      setIsParsing(false);
    }
  }

  async function doImport() {
    setIsImporting(true);
    try {
      const payload = rows
        .filter(r => r.include && r.valid)
        .map(r => ({
          date: r.date!,
          odometerKm: r.odometerKm!,
          liters: r.liters!,
          pricePerLiter: r.pricePerLiter!,
          totalCost: r.totalCost!,
          isFull: !!r.isFull,
          notes: r.notes || undefined,
        }));
      await importMutation.mutateAsync(payload);
      onImported?.();
      setOpen(false);
      setText('');
      setRows([]);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button variant="outline">Import CSV</Button>
        </DialogTrigger>
      )}
      <DialogContent
        aria-label="Import fill-ups CSV"
        className="sm:max-w-4xl max-w-[95vw] w-full h-[85vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Import fill-ups from CSV</DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => setText(String(ev.target?.result || ''));
                reader.readAsText(file);
              }}
            />
            <Button type="button" variant="outline" onClick={doParse} disabled={!text || isParsing}>
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
          {rows.length > 0 ? (
            <div className="border rounded-md flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Import</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Odometer</th>
                    <th className="p-2 text-left">Liters</th>
                    <th className="p-2 text-left">Price/L</th>
                    <th className="p-2 text-left">Total</th>
                    <th className="p-2 text-left">Full</th>
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
                        <input
                          type="number"
                          inputMode="numeric"
                          className="border rounded px-2 py-1 w-28"
                          value={r.odometerKm ?? ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              clone[idx] = {
                                ...clone[idx],
                                odometerKm: e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : undefined,
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
                          className="border rounded px-2 py-1 w-24"
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
                          type="text"
                          inputMode="decimal"
                          pattern="^[0-9]*[.,]?[0-9]*$"
                          className="border rounded px-2 py-1 w-24"
                          value={typeof r.pricePerLiter === 'number' ? String(r.pricePerLiter) : ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              const v = e.target.value.replace(',', '.');
                              clone[idx] = {
                                ...clone[idx],
                                pricePerLiter: v ? parseFloat(v) : undefined,
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
                          className="border rounded px-2 py-1 w-24"
                          value={typeof r.totalCost === 'number' ? String(r.totalCost) : ''}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              const v = e.target.value.replace(',', '.');
                              clone[idx] = {
                                ...clone[idx],
                                totalCost: v ? parseFloat(v) : undefined,
                              };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="checkbox"
                          checked={!!r.isFull}
                          onChange={e =>
                            setRows(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], isFull: e.target.checked };
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
          ) : null}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">Ready to import: {validCount}</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="button" onClick={doImport} disabled={!validCount || isImporting}>
                {isImporting ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
