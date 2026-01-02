import { render, screen } from '@testing-library/react';

import { Badge } from '../components/Badge';

describe('Badge Component', () => {
  test('renders level solid badge correctly', () => {
    render(<Badge type="level" levelVariant="announcement" variant="announcement-solid">Level Solid</Badge>);
    expect(screen.getByText('Level Solid')).toBeInTheDocument();
  });

  test('renders status success badge correctly', () => {
    render(<Badge type="status" statusVariant="success" variant="success-solid">Success</Badge>);
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  test('renders count badge correctly', () => {
    render(<Badge type="count">12</Badge>);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  test('renders count badge with maxDigits correctly', () => {
    render(<Badge type="count" maxDigits={2}>{100}</Badge>);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  test('renders dot badge correctly', () => {
    const { container } = render(<Badge type="dot" />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const badgeElement = container.querySelector('div');
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toBeEmptyDOMElement();
  });
});
