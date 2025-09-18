'use client';
import { VehicleDetailSkeleton } from '@/components/car';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <VehicleDetailSkeleton />
      </div>
    </div>
  );
}
