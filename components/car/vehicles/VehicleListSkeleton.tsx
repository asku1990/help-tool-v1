'use client';

import { Card, CardContent } from '@/components/ui';
import VehicleGrid from './VehicleGrid';

export default function VehicleListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <VehicleGrid placeholder>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <Card variant="subtle">
            <CardContent className="space-y-4 motion-safe:animate-pulse sm:p-5">
              <div className="flex items-start gap-3">
                <div className="size-10 shrink-0 rounded-lg bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 w-36 max-w-full rounded bg-muted" />
                  <div className="h-4 w-24 max-w-full rounded bg-muted" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-8 w-20 rounded-md bg-muted" />
                <div className="h-6 w-32 rounded-full bg-muted" />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </VehicleGrid>
  );
}
