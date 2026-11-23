'use client';
import { VehicleListSkeleton } from '@/components/car';
import { Card } from '@/components/ui';

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="container mx-auto px-4 py-8">
        <div className="h-7 w-40 bg-gray-100 rounded mb-4 animate-pulse" />
        <Card variant="subtle" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-5 w-36 bg-gray-100 rounded mb-2 animate-pulse" />
              <div className="h-4 w-60 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="h-10 w-28 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="mt-6 space-y-3">
            <VehicleListSkeleton rows={3} />
          </div>
        </Card>
      </div>
    </div>
  );
}
