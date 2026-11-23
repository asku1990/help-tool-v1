'use client';

import { Card } from '@/components/ui';

export default function VehicleDetailSkeleton() {
  return (
    <div>
      <div className="mb-6 animate-pulse space-y-3">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="h-8 w-56 max-w-full rounded bg-muted" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="h-8 w-40 rounded bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="h-11 rounded-md bg-muted sm:w-28" />
          <div className="h-11 rounded-md bg-muted sm:w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card variant="subtle" className="p-6 lg:col-span-2">
          <div className="h-5 w-40 bg-gray-100 rounded mb-4 animate-pulse" />
          <div className="h-64 w-full bg-gray-100 rounded animate-pulse" />
        </Card>
        <Card variant="subtle" className="p-6">
          <div className="h-5 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card variant="subtle" className="p-6">
          <div className="h-5 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </Card>
        <Card variant="subtle" className="p-6">
          <div className="h-5 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
