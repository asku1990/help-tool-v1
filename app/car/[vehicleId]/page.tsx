'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronRight } from 'lucide-react';
import {
  BackToVehiclesLink,
  LicensePlate,
  InspectionBadge,
  VehicleDialog,
} from '@/components/car/vehicles';
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
import { FillUpForm, FillUpList } from '@/components/car/fillups';
import { ExpenseForm, ExpenseList } from '@/components/car/expenses';
import { CostSummary, ConsumptionBadges, VehiclePageHeader } from '@/components/car/vehicle-detail';
import { SpreadsheetExportLink } from '@/components/car';
import {
  ConsumptionChart,
  OilConsumptionChart,
  ChartToolbar,
  type ChartOptions,
} from '@/components/car/charts';
import { TireOverview } from '@/components/car/tires';
import { useExpenses, useVehicleSummary, useVehicle, useDeleteVehicle } from '@/hooks';
import { pickLastInspectionDateFromExpenses } from '@/utils';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';

import {
  RecordActions,
  destructiveRecordActionClass,
  recordActionClass,
} from '@/components/car/records';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

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
  const vehicleFieldsReady = !vehicleQuery.isError && vehicleQuery.fetchStatus === 'idle';
  const deleteVehicleMutation = useDeleteVehicle(vehicleId || '');
  const [vehicleEntry, setVehicleEntry] = useState<'view' | 'edit' | null>(null);
  const vehicleDialogTrigger = useRef<HTMLElement | null>(null);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

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
    <div className="min-h-screen bg-canvas">
      <VehiclePageHeader navigation={<BackToVehiclesLink />}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="min-w-0 text-2xl leading-tight font-bold tracking-tight wrap-anywhere sm:text-3xl">
              {vehicle ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-describedby="vehicle-name-action"
                  className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-sm text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={event => openVehicleDialog(event, () => setVehicleEntry('view'))}
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
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
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
          </div>
          {vehicle ? (
            <div
              role="group"
              aria-label="Vehicle controls"
              className="relative flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end"
            >
              {vehicle.canWrite ? (
                <>
                  <FillUpForm key={`fillup-${vehicle.id}`} vehicleId={vehicle.id} />
                  <ExpenseForm key={`expense-${vehicle.id}`} vehicleId={vehicle.id} />
                </>
              ) : null}
              <RecordActions
                label="More vehicle actions"
                triggerText="More"
                placement="toolbar"
                unmountOnClose
              >
                {vehicle.canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className={recordActionClass}
                    disabled={!vehicleFieldsReady}
                    onClick={event => openVehicleDialog(event, () => setVehicleEntry('edit'))}
                  >
                    Edit
                  </Button>
                ) : null}
                <SpreadsheetExportLink vehicleId={vehicle.id} />
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
            </div>
          ) : null}
        </div>
      </VehiclePageHeader>
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
              <div role="status" className="text-sm text-muted-foreground">
                Loading vehicle summary…
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-6 lg:col-span-3">
            <Card variant="subtle">
              <CardContent className="!p-4 sm:!p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Fill-ups</h2>
                  {summary && !summaryQuery.isError && (
                    <p className="text-sm text-muted-foreground">
                      All-time fuel cost: {currency.format(summary.fuelCostLifetime)}
                    </p>
                  )}
                </div>
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

            <Card variant="subtle">
              <CardContent className="!p-4 sm:!p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Expenses</h2>
                  {summary && !summaryQuery.isError && (
                    <p className="text-sm text-muted-foreground">
                      All-time expenses: {currency.format(summary.expenseTotalLifetime)}
                    </p>
                  )}
                </div>
                {vehicleId ? <ExpenseList vehicleId={vehicleId} /> : null}
              </CardContent>
            </Card>

            {vehicle ? <TireOverview vehicleId={vehicle.id} /> : null}

            <Card variant="subtle">
              <CardContent className="!p-4 sm:!p-6">
                <h2 className="text-lg font-semibold mb-4">Oil Consumption</h2>
                {vehicleId ? <OilConsumptionChart vehicleId={vehicleId} /> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
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
      {vehicle && vehicleEntry ? (
        <VehicleDialog
          key={`details-${vehicle.id}`}
          vehicle={vehicle}
          entry={vehicleEntry}
          canEdit={vehicle.canEdit === true}
          available={vehicleFieldsReady}
          onClose={() => setVehicleEntry(null)}
          restoreFocus={() => vehicleDialogTrigger.current?.focus()}
        />
      ) : null}
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
