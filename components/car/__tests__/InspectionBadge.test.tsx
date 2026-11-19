import React from 'react';
import { render, screen } from '@testing-library/react';
import InspectionBadge from '@/components/car/InspectionBadge';

describe('InspectionBadge', () => {
  it('shows when no due date is available', () => {
    render(<InspectionBadge />);
    expect(screen.getByText('Inspection: Not scheduled')).toBeInTheDocument();
  });

  it('renders due soon when within 30 days', () => {
    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    render(<InspectionBadge inspectionDueDate={due} />);
    expect(screen.getByText('Inspection: Due in 7 days')).toBeInTheDocument();
  });

  it('renders overdue when past due', () => {
    const due = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<InspectionBadge inspectionDueDate={due} />);
    expect(screen.getByText('Inspection: Overdue by 3 days')).toBeInTheDocument();
  });

  it('shows due today instead of a zero-day countdown', () => {
    render(<InspectionBadge inspectionDueDate={new Date().toISOString()} />);
    expect(screen.getByText('Inspection: Due today')).toBeInTheDocument();
  });
});
