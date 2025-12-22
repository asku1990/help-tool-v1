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
import { useImportTires } from '@/hooks/tires';
import type { TireType, TireStatus } from '@/queries/tires';

type ParsedTireSet = {
  id: string;
  include: boolean;
  raw: string;
  exportId?: string; // Original ID from export for linking change logs
  name: string;
  type: TireType;
  status?: TireStatus;
  purchaseDate?: string;
  notes?: string;
  valid: boolean;
};

type ParsedChangeLog = {
  id: string;
  include: boolean;
  raw: string;
  tireSetId: string;
  date: string;
  odometerKm: number;
  notes?: string;
  valid: boolean;
};

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
  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // European format: DD.MM.YYYY
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

function parseTireType(value: string): TireType | undefined {
  const normalized = value.toUpperCase().trim();
  if (normalized === 'SUMMER') return 'SUMMER';
  if (normalized === 'WINTER') return 'WINTER';
  if (normalized === 'ALL_SEASON' || normalized === 'ALL-SEASON' || normalized === 'ALLSEASON')
    return 'ALL_SEASON';
  return undefined;
}

function parseTireStatus(value: string): TireStatus | undefined {
  const normalized = value.toUpperCase().trim();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'STORED') return 'STORED';
  if (normalized === 'RETIRED') return 'RETIRED';
  return undefined;
}

