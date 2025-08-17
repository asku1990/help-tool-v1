import React from 'react';
import { computeInspectionStatus, formatDateFi } from '@/utils';

export default function InspectionBadge(props: {
  inspectionDueDate?: string | null;
  lastInspectionDate?: string | null;
  inspectionIntervalMonths?: number | null;
  className?: string;
}) {
  const due = props.inspectionDueDate ? new Date(props.inspectionDueDate) : null;
  const last = props.lastInspectionDate ? new Date(props.lastInspectionDate) : null;
  const { state, daysRemaining, dueDate } = computeInspectionStatus({
    inspectionDueDate: due,
    lastInspectionDate: last,
    inspectionIntervalMonths: props.inspectionIntervalMonths ?? null,
  });

  const label = (() => {
    if (!dueDate) return 'Inspection: —';
    if (daysRemaining === null) return `Inspection: ${formatDateFi(dueDate)}`;
    if (daysRemaining < 0) return `Inspection: Overdue • ${Math.abs(daysRemaining)}d`;
    if (daysRemaining <= 30) return `Inspection: Due in ${daysRemaining}d`;
    return `Inspection: ${formatDateFi(dueDate)}`;
  })();

  const color =
    state === 'overdue'
      ? 'bg-red-100 text-red-800'
      : state === 'dueSoon'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-700';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        color,
        props.className || '',
      ].join(' ')}
    >
      {label}
    </span>
  );
}
