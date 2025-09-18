import React from 'react';
import { render } from '@testing-library/react';
import Loading from '@/app/car/[vehicleId]/loading';

describe('app/car/[vehicleId]/loading', () => {
  it('renders without crashing', () => {
    render(<Loading />);
  });
});
