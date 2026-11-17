import React from 'react';
import { render, screen } from '@testing-library/react';
import ConsumptionChart from '@/components/car/charts/ConsumptionChart';

// Mock ResizeObserver for JSDOM
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
type MinimalResizeObserverCtor = new () => {
  observe: () => void;
  unobserve: () => void;
  disconnect: () => void;
};
Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverMock as unknown as MinimalResizeObserverCtor,
  writable: true,
});

describe('ConsumptionChart', () => {
  it('renders empty state when no segments', () => {
    render(<ConsumptionChart segments={[]} />);
    expect(screen.getByText(/No consumption data yet/i)).toBeInTheDocument();
  });

  it('renders chart elements when segments provided', () => {
    const segments = [
      { date: '2024-01-01', lPer100: 5, distanceKm: 100 },
      { date: '2024-02-01', lPer100: 6, distanceKm: 100 },
      { date: '2024-03-01', lPer100: 7, distanceKm: 100 },
    ];
    render(<ConsumptionChart segments={segments} />);
    expect(screen.getByRole('img', { name: /Fuel consumption trend chart/i })).toBeInTheDocument();
    expect(screen.getByText(/Consumption trend/i)).toBeInTheDocument();
  });

  it('weights the displayed average by distance', () => {
    render(
      <ConsumptionChart
        segments={[
          { date: '2026-11-01', lPer100: 10, distanceKm: 100 },
          { date: '2026-11-02', lPer100: 5, distanceKm: 900 },
        ]}
      />
    );
    expect(screen.getByText(/Avg: 5.50 L\/100km/)).toBeInTheDocument();
  });

  it('shows an empty state when the selected period has no trips', () => {
    render(
      <ConsumptionChart
        segments={[{ date: '2000-01-01', lPer100: 5, distanceKm: 100 }]}
        options={{ rangeDays: 30 }}
      />
    );
    expect(screen.getByText(/No consumption data yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });
});
