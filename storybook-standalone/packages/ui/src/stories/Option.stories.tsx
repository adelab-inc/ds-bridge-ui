import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { Option } from '../components/Option';
import { Radio } from '../components/Radio';
import { Checkbox } from '../components/Checkbox';
import { Interaction, Mode, CheckboxValue, RadioValue } from '../types';

// Radio용 확장 타입
interface RadioStoryArgs {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  mode?: 'base' | 'compact';
  checked?: boolean;
  disabled?: boolean;
}

// Checkbox용 확장 타입
interface CheckboxStoryArgs {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  mode?: 'base' | 'compact';
  value?: CheckboxValue;
  disabled?: boolean;
}

const meta: Meta<typeof Option> = {
  title: 'UI/Option',
  component: Option,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 비고 |',
          '|---|---|---|',
          '| `Size` (sm/md/lg) | `size` | 라벨 텍스트 크기 + 컨트롤 높이 결정 |',
          '| `Disabled` (True/False) | `disabled` | 라벨 텍스트 `text-disabled` + cursor 변경 |',
          '| `Value` | _(children)_ | 자식 Checkbox/Radio가 관리 |',
          '| — | `mode` | 코드 전용. SpacingModeProvider |',
          '',
          '## V1 → V2 변경 사항',
          '',
          '| V1 | V2 | 변경 내용 |',
          '|---|---|---|',
          '| `inputSize` (16~28 픽셀) | `size` (sm/md/lg) | 시맨틱 사이즈로 변경 |',
          '| _(disabled 미지원)_ | `disabled` | 라벨 텍스트 disabled 색상 + cursor 변경 |',
          '',
          '**Note**: 자식 Radio/Checkbox는 V2 props를 사용합니다 (value, interaction).',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Option 레이블 텍스트',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Figma: Size — 라벨 텍스트 크기 + 컨트롤 높이',
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(Mode),
      description: 'SpacingMode: base/compact',
    },
    disabled: {
      control: 'boolean',
      description: 'Figma: Disabled — 비활성 상태 (라벨 + 컨트롤)',
    },
  },
};

export default meta;

export const WithRadio: StoryObj<RadioStoryArgs> = {
  render: (args) => {
    const { label, size, mode = 'base', checked = false, disabled = false } = args;
    const [value, setValue] = React.useState<RadioValue>(checked ? RadioValue.CHECKED : RadioValue.UNCHECKED);

    React.useEffect(() => {
      setValue(checked ? RadioValue.CHECKED : RadioValue.UNCHECKED);
    }, [checked]);

    // Storybook 전용: Radio는 브라우저 기본동작으로 unchecked 전환이 안 되므로 토글 핸들러 필요
    // Option의 <label>이 native input click을 발생시키므로 preventDefault로 이중 발생 방지
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      setValue(prev => prev === RadioValue.UNCHECKED ? RadioValue.CHECKED : RadioValue.UNCHECKED);
    };

    return (
      <div className="flex items-center min-h-[40px] w-[300px]">
        <div onClick={handleClick} className="contents">
          <Option label={label} size={size} mode={mode} disabled={disabled}>
            <Radio
              value={value}
              interaction={disabled ? Interaction.DISABLED : Interaction.DEFAULT}
              onChange={() => {}}
              aria-label="radio option"
            />
          </Option>
        </div>
      </div>
    );
  },
  args: {
    label: '라디오 옵션',
    size: 'md',
    mode: Mode.BASE,
    checked: false,
    disabled: false,
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Option 레이블 텍스트',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Figma: Size — 라벨 텍스트 크기 + 컨트롤 높이',
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(Mode),
      description: 'SpacingMode: base/compact',
    },
    checked: {
      control: 'boolean',
      description: '체크 상태 (Storybook 편의 제공)',
    },
    disabled: {
      control: 'boolean',
      description: 'Figma: Disabled — 비활성화 상태',
    },
  },
};

export const WithCheckbox: StoryObj<CheckboxStoryArgs> = {
  render: (args) => {
    const { label, size, mode = 'base', value = CheckboxValue.UNCHECKED, disabled = false } = args;
    const [checkboxValue, setCheckboxValue] = React.useState<CheckboxValue>(value);

    React.useEffect(() => {
      setCheckboxValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      setCheckboxValue(e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED);
    };

    return (
      <div className="flex items-center min-h-[40px] w-[300px]">
        <Option label={label} size={size} mode={mode} disabled={disabled}>
          <Checkbox
            value={checkboxValue}
            interaction={disabled ? Interaction.DISABLED : Interaction.DEFAULT}
            onChange={handleChange}
            aria-label="checkbox option"
          />
        </Option>
      </div>
    );
  },
  args: {
    label: '체크박스 옵션',
    size: 'md',
    mode: Mode.BASE,
    value: CheckboxValue.UNCHECKED,
    disabled: false,
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Option 레이블 텍스트',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Figma: Size — 라벨 텍스트 크기 + 컨트롤 높이',
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(Mode),
      description: 'SpacingMode: base/compact',
    },
    value: {
      control: 'select',
      options: ['unchecked', 'checked', 'indeterminate'],
      description: 'Checkbox value (V2)',
    },
    disabled: {
      control: 'boolean',
      description: 'Figma: Disabled — 비활성화 상태',
    },
  },
};
