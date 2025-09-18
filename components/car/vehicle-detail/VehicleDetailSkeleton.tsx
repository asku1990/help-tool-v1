'use client';

export default function VehicleDetailSkeleton() {
  return (
    <div>
      <div className="h-7 w-56 bg-gray-100 rounded mb-4 animate-pulse" />
      <div className="flex items-center gap-2 flex-wrap mb-6">
        <div className="h-9 w-28 bg-gray-100 rounded animate-pulse" />
        <div className="h-9 w-28 bg-gray-100 rounded animate-pulse" />
        <div className="h-9 w-40 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6">
          <div className="h-5 w-40 bg-gray-100 rounded mb-4 animate-pulse" />
          <div className="h-64 w-full bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="h-5 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="h-5 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="h-5 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
