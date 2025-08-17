import React from 'react';
import { render, screen } from '@testing-library/react';
import ConsumptionBadges from '@/components/car/ConsumptionBadges';

describe('ConsumptionBadges', () => {
  it('renders badges with latest and averages', () => {
    const segments = [
      {
        date: '2024-01-01',
        distanceKm: 100,
        litersUsed: 5,
        lPer100: 5,
        fuelCost: 8,
        costPer100: 8,
      },
      {
        date: '2024-02-01',
        distanceKm: 200,
        litersUsed: 10,
        lPer100: 5,
        fuelCost: 16,
        costPer100: 8,
      },
      {
        date: '2024-03-01',
        distanceKm: 150,
        litersUsed: 9,
        lPer100: 6,
        fuelCost: 15,
        costPer100: 10,
      },
    ];
    render(<ConsumptionBadges segments={segments} />);
    expect(screen.getByText(/Latest/i)).toBeInTheDocument();
    expect(screen.getByText(/Avg \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Lifetime/i)).toBeInTheDocument();
    // Cost/100 should render currency
    expect(screen.getAllByText(/€/i).length).toBeGreaterThan(0);
  });

  it('renders dashes when no data', () => {
    render(<ConsumptionBadges segments={[]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
