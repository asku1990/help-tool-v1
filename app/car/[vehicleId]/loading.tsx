'use client';
import { VehicleDetailSkeleton } from '@/components/car';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#edf1f5] dark:bg-background">
      <div className="container mx-auto px-4 py-8">
        <VehicleDetailSkeleton />
      </div>
    </div>
  );
}
