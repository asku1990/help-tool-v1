import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ConsumptionChart from '@/components/car/charts/ConsumptionChart';

// JSDOM has no layout; give the real Recharts chart a fixed viewport.
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, {
        width: 600,
        height: 260,
      }),
  };
});

describe('ConsumptionChart', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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
    const chart = screen.getByRole('group', { name: /Fuel consumption trend chart/i });
    expect(within(chart).getByRole('application')).toBeInTheDocument();
    expect(screen.getByText(/Consumption trend/i)).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('L/100 km')).toBeInTheDocument();
    expect(screen.getByText(/Dashed line: distance-weighted average/)).toBeInTheDocument();
  });

  it('orders trips by date and spaces points by elapsed time rather than trip index', () => {
    const { container } = render(
      <ConsumptionChart
        segments={[
          { date: '2026-01-11', lPer100: 7, distanceKm: 100 },
          { date: '2026-01-01', lPer100: 5, distanceKm: 100 },
          { date: '2026-01-02', lPer100: 6, distanceKm: 100 },
        ]}
      />
    );
    const dots = Array.from(container.querySelectorAll('.recharts-line-dot'));
    expect(dots).toHaveLength(3);
    const positions = dots.map(dot => Number(dot.getAttribute('cx')));
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
    expect((positions[1] - positions[0]) / (positions[2] - positions[0])).toBeCloseTo(0.1);
  });

  it('labels calendar months even when no trip ends on the first of the month', () => {
    render(
      <ConsumptionChart
        segments={[
          { date: new Date(2025, 11, 22).toISOString(), lPer100: 5, distanceKm: 100 },
          { date: new Date(2026, 2, 12).toISOString(), lPer100: 6, distanceKm: 100 },
        ]}
      />
    );

    const chart = within(screen.getByRole('group', { name: /Fuel consumption trend chart/i }));
    expect(chart.getByText('1.2026')).toBeInTheDocument();
    expect(chart.getByText('2.2026')).toBeInTheDocument();
    expect(chart.getByText('3.2026')).toBeInTheDocument();
    expect(chart.queryByText('22.12.2025')).not.toBeInTheDocument();
  });

  it('bounds calendar tick generation for a century of history', () => {
    const advanceMonth = vi.spyOn(Date.prototype, 'setMonth');
    render(
      <ConsumptionChart
        segments={[
          { date: new Date(2026, 0, 1).toISOString(), lPer100: 5, distanceKm: 100 },
          { date: new Date(2126, 0, 1).toISOString(), lPer100: 6, distanceKm: 100 },
        ]}
      />
    );

    expect(advanceMonth.mock.calls.length).toBeGreaterThan(0);
    expect(advanceMonth.mock.calls.length).toBeLessThanOrEqual(24);
  });

  it('ignores invalid dates instead of passing them to the chart', () => {
    render(<ConsumptionChart segments={[{ date: 'invalid', lPer100: 5, distanceKm: 100 }]} />);
    expect(screen.getByText(/No consumption data yet/i)).toBeInTheDocument();
  });

  it('shows multiple day labels for a history contained within one month', () => {
    const { container } = render(
      <ConsumptionChart
        segments={[
          { date: new Date(2026, 0, 12).toISOString(), lPer100: 5, distanceKm: 100 },
          { date: new Date(2026, 0, 20).toISOString(), lPer100: 6, distanceKm: 100 },
        ]}
      />
    );

    const labels = container.querySelectorAll(
      '.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value'
    );
    expect(Array.from(labels, label => label.textContent)).toEqual(['12.1.', '15.1.', '18.1.']);
  });

  it('shows multiple day labels when a short history crosses only one month boundary', () => {
    const { container } = render(
      <ConsumptionChart
        segments={[
          { date: new Date(2026, 9, 20).toISOString(), lPer100: 6, distanceKm: 100 },
          { date: new Date(2026, 10, 10).toISOString(), lPer100: 5, distanceKm: 100 },
        ]}
      />
    );
    const labels = container.querySelectorAll(
      '.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value'
    );
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(
      Array.from(labels).every(label => /^\d{1,2}\.\d{1,2}\.$/.test(label.textContent ?? ''))
    ).toBe(true);
  });

  it('shows date, consumption, and distance when a point is selected with the keyboard', async () => {
    render(
      <ConsumptionChart
        segments={[{ date: new Date(2026, 0, 1).toISOString(), lPer100: 5.25, distanceKm: 450 }]}
      />
    );
    const chart = screen.getByRole('application');
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('Consumption: 5.25 L/100 km')).toBeInTheDocument();
    });
    expect(screen.getAllByText('01.01.2026').length).toBeGreaterThan(0);
    expect(screen.getByText('Distance: 450 km')).toBeInTheDocument();
  });

  it.each([30, 90, 180, 365, 730] as const)(
    'filters trips and summaries to the selected %i days',
    rangeDays => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
      render(
        <ConsumptionChart
          segments={[
            { date: '2020-01-01', lPer100: 20, distanceKm: 1000 },
            { date: '2026-11-16', lPer100: 5, distanceKm: 100 },
          ]}
          options={{ rangeDays }}
        />
      );

      expect(screen.getByText('Avg: 5.00 L/100km • Min: 5.00 • Max: 5.00')).toBeInTheDocument();
    }
  );

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
