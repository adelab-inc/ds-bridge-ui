import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { Dialog, dialogVariants } from '../components/Dialog';

describe('Dialog Component', () => {
  const defaultProps = {
    title: 'Test Dialog',
    children: 'Dialog content',
    onClose: vi.fn(),
  };

  it('title과 children을 올바르게 렌더링해야 합니다', () => {
    render(<Dialog {...defaultProps} />);
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('닫기 버튼 클릭 시 onClose 핸들러를 호출해야 합니다', () => {
    const handleClose = vi.fn();
    render(<Dialog {...defaultProps} onClose={handleClose} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop 클릭 시 onClose 핸들러를 호출해야 합니다', () => {
    const handleClose = vi.fn();
    const { container } = render(<Dialog {...defaultProps} onClose={handleClose} />);
    const backdrop = container.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(handleClose).toHaveBeenCalledTimes(1);
    }
  });

  it('ESC 키 입력 시 onClose 핸들러를 호출해야 합니다', () => {
    const handleClose = vi.fn();
    render(<Dialog {...defaultProps} onClose={handleClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('onPrimaryClick이 있을 때 Primary 버튼을 렌더링하고 클릭 시 호출해야 합니다', () => {
    const handlePrimaryClick = vi.fn();
    render(
      <Dialog
        {...defaultProps}
        onPrimaryClick={handlePrimaryClick}
        primaryLabel="확인"
      />
    );
    const primaryButton = screen.getByRole('button', { name: '확인' });
    expect(primaryButton).toBeInTheDocument();
    fireEvent.click(primaryButton);
    expect(handlePrimaryClick).toHaveBeenCalledTimes(1);
  });

  it('onSecondaryClick이 있을 때 Secondary 버튼을 렌더링하고 클릭 시 호출해야 합니다', () => {
    const handleSecondaryClick = vi.fn();
    render(
      <Dialog
        {...defaultProps}
        onSecondaryClick={handleSecondaryClick}
        secondaryLabel="취소"
      />
    );
    const secondaryButton = screen.getByRole('button', { name: '취소' });
    expect(secondaryButton).toBeInTheDocument();
    fireEvent.click(secondaryButton);
    expect(handleSecondaryClick).toHaveBeenCalledTimes(1);
  });

  it('onPrimaryClick과 onSecondaryClick이 없을 때 Footer를 렌더링하지 않아야 합니다', () => {
    render(<Dialog {...defaultProps} />);
    const buttons = screen.queryAllByRole('button');
    // 닫기 버튼만 있어야 함
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('aria-label', '닫기');
  });

  it('커스텀 위치(x, y)를 적용해야 합니다', () => {
    render(<Dialog {...defaultProps} x="30%" y="20%" />);
    const dialog = screen.getByRole('dialog');
    const dialogContainer = dialog.parentElement;
    expect(dialogContainer).toHaveStyle({
      left: '30%',
      top: '20%',
    });
  });

  it('role과 aria 속성을 올바르게 설정해야 합니다', () => {
    render(<Dialog {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
  });

  it('subtitle이 제공되면 렌더링해야 합니다', () => {
    render(<Dialog {...defaultProps} subtitle="Test Subtitle" />);
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('subtitle이 제공되지 않으면 렌더링하지 않아야 합니다', () => {
    render(<Dialog {...defaultProps} />);
    expect(screen.queryByText('Test Subtitle')).not.toBeInTheDocument();
  });

  it('마운트 시 body 스크롤을 막아야 합니다', () => {
    render(<Dialog {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');

    // cleanup은 테스트 프레임워크가 자동으로 처리
  });
});

describe('dialogVariants CVA', () => {
  const sizes: ('sm' | 'md' | 'lg' | 'xl')[] = ['sm', 'md', 'lg', 'xl'];

  sizes.forEach((size) => {
    it(`${size} size should apply correct width`, () => {
      const className = dialogVariants({ size });

      if (size === 'sm') {
        expect(className).toContain('w-[480px]');
      } else if (size === 'md') {
        expect(className).toContain('w-[612px]');
      } else if (size === 'lg') {
        expect(className).toContain('w-[928px]');
      } else if (size === 'xl') {
        expect(className).toContain('w-[1244px]');
      }

      // 모든 size는 max-height를 가져야 함
      expect(className).toContain('max-h-[80vh]');
    });
  });

  it('should include base styles', () => {
    const className = dialogVariants();
    expect(className).toContain('flex');
    expect(className).toContain('flex-col');
    expect(className).toContain('rounded-xl');
    expect(className).toContain('border');
    expect(className).toContain('bg-bg-surface');
  });
});
