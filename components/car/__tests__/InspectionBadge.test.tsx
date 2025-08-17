import React from 'react';
import { render, screen } from '@testing-library/react';
import InspectionBadge from '@/components/car/InspectionBadge';

describe('InspectionBadge', () => {
  it('renders dash when no due date', () => {
    render(<InspectionBadge />);
    expect(screen.getByText(/Inspection: —/i)).toBeInTheDocument();
  });

  it('renders due soon when within 30 days', () => {
    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    render(<InspectionBadge inspectionDueDate={due} />);
    expect(screen.getByText(/Inspection: Due in \d+d/i)).toBeInTheDocument();
  });

  it('renders overdue when past due', () => {
    const due = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<InspectionBadge inspectionDueDate={due} />);
    expect(screen.getByText(/Inspection: Overdue/i)).toBeInTheDocument();
  });
});
