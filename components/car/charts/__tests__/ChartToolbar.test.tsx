import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChartToolbar from '../ChartToolbar';

describe('ChartToolbar', () => {
  it('renders and changes range', () => {
    const onChange = vi.fn();
    render(<ChartToolbar options={{ rangeDays: 90 }} onChange={onChange} />);

    const select = screen.getByLabelText('Range') as HTMLSelectElement;
    expect(select.value).toBe('90');

    fireEvent.change(select, { target: { value: '30' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ rangeDays: 30 });
  });

  it('offers one year after 180 days and selects a 365-day range', () => {
    const onChange = vi.fn();
    render(<ChartToolbar options={{ rangeDays: 180 }} onChange={onChange} />);

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      '30d',
      '90d',
      '180d',
      '1 year',
      '2 years',
      'All',
    ]);
    fireEvent.change(screen.getByLabelText('Range'), { target: { value: '365' } });
    expect(onChange).toHaveBeenCalledWith({ rangeDays: 365 });
  });

  it('selects a rolling 730-day range for two years', () => {
    const onChange = vi.fn();
    render(<ChartToolbar options={{ rangeDays: 365 }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: '730' } });
    expect(onChange).toHaveBeenCalledWith({ rangeDays: 730 });
  });
});
