import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChartToolbar from '@/components/car/ChartToolbar';

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
});
