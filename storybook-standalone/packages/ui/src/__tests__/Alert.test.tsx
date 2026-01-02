import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { Alert, alertVariants } from '../components/Alert';

describe('Alert Component', () => {
  it('자식 요소를 올바르게 렌더링해야 합니다', () => {
    render(<Alert>Alert Message</Alert>);
    expect(screen.getByText('Alert Message')).toBeInTheDocument();
  });

  it('제목이 있을 때 올바르게 렌더링해야 합니다', () => {
    render(
      <Alert title="Alert Title">
        Alert Message
      </Alert>,
    );
    expect(screen.getByText('Alert Title')).toBeInTheDocument();
    expect(screen.getByText('Alert Message')).toBeInTheDocument();
  });

  it('닫기 버튼 클릭 시 onClose 핸들러를 호출해야 합니다', () => {
    const handleClose = vi.fn();
    render(
      <Alert onClose={handleClose} hasCloseButton>
        Alert Message
      </Alert>,
    );
    const closeButton = screen.getByLabelText('Close alert');
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('액션 버튼을 올바르게 렌더링하고 클릭 핸들러를 호출해야 합니다', () => {
    const action1Handler = vi.fn();
    const action2Handler = vi.fn();
    const actions = [
      { label: 'Action 1', onClick: action1Handler },
      { label: 'Action 2', onClick: action2Handler },
    ];

    render(<Alert actions={actions}>Alert Message</Alert>);

    const action1Button = screen.getByText('Action 1');
    const action2Button = screen.getByText('Action 2');

    fireEvent.click(action1Button);
    expect(action1Handler).toHaveBeenCalledTimes(1);

    fireEvent.click(action2Button);
    expect(action2Handler).toHaveBeenCalledTimes(1);
  });

  it('최대 2개의 액션 버튼만 렌더링해야 합니다', () => {
    const actions = [
      { label: 'Action 1', onClick: vi.fn() },
      { label: 'Action 2', onClick: vi.fn() },
      { label: 'Action 3', onClick: vi.fn() },
    ];

    render(<Alert actions={actions}>Alert Message</Alert>);

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
    expect(screen.queryByText('Action 3')).not.toBeInTheDocument();
  });

  it('role="alert" 속성이 있어야 합니다', () => {
    render(<Alert>Alert Message</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  describe('variant별 렌더링', () => {
    const variants: ('default' | 'info' | 'success' | 'warning' | 'error')[] = [
      'default',
      'info',
      'success',
      'warning',
      'error',
    ];

    variants.forEach((variant) => {
      it(`${variant} variant를 올바르게 렌더링해야 합니다`, () => {
        render(<Alert variant={variant}>Alert Message</Alert>);
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Toast 모드', () => {
    it('isToast가 true일 때 고정 너비를 가져야 합니다', () => {
      const { container } = render(
        <Alert isToast>Toast Message</Alert>,
      );
      const alert = container.firstChild as HTMLElement;
      expect(alert.className).toContain('w-[360px]');
    });

    it('isToast가 false일 때 고정 너비를 가지지 않아야 합니다', () => {
      const { container } = render(
        <Alert isToast={false}>Inline Message</Alert>,
      );
      const alert = container.firstChild as HTMLElement;
      expect(alert.className).not.toContain('w-[360px]');
    });
  });
});

describe('alertVariants CVA', () => {
  const variants: ('default' | 'info' | 'success' | 'warning' | 'error')[] = [
    'default',
    'info',
    'success',
    'warning',
    'error',
  ];

  variants.forEach((variant) => {
    describe(`${variant} variant`, () => {
      it('should include correct background and text classes', () => {
        const className = alertVariants({ variant });
        if (variant === 'info') {
          expect(className).toContain('bg-alert-info-bg');
          expect(className).toContain('text-alert-info-text');
        } else if (variant === 'success') {
          expect(className).toContain('bg-alert-success-bg');
          expect(className).toContain('text-alert-success-text');
        } else if (variant === 'warning') {
          expect(className).toContain('bg-alert-warning-bg');
          expect(className).toContain('text-alert-warning-text');
        } else if (variant === 'error') {
          expect(className).toContain('bg-alert-error-bg');
          expect(className).toContain('text-alert-error-text');
        }
      });
    });
  });

  it('should include shadow when isToast is true', () => {
    const className = alertVariants({ isToast: true });
    expect(className).toContain('shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]');
  });

  it('should not include shadow when isToast is false', () => {
    const className = alertVariants({ isToast: false });
    expect(className).not.toContain('shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]');
  });
});
