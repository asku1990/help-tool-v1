import React from 'react';
import Link from 'next/link';

type PageHeaderProps = {
  title?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
};

export default function PageHeader({
  title,
  icon,
  right,
  backHref,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          {title ? <h1 className="text-2xl font-bold truncate">{title}</h1> : null}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {right}
          {!right && backHref ? (
            <Link href={backHref} className="text-sm text-blue-600 hover:underline">
              {backLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