export default function ImportTiresDialog({
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
  const [tireSets, setTireSets] = useState<ParsedTireSet[]>([]);
  const [changeLogs, setChangeLogs] = useState<ParsedChangeLog[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importMutation = useImportTires(vehicleId);

  const validTireSetCount = useMemo(
    () => tireSets.filter(r => r.include && r.valid).length,
    [tireSets]
  );
  const validChangeLogCount = useMemo(
    () => changeLogs.filter(r => r.include && r.valid).length,
    [changeLogs]
  );

  useEffect(() => {
    if (open) {
      setText('');
      setTireSets([]);
      setChangeLogs([]);
      setIsParsing(false);
      setIsImporting(false);
    }
  }, [open]);

  function parseCsv(input: string): { tireSets: ParsedTireSet[]; changeLogs: ParsedChangeLog[] } {
    const lines = input
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) return { tireSets: [], changeLogs: [] };

    const parsedTireSets: ParsedTireSet[] = [];
    const parsedChangeLogs: ParsedChangeLog[] = [];

    let currentSection: 'TIRE_SETS' | 'CHANGE_LOGS' | null = null;
    let headerTokens: string[] = [];

    for (const line of lines) {
      // Check for section headers
      if (line.startsWith('[TIRE_SETS]')) {
        currentSection = 'TIRE_SETS';
        headerTokens = [];
        continue;
      }
      if (line.startsWith('[CHANGE_LOGS]')) {
        currentSection = 'CHANGE_LOGS';
        headerTokens = [];
        continue;
      }

      const tokens = splitSemicolonCsv(line);

      // Check if this is a header line
      const lowerTokens = tokens.map(t => t.toLowerCase());
      if (
        currentSection === 'TIRE_SETS' &&
        headerTokens.length === 0 &&
        lowerTokens.includes('name')
      ) {
        headerTokens = lowerTokens;
        continue;
      }
      if (
        currentSection === 'CHANGE_LOGS' &&
        headerTokens.length === 0 &&
        lowerTokens.includes('tiresetid')
      ) {
        headerTokens = lowerTokens;
        continue;
      }

      if (currentSection === 'TIRE_SETS' && headerTokens.length > 0) {
        const idx = {
          id: headerTokens.indexOf('id'),
          name: headerTokens.indexOf('name'),
          type: headerTokens.indexOf('type'),
          status: headerTokens.indexOf('status'),
          purchaseDate: headerTokens.indexOf('purchasedate'),
          notes: headerTokens.indexOf('notes'),
        };

        const exportId = idx.id >= 0 ? tokens[idx.id] : undefined;
        const name = idx.name >= 0 ? tokens[idx.name] : '';
        const type = parseTireType(idx.type >= 0 ? tokens[idx.type] : '');
        const status = parseTireStatus(idx.status >= 0 ? tokens[idx.status] : '');
        const purchaseDate = tryParseDate(idx.purchaseDate >= 0 ? tokens[idx.purchaseDate] : '');
        const notes = idx.notes >= 0 ? tokens[idx.notes] : undefined;

        const valid = !!name && !!type;

        parsedTireSets.push({
          id: `ts-${parsedTireSets.length}`,
          include: valid,
          raw: line,
          exportId,
          name,
          type: type ?? 'SUMMER',
          status,
          purchaseDate,
          notes,
          valid,
        });
      }

      if (currentSection === 'CHANGE_LOGS' && headerTokens.length > 0) {
        const idx = {
          tireSetId: headerTokens.indexOf('tiresetid'),
          date: headerTokens.indexOf('date'),
          odometerKm: headerTokens.indexOf('odometerkm'),
          notes: headerTokens.indexOf('notes'),
        };

        const tireSetId = idx.tireSetId >= 0 ? tokens[idx.tireSetId] : '';
        const date = tryParseDate(idx.date >= 0 ? tokens[idx.date] : '');
        const odometerKmStr = idx.odometerKm >= 0 ? tokens[idx.odometerKm] : '';
        const odometerKm = odometerKmStr ? parseInt(odometerKmStr.replace(/[^0-9-]/g, ''), 10) : 0;
        const notes = idx.notes >= 0 ? tokens[idx.notes] : undefined;

        const valid = !!tireSetId && !!date && Number.isFinite(odometerKm);

        parsedChangeLogs.push({
          id: `cl-${parsedChangeLogs.length}`,
          include: valid,
          raw: line,
          tireSetId,
          date: date ?? '',
          odometerKm,
          notes,
          valid,
        });
      }
    }

    return { tireSets: parsedTireSets, changeLogs: parsedChangeLogs };
  }

  async function doParse() {
    setIsParsing(true);
    try {
      const parsed = parseCsv(text);
      setTireSets(parsed.tireSets);
      setChangeLogs(parsed.changeLogs);
    } finally {
      setIsParsing(false);
    }
  }

  async function doImport() {
    setIsImporting(true);
    try {
      // Build ID mapping from exportId to name for linking change logs
      const tireSetIdMap = new Map<string, string>();

      // Check if any tire is set to ACTIVE - only one can be active
      const activeTireSets = tireSets.filter(r => r.include && r.valid && r.status === 'ACTIVE');
      if (activeTireSets.length > 1) {
        alert('Only one tire set can be ACTIVE. Please set others to STORED or RETIRED.');
        setIsImporting(false);
        return;
      }

      // Create tire sets with their actual status
      const tireSetPayload = tireSets
        .filter(r => r.include && r.valid)
        .map(r => {
          // Store the export ID for mapping change logs
          if (r.exportId) {
            tireSetIdMap.set(r.exportId, r.name);
          }
          return {
            name: r.name,
            type: r.type,
            status: r.status ?? 'STORED',
            purchaseDate: r.purchaseDate,
            notes: r.notes,
          };
        });

      const changeLogPayload = changeLogs
        .filter(r => r.include && r.valid)
        .map(r => ({
          tireSetId: r.tireSetId,
          date: r.date,
          odometerKm: r.odometerKm,
          notes: r.notes,
        }));

      await importMutation.mutateAsync({
        tireSets: tireSetPayload,
        changeLogs: changeLogPayload,
        tireSetIdMap,
      });
      onImported?.();
      setOpen(false);
      setText('');
      setTireSets([]);
      setChangeLogs([]);
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
        aria-label="Import tires CSV"
        className="sm:max-w-4xl max-w-[95vw] w-full h-[85vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Import tires from CSV</DialogTitle>
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
              className="border rounded-md px-3 py-2 h-32"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste semicolon-delimited CSV with [TIRE_SETS] and [CHANGE_LOGS] sections"
            />
          </label>

          {tireSets.length > 0 ? (
            <div className="border rounded-md flex-1 min-h-0 overflow-auto">
              <h3 className="p-2 font-semibold bg-gray-100">Tire Sets ({tireSets.length})</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Import</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Purchase Date</th>
                    <th className="p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {tireSets.map((r, idx) => (
                    <tr key={r.id} className={!r.valid ? 'opacity-60' : ''}>
                      <td className="p-2 align-top">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={e =>
                            setTireSets(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], include: e.target.checked };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-32"
                          value={r.name}
                          onChange={e =>
                            setTireSets(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], name: e.target.value };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <select
                          className="border rounded px-2 py-1 text-xs"
                          value={r.type}
                          onChange={e =>
                            setTireSets(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], type: e.target.value as TireType };
                              return clone;
                            })
                          }
                        >
                          <option value="SUMMER">SUMMER</option>
                          <option value="WINTER">WINTER</option>
                          <option value="ALL_SEASON">ALL SEASON</option>
                        </select>
                      </td>
                      <td className="p-2 align-top">
                        <select
                          className="border rounded px-2 py-1 text-xs"
                          value={r.status ?? 'STORED'}
                          onChange={e =>
                            setTireSets(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], status: e.target.value as TireStatus };
                              return clone;
                            })
                          }
                        >
                          <option value="STORED">STORED</option>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="RETIRED">RETIRED</option>
                        </select>
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="date"
                          className="border rounded px-2 py-1"
                          value={r.purchaseDate || ''}
                          onChange={e =>
                            setTireSets(prev => {
                              const clone = [...prev];
                              clone[idx] = {
                                ...clone[idx],
                                purchaseDate: e.target.value || undefined,
                              };
                              return clone;
                            })
                          }
                        />
                      </td>
                      <td className="p-2 align-top">
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-28"
                          placeholder="Notes"
                          value={r.notes || ''}
                          onChange={e =>
                            setTireSets(prev => {
                              const clone = [...prev];
                              clone[idx] = { ...clone[idx], notes: e.target.value || undefined };
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

          {changeLogs.length > 0 ? (
            <div className="border rounded-md flex-1 min-h-0 overflow-auto">
              <h3 className="p-2 font-semibold bg-gray-100">Change Logs ({changeLogs.length})</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Import</th>
                    <th className="p-2 text-left">Tire Set ID</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Odometer</th>
                    <th className="p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {changeLogs.map((r, idx) => {
                    // Find the tire set name for this change log's tire set ID
                    const matchingTireSet = tireSets.find(ts => ts.exportId === r.tireSetId);
                    return (
                      <tr key={r.id} className={!r.valid ? 'opacity-60' : ''}>
                        <td className="p-2 align-top">
                          <input
                            type="checkbox"
                            checked={r.include}
                            onChange={e =>
                              setChangeLogs(prev => {
                                const clone = [...prev];
                                clone[idx] = { ...clone[idx], include: e.target.checked };
                                return clone;
                              })
                            }
                          />
                        </td>
                        <td className="p-2 align-top">
                          <select
                            className="border rounded px-2 py-1 text-xs w-32"
                            value={r.tireSetId}
                            onChange={e =>
                              setChangeLogs(prev => {
                                const clone = [...prev];
                                clone[idx] = { ...clone[idx], tireSetId: e.target.value };
                                return clone;
                              })
                            }
                          >
                            {tireSets.map(ts => (
                              <option key={ts.exportId || ts.id} value={ts.exportId || ts.id}>
                                {ts.name}
                              </option>
                            ))}
                          </select>
                          {!matchingTireSet && (
                            <span className="text-xs text-red-500 ml-1" title={r.tireSetId}>
                              ?
                            </span>
                          )}
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="date"
                            className="border rounded px-2 py-1"
                            value={r.date}
                            onChange={e =>
                              setChangeLogs(prev => {
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
                            value={r.odometerKm}
                            onChange={e =>
                              setChangeLogs(prev => {
                                const clone = [...prev];
                                clone[idx] = {
                                  ...clone[idx],
                                  odometerKm: e.target.value ? parseInt(e.target.value, 10) : 0,
                                };
                                return clone;
                              })
                            }
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            className="border rounded px-2 py-1 w-28"
                            placeholder="Notes"
                            value={r.notes || ''}
                            onChange={e =>
                              setChangeLogs(prev => {
                                const clone = [...prev];
                                clone[idx] = { ...clone[idx], notes: e.target.value || undefined };
                                return clone;
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">
              Ready to import: {validTireSetCount} tire sets, {validChangeLogCount} change logs
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={doImport}
                disabled={(!validTireSetCount && !validChangeLogCount) || isImporting}
              >
                {isImporting ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
