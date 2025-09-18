import React from 'react';
import { render } from '@testing-library/react';
import Loading from '@/app/car/loading';

describe('app/car/loading', () => {
  it('renders without crashing', () => {
    render(<Loading />);
  });
});
