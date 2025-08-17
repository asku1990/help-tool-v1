import React from 'react';
import { render, screen } from '@testing-library/react';
import LicensePlate from '@/components/car/LicensePlate';

describe('LicensePlate', () => {
  it('renders uppercase value and aria label', () => {
    render(<LicensePlate value="ab-123-cd" />);
    const el = screen.getByLabelText(/License plate/i);
    expect(el).toHaveTextContent('AB-123-CD');
  });

  it('renders nothing when value is empty', () => {
    const { container } = render(<LicensePlate value={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
