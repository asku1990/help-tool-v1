import type { ReactNode } from 'react';

export function VehiclePageHeader({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="border-b border-surface-border bg-canvas">
      <div className="container mx-auto px-4 pt-2 pb-5 sm:pt-4 sm:pb-6">
        <nav aria-label="Vehicle navigation" className="sm:mb-2">
          {navigation}
        </nav>
        {children}
      </div>
    </header>
  );
}
