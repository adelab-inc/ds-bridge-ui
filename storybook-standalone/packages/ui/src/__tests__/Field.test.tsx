import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { Field, fieldVariants } from '../components/Field';

describe('Field Component', () => {
  describe('기본 렌더링', () => {
    it('label을 올바르게 렌더링해야 합니다', () => {
      render(<Field label="테스트 레이블" />);
      expect(screen.getByText('테스트 레이블')).toBeInTheDocument();
    });

    it('helperText를 올바르게 렌더링해야 합니다', () => {
      render(<Field helperText="도움말 텍스트" />);
      expect(screen.getByText('도움말 텍스트')).toBeInTheDocument();
    });

    it('placeholder를 올바르게 설정해야 합니다', () => {
      render(<Field placeholder="입력하세요" />);
      const input = screen.getByPlaceholderText('입력하세요');
      expect(input).toBeInTheDocument();
    });
  });

  describe('multiline 속성', () => {
    it('multiline이 false일 때 input 요소를 렌더링해야 합니다', () => {
      render(<Field multiline={false} />);
      const input = screen.getByRole('textbox');
      expect(input.tagName).toBe('INPUT');
    });

    it('multiline이 true일 때 textarea 요소를 렌더링해야 합니다', () => {
      render(<Field multiline={true} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('rowsVariant 속성', () => {
    it('flexible variant는 rows=1을 설정해야 합니다', () => {
      render(<Field multiline rowsVariant="flexible" />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.rows).toBe(1);
    });

    it('rows4 variant는 rows=4를 설정해야 합니다', () => {
      render(<Field multiline rowsVariant="rows4" />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.rows).toBe(4);
    });

    it('rows6 variant는 rows=6을 설정해야 합니다', () => {
      render(<Field multiline rowsVariant="rows6" />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.rows).toBe(6);
    });

    it('rows8 variant는 rows=8을 설정해야 합니다', () => {
      render(<Field multiline rowsVariant="rows8" />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.rows).toBe(8);
    });
  });

  describe('상태 속성', () => {
    it('disabled 상태를 올바르게 설정해야 합니다', () => {
      render(<Field disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('readOnly 상태를 올바르게 설정해야 합니다', () => {
      render(<Field readOnly />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });

    it('error가 true일 때 aria-invalid를 설정해야 합니다', () => {
      render(<Field error />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('error가 false일 때 aria-invalid가 false여야 합니다', () => {
      render(<Field error={false} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('접근성', () => {
    it('label과 input이 올바르게 연결되어야 합니다', () => {
      render(<Field label="이름" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('이름');
      expect(input).toHaveAttribute('id');
      expect(label).toHaveAttribute('for', input.getAttribute('id'));
    });

    it('helperText가 있을 때 aria-describedby를 설정해야 합니다', () => {
      render(<Field helperText="도움말" />);
      const input = screen.getByRole('textbox');
      const helperTextId = input.getAttribute('aria-describedby');
      expect(helperTextId).toBeTruthy();
      expect(screen.getByText('도움말')).toHaveAttribute('id', helperTextId!);
    });
  });

  describe('이벤트 처리', () => {
    it('onChange 핸들러를 호출해야 합니다', () => {
      const handleChange = vi.fn();
      render(<Field onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(handleChange).toHaveBeenCalled();
    });

    it('onFocus 핸들러를 호출해야 합니다', () => {
      const handleFocus = vi.fn();
      render(<Field onFocus={handleFocus} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalled();
    });

    it('onBlur 핸들러를 호출해야 합니다', () => {
      const handleBlur = vi.fn();
      render(<Field onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe('size 속성', () => {
    it('md size를 올바르게 렌더링해야 합니다', () => {
      render(<Field size="md" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('sm size를 올바르게 렌더링해야 합니다', () => {
      render(<Field size="sm" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});

describe('fieldVariants CVA', () => {
  it('기본 클래스를 포함해야 합니다', () => {
    const className = fieldVariants({});
    expect(className).toContain('flex');
    expect(className).toContain('flex-col');
    expect(className).toContain('w-[222px]');
  });

  it('size variant를 올바르게 적용해야 합니다', () => {
    const mdClassName = fieldVariants({ size: 'md' });
    const smClassName = fieldVariants({ size: 'sm' });
    expect(mdClassName).toBeTruthy();
    expect(smClassName).toBeTruthy();
  });

  it('error 상태를 올바르게 적용해야 합니다', () => {
    const className = fieldVariants({ hasError: true });
    expect(className).toBeTruthy();
  });

  it('disabled 상태를 올바르게 적용해야 합니다', () => {
    const className = fieldVariants({ isDisabled: true });
    expect(className).toBeTruthy();
  });

  it('readOnly 상태를 올바르게 적용해야 합니다', () => {
    const className = fieldVariants({ isReadOnly: true });
    expect(className).toBeTruthy();
  });
});
