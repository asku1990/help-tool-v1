import React from 'react';

export default function LicensePlate({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={['inline-flex items-center', className].filter(Boolean).join(' ')}>
      <div
        className="rounded-md border bg-white px-3 py-1.5 text-sm tracking-widest font-medium shadow-xs [letter-spacing:.12em] select-text"
        aria-label="License plate"
      >
        {value.toUpperCase()}
      </div>
    </div>
  );
}
