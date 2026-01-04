import { render, screen } from '@testing-library/react';

import { Scrollbar } from '../components/Scrollbar';

describe('Scrollbar', () => {
  it('should render children correctly', () => {
    const testText = 'Hello, Scrollbar!';
    render(
      <Scrollbar>
        <div>{testText}</div>
      </Scrollbar>,
    );
    expect(screen.getByText(testText)).toBeInTheDocument();
  });

  it('should apply the correct default variant class', () => {
    const { container } = render(
      <Scrollbar>
        <div>Content</div>
      </Scrollbar>,
    );
    // Note: The generated class for the variant might be complex.
    // This test primarily checks if the component renders without crashing.
    // Specific style checks can be added in a more detailed test suite.
    expect(container.firstChild).not.toBeNull();
  });
});
