import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Field } from '../components/Field';

const meta: Meta<typeof Field> = {
  title: 'UI/Field',
  component: Field,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['md', 'sm'],
    },
    multiline: {
      control: { type: 'boolean' },
    },
    rowsVariant: {
      control: { type: 'select' },
      options: ['flexible', 'rows4', 'rows6', 'rows8'],
    },
    error: {
      control: { type: 'boolean' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    readOnly: {
      control: { type: 'boolean' },
    },
    label: {
      control: { type: 'text' },
    },
    helperText: {
      control: { type: 'text' },
    },
    placeholder: {
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Field>;

// Basic Single-line Field (md size)
export const Default: Story = {
  name: '기본 (MD)',
  args: {
    label: '레이블',
    placeholder: '입력하세요',
    size: 'md',
    multiline: false,
  },
};

export const WithHelperText: Story = {
  name: '도움말 텍스트 포함 (MD)',
  args: {
    label: '레이블',
    placeholder: '입력하세요',
    helperText: '도움말 텍스트입니다.',
    size: 'md',
    multiline: false,
  },
};

export const Small: Story = {
  name: '기본 (SM)',
  args: {
    label: '레이블',
    placeholder: '입력하세요',
    size: 'sm',
    multiline: false,
  },
};

export const SmallWithHelperText: Story = {
  name: '도움말 텍스트 포함 (SM)',
  args: {
    label: '레이블',
    placeholder: '입력하세요',
    helperText: '도움말 텍스트입니다.',
    size: 'sm',
    multiline: false,
  },
};

// State Variants (md size)
export const Disabled: Story = {
  name: 'Disabled',
  args: {
    label: '레이블',
    placeholder: '입력하세요',
    helperText: '도움말 텍스트입니다.',
    disabled: true,
    size: 'md',
    multiline: false,
  },
};

export const ReadOnly: Story = {
  name: 'ReadOnly',
  args: {
    label: '레이블',
    defaultValue: '읽기 전용 텍스트',
    helperText: '도움말 텍스트입니다.',
    readOnly: true,
    size: 'md',
    multiline: false,
  },
};

export const Error: Story = {
  name: 'Error',
  args: {
    label: '레이블',
    placeholder: '입력하세요',
    helperText: '오류 메시지입니다.',
    error: true,
    size: 'md',
    multiline: false,
  },
};

// Multiline Variants (md size)
export const MultilineFlexible: Story = {
  name: 'Multiline - Flexible (1줄)',
  args: {
    label: '레이블',
    placeholder: '여러 줄 입력하세요',
    helperText: '도움말 텍스트입니다.',
    multiline: true,
    rowsVariant: 'flexible',
    size: 'md',
  },
};

export const MultilineRows4: Story = {
  name: 'Multiline - 4줄',
  args: {
    label: '레이블',
    placeholder: '여러 줄 입력하세요',
    helperText: '도움말 텍스트입니다.',
    multiline: true,
    rowsVariant: 'rows4',
    size: 'md',
  },
};

export const MultilineRows6: Story = {
  name: 'Multiline - 6줄',
  args: {
    label: '레이블',
    placeholder: '여러 줄 입력하세요',
    helperText: '도움말 텍스트입니다.',
    multiline: true,
    rowsVariant: 'rows6',
    size: 'md',
  },
};

export const MultilineRows8: Story = {
  name: 'Multiline - 8줄',
  args: {
    label: '레이블',
    placeholder: '여러 줄 입력하세요',
    helperText: '도움말 텍스트입니다.',
    multiline: true,
    rowsVariant: 'rows8',
    size: 'md',
  },
};

// Multiline with States
export const MultilineDisabled: Story = {
  name: 'Multiline - Disabled',
  args: {
    label: '레이블',
    placeholder: '여러 줄 입력하세요',
    helperText: '도움말 텍스트입니다.',
    multiline: true,
    rowsVariant: 'rows4',
    disabled: true,
    size: 'md',
  },
};

export const MultilineReadOnly: Story = {
  name: 'Multiline - ReadOnly',
  args: {
    label: '레이블',
    defaultValue: '읽기 전용 텍스트\n여러 줄 포함',
    helperText: '도움말 텍스트입니다.',
    multiline: true,
    rowsVariant: 'rows4',
    readOnly: true,
    size: 'md',
  },
};

export const MultilineError: Story = {
  name: 'Multiline - Error',
  args: {
    label: '레이블',
    placeholder: '여러 줄 입력하세요',
    helperText: '오류 메시지입니다.',
    multiline: true,
    rowsVariant: 'rows4',
    error: true,
    size: 'md',
  },
};

// Interactive Demo
export const Interactive: Story = {
  name: 'Interactive Demo',
  render: (args) => {
    const [value, setValue] = React.useState('');
    return (
      <Field
        {...args}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        helperText={`입력된 글자 수: ${value.length}자`}
      />
    );
  },
  args: {
    label: '레이블',
    placeholder: '입력하세요',
    size: 'md',
    multiline: false,
  },
};
