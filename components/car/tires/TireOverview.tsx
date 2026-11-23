'use client';

import Link from 'next/link';
import { Button, Card, CardContent } from '@/components/ui';
import { useTireSets } from '@/hooks/tires/useTireSets';

export function TireOverview({ vehicleId }: { vehicleId: string }) {
  const { data, isError, isPending } = useTireSets(vehicleId);
  const mounted = data?.tireSets.find(set => set.status === 'ACTIVE');

  return (
    <Card variant="subtle">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 !p-4 sm:!p-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Tires</h2>
          {isError ? (
            <p role="alert" className="text-sm text-muted-foreground">
              Could not load mounted tires.
            </p>
          ) : isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading tires…
            </p>
          ) : (
            <p className="text-sm text-muted-foreground wrap-anywhere">
              {mounted ? `${mounted.name} mounted` : 'No tire set mounted'}
            </p>
          )}
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/car/${vehicleId}/tires`}>Manage tires</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
