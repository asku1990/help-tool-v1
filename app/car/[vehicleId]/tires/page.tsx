'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { TireManager } from '@/components/car/tires';
import { VehiclePageHeader } from '@/components/car/vehicle-detail';
import { Button, Toaster } from '@/components/ui';
import { useVehicle } from '@/hooks';

export default function TiresPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const vehicleQuery = useVehicle(vehicleId);
  const vehicle = vehicleQuery.data?.vehicle;

  return (
    <div className="min-h-screen bg-canvas">
      <VehiclePageHeader
        navigation={
          <Link
            href={`/car/${vehicleId}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Back to vehicle
          </Link>
        }
      >
        <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">Tires</h1>
        {vehicle && (
          <p className="mt-2 text-sm text-muted-foreground wrap-anywhere">{vehicle.name}</p>
        )}
      </VehiclePageHeader>
      <div className="container mx-auto px-4 py-5 sm:py-6">
        {vehicleQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600">
            Could not load this vehicle.
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={vehicleQuery.isFetching}
              onClick={() => void vehicleQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : vehicle ? (
          <TireManager
            key={vehicle.id}
            vehicleId={vehicle.id}
            canWrite={vehicle.canWrite === true}
          />
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Loading vehicle…
          </p>
        )}
      </div>
      <Toaster />
    </div>
  );
}
