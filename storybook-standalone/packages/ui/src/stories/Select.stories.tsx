import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Select } from '../components/Select';
import { Icon } from '../components/Icon';

// Icon 옵션 매핑
const iconOptions = {
  none: undefined,
  search: <Icon name="search" className="w-full h-full" />,
  person: <Icon name="person" className="w-full h-full" />,
  menu: <Icon name="menu" className="w-full h-full" />,
  close: <Icon name="close" className="w-full h-full" />,
};

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[240px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    size: {
      control: 'select',
      options: ['md', 'sm'],
      description: 'Select의 크기를 선택합니다.',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    required: {
      control: 'boolean',
      description: '필수 입력 표시 (asterisk *)',
    },
    error: {
      control: 'boolean',
      description: '에러 상태를 설정합니다.',
    },
    disabled: {
      control: 'boolean',
      description: 'Select를 비활성화합니다.',
    },
    label: {
      control: 'text',
      description: 'Select의 라벨을 설정합니다.',
    },
    helperText: {
      control: 'text',
      description: 'Select의 도움말 텍스트를 설정합니다.',
    },
    placeholder: {
      control: 'text',
      description: 'Select의 placeholder 텍스트를 설정합니다.',
    },
    startIcon: {
      control: { type: 'select' },
      options: Object.keys(iconOptions),
      mapping: iconOptions,
      description: 'Select 시작 아이콘',
    },
    endIcon: {
      control: { type: 'select' },
      options: Object.keys(iconOptions),
      mapping: iconOptions,
      description: 'Select 끝 아이콘 (기본값: chevron-down)',
    },
    options: { table: { disable: true } },
    value: { table: { disable: true } },
    defaultValue: { table: { disable: true } },
    onChange: { table: { disable: true } },
    onStartIconClick: { table: { disable: true } },
    onEndIconClick: { table: { disable: true } },
    id: { table: { disable: true } },
    labelProps: { table: { disable: true } },
    helperTextProps: { table: { disable: true } },
    selectProps: { table: { disable: true } },
    startIconProps: { table: { disable: true } },
    endIconProps: { table: { disable: true } },
    hasValue: { table: { disable: true } },
  },
  args: {
    id: 'select-story',
    size: 'md',
    mode: 'base',
    required: false,
    error: false,
    disabled: false,
    label: '선택 항목',
    helperText: '항목을 선택해주세요',
    placeholder: '선택하세요',
    startIcon: 'none',
    endIcon: 'none',
    options: [
      { value: 'option1', label: '옵션 1' },
      { value: 'option2', label: '옵션 2' },
      { value: 'option3', label: '옵션 3' },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
