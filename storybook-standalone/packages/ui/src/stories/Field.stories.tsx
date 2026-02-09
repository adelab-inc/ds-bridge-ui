import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Field } from '../components/Field';
import { Icon } from '../components/Icon';

// Icon/Prefix 옵션 매핑
const iconOptions = {
  none: undefined,
  search: <Icon name="search" className="w-full h-full" />,
  close: <Icon name="close" className="w-full h-full" />,
};

const prefixOptions = {
  none: undefined,
  'https://': 'https://',
  '$': '$',
  '@': '@',
  '+82': '+82',
};

const meta: Meta<typeof Field> = {
  title: 'UI/Field',
  component: Field,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['md', 'sm'],
      description: 'Field 크기',
    },
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    multiline: {
      control: { type: 'boolean' },
      description: '여러 줄 입력 모드 (textarea)',
    },
    rowsVariant: {
      control: { type: 'select' },
      options: ['flexible', 'rows4', 'rows6', 'rows8'],
      description: 'Multiline 모드에서 행 수',
      if: { arg: 'multiline', eq: true },
    },
    required: {
      control: { type: 'boolean' },
      description: '필수 입력 표시 (asterisk *)',
    },
    error: {
      control: { type: 'boolean' },
      description: '에러 상태',
    },
    disabled: {
      control: { type: 'boolean' },
      description: '비활성화 상태',
    },
    readOnly: {
      control: { type: 'boolean' },
      description: '읽기 전용 상태',
    },
    label: {
      control: { type: 'text' },
      description: '레이블 텍스트',
    },
    helperText: {
      control: { type: 'text' },
      description: '도움말 텍스트',
    },
    placeholder: {
      control: { type: 'text' },
      description: '플레이스홀더 텍스트',
    },
    prefix: {
      control: { type: 'select' },
      options: Object.keys(prefixOptions),
      mapping: prefixOptions,
      description: 'Input 내부 prefix 텍스트 (multiline에서는 미지원)',
      if: { arg: 'multiline', eq: false },
    },
    startIcon: {
      control: { type: 'select' },
      options: Object.keys(iconOptions),
      mapping: iconOptions,
      description: 'Input 시작 아이콘 (multiline에서는 미지원)',
      if: { arg: 'multiline', eq: false },
    },
    endIcon: {
      control: { type: 'select' },
      options: Object.keys(iconOptions),
      mapping: iconOptions,
      description: 'Input 끝 아이콘 (multiline에서는 미지원)',
      if: { arg: 'multiline', eq: false },
    },
    onStartIconClick: {
      action: 'startIconClicked',
      description: 'Start 아이콘 클릭 핸들러',
      if: { arg: 'multiline', eq: false },
    },
    onEndIconClick: {
      action: 'endIconClicked',
      description: 'End 아이콘 클릭 핸들러',
      if: { arg: 'multiline', eq: false },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Field>;

// 기본 Field
export const Default: Story = {
  name: '기본',
  args: {
    label: '레이블',
    placeholder: '입력하세요',
    helperText: '도움말 텍스트입니다.',
    size: 'md',
    mode: 'base',
    multiline: false,
    rowsVariant: 'flexible',
    required: false,
    disabled: false,
    readOnly: false,
    error: false,
    prefix: 'none',
    startIcon: 'none',
    endIcon: 'none',
  },
};

// Multiline Field
export const Multiline: Story = {
  name: 'Multiline (Textarea)',
  args: {
    label: '설명',
    placeholder: '여러 줄 입력하세요',
    helperText: '최대 500자까지 입력 가능합니다.',
    multiline: true,
    rowsVariant: 'rows4',
    size: 'md',
    mode: 'base',
    required: false,
    disabled: false,
    readOnly: false,
    error: false,
  },
};

// Flexible Auto-grow Multiline
export const FlexibleMultiline: Story = {
  name: 'Flexible (Auto-grow)',
  args: {
    label: '메모',
    placeholder: '입력하면 자동으로 높이가 늘어납니다',
    helperText: '내용에 따라 자동으로 확장됩니다.',
    multiline: true,
    rowsVariant: 'flexible',
    size: 'md',
    mode: 'base',
    required: false,
    disabled: false,
    readOnly: false,
    error: false,
  },
};

// Interactive Demo - Clearable Search
export const InteractiveSearch: Story = {
  name: 'Interactive - 검색 (Clear 버튼)',
  render: (args) => {
    const [value, setValue] = React.useState('');
    const handleClear = () => setValue('');
    return (
      <Field
        {...args}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        startIcon={<Icon name="search" className="w-full h-full" />}
        endIcon={value ? <Icon name="close" className="w-full h-full" /> : undefined}
        onEndIconClick={handleClear}
        helperText={`입력된 글자 수: ${value.length}자`}
      />
    );
  },
  args: {
    label: '검색',
    placeholder: '검색어를 입력하세요',
    size: 'md',
  },
};

// Icon Color Customization via startIconProps
export const CustomIconColor: Story = {
  name: 'Custom Icon Color (startIconProps)',
  render: () => (
    <div className="flex flex-col gap-4">
      <Field
        label="기본 아이콘"
        placeholder="기본 색상"
        startIcon={<Icon name="search" className="w-full h-full" />}
        helperText="기본 아이콘 색상 (text-icon-interactive-default)"
      />
      <Field
        label="노란색 아이콘"
        placeholder="startIconProps로 색상 변경"
        startIcon={<Icon name="search" className="w-full h-full" />}
        startIconProps={{ className: 'text-yellow-500' }}
        helperText="startIconProps={{ className: 'text-yellow-500' }}"
      />
      <Field
        label="연한 파란색 아이콘"
        placeholder="startIconProps로 색상 변경"
        startIcon={<Icon name="search" className="w-full h-full" />}
        startIconProps={{ className: 'text-blue-200' }}
        helperText="startIconProps={{ className: 'text-blue-200' }}"
      />
      <Field
        label="양쪽 아이콘 색상 다르게"
        placeholder="start: 노랑, end: 연한 파랑"
        startIcon={<Icon name="search" className="w-full h-full" />}
        endIcon={<Icon name="close" className="w-full h-full" />}
        startIconProps={{ className: 'text-yellow-500' }}
        endIconProps={{ className: 'text-blue-200' }}
        helperText="startIconProps와 endIconProps 각각 다른 색상 적용"
      />
    </div>
  ),
};
