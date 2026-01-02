import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OptionGroup } from '../components/OptionGroup';
import { Option } from '../components/Option';
import { Radio } from '../components/Radio';
import { Checkbox } from '../components/Checkbox';

describe('OptionGroup', () => {
  describe('렌더링', () => {
    it('기본 렌더링이 정상적으로 이루어져야 합니다', () => {
      const { container } = render(
        <OptionGroup>
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
          <Option label="옵션2">
            <Radio aria-label="option2" />
          </Option>
        </OptionGroup>
      );
      expect(container.firstChild).toBeInTheDocument();
    });

    it('title을 렌더링해야 합니다', () => {
      render(
        <OptionGroup title="그룹 제목">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const title = screen.getByText('그룹 제목');
      expect(title).toBeInTheDocument();
    });

    it('helperText를 렌더링해야 합니다', () => {
      render(
        <OptionGroup helperText="도움말 텍스트">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const helperText = screen.getByText('도움말 텍스트');
      expect(helperText).toBeInTheDocument();
    });

    it('title 없이도 렌더링되어야 합니다', () => {
      const { container } = render(
        <OptionGroup>
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      expect(container.firstChild).toBeInTheDocument();
    });

    it('helperText 없이도 렌더링되어야 합니다', () => {
      const { container } = render(
        <OptionGroup>
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('스타일', () => {
    it('기본 컨테이너 스타일을 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup>
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const wrapper = container.querySelector('.inline-flex.flex-col.items-start.gap-component-gap-contents-sm');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('sm 사이즈에서 title은 text-form-label-sm-medium 클래스를 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup title="Small Title" size="sm">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const title = container.querySelector('.text-form-label-sm-medium');
      expect(title).toBeInTheDocument();
    });

    it('md 사이즈에서 title은 text-form-label-md-medium 클래스를 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup title="Medium Title" size="md">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const title = container.querySelector('.text-form-label-md-medium');
      expect(title).toBeInTheDocument();
    });

    it('lg 사이즈에서 title은 text-form-label-md-medium 클래스를 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup title="Large Title" size="lg">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const title = container.querySelector('.text-form-label-md-medium');
      expect(title).toBeInTheDocument();
    });

    it('sm 사이즈에서 helperText는 text-form-helper-text-sm-regular 클래스를 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup helperText="Small helper" size="sm">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const helper = container.querySelector('.text-form-helper-text-sm-regular');
      expect(helper).toBeInTheDocument();
    });

    it('md 사이즈에서 helperText는 text-form-helper-text-md-regular 클래스를 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup helperText="Medium helper" size="md">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const helper = container.querySelector('.text-form-helper-text-md-regular');
      expect(helper).toBeInTheDocument();
    });

    it('lg 사이즈에서 helperText는 text-form-helper-text-md-regular 클래스를 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup helperText="Large helper" size="lg">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      const helper = container.querySelector('.text-form-helper-text-md-regular');
      expect(helper).toBeInTheDocument();
    });
  });

  describe('orientation variants', () => {
    it('vertical orientation에서 flex-col gap-layout-inline-lg 클래스를 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup orientation="vertical">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
          <Option label="옵션2">
            <Radio aria-label="option2" />
          </Option>
        </OptionGroup>
      );
      const optionsContainer = container.querySelector('.flex-col.gap-layout-inline-lg');
      expect(optionsContainer).toBeInTheDocument();
    });

    it('horizontal orientation에서 flex-row gap-layout-inline-lg 클래스를 가져야 합니다', () => {
      const { container } = render(
        <OptionGroup orientation="horizontal">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
          <Option label="옵션2">
            <Radio aria-label="option2" />
          </Option>
        </OptionGroup>
      );
      const optionsContainer = container.querySelector('.flex-row.gap-layout-inline-lg');
      expect(optionsContainer).toBeInTheDocument();
    });
  });

  describe('inputSize 전달', () => {
    it('sm 사이즈에서 자식 Option에 inputSize="20"을 전달해야 합니다', () => {
      const { container } = render(
        <OptionGroup size="sm">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      // 20px height를 가진 Radio 컨테이너 확인
      const radioContainer = container.querySelector('div.h-\\[20px\\]');
      expect(radioContainer).toBeInTheDocument();
    });

    it('md 사이즈에서 자식 Option에 inputSize="24"를 전달해야 합니다', () => {
      const { container } = render(
        <OptionGroup size="md">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      // 24px height를 가진 Radio 컨테이너 확인
      const radioContainer = container.querySelector('div.h-\\[24px\\]');
      expect(radioContainer).toBeInTheDocument();
    });

    it('lg 사이즈에서 자식 Option에 inputSize="28"을 전달해야 합니다', () => {
      const { container } = render(
        <OptionGroup size="lg">
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
        </OptionGroup>
      );
      // 28px height를 가진 Radio 컨테이너 확인
      const radioContainer = container.querySelector('div.h-\\[28px\\]');
      expect(radioContainer).toBeInTheDocument();
    });
  });

  describe('여러 Option 렌더링', () => {
    it('여러 Option을 렌더링할 수 있어야 합니다', () => {
      render(
        <OptionGroup>
          <Option label="옵션1">
            <Radio aria-label="option1" />
          </Option>
          <Option label="옵션2">
            <Radio aria-label="option2" />
          </Option>
          <Option label="옵션3">
            <Radio aria-label="option3" />
          </Option>
        </OptionGroup>
      );
      expect(screen.getByText('옵션1')).toBeInTheDocument();
      expect(screen.getByText('옵션2')).toBeInTheDocument();
      expect(screen.getByText('옵션3')).toBeInTheDocument();
    });

    it('Radio와 Checkbox를 혼합하여 사용할 수 있어야 합니다', () => {
      render(
        <OptionGroup>
          <Option label="라디오 옵션">
            <Radio aria-label="radio-option" />
          </Option>
          <Option label="체크박스 옵션">
            <Checkbox aria-label="checkbox-option" />
          </Option>
        </OptionGroup>
      );
      expect(screen.getByRole('radio')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
  });
});
