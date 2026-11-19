'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Card,
  CardContent,
  Toaster,
} from '@/components/ui';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import FillUpForm from '@/components/car/FillUpForm';
import ExpenseForm from '@/components/car/ExpenseForm';
import CostSummary from '@/components/car/CostSummary';
import FillUpList from '@/components/car/FillUpList';
import ExpenseList from '@/components/car/ExpenseList';
import ConsumptionBadges from '@/components/car/ConsumptionBadges';
import { ConsumptionChart, ExportMenu, RestoreBackupDialog } from '@/components/car';
import type { ChartOptions } from '@/components/car/charts/ConsumptionChart';
import ChartToolbar from '@/components/car/ChartToolbar';
import LicensePlate from '@/components/car/LicensePlate';
import InspectionBadge from '@/components/car/InspectionBadge';
import TireManager from '@/components/car/TireManager';
import OilConsumptionChart from '@/components/car/charts/OilConsumptionChart';
import {
  useExpenses,
  useVehicleSummary,
  useVehicle,
  useVehicles,
  useUpdateVehicle,
  useDeleteVehicle,
} from '@/hooks';
import { pickLastInspectionDateFromExpenses } from '@/utils';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';

import {
  RecordActions,
  destructiveRecordActionClass,
  recordActionClass,
} from '@/components/car/records';
import VehicleDetailsDialog from './VehicleDetailsDialog';

