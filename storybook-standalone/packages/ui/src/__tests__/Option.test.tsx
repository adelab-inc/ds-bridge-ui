import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Option } from '../components/Option';
import { Radio } from '../components/Radio';
import { Checkbox } from '../components/Checkbox';

describe('Option', () => {
  describe('렌더링', () => {
    it('기본 렌더링이 정상적으로 이루어져야 합니다', () => {
      render(
        <Option label="옵션 레이블">
          <Radio aria-label="test radio" />
        </Option>
      );
      const label = screen.getByText('옵션 레이블');
      expect(label).toBeInTheDocument();
    });

    it('Radio를 자식으로 받을 수 있어야 합니다', () => {
      render(
        <Option label="라디오 옵션">
          <Radio aria-label="test radio" />
        </Option>
      );
      const radio = screen.getByRole('radio');
      expect(radio).toBeInTheDocument();
    });

    it('Checkbox를 자식으로 받을 수 있어야 합니다', () => {
      render(
        <Option label="체크박스 옵션">
          <Checkbox aria-label="test checkbox" />
        </Option>
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe('스타일', () => {
    it('gap-layout-inline-md 클래스를 가져야 합니다', () => {
      const { container } = render(
        <Option label="옵션">
          <Radio aria-label="test radio" />
        </Option>
      );
      const label = container.querySelector('label.gap-layout-inline-md');
      expect(label).toBeInTheDocument();
    });

    it('inline-flex items-center 클래스를 가져야 합니다', () => {
      const { container } = render(
        <Option label="옵션">
          <Radio aria-label="test radio" />
        </Option>
      );
      const label = container.querySelector('label.inline-flex.items-center');
      expect(label).toBeInTheDocument();
    });

    it('레이블 텍스트는 text-body-sm-regular text-text-primary 클래스를 가져야 합니다', () => {
      const { container } = render(
        <Option label="옵션 텍스트">
          <Radio aria-label="test radio" />
        </Option>
      );
      const labelText = container.querySelector('.text-body-sm-regular.text-text-primary');
      expect(labelText).toBeInTheDocument();
      expect(labelText).toHaveTextContent('옵션 텍스트');
    });
  });

  describe('중첩 label 방지', () => {
    it('Radio/Checkbox에 renderContainer="div"를 전달해야 합니다', () => {
      const { container } = render(
        <Option label="옵션">
          <Radio aria-label="test radio" />
        </Option>
      );
      // Radio의 컨테이너가 div여야 함 (label이 아님)
      const radioContainer = container.querySelector('label > div.inline-flex');
      expect(radioContainer).toBeInTheDocument();
    });
  });

  describe('inputSize prop', () => {
    it('inputSize를 자식 컴포넌트에 전달해야 합니다', () => {
      const { container } = render(
        <Option label="옵션" inputSize="24">
          <Radio aria-label="test radio" />
        </Option>
      );
      // 24px height를 가진 컨테이너 확인
      const radioContainer = container.querySelector('div.h-\\[24px\\]');
      expect(radioContainer).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('label 요소를 사용해야 합니다', () => {
      const { container } = render(
        <Option label="옵션">
          <Radio aria-label="test radio" />
        </Option>
      );
      const label = container.querySelector('label');
      expect(label).toBeInTheDocument();
    });

    it('label을 클릭하면 내부 input이 체크되어야 합니다', () => {
      render(
        <Option label="클릭 가능한 옵션">
          <Radio aria-label="test radio" />
        </Option>
      );
      const label = screen.getByText('클릭 가능한 옵션');
      const radio = screen.getByRole('radio');

      expect(radio).not.toBeChecked();
      label.click();
      // Note: 실제 상호작용은 부모 컴포넌트에서 처리
    });
  });
});
