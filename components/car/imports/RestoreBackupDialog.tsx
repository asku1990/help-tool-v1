'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import {
  useImportFillUpsToVehicle,
  useImportExpensesToVehicle,
  useImportTiresToVehicle,
} from '@/hooks';
import { parseBackupCsv, type ParsedBackupData } from '@/utils/csv';
import { FillUpsPreviewTable } from './fillups';
import { ExpensesPreviewTable } from './expenses';
import { TiresPreviewTable } from './tires';
import { VehiclePreview, type RestoreMode } from './vehicle';
import { apiPost } from '@/lib/api/client';

type Props = {
  /** When provided, imports directly into this vehicle (skips vehicle selection) */
  forVehicleId?: string;
  /** List of existing vehicles for selection (required when forVehicleId is not set) */
  existingVehicles?: Array<{ id: string; name: string }>;
  onRestored?: () => void;
  open?: boolean;
  onOpenChange?: (_open: boolean) => void;
  hideTrigger?: boolean;
};

export default function RestoreBackupDialog({
  forVehicleId,
  existingVehicles = [],
  onRestored,
  open,
  onOpenChange,
  hideTrigger,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [text, setText] = useState('');
  const [data, setData] = useState<ParsedBackupData>({
    fillUps: [],
    expenses: [],
    tireSets: [],
    changeLogs: [],
  });
  const [isParsing, setIsParsing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [clearExisting, setClearExisting] = useState(true);
  const [activeTab, setActiveTab] = useState<'vehicle' | 'fillups' | 'expenses' | 'tires'>(
    forVehicleId ? 'fillups' : 'vehicle'
  );
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restoreMode, setRestoreMode] = useState<RestoreMode>(forVehicleId ? 'update' : 'pending');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(forVehicleId ?? '');

  // Check if vehicle name matches an existing vehicle
  const matchingVehicle = useMemo(() => {
    if (forVehicleId || !data.vehicle?.name) return null;
    return existingVehicles.find(v => v.name.toLowerCase() === data.vehicle!.name.toLowerCase());
  }, [data.vehicle, existingVehicles, forVehicleId]);

  const importFillUps = useImportFillUpsToVehicle();
  const importExpenses = useImportExpensesToVehicle();
  const importTires = useImportTiresToVehicle();

  const counts = useMemo(
    () => ({
      fillUps: data.fillUps.filter(r => r.include && r.valid).length,
      expenses: data.expenses.filter(r => r.include && r.valid).length,
      tireSets: data.tireSets.filter(r => r.include && r.valid).length,
      changeLogs: data.changeLogs.filter(r => r.include && r.valid).length,
    }),
    [data]
  );

  const totalCount = counts.fillUps + counts.expenses + counts.tireSets + counts.changeLogs;
  const hasData = (forVehicleId && totalCount > 0) || data.vehicle?.valid || totalCount > 0;

  // Can restore if: forVehicleId is set OR restoreMode is selected
  const canRestore = forVehicleId
    ? totalCount > 0
    : data.vehicle?.valid && restoreMode !== 'pending';

  useEffect(() => {
    if (open) {
      setText('');
      setData({ fillUps: [], expenses: [], tireSets: [], changeLogs: [] });
      setIsParsing(false);
      setIsRestoring(false);
      setClearExisting(true);
      setRestoreStatus('');
      setRestoreMode(forVehicleId ? 'update' : 'pending');
      setSelectedVehicleId(forVehicleId ?? '');
      setActiveTab(forVehicleId ? 'fillups' : 'vehicle');
    }
  }, [open, forVehicleId]);

  // When data is parsed, check for matching vehicle
  useEffect(() => {
    if (!forVehicleId && data.vehicle?.valid && matchingVehicle) {
      setSelectedVehicleId(matchingVehicle.id);
    }
  }, [data.vehicle, matchingVehicle, forVehicleId]);

  function handleParse() {
    setIsParsing(true);
    try {
      const parsed = parseBackupCsv(text);
      setData(parsed);
      if (forVehicleId) {
        // When importing to specific vehicle, go to first tab with data
        if (parsed.fillUps.length > 0) setActiveTab('fillups');
        else if (parsed.expenses.length > 0) setActiveTab('expenses');
        else if (parsed.tireSets.length > 0 || parsed.changeLogs.length > 0) setActiveTab('tires');
      } else {
        setActiveTab('vehicle');
        setRestoreMode('pending');
      }
    } finally {
      setIsParsing(false);
    }
  }

  async function handleRestore() {
    setIsRestoring(true);
    setRestoreStatus('');

    try {
      let targetVehicleId: string;

      if (forVehicleId) {
        targetVehicleId = forVehicleId;
        if (clearExisting) {
          setRestoreStatus('Clearing existing data...');
          const res = await fetch(`/api/vehicles/${targetVehicleId}/clear`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to clear existing data');
        }
      } else if (restoreMode === 'create') {
        if (!data.vehicle?.valid) return;
        setRestoreStatus('Creating vehicle...');
        const result = await apiPost<{ id: string }>('/api/vehicles', {
          name: data.vehicle.name,
          make: data.vehicle.make,
          model: data.vehicle.model,
          year: data.vehicle.year,
          licensePlate: data.vehicle.licensePlate,
          inspectionDueDate: data.vehicle.inspectionDueDate,
          inspectionIntervalMonths: data.vehicle.inspectionIntervalMonths,
          initialOdometer: data.vehicle.initialOdometer,
        });
        targetVehicleId = result.id;
      } else if (restoreMode === 'update') {
        if (!selectedVehicleId) {
          throw new Error('Please select a vehicle to update');
        }
        targetVehicleId = selectedVehicleId;
        if (clearExisting) {
          setRestoreStatus('Clearing existing data...');
          const res = await fetch(`/api/vehicles/${targetVehicleId}/clear`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to clear existing data');
        }
      } else {
        return;
      }

      if (counts.fillUps > 0) {
        setRestoreStatus(`Importing ${counts.fillUps} fill-ups...`);
        await importFillUps.mutateAsync({
          vehicleId: targetVehicleId,
          rows: data.fillUps
            .filter(r => r.include && r.valid)
            .map(r => ({
              date: r.date,
              odometerKm: r.odometerKm,
              liters: r.liters,
              pricePerLiter: r.pricePerLiter,
              totalCost: r.totalCost,
              isFull: r.isFull,
              notes: r.notes,
            })),
        });
      }

      if (counts.expenses > 0) {
        setRestoreStatus(`Importing ${counts.expenses} expenses...`);
        await importExpenses.mutateAsync({
          vehicleId: targetVehicleId,
          rows: data.expenses
            .filter(r => r.include && r.valid)
            .map(r => ({
              date: r.date,
              amount: r.amount,
              category: r.category,
              vendor: r.vendor,
              odometerKm: r.odometerKm,
              liters: r.liters,
              oilConsumption: r.oilConsumption,
              notes: r.notes,
            })),
        });
      }

      if (counts.tireSets > 0 || counts.changeLogs > 0) {
        setRestoreStatus(`Importing ${counts.tireSets} tire sets...`);
        const tireSetIdMap = new Map<string, string>();
        await importTires.mutateAsync({
          vehicleId: targetVehicleId,
          tireSets: data.tireSets
            .filter(r => r.include && r.valid)
            .map(r => {
              if (r.exportId) tireSetIdMap.set(r.exportId, r.name);
              return {
                name: r.name,
                type: r.type,
                status: r.status ?? 'STORED',
                purchaseDate: r.purchaseDate,
                notes: r.notes,
              };
            }),
          changeLogs: data.changeLogs
            .filter(r => r.include && r.valid)
            .map(r => ({
              tireSetId: r.tireSetId,
              date: r.date,
              odometerKm: r.odometerKm,
              notes: r.notes,
            })),
          tireSetIdMap,
        });
      }

      setRestoreStatus('Import complete!');
      onRestored?.();
      setTimeout(() => {
        setOpen(false);
        setText('');
        setData({ fillUps: [], expenses: [], tireSets: [], changeLogs: [] });
      }, 1000);
    } catch (error) {
      setRestoreStatus(`Error: ${error instanceof Error ? error.message : 'Import failed'}`);
    } finally {
      setIsRestoring(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setText(String(ev.target?.result || ''));
    reader.readAsText(file);
  }

  const dialogTitle = forVehicleId ? 'Import Backup' : 'Restore from Backup';
  const dialogDescription = forVehicleId
    ? 'Import fill-ups, expenses, and tire history from a backup CSV.'
    : 'Restore a backup CSV into a new or existing vehicle.';
  const buttonLabel = forVehicleId ? 'Import' : 'Restore';
  const triggerLabel = forVehicleId ? 'Import Backup' : 'Restore Backup';

  // Determine which tabs to show
  const showVehicleTab = !forVehicleId;
  const tabCount = showVehicleTab ? 4 : 3;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button variant="outline">{triggerLabel}</Button>
        </DialogTrigger>
      )}
      <DialogContent
        aria-label={dialogTitle}
        className="sm:max-w-5xl max-w-[95vw] w-full h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
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
              className="border rounded-md px-3 py-2 h-24"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste backup CSV content here"
            />
          </label>

          {hasData && (
            <>
              <div className="flex-1 flex flex-col min-h-0">
                <div
                  className={`grid gap-1 bg-gray-100 p-1 rounded-lg`}
                  style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}
                >
                  {showVehicleTab && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('vehicle')}
                      className={`px-3 py-2 text-sm rounded-md ${activeTab === 'vehicle' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
                    >
                      Vehicle {data.vehicle?.valid ? '✓' : ''}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('fillups')}
                    disabled={data.fillUps.length === 0}
                    className={`px-3 py-2 text-sm rounded-md disabled:opacity-50 ${activeTab === 'fillups' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
                  >
                    Fill-ups ({counts.fillUps})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('expenses')}
                    disabled={data.expenses.length === 0}
                    className={`px-3 py-2 text-sm rounded-md disabled:opacity-50 ${activeTab === 'expenses' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
                  >
                    Expenses ({counts.expenses})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tires')}
                    disabled={data.tireSets.length === 0 && data.changeLogs.length === 0}
                    className={`px-3 py-2 text-sm rounded-md disabled:opacity-50 ${activeTab === 'tires' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
                  >
                    Tires ({counts.tireSets + counts.changeLogs})
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-auto mt-2">
                  {activeTab === 'vehicle' && data.vehicle && !forVehicleId && (
                    <VehiclePreview
                      vehicle={data.vehicle}
                      matchingVehicle={matchingVehicle}
                      existingVehicles={existingVehicles}
                      restoreMode={restoreMode}
                      selectedVehicleId={selectedVehicleId}
                      onModeChange={setRestoreMode}
                      onVehicleSelect={setSelectedVehicleId}
                    />
                  )}

                  {activeTab === 'fillups' && (
                    <FillUpsPreviewTable
                      data={data.fillUps}
                      onToggle={(idx, include) =>
                        setData(prev => {
                          const clone = [...prev.fillUps];
                          clone[idx] = { ...clone[idx], include };
                          return { ...prev, fillUps: clone };
                        })
                      }
                    />
                  )}

                  {activeTab === 'expenses' && (
                    <ExpensesPreviewTable
                      data={data.expenses}
                      onToggle={(idx, include) =>
                        setData(prev => {
                          const clone = [...prev.expenses];
                          clone[idx] = { ...clone[idx], include };
                          return { ...prev, expenses: clone };
                        })
                      }
                    />
                  )}

                  {activeTab === 'tires' && (
                    <TiresPreviewTable
                      tireSets={data.tireSets}
                      changeLogs={data.changeLogs}
                      onToggleTireSet={(idx, include) =>
                        setData(prev => {
                          const clone = [...prev.tireSets];
                          clone[idx] = { ...clone[idx], include };
                          return { ...prev, tireSets: clone };
                        })
                      }
                      onToggleChangeLog={(idx, include) =>
                        setData(prev => {
                          const clone = [...prev.changeLogs];
                          clone[idx] = { ...clone[idx], include };
                          return { ...prev, changeLogs: clone };
                        })
                      }
                    />
                  )}
                </div>
              </div>

              {(forVehicleId || restoreMode === 'update') && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={e => setClearExisting(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Clear existing data before import</span>
                </label>
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm">
              {restoreStatus ? (
                <span className={restoreStatus.startsWith('Error') ? 'text-red-600' : ''}>
                  {restoreStatus}
                </span>
              ) : (
                <span className="text-gray-500">
                  {totalCount > 0 ? `${totalCount} records to import` : 'Parse a backup file'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleRestore} disabled={!canRestore || isRestoring}>
                {isRestoring ? 'Importing…' : buttonLabel}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
