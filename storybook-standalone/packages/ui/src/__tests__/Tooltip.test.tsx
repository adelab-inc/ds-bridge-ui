import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Tooltip } from '../components/Tooltip';
import { Button } from '../components/Button';

describe('Tooltip Component', () => {
  test('renders trigger element correctly', () => {
    render(
      <Tooltip content="Test tooltip">
        <Button>Trigger</Button>
      </Tooltip>
    );
    expect(screen.getByText('Trigger')).toBeInTheDocument();
  });

  test('shows tooltip on hover after delay', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Test tooltip" delay={50}>
        <Button>Trigger</Button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Test tooltip')).toBeInTheDocument();
    });
  });

  test('hides tooltip on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Test tooltip" delay={10} closeDelay={10}>
        <Button>Trigger</Button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    await user.unhover(trigger);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('renders with truncation variant correctly', async () => {
    const user = userEvent.setup();
    const longContent = 'Very long content that needs truncation and scrolling';

    render(
      <Tooltip content={longContent} truncation={true} delay={10}>
        <Button>Trigger</Button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    await user.hover(trigger);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveClass('max-w-[540px]');
      expect(tooltip).toHaveClass('max-h-[240px]');
      expect(tooltip).toHaveClass('overflow-y-scroll');
    });
  });

  test('renders default variant without truncation', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Short content" truncation={false} delay={10}>
        <Button>Trigger</Button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    await user.hover(trigger);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveClass('max-w-[320px]');
      expect(tooltip).toHaveClass('max-h-[44px]');
    });
  });

  test('respects custom delay', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Test tooltip" delay={100}>
        <Button>Trigger</Button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    await user.hover(trigger);

    // Tooltip should appear after delay
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    }, { timeout: 200 });
  });

  test('respects custom closeDelay', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Test tooltip" delay={10} closeDelay={100}>
        <Button>Trigger</Button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    await user.unhover(trigger);

    // Tooltip should stay visible for closeDelay duration
    // Total time = closeDelay (100ms) + animation fade out (150ms) = 250ms
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    }, { timeout: 300 });
  });

  test('renders custom React element as content', async () => {
    const user = userEvent.setup();
    const customContent = (
      <div>
        <strong>Title</strong>
        <p>Description</p>
      </div>
    );

    render(
      <Tooltip content={customContent} delay={10}>
        <Button>Trigger</Button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });
});
