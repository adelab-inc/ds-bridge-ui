import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { Option } from '../components/Option';
import { Radio } from '../components/Radio';
import { Checkbox } from '../components/Checkbox';

// Radio용 확장 타입
interface RadioStoryArgs {
  label: string;
  inputSize?: '16' | '18' | '20' | '24' | '28';
  checked?: boolean;
  disabled?: boolean;
}

// Checkbox용 확장 타입
interface CheckboxStoryArgs {
  label: string;
  inputSize?: '16' | '18' | '20' | '24' | '28';
  checked?: boolean;
  disabled?: boolean;
  variant?: 'checked' | 'indeterminate';
}

const meta: Meta<typeof Option> = {
  title: 'UI/Option',
  component: Option,
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Option 레이블 텍스트',
    },
    inputSize: {
      control: 'select',
      options: ['16', '18', '20', '24', '28'],
      description: 'Radio/Checkbox 크기',
    },
  },
};

export default meta;

export const WithRadio: StoryObj<RadioStoryArgs> = {
  render: (args) => {
    const { label, inputSize, checked = false, disabled = false } = args;
    const [checkedState, setCheckedState] = React.useState(checked);

    React.useEffect(() => {
      setCheckedState(checked);
    }, [checked]);

    return (
      <Option label={label} inputSize={inputSize}>
        <Radio
          checked={checkedState}
          disabled={disabled}
          onChange={(e) => !disabled && setCheckedState(e.target.checked)}
          aria-label="radio option"
        />
      </Option>
    );
  },
  args: {
    label: '라디오 옵션',
    inputSize: '18',
    checked: false,
    disabled: false,
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Option 레이블 텍스트',
    },
    inputSize: {
      control: 'select',
      options: ['16', '18', '20', '24', '28'],
      description: 'Radio/Checkbox 크기',
    },
    checked: {
      control: 'boolean',
      description: '체크 상태',
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태',
    },
  },
};

export const WithCheckbox: StoryObj<CheckboxStoryArgs> = {
  render: (args) => {
    const { label, inputSize, checked = false, disabled = false, variant = 'checked' } = args;
    const [checkedState, setCheckedState] = React.useState(checked);

    React.useEffect(() => {
      setCheckedState(checked);
    }, [checked]);

    return (
      <Option label={label} inputSize={inputSize}>
        <Checkbox
          checked={checkedState}
          disabled={disabled}
          variant={variant}
          onChange={(e) => !disabled && setCheckedState(e.target.checked)}
          aria-label="checkbox option"
        />
      </Option>
    );
  },
  args: {
    label: '체크박스 옵션',
    inputSize: '18',
    checked: false,
    disabled: false,
    variant: 'checked',
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Option 레이블 텍스트',
    },
    inputSize: {
      control: 'select',
      options: ['16', '18', '20', '24', '28'],
      description: 'Radio/Checkbox 크기',
    },
    checked: {
      control: 'boolean',
      description: '체크 상태',
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태',
    },
    variant: {
      control: 'select',
      options: ['checked', 'indeterminate'],
      description: '체크박스 variant',
    },
  },
};
