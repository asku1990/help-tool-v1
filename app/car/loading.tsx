'use client';
import { VehicleListSkeleton } from '@/components/car';

export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <main className="container mx-auto px-4 py-8" aria-busy="true">
        <p className="sr-only">Loading vehicles…</p>
        <div className="mb-6 h-7 w-36 rounded bg-muted motion-safe:animate-pulse" />
        <VehicleListSkeleton />
      </main>
    </div>
  );
}
