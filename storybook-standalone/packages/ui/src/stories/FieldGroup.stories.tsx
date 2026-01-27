import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { FieldGroup } from '../components/FieldGroup';
import { Field } from '../components/Field';
import { Select } from '../components/Select';

const phoneOptions = [
  { value: '010', label: '010' },
  { value: '011', label: '011' },
  { value: '016', label: '016' },
  { value: '017', label: '017' },
  { value: '018', label: '018' },
  { value: '019', label: '019' },
];

const meta: Meta<typeof FieldGroup> = {
  title: 'UI/FieldGroup',
  component: FieldGroup,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['md', 'sm'],
      description: 'FieldGroup 크기 (label, helperText에 적용)',
    },
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    required: {
      control: { type: 'boolean' },
      description: '필수 입력 표시 (asterisk *)',
    },
    label: {
      control: { type: 'text' },
      description: '그룹 레이블 텍스트',
    },
    helperText: {
      control: { type: 'text' },
      description: '도움말 텍스트',
    },
    autoFocusNext: {
      control: { type: 'boolean' },
      description: 'maxLength 입력 완료 시 다음 필드로 자동 포커스 이동',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FieldGroup>;

// 기본 FieldGroup - 휴대폰 번호
export const Default: Story = {
  name: '기본 - 휴대폰 번호',
  args: {
    label: '휴대폰 번호',
    helperText: '연락 가능한 번호를 입력하세요.',
    size: 'md',
    mode: 'base',
    required: false,
  },
  render: (args) => (
    <FieldGroup {...args}>
      <Select options={phoneOptions} placeholder="선택" className="w-[100px]" size={args.size} />
      <Field placeholder="0000" className="flex-1" size={args.size} />
      <Field placeholder="0000" className="flex-1" size={args.size} />
    </FieldGroup>
  ),
};

// autoFocusNext - maxLength 입력 완료 시 다음 필드로 자동 포커스 이동
export const AutoFocusNext: Story = {
  name: 'Auto Focus Next - 자동 포커스 이동',
  args: {
    label: '휴대폰 번호',
    helperText: '각 필드 입력 완료 시 다음 필드로 자동 이동합니다.',
    size: 'md',
    mode: 'base',
    required: false,
    autoFocusNext: true,
  },
  render: (args) => (
    <FieldGroup {...args}>
      <Field placeholder="010" maxLength={3} className="w-[80px]" size={args.size} />
      <Field placeholder="0000" maxLength={4} className="flex-1" size={args.size} />
      <Field placeholder="0000" maxLength={4} className="flex-1" size={args.size} />
    </FieldGroup>
  ),
};
