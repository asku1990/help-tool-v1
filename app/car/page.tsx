'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Card,
  CardContent,
  Toaster,
} from '@/components/ui';
import { Car, ChevronRight, Plus, Shield, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useVehicles, useIsAdmin } from '@/hooks';
import { apiPost } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui';
import PageHeader from '@/components/layout/PageHeader';
import {
  InspectionBadge,
  LicensePlate,
  VehicleGrid,
  VehicleListSkeleton,
} from '@/components/car/vehicles';
import { RestoreBackupDialog } from '@/components/car/imports';
import { toast } from 'sonner';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import { SignOutButton } from '@/components/buttons/SignOutButton';
import RecordActions, { recordActionClass } from '@/components/car/records/RecordActions';

export default function CarHomePage() {
  const { status } = useSession();
  const router = useRouter();
  const [isDemo] = useState<boolean>(() => false);
  const [loading, setLoading] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const { isVehicleDialogOpen: open, setVehicleDialogOpen: setOpen } = useUiStore();
  const [form, setForm] = useState<{
    name: string;
    make: string;
    model: string;
    year: string;
    licensePlate: string;
    inspectionDueDate: string;
    inspectionIntervalMonths: string;
    initialOdometer: string;
  }>({
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
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const {
    data: vehiclesData,
    isLoading: isVehiclesLoading,
    isError: isVehiclesError,
    refetch: refetchVehicles,
  } = useVehicles(status === 'authenticated' || isDemo);
  const vehicles = vehiclesData?.vehicles ?? [];
  const { data: adminData } = useIsAdmin(status === 'authenticated' || isDemo);
  const isAdmin = adminData?.isAdmin === true;

  if (status === 'unauthenticated' && !isDemo) {
    return null;
  }

  if (status === 'loading' && !isDemo) {
    return <div className="p-6">Loading...</div>;
  }

  function openFromMenu(event: MouseEvent<HTMLButtonElement>, openDialog: () => void) {
    menuTrigger.current = event.currentTarget.closest('details')?.querySelector('summary') ?? null;
    openDialog();
  }

  function restoreMenuFocus(event: Event) {
    event.preventDefault();
    menuTrigger.current?.focus();
  }

  return (
    <div className="min-h-screen bg-canvas">
      <PageHeader
        surface="canvas"
        title="Car Management"
        icon={<Car className="w-6 h-6" />}
        right={
          <RecordActions label="Vehicle list actions" placement="card" unmountOnClose>
            <Button
              type="button"
              variant="ghost"
              className={recordActionClass}
              aria-haspopup="dialog"
              onClick={event => openFromMenu(event, () => setOpen(true))}
            >
              <Plus className="size-5" aria-hidden="true" />
              Add vehicle
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={recordActionClass}
              aria-haspopup="dialog"
              onClick={event => openFromMenu(event, () => setRestoreOpen(true))}
            >
              <Upload className="size-5" aria-hidden="true" />
              Restore Backup
            </Button>
            {isAdmin ? (
              <Button asChild variant="ghost" className={recordActionClass}>
                <Link href="/car/admin">
                  <Shield aria-hidden="true" />
                  Admin
                </Link>
              </Button>
            ) : null}
            <SignOutButton inMenu />
          </RecordActions>
        }
      />

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold">Vehicles</h2>
        <div className="mt-6" aria-busy={isVehiclesLoading}>
          {isVehiclesLoading ? (
            <>
              <p className="sr-only">Loading vehicles…</p>
              <VehicleListSkeleton />
            </>
          ) : isVehiclesError && !vehiclesData ? (
            <Card variant="subtle" className="max-w-6xl">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p role="alert" className="text-sm">
                  Could not load vehicles.
                </p>
                <Button variant="outline" onClick={() => refetchVehicles()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : vehicles.length === 0 ? (
            <Card variant="subtle" className="max-w-6xl">
              <CardContent className="space-y-1">
                <p className="font-medium">No vehicles yet.</p>
                <p className="text-sm text-muted-foreground">
                  Choose Add vehicle from the menu to start tracking fuel and expenses.
                </p>
              </CardContent>
            </Card>
          ) : (
            <VehicleGrid>
              {vehicles.map(vehicle => {
                const model = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
                return (
                  <li key={vehicle.id}>
                    <Link
                      href={`/car/${vehicle.id}`}
                      className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Card
                        variant="subtle"
                        className="h-full transition-colors group-hover:bg-accent"
                      >
                        <CardContent className="flex h-full flex-col gap-4 sm:p-5">
                          <div className="flex items-start gap-3">
                            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                              <Car className="size-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1 wrap-anywhere">
                              <h3 className="font-semibold">{vehicle.name}</h3>
                              {model ? (
                                <p className="text-sm text-muted-foreground">{model}</p>
                              ) : null}
                            </div>
                            <ChevronRight
                              className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="mt-auto flex flex-wrap items-center gap-2">
                            <LicensePlate
                              value={vehicle.licensePlate}
                              className="max-w-full wrap-anywhere"
                            />
                            <InspectionBadge
                              inspectionDueDate={vehicle.inspectionDueDate}
                              inspectionIntervalMonths={vehicle.inspectionIntervalMonths}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </VehicleGrid>
          )}
        </div>

        <RestoreBackupDialog
          existingVehicles={vehicles.map(v => ({ id: v.id, name: v.name }))}
          onRestored={() => refetchVehicles()}
          open={restoreOpen}
          onOpenChange={setRestoreOpen}
          hideTrigger
          onCloseAutoFocus={restoreMenuFocus}
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            mobileLayout="fullscreen"
            aria-label="Add vehicle dialog"
            onCloseAutoFocus={restoreMenuFocus}
          >
            <DialogHeader>
              <DialogTitle>Add vehicle</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={async e => {
                e.preventDefault();
                setLoading(true);
                try {
                  await apiPost<{ id: string }>('/*/api/vehicles'.replace('/*', ''), {
                    name: form.name,
                    make: form.make || undefined,
                    model: form.model || undefined,
                    year: form.year ? parseInt(form.year, 10) : undefined,
                    licensePlate: form.licensePlate || undefined,
                    inspectionDueDate: form.inspectionDueDate || undefined,
                    inspectionIntervalMonths: form.inspectionIntervalMonths
                      ? parseInt(form.inspectionIntervalMonths, 10)
                      : undefined,
                    initialOdometer: form.initialOdometer
                      ? parseInt(form.initialOdometer, 10)
                      : undefined,
                  });
                  toast.success('Vehicle created');
                  setOpen(false);
                  setForm({
                    name: '',
                    make: '',
                    model: '',
                    year: '',
                    licensePlate: '',
                    inspectionDueDate: '',
                    inspectionIntervalMonths: '',
                    initialOdometer: '',
                  });
                  await refetchVehicles();
                } catch (error) {
                  toast.error(getUiErrorMessage(error, 'Failed to create vehicle'));
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-sm">Name</span>
                  <input
                    className="border rounded-md px-3 py-2"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Make</span>
                  <input
                    className="border rounded-md px-3 py-2"
                    value={form.make}
                    onChange={e => setForm(f => ({ ...f, make: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Model</span>
                  <input
                    className="border rounded-md px-3 py-2"
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Year</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1900"
                    className="border rounded-md px-3 py-2"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">License plate</span>
                  <input
                    className="border rounded-md px-3 py-2 uppercase"
                    maxLength={16}
                    value={form.licensePlate}
                    onChange={e => setForm(f => ({ ...f, licensePlate: e.target.value }))}
                    placeholder="ABC-123"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Inspection due date</span>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-2"
                    value={form.inspectionDueDate}
                    onChange={e => setForm(f => ({ ...f, inspectionDueDate: e.target.value }))}
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
                    value={form.inspectionIntervalMonths}
                    onChange={e =>
                      setForm(f => ({ ...f, inspectionIntervalMonths: e.target.value }))
                    }
                    placeholder="12"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm">Initial odometer (km)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className="border rounded-md px-3 py-2"
                    value={form.initialOdometer}
                    onChange={e => setForm(f => ({ ...f, initialOdometer: e.target.value }))}
                    placeholder="0"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!form.name.trim() || loading}>
                  Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
      <Toaster />
    </div>
  );
}