export default function VehiclePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const vehicleId = Array.isArray(params?.vehicleId)
    ? params?.vehicleId[0]
    : (params?.vehicleId as string | undefined);

  const [isDemo] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return (
      document.cookie
        .split('; ')
        .find(c => c.startsWith('demo='))
        ?.split('=')[1] === '1'
    );
  });

  // Server state via TanStack Query, derived locally with useMemo (no duplication to local state)
  const vehicleQuery = useVehicle(vehicleId);
  const vehicle = vehicleQuery.data?.vehicle;
  const { data: vehiclesData } = useVehicles(true);
  const otherVehicles = vehiclesData?.vehicles.filter(v => v.id !== vehicleId) ?? [];
  const updateVehicleMutation = useUpdateVehicle(vehicleId || '');
  const deleteVehicleMutation = useDeleteVehicle(vehicleId || '');
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const vehicleDialogTrigger = useRef<HTMLElement | null>(null);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isImportOpen, setImportOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    make: '',
    model: '',
    year: '',
    licensePlate: '',
    inspectionDueDate: '',
    inspectionIntervalMonths: '',
    initialOdometer: '',
  });

  useEffect(() => {
    const v = vehicleQuery.data?.vehicle;
    if (v) {
      setEditForm({
        name: v.name || '',
        make: v.make || '',
        model: v.model || '',
        year: v.year ? String(v.year) : '',
        licensePlate: v.licensePlate || '',
        inspectionDueDate: v.inspectionDueDate ? v.inspectionDueDate.slice(0, 10) : '',
        inspectionIntervalMonths: v.inspectionIntervalMonths
          ? String(v.inspectionIntervalMonths)
          : '',
        initialOdometer: v.initialOdometer ? String(v.initialOdometer) : '',
      });
    }
  }, [vehicleQuery.data]);

  const summaryQuery = useVehicleSummary(vehicleId || '');
  const summary = summaryQuery.data;
  const segments = summary?.segments || [];

  const expensesQuery = useExpenses(vehicleId || '');
  const expenses = useMemo(
    () =>
      (expensesQuery.data?.expenses || []) as Array<{
        id: string;
        date: string;
        category:
          | 'FUEL'
          | 'MAINTENANCE'
          | 'INSURANCE'
          | 'TAX'
          | 'PARKING'
          | 'TOLL'
          | 'OIL_CHANGE'
          | 'OIL_TOP_UP'
          | 'INSPECTION'
          | 'TIRES'
          | 'OTHER';
        amount: number;
        vendor?: string | null;
        notes?: string | null;
      }>,
    [expensesQuery.data]
  );
  const lastInspectionDate = useMemo(
    () => pickLastInspectionDateFromExpenses(expenses),
    [expenses]
  );

  useEffect(() => {
    if (status === 'unauthenticated' && !isDemo) {
      router.replace('/');
    }
  }, [status, isDemo, router]);

  // Redirect handling remains effectful

  if (status === 'unauthenticated' && !isDemo) {
    return null;
  }

  if (status === 'loading' && !isDemo) {
    return <div className="p-6">Loading...</div>;
  }

  function openVehicleDialog(event: MouseEvent<HTMLButtonElement>, open: () => void) {
    vehicleDialogTrigger.current =
      event.currentTarget.closest('details')?.querySelector('summary') ?? event.currentTarget;
    open();
  }

  function restoreVehicleDialogFocus(event: Event) {
    event.preventDefault();
    vehicleDialogTrigger.current?.focus();
  }

  return (
    <div className="min-h-screen bg-[#edf1f5] dark:bg-background">
      <header className="border-b border-slate-200 bg-background dark:border-border">
        <div className="container mx-auto px-4 pt-2 pb-5 sm:pt-4 sm:pb-6">
          <nav
            aria-label="Vehicle navigation"
            className="mb-2 flex flex-wrap items-center justify-between gap-x-4"
          >
            <Link
              href="/car"
              className="inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Back to vehicles
            </Link>
            {otherVehicles.length > 0 ? (
              <select
                aria-label="Switch vehicle"
                className="hidden min-h-11 w-44 cursor-pointer rounded-md border border-border/60 bg-background px-2 text-sm lg:block"
                value=""
                onChange={event => router.push(`/car/${event.target.value}`)}
              >
                <option value="" disabled>
                  Switch vehicle
                </option>
                {otherVehicles.map(other => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
              </select>
            ) : null}
          </nav>

          <div className="flex items-start gap-2 max-sm:justify-between">
            <h1 className="min-w-0 text-2xl leading-tight font-bold tracking-tight wrap-anywhere sm:text-3xl">
              {vehicle ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-describedby="vehicle-name-action"
                  className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-sm text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={event => openVehicleDialog(event, () => setDetailsOpen(true))}
                >
                  <span className="min-w-0">{vehicle.name}</span>
                  <ChevronRight
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              ) : (
                'Vehicle overview'
              )}
            </h1>
            {vehicle ? (
              <span id="vehicle-name-action" hidden>
                View vehicle details
              </span>
            ) : null}
            {vehicle ? (
              <RecordActions label="Vehicle actions" placement="card">
                {vehicle.canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className={recordActionClass}
                    onClick={event => openVehicleDialog(event, () => setEditOpen(true))}
                  >
                    Edit
                  </Button>
                ) : null}
                {vehicle.canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className={recordActionClass}
                    onClick={event => openVehicleDialog(event, () => setImportOpen(true))}
                  >
                    Import backup
                  </Button>
                ) : null}
                <ExportMenu vehicleId={vehicle.id} />
                {vehicle.canEdit ? (
                  <>
                    <hr className="my-1 border-border/40" />
                    <Button
                      type="button"
                      variant="ghost"
                      className={destructiveRecordActionClass}
                      onClick={event => openVehicleDialog(event, () => setDeleteOpen(true))}
                    >
                      Delete vehicle
                    </Button>
                  </>
                ) : null}
              </RecordActions>
            ) : null}
          </div>
          {vehicle ? (
            <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <LicensePlate value={vehicle.licensePlate} />
              <InspectionBadge
                inspectionDueDate={vehicle.inspectionDueDate}
                lastInspectionDate={lastInspectionDate?.toISOString()}
                inspectionIntervalMonths={vehicle.inspectionIntervalMonths}
              />
            </div>
          ) : vehicleQuery.isError ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600">
              Could not load vehicle details.
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={vehicleQuery.isFetching}
                onClick={() => vehicleQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div role="status" className="mt-2 text-sm text-muted-foreground">
              Loading vehicle details…
            </div>
          )}
          {vehicle?.canWrite ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
              <FillUpForm key={`fillup-${vehicle.id}`} vehicleId={vehicle.id} />
              <ExpenseForm key={`expense-${vehicle.id}`} vehicleId={vehicle.id} />
            </div>
          ) : null}
        </div>
      </header>
      <main className="container mx-auto px-4 py-5 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {summaryQuery.isError ? (
              <div role="alert" className="text-sm text-red-600">
                Could not load vehicle summary.
                <Button
                  type="button"
                  onClick={() => summaryQuery.refetch()}
                  variant="ghost"
                  size="sm"
                  className="ml-2 min-h-11 cursor-pointer"
                >
                  Retry
                </Button>
              </div>
            ) : summary ? (
              <>
                <ConsumptionBadges segments={segments} />
                <CostSummary
                  costPerKmLifetime={summary.costPerKmLifetime ?? NaN}
                  costPerKm90d={summary.costPerKm90d ?? NaN}
                  spendMTD={summary.spendMTD}
                  spend30d={summary.spend30d}
                  breakdown90d={summary.breakdown90d}
                />
              </>
            ) : (
              <div role="status" className="text-sm text-gray-500">
                Loading vehicle summary…
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-6 lg:col-span-3">
            <Card className="border-slate-200 dark:border-border dark:bg-card">
              <CardContent className="!p-4 sm:!p-6">
                <h2 className="text-lg font-semibold mb-4">Fill-ups</h2>
                {vehicleId ? (
                  <FillUpsTabs
                    segments={segments.map(s => ({
                      date: s.date,
                      lPer100: s.lPer100,
                      costPer100: s.costPer100,
                      distanceKm: s.distanceKm,
                    }))}
                    vehicleId={vehicleId}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-border dark:bg-card">
              <CardContent className="!p-4 sm:!p-6">
                <h2 className="text-lg font-semibold mb-4">Expenses</h2>
                {vehicleId ? <ExpenseList vehicleId={vehicleId} /> : null}
              </CardContent>
            </Card>

            {vehicleId ? <TireManager vehicleId={vehicleId} /> : null}

            <Card className="border-slate-200 dark:border-border dark:bg-card">
              <CardContent className="!p-4 sm:!p-6">
                <h2 className="text-lg font-semibold mb-4">Oil Consumption</h2>
                {vehicleId ? <OilConsumptionChart vehicleId={vehicleId} /> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      {vehicle?.canWrite ? (
        <RestoreBackupDialog
          key={vehicle.id}
          forVehicleId={vehicle.id}
          open={isImportOpen}
          onOpenChange={setImportOpen}
          onCloseAutoFocus={restoreVehicleDialogFocus}
          hideTrigger
          onRestored={() => {
            summaryQuery.refetch();
            expensesQuery.refetch();
          }}
        />
      ) : null}
      <Dialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={restoreVehicleDialogFocus}>
          <DialogHeader>
            <DialogTitle>Delete vehicle</DialogTitle>
            <DialogDescription>
              This permanently deletes the vehicle and all related data (fill-ups, expenses, tires,
              change logs). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteVehicleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={deleteVehicleMutation.isPending}
              onClick={async () => {
                if (!vehicle?.canEdit) return;
                try {
                  await deleteVehicleMutation.mutateAsync();
                  toast.success('Vehicle deleted');
                  setDeleteOpen(false);
                  router.push('/car');
                } catch (error) {
                  toast.error(getUiErrorMessage(error, 'Failed to delete vehicle'));
                }
              }}
            >
              {deleteVehicleMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {vehicle ? (
        <VehicleDetailsDialog
          vehicle={vehicle}
          open={isDetailsOpen}
          onOpenChange={setDetailsOpen}
          onCloseAutoFocus={restoreVehicleDialogFocus}
        />
      ) : null}
      <Dialog open={isEditOpen} onOpenChange={setEditOpen}>
        <DialogContent
          aria-label="Edit vehicle dialog"
          aria-describedby={undefined}
          onCloseAutoFocus={restoreVehicleDialogFocus}
        >
          <DialogHeader>
            <DialogTitle>Edit vehicle</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async e => {
              e.preventDefault();
              try {
                await updateVehicleMutation.mutateAsync({
                  name: editForm.name || undefined,
                  make: editForm.make || undefined,
                  model: editForm.model || undefined,
                  year: editForm.year ? parseInt(editForm.year, 10) : undefined,
                  licensePlate: editForm.licensePlate || null,
                  inspectionDueDate: editForm.inspectionDueDate || null,
                  inspectionIntervalMonths: editForm.inspectionIntervalMonths
                    ? parseInt(editForm.inspectionIntervalMonths, 10)
                    : null,
                  initialOdometer: editForm.initialOdometer
                    ? parseInt(editForm.initialOdometer, 10)
                    : null,
                });
                toast.success('Vehicle updated');
                setEditOpen(false);
              } catch (error) {
                toast.error(getUiErrorMessage(error, 'Failed to update vehicle'));
              }
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-sm">Name</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Make</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={editForm.make}
                  onChange={e => setEditForm(f => ({ ...f, make: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Model</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={editForm.model}
                  onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Year</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1900"
                  className="border rounded-md px-3 py-2"
                  value={editForm.year}
                  onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">License plate</span>
                <input
                  className="border rounded-md px-3 py-2 uppercase"
                  maxLength={16}
                  value={editForm.licensePlate}
                  onChange={e => setEditForm(f => ({ ...f, licensePlate: e.target.value }))}
                  placeholder="ABC-123"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Inspection due date</span>
                <input
                  type="date"
                  className="border rounded-md px-3 py-2"
                  value={editForm.inspectionDueDate}
                  onChange={e => setEditForm(f => ({ ...f, inspectionDueDate: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Inspection interval (months)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="60"
                  className="border rounded-md px-3 py-2"
                  value={editForm.inspectionIntervalMonths}
                  onChange={e =>
                    setEditForm(f => ({ ...f, inspectionIntervalMonths: e.target.value }))
                  }
                  placeholder="12"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Initial Odometer</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className="border rounded-md px-3 py-2"
                  value={editForm.initialOdometer}
                  onChange={e => setEditForm(f => ({ ...f, initialOdometer: e.target.value }))}
                  placeholder="0"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 cursor-pointer"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11 cursor-pointer"
                disabled={updateVehicleMutation.isPending}
              >
                {updateVehicleMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}
function FillUpsTabs({
  segments,
  vehicleId,
}: {
  segments: Array<{ date: string; lPer100: number; costPer100: number; distanceKm: number }>;
  vehicleId: string;
}) {
  const [tab, setTab] = useState<'list' | 'chart'>('list');
  const [chartOptions, setChartOptions] = useState<ChartOptions>({
    rangeDays: 90,
  });
  return (
    <div>
      <div
        role="group"
        aria-label="Fill-up view"
        className="mb-3 grid w-full max-w-64 grid-cols-2 gap-1 rounded-lg border border-border/40 bg-muted p-1 sm:max-w-48"
      >
        {(['list', 'chart'] as const).map(view => (
          <Button
            key={view}
            type="button"
            variant="ghost"
            className="min-h-11 text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            aria-pressed={tab === view}
            onClick={() => setTab(view)}
          >
            {view === 'list' ? 'List' : 'Chart'}
          </Button>
        ))}
      </div>
      {tab === 'list' ? (
        <FillUpList vehicleId={vehicleId} />
      ) : (
        <>
          <ChartToolbar options={chartOptions} onChange={setChartOptions} />
          <ConsumptionChart segments={segments} options={chartOptions} />
        </>
      )}
    </div>
  );
}
