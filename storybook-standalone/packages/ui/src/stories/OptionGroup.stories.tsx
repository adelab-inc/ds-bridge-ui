import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { OptionGroup } from '../components/OptionGroup';
import { Option } from '../components/Option';
import { Radio } from '../components/Radio';
import { Checkbox } from '../components/Checkbox';

// Radio용 확장 타입
interface RadioGroupStoryArgs {
  title?: string;
  required?: boolean;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
}

// Checkbox용 확장 타입
interface CheckboxGroupStoryArgs {
  title?: string;
  required?: boolean;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
}

const meta: Meta<typeof OptionGroup> = {
  title: 'UI/OptionGroup',
  component: OptionGroup,
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: '그룹 제목',
    },
    required: {
      control: 'boolean',
      description: '필수 입력 표시 (asterisk *)',
    },
    helperText: {
      control: 'text',
      description: '도움말 텍스트',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: '그룹 크기 (Radio/Checkbox 크기에 영향)',
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Option 배치 방향',
    },
    groupType: {
      table: {
        disable: true,
      },
    },
  },
};

export default meta;

export const WithRadio: StoryObj<RadioGroupStoryArgs> = {
  render: (args) => {
    const { title, required = false, helperText, size = 'md', orientation = 'vertical', disabled = false } = args;
    const [selected, setSelected] = React.useState('option1');

    return (
      <OptionGroup title={title} required={required} helperText={helperText} size={size} orientation={orientation} groupType="radio">
        <Option label="옵션 1">
          <Radio
            checked={selected === 'option1'}
            disabled={disabled}
            onChange={() => !disabled && setSelected('option1')}
            aria-label="option 1"
          />
        </Option>
        <Option label="옵션 2">
          <Radio
            checked={selected === 'option2'}
            disabled={disabled}
            onChange={() => !disabled && setSelected('option2')}
            aria-label="option 2"
          />
        </Option>
        <Option label="옵션 3">
          <Radio
            checked={selected === 'option3'}
            disabled={disabled}
            onChange={() => !disabled && setSelected('option3')}
            aria-label="option 3"
          />
        </Option>
      </OptionGroup>
    );
  },
  args: {
    title: '라디오 그룹',
    required: false,
    helperText: '하나의 옵션을 선택하세요',
    size: 'md',
    orientation: 'vertical',
    disabled: false,
  },
  argTypes: {
    title: {
      control: 'text',
      description: '그룹 제목',
    },
    required: {
      control: 'boolean',
      description: '필수 입력 표시 (asterisk *)',
    },
    helperText: {
      control: 'text',
      description: '도움말 텍스트',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: '그룹 크기 (Radio/Checkbox 크기에 영향)',
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Option 배치 방향',
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태',
    },
  },
};

export const WithCheckbox: StoryObj<CheckboxGroupStoryArgs> = {
  render: (args) => {
    const { title, required = false, helperText, size = 'md', orientation = 'vertical', disabled = false } = args;
    const [checked1, setChecked1] = React.useState(false);
    const [checked2, setChecked2] = React.useState(false);
    const [checked3, setChecked3] = React.useState(false);

    return (
      <OptionGroup title={title} required={required} helperText={helperText} size={size} orientation={orientation} groupType="checkbox">
        <Option label="옵션 1">
          <Checkbox
            checked={checked1}
            disabled={disabled}
            onChange={(e) => !disabled && setChecked1(e.target.checked)}
            aria-label="checkbox 1"
          />
        </Option>
        <Option label="옵션 2">
          <Checkbox
            checked={checked2}
            disabled={disabled}
            onChange={(e) => !disabled && setChecked2(e.target.checked)}
            aria-label="checkbox 2"
          />
        </Option>
        <Option label="옵션 3">
          <Checkbox
            checked={checked3}
            disabled={disabled}
            onChange={(e) => !disabled && setChecked3(e.target.checked)}
            aria-label="checkbox 3"
          />
        </Option>
      </OptionGroup>
    );
  },
  args: {
    title: '체크박스 그룹',
    required: false,
    helperText: '여러 옵션을 선택할 수 있습니다',
    size: 'md',
    orientation: 'vertical',
    disabled: false,
  },
  argTypes: {
    title: {
      control: 'text',
      description: '그룹 제목',
    },
    required: {
      control: 'boolean',
      description: '필수 입력 표시 (asterisk *)',
    },
    helperText: {
      control: 'text',
      description: '도움말 텍스트',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: '그룹 크기 (Radio/Checkbox 크기에 영향)',
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Option 배치 방향',
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태',
    },
  },
};
