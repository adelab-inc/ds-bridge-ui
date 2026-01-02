import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { Button, buttonVariants } from '../components/Button';

describe('Button Component', () => {
  it('자식 요소를 올바르게 렌더링해야 합니다', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('클릭 시 onClick 핸들러를 호출해야 합니다', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disabled prop이 true일 때 비활성화되어야 합니다', () => {
    render(<Button disabled>Click Me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('isLoading prop이 true일 때 비활성화되어야 합니다', () => {
    render(<Button isLoading>loading...</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('isLoading과 disabled 상태에서는 onClick 핸들러가 호출되지 않아야 합니다', () => {
    const handleClick = vi.fn();
    const { rerender } = render(<Button onClick={handleClick} disabled>Disabled</Button>);
    fireEvent.click(screen.getByText('Disabled'));
    expect(handleClick).not.toHaveBeenCalled();

    rerender(<Button onClick={handleClick} isLoading>loading...</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});

describe('buttonVariants CVA', () => {
  const variants: ('primary' | 'secondary' | 'outline' | 'tertiary' | 'destructive' | 'outline-destructive')[] = [
    'primary',
    'secondary',
    'outline',
    'tertiary',
    'destructive',
    'outline-destructive',
  ];

  variants.forEach((variant) => {
    describe(`${variant} variant`, () => {
      it('should include correct interaction classes when enabled', () => {
        const className = buttonVariants({ variant });
        expect(className).toContain('focus-visible:');

        if (variant === 'primary') {
          expect(className).toContain('hover:bg-brand-primary-hover');
          expect(className).toContain('active:bg-brand-primary-pressed');
        } else if (variant === 'secondary') {
          expect(className).toContain('hover:bg-brand-secondary-hover');
          expect(className).toContain('active:bg-brand-secondary-pressed');
        } else if (variant === 'tertiary') {
          expect(className).toContain('hover:bg-[linear-gradient(0deg,#0000000f,#0000000f)]');
          expect(className).toContain('active:bg-[linear-gradient(0deg,#00000019,#00000019)]');
        } else if (variant === 'destructive') {
          expect(className).toContain('hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-colored-hover),theme(colors.state-overlay-on-colored-hover))]');
          expect(className).toContain('active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-colored-pressed),theme(colors.state-overlay-on-colored-pressed))]');
        } else {
          expect(className).toContain('hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))]');
          expect(className).toContain('active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))]');
        }
      });

      it('should not include interaction classes when disabled', () => {
        const className = buttonVariants({ variant, isDisabled: true });
        expect(className).not.toContain('hover:');
        expect(className).not.toContain('active:');
        expect(className).not.toContain('focus-visible:');
      });

      it('should not include interaction classes when loading', () => {
        const className = buttonVariants({ variant, isLoading: true });
        expect(className).not.toContain('hover:');
        expect(className).not.toContain('active:');
        // focus-visible can still be present on loading, but hover/active should be disabled.
      });
    });
  });
});
