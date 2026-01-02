import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { IconButton, iconButtonVariants } from '../components/IconButton';
import { Icon } from '../components/Icon';

describe('IconButton Component', () => {
  const testIcon = <Icon name="add" data-testid="icon" />;

  it('아이콘을 올바르게 렌더링해야 합니다', () => {
    render(<IconButton icon={testIcon} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('클릭 시 onClick 핸들러를 호출해야 합니다', () => {
    const handleClick = vi.fn();
    render(<IconButton icon={testIcon} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disabled prop이 true일 때 비활성화되어야 합니다', () => {
    render(<IconButton icon={testIcon} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('isLoading prop이 true일 때 비활성화되고 스피너 아이콘을 표시해야 합니다', () => {
    render(<IconButton icon={testIcon} isLoading />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // Check for loading spinner
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('isLoading과 disabled 상태에서는 onClick 핸들러가 호출되지 않아야 합니다', () => {
    const handleClick = vi.fn();
    const { rerender } = render(<IconButton icon={testIcon} onClick={handleClick} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();

    rerender(<IconButton icon={testIcon} onClick={handleClick} isLoading />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});

describe('iconButtonVariants CVA', () => {
  const variants: ('ghost' | 'secondary' | 'tertiary' | 'ghost-destructive')[] = [
    'ghost',
    'secondary',
    'tertiary',
    'ghost-destructive',
  ];

  variants.forEach((variant) => {
    describe(`${variant} variant`, () => {
      it('활성화 상태일 때 올바른 상호작용 클래스를 포함해야 합니다', () => {
        const className = iconButtonVariants({ variant });
        expect(className).toContain('focus-visible:ring-2');

        if (variant === 'ghost') {
          expect(className).toContain('hover:bg-state-overlay-on-neutral-hover');
          expect(className).toContain('active:bg-state-overlay-on-neutral-pressed');
        } else if (variant === 'secondary') {
          expect(className).toContain('hover:bg-brand-secondary-hover');
          expect(className).toContain('active:bg-brand-secondary-pressed');
        } else if (variant === 'tertiary') {
          expect(className).toContain('hover:bg-[linear-gradient(0deg,#0000000f,#0000000f)]');
          expect(className).toContain('active:bg-[linear-gradient(0deg,#00000019,#00000019)]');
        } else if (variant === 'ghost-destructive') {
          expect(className).toContain('hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))]');
          expect(className).toContain('active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))]');
        }
      });

      it('비활성화 상태일 때 상호작용 클래스를 포함하지 않아야 합니다', () => {
        const className = iconButtonVariants({ variant, isDisabled: true });
        expect(className).not.toContain('hover:');
        expect(className).not.toContain('active:');
        expect(className).not.toContain('focus-visible:');
      });

      it('로딩 상태일 때 상호작용 클래스를 포함하지 않아야 합니다', () => {
        const className = iconButtonVariants({ variant, isLoading: true });
        expect(className).not.toContain('hover:');
        expect(className).not.toContain('active:');
      });
    });
  });
});