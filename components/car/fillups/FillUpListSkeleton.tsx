'use client';

export default function FillUpListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-36" />
      <ul className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="py-3 grid gap-2 sm:grid-cols-5 sm:items-center">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-28" />
            <div className="h-4 bg-gray-100 rounded w-44" />
            <div className="h-4 bg-gray-100 rounded w-40" />
            <div className="h-4 bg-gray-100 rounded w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}
