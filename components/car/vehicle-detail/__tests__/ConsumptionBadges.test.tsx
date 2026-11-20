import React from 'react';
import { render, screen } from '@testing-library/react';
import ConsumptionBadges from '../ConsumptionBadges';

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
    const valueFor = (label: string) => screen.getByText(label).parentElement;
    expect(valueFor('Latest')).toHaveTextContent('6.00 L/100km');
    expect(valueFor('Avg (3)')).toHaveTextContent('5.33 L/100km');
    expect(valueFor('Avg (6)')).toHaveTextContent('5.33 L/100km');
    expect(valueFor('Lifetime')).toHaveTextContent('5.33 L/100km');
    expect(valueFor('Cost/100')).toHaveTextContent(/8[.,]67/);
  });

  it('uses the last three and six completed trips with distance weighting', () => {
    const segments = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      distanceKm: (i + 1) * 100,
      litersUsed: (i + 1) ** 2,
      lPer100: i + 1,
      fuelCost: (i + 1) ** 2 * 2,
      costPer100: (i + 1) * 2,
    }));
    render(<ConsumptionBadges segments={segments} />);
    expect(screen.getByText('Avg (3)').parentElement).toHaveTextContent('6.11 L/100km');
    expect(screen.getByText('Avg (6)').parentElement).toHaveTextContent('5.15 L/100km');
    expect(screen.getByText('Lifetime').parentElement).toHaveTextContent('5.00 L/100km');
    expect(screen.getByText('Cost/100').parentElement).toHaveTextContent(/12[.,]22/);
  });

  it('renders dashes when no data', () => {
    render(<ConsumptionBadges segments={[]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
