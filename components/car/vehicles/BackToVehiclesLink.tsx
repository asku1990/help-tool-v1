import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const archivedVehiclesHref = '/car?view=archived';

export default function BackToVehiclesLink({ archived = false }: { archived?: boolean }) {
  return (
    <Link
      href={archived ? archivedVehiclesHref : '/car'}
      className="inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      Back to vehicles
    </Link>
  );
}
