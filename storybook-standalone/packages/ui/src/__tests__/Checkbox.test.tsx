import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from '../components/Checkbox';

describe('Checkbox', () => {
  describe('렌더링', () => {
    it('기본 렌더링이 정상적으로 이루어져야 합니다', () => {
      render(<Checkbox aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('unchecked 상태로 렌더링되어야 합니다', () => {
      render(<Checkbox checked={false} aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('checked 상태로 렌더링되어야 합니다', () => {
      render(<Checkbox checked={true} aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('indeterminate 상태로 렌더링되어야 합니다', () => {
      render(<Checkbox checked={true} variant="indeterminate" aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('disabled 상태로 렌더링되어야 합니다', () => {
      render(<Checkbox disabled aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });
  });

  describe('사이즈 variants', () => {
    it('16px 사이즈 컨테이너 클래스를 적용해야 합니다', () => {
      const { container } = render(<Checkbox size="16" aria-label="test checkbox" />);
      const labelContainer = container.querySelector('label.h-\\[16px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('18px 사이즈 컨테이너 클래스를 적용해야 합니다 (기본값)', () => {
      const { container } = render(<Checkbox aria-label="test checkbox" />);
      const labelContainer = container.querySelector('label.h-\\[18px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('20px 사이즈 컨테이너 클래스를 적용해야 합니다', () => {
      const { container } = render(<Checkbox size="20" aria-label="test checkbox" />);
      const labelContainer = container.querySelector('label.h-\\[20px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('24px 사이즈 컨테이너 클래스를 적용해야 합니다', () => {
      const { container } = render(<Checkbox size="24" aria-label="test checkbox" />);
      const labelContainer = container.querySelector('label.h-\\[24px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('28px 사이즈 컨테이너 클래스를 적용해야 합니다', () => {
      const { container } = render(<Checkbox size="28" aria-label="test checkbox" />);
      const labelContainer = container.querySelector('label.h-\\[28px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('Checkbox 버튼 자체는 항상 18px × 18px이어야 합니다', () => {
      const { container } = render(<Checkbox size="24" aria-label="test checkbox" />);
      const checkboxButton = container.querySelector('.w-\\[18px\\].h-\\[18px\\]');
      expect(checkboxButton).toBeInTheDocument();
    });
  });

  describe('상호작용', () => {
    it('클릭 시 onChange 핸들러가 호출되어야 합니다', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Checkbox onChange={handleChange} aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');

      await user.click(checkbox);

      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('disabled 상태에서는 onChange 핸들러가 호출되지 않아야 합니다', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Checkbox disabled onChange={handleChange} aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');

      await user.click(checkbox);

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('unchecked 상태에서는 아이콘이 표시되지 않아야 합니다', () => {
      const { container } = render(<Checkbox checked={false} aria-label="test checkbox" />);
      const icon = container.querySelector('svg');
      expect(icon).not.toBeInTheDocument();
    });

    it('checked 상태에서는 체크 아이콘이 표시되어야 합니다', () => {
      const { container } = render(<Checkbox checked={true} variant="checked" aria-label="test checkbox" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('indeterminate 상태에서는 indeterminate 아이콘이 표시되어야 합니다', () => {
      const { container } = render(<Checkbox checked={true} variant="indeterminate" aria-label="test checkbox" />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('unchecked 상태에서 aria-checked가 false여야 합니다', () => {
      render(<Checkbox checked={false} aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('checked 상태에서 aria-checked가 true여야 합니다', () => {
      render(<Checkbox checked={true} aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('indeterminate 상태에서 aria-checked가 mixed여야 합니다', () => {
      render(<Checkbox checked={true} variant="indeterminate" aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('aria-label이 올바르게 적용되어야 합니다', () => {
      render(<Checkbox aria-label="custom label" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-label', 'custom label');
    });

    it('role="checkbox" 속성이 적용되어야 합니다', () => {
      render(<Checkbox aria-label="test checkbox" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('role', 'checkbox');
    });
  });

  describe('CVA variants', () => {
    it('unchecked 기본 상태 클래스를 적용해야 합니다', () => {
      const { container } = render(<Checkbox checked={false} disabled={false} aria-label="test checkbox" />);
      const checkboxContainer = container.querySelector('.border-control-stroke-default');
      expect(checkboxContainer).toBeInTheDocument();
    });

    it('checked 상태에서 배경색 클래스를 적용해야 합니다', () => {
      const { container } = render(<Checkbox checked={true} disabled={false} aria-label="test checkbox" />);
      const checkboxContainer = container.querySelector('.bg-control-bg-on');
      expect(checkboxContainer).toBeInTheDocument();
    });

    it('disabled 상태 cursor 클래스를 적용해야 합니다', () => {
      const { container } = render(<Checkbox disabled aria-label="test checkbox" />);
      const checkboxContainer = container.querySelector('.cursor-not-allowed');
      expect(checkboxContainer).toBeInTheDocument();
    });

    it('checked + disabled 상태에서 적절한 클래스를 적용해야 합니다', () => {
      const { container } = render(<Checkbox checked={true} disabled aria-label="test checkbox" />);
      const checkboxContainer = container.querySelector('.bg-control-bg-disabled');
      expect(checkboxContainer).toBeInTheDocument();
    });
  });

  describe('아이콘 크기', () => {
    it('체크 아이콘은 항상 12px이어야 합니다', () => {
      const { container } = render(<Checkbox checked={true} variant="checked" aria-label="test checkbox" />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('width', '12');
      expect(icon).toHaveAttribute('height', '12');
    });

    it('size가 변경되어도 아이콘 크기는 12px로 고정되어야 합니다', () => {
      const { container: container16 } = render(<Checkbox size="16" checked={true} variant="checked" aria-label="test checkbox" />);
      const icon16 = container16.querySelector('svg');
      expect(icon16).toHaveAttribute('width', '12');
      expect(icon16).toHaveAttribute('height', '12');

      const { container: container28 } = render(<Checkbox size="28" checked={true} variant="checked" aria-label="test checkbox" />);
      const icon28 = container28.querySelector('svg');
      expect(icon28).toHaveAttribute('width', '12');
      expect(icon28).toHaveAttribute('height', '12');
    });
  });

  describe('아이콘 색상', () => {
    it('disabled 상태에서는 text-control-icon-disabled 클래스를 가져야 합니다', () => {
      const { container } = render(<Checkbox checked={true} variant="checked" disabled aria-label="test checkbox" />);
      const icon = container.querySelector('.text-control-icon-disabled');
      expect(icon).toBeInTheDocument();
    });

    it('활성화된 체크 상태에서는 text-white 클래스를 가져야 합니다', () => {
      const { container } = render(<Checkbox checked={true} variant="checked" disabled={false} aria-label="test checkbox" />);
      const icon = container.querySelector('.text-white');
      expect(icon).toBeInTheDocument();
    });
  });
});
