import type { ReactNode } from 'react';

export default function VehicleGrid({
  children,
  placeholder = false,
}: {
  children: ReactNode;
  placeholder?: boolean;
}) {
  return (
    <ul
      aria-hidden={placeholder || undefined}
      className="grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {children}
    </ul>
  );
}
