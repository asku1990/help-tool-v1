import React from 'react';
import { render } from '@testing-library/react';
import VehicleDetailSkeleton from '@/components/car/vehicle-detail/VehicleDetailSkeleton';

describe('VehicleDetailSkeleton', () => {
  it('renders without crashing', () => {
    render(<VehicleDetailSkeleton />);
  });
});
