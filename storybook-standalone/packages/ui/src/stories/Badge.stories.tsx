import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Badge, type BadgeProps } from '../components/Badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['level', 'status', 'count', 'dot'],
      description: '배지의 타입을 선택합니다.',
    },
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    levelVariant: {
      control: { type: 'select' },
      options: ['primary', 'neutral'],
      description: 'level 타입의 세부 종류',
      if: { arg: 'type', eq: 'level' },
    },
    statusVariant: {
      control: { type: 'select' },
      options: ['info', 'success', 'warning', 'error'],
      description: 'status 타입의 세부 종류',
      if: { arg: 'type', eq: 'status' },
    },
    appearance: {
      control: { type: 'select' },
      options: ['solid', 'subtle'],
      description: '배지의 스타일 (solid: 채워진 배경, subtle: 연한 배경)',
      if: { arg: 'type', neq: 'dot' },
    },
    children: {
      control: { type: 'text' },
      description: '배지 내부에 표시될 내용입니다.',
    },
    maxDigits: {
      control: { type: 'number' },
      description: 'type이 count일 때, 최대 자릿수를 지정합니다.',
      if: { arg: 'type', eq: 'count' },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: 'level',
    levelVariant: 'primary',
    statusVariant: 'info',
    mode: 'base',
    appearance: 'solid',
    children: 'Badge',
  } as unknown as BadgeProps,
};
