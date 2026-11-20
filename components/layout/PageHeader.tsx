import React from 'react';

type PageHeaderProps = {
  title?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  navigation?: React.ReactNode;
};

export default function PageHeader({ title, icon, right, navigation }: PageHeaderProps) {
  return (
    <header className="border-b border-surface-border bg-background">
      <div
        className={`container mx-auto px-4 ${navigation ? 'pt-2 pb-5 sm:pt-4 sm:pb-6' : 'py-4'}`}
      >
        {navigation && (
          <nav aria-label="Page navigation" className="mb-2">
            {navigation}
          </nav>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            {title ? (
              <h1 className="truncate text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
                {title}
              </h1>
            ) : null}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </div>
      </div>
    </header>
  );
}
