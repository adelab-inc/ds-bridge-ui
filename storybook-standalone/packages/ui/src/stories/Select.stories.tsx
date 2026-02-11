import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Select } from '../components/Select';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';

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

// 복합 옵션 (다양한 옵션 조합)
export const WithComplexOptions: Story = {
  name: '복합 옵션',
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
  args: {
    label: '메뉴 항목',
    helperText: '다양한 옵션 스타일을 확인하세요',
    options: [
      // 텍스트만 있는 경우
      { value: 'text-only', label: '텍스트만' },
      // 긴 텍스트 (말줄임표 + 툴팁 테스트)
      { value: 'long-text', label: '이것은 매우 긴 텍스트로 말줄임표가 나타나야 합니다' },
      // right Icon만 있는 경우
      { value: 'right-icon', label: '선택됨', rightIcon: <Icon name="menu-selection" size={16} /> },
      // left icon + 텍스트
      { value: 'left-icon', label: '검색', leftIcon: <Icon name="search" size={14} /> },
      // left icon + 텍스트 + 뱃지
      {
        value: 'with-badge',
        label: '알림',
        leftIcon: <Icon name="alert-info" size={14} />,
        badge: <Badge type="status" statusVariant="info">NEW</Badge>,
      },
      // left icon + 텍스트 + 뱃지 + right icon
      {
        value: 'full-option',
        label: '프리미엄',
        leftIcon: <Icon name="widgets" size={14} />,
        badge: <Badge type="status" statusVariant="success">추천</Badge>,
        rightIcon: <Icon name="menu-selection" size={16} />,
      },
      // 긴 텍스트 + 아이콘 + 뱃지 조합
      {
        value: 'long-with-icons',
        label: '이것은 아이콘과 뱃지가 함께 있는 매우 긴 텍스트입니다',
        leftIcon: <Icon name="person" size={14} />,
        badge: <Badge type="status" statusVariant="warning">긴뱃지텍스트</Badge>,
        rightIcon: <Icon name="menu-selection" size={16} />,
      },
      // destructive item
      { value: 'delete', label: '삭제', leftIcon: <Icon name="close" size={14} />, destructive: true },
      // disabled item
      { value: 'disabled', label: '비활성화됨', leftIcon: <Icon name="more-vert" size={14} />, disabled: true },
    ],
  },
};
