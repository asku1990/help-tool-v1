import React from 'react';
import { render, screen } from '@testing-library/react';
import CostSummary from '@/components/car/CostSummary';

describe('CostSummary', () => {
  it('renders KPI values and breakdown bars', () => {
    render(
      <CostSummary
        costPerKmLifetime={0.1234}
        costPerKm90d={0.2}
        spendMTD={45.67}
        spend30d={123.45}
        breakdown90d={[
          { label: 'Fuel', amount: 60 },
          { label: 'Maintenance', amount: 30 },
          { label: 'Other', amount: 10 },
        ]}
      />
    );

    expect(screen.getByText(/Lifetime cost per km/i)).toBeInTheDocument();
    expect(screen.getByText(/Last 90 days cost per km/i)).toBeInTheDocument();
    expect(screen.getByText(/Month-to-date spend/i)).toBeInTheDocument();
    expect(screen.getByText(/Last 30 days spend/i)).toBeInTheDocument();

    // Currency formatting (EUR) present
    expect(screen.getAllByText(/€/i).length).toBeGreaterThan(0);

    // Bars have aria-labels with percentages
    expect(screen.getByLabelText(/Fuel \d+%/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Maintenance \d+%/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Other \d+%/i)).toBeInTheDocument();
  });

  it('handles zero/NaN gracefully with dashes', () => {
    render(
      <CostSummary
        costPerKmLifetime={Number.NaN}
        costPerKm90d={Infinity}
        spendMTD={Number.NaN}
        spend30d={Number.NaN}
        breakdown90d={[]}
      />
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
