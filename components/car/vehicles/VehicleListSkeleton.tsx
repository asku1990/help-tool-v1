'use client';

export default function VehicleListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="py-3 px-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="h-4 bg-gray-100 rounded w-40 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-24" />
              <div className="h-5 bg-gray-100 rounded w-20 mt-3" />
            </div>
            <div className="w-20 h-8 bg-gray-100 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
