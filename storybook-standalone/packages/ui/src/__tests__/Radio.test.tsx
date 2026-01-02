import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Radio } from '../components/Radio';

describe('Radio', () => {
  describe('렌더링', () => {
    it('기본 렌더링이 정상적으로 이루어져야 합니다', () => {
      render(<Radio aria-label="test radio" />);
      const radio = screen.getByRole('radio');
      expect(radio).toBeInTheDocument();
    });

    it('체크되지 않은 상태로 렌더링되어야 합니다', () => {
      render(<Radio aria-label="test radio" />);
      const radio = screen.getByRole('radio');
      expect(radio).not.toBeChecked();
    });

    it('체크된 상태로 렌더링되어야 합니다', () => {
      render(<Radio checked aria-label="test radio" />);
      const radio = screen.getByRole('radio');
      expect(radio).toBeChecked();
    });

    it('disabled 상태로 렌더링되어야 합니다', () => {
      render(<Radio disabled aria-label="test radio" />);
      const radio = screen.getByRole('radio');
      expect(radio).toBeDisabled();
    });
  });

  describe('사이즈 variants', () => {
    it('16px 사이즈 컨테이너 클래스를 적용해야 합니다', () => {
      const { container } = render(<Radio size="16" aria-label="test radio" />);
      const labelContainer = container.querySelector('label.h-\\[16px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('18px 사이즈 컨테이너 클래스를 적용해야 합니다 (기본값)', () => {
      const { container } = render(<Radio aria-label="test radio" />);
      const labelContainer = container.querySelector('label.h-\\[18px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('20px 사이즈 컨테이너 클래스를 적용해야 합니다', () => {
      const { container } = render(<Radio size="20" aria-label="test radio" />);
      const labelContainer = container.querySelector('label.h-\\[20px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('24px 사이즈 컨테이너 클래스를 적용해야 합니다', () => {
      const { container } = render(<Radio size="24" aria-label="test radio" />);
      const labelContainer = container.querySelector('label.h-\\[24px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('28px 사이즈 컨테이너 클래스를 적용해야 합니다', () => {
      const { container } = render(<Radio size="28" aria-label="test radio" />);
      const labelContainer = container.querySelector('label.h-\\[28px\\]');
      expect(labelContainer).toBeInTheDocument();
    });

    it('Radio 버튼 자체는 항상 18px × 18px이어야 합니다', () => {
      const { container } = render(<Radio size="24" aria-label="test radio" />);
      const radioButton = container.querySelector('.w-\\[18px\\].h-\\[18px\\]');
      expect(radioButton).toBeInTheDocument();
    });
  });

  describe('상호작용', () => {
    it('클릭 시 onChange 핸들러가 호출되어야 합니다', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Radio onChange={handleChange} aria-label="test radio" />);
      const radio = screen.getByRole('radio');

      await user.click(radio);

      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('disabled 상태에서는 onChange 핸들러가 호출되지 않아야 합니다', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Radio disabled onChange={handleChange} aria-label="test radio" />);
      const radio = screen.getByRole('radio');

      await user.click(radio);

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('체크 아이콘이 checked 상태에서만 표시되어야 합니다', () => {
      const { container, rerender } = render(<Radio checked={false} aria-label="test radio" />);

      // 체크되지 않은 상태: 아이콘 없음
      let icon = container.querySelector('svg');
      expect(icon).not.toBeInTheDocument();

      // 체크된 상태: 아이콘 있음
      rerender(<Radio checked={true} aria-label="test radio" />);
      icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('aria-checked 속성이 올바르게 설정되어야 합니다', () => {
      const { rerender } = render(<Radio checked={false} aria-label="test radio" />);
      let radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('aria-checked', 'false');

      rerender(<Radio checked={true} aria-label="test radio" />);
      radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('aria-checked', 'true');
    });

    it('aria-label이 올바르게 적용되어야 합니다', () => {
      render(<Radio aria-label="custom label" />);
      const radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('aria-label', 'custom label');
    });

    it('role="radio" 속성이 적용되어야 합니다', () => {
      render(<Radio aria-label="test radio" />);
      const radio = screen.getByRole('radio');
      expect(radio).toHaveAttribute('role', 'radio');
    });
  });

  describe('CVA variants', () => {
    it('체크되지 않은 기본 상태 클래스를 적용해야 합니다', () => {
      const { container } = render(<Radio checked={false} disabled={false} aria-label="test radio" />);
      const radioContainer = container.querySelector('.border-control-stroke-default');
      expect(radioContainer).toBeInTheDocument();
    });

    it('체크된 상태 클래스를 적용해야 합니다', () => {
      const { container } = render(<Radio checked={true} disabled={false} aria-label="test radio" />);
      const radioContainer = container.querySelector('.border-control-stroke-default');
      expect(radioContainer).toBeInTheDocument();
    });

    it('disabled 상태 cursor 클래스를 적용해야 합니다', () => {
      const { container } = render(<Radio disabled aria-label="test radio" />);
      const radioContainer = container.querySelector('.cursor-not-allowed');
      expect(radioContainer).toBeInTheDocument();
    });

    it('disabled + checked 상태에서 적절한 클래스를 적용해야 합니다', () => {
      const { container } = render(<Radio checked disabled aria-label="test radio" />);
      const radioContainer = container.querySelector('.border-control-stroke-disabled');
      expect(radioContainer).toBeInTheDocument();
    });
  });

  describe('체크 아이콘 크기', () => {
    it('체크 아이콘은 항상 10px이어야 합니다', () => {
      const { container } = render(<Radio checked aria-label="test radio" />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('width', '10');
      expect(icon).toHaveAttribute('height', '10');
    });

    it('size가 변경되어도 아이콘 크기는 10px로 고정되어야 합니다', () => {
      const { container: container16 } = render(<Radio size="16" checked aria-label="test radio" />);
      const icon16 = container16.querySelector('svg');
      expect(icon16).toHaveAttribute('width', '10');
      expect(icon16).toHaveAttribute('height', '10');

      const { container: container28 } = render(<Radio size="28" checked aria-label="test radio" />);
      const icon28 = container28.querySelector('svg');
      expect(icon28).toHaveAttribute('width', '10');
      expect(icon28).toHaveAttribute('height', '10');
    });
  });

  describe('disabled 아이콘 색상', () => {
    it('disabled 상태에서는 text-control-icon-disabled 클래스를 가져야 합니다', () => {
      const { container } = render(<Radio checked disabled aria-label="test radio" />);
      const icon = container.querySelector('.text-control-icon-disabled');
      expect(icon).toBeInTheDocument();
    });

    it('활성화된 체크 상태에서는 text-control-bg-on 클래스를 가져야 합니다', () => {
      const { container } = render(<Radio checked disabled={false} aria-label="test radio" />);
      const icon = container.querySelector('.text-control-bg-on');
      expect(icon).toBeInTheDocument();
    });
  });
});
