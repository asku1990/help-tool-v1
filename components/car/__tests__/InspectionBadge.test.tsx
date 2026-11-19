import React from 'react';
import { render, screen } from '@testing-library/react';
import InspectionBadge from '@/components/car/InspectionBadge';

describe('InspectionBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows when no due date is available', () => {
    render(<InspectionBadge />);
    expect(screen.getByText('Inspection: Not scheduled')).toBeInTheDocument();
  });

  it('renders due soon when within 30 days', () => {
    const due = new Date(2026, 10, 3, 12).toISOString();
    render(<InspectionBadge inspectionDueDate={due} />);
    expect(screen.getByText('Inspection: Due in 7 days')).toBeInTheDocument();
  });

  it('renders overdue when past due', () => {
    const due = new Date(2026, 9, 24, 12).toISOString();
    render(<InspectionBadge inspectionDueDate={due} />);
    expect(screen.getByText('Inspection: Overdue by 3 days')).toBeInTheDocument();
  });

  it('shows due today instead of a zero-day countdown', () => {
    const due = new Date(2026, 9, 27, 8).toISOString();
    render(<InspectionBadge inspectionDueDate={due} />);
    expect(screen.getByText('Inspection: Due today')).toBeInTheDocument();
  });
});
