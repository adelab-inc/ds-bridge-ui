import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Badge } from '../components/Badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['level', 'status', 'count', 'dot'],
      description: '배지의 타입을 선택합니다.',
    },
    levelVariant: {
      control: 'select',
      options: ['announcement'],
      if: { arg: 'type', eq: 'level' },
    },
    statusVariant: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
      if: { arg: 'type', eq: 'status' },
    },
    variant: {
      control: 'select',
      options: [
        'announcement-solid',
        'announcement-subtle',
        'info-solid',
        'info-subtle',
        'success-solid',
        'success-subtle',
        'warning-solid',
        'warning-subtle',
        'error-solid',
        'error-subtle',
        'solid',
        'subtle',
      ],
      description: '배지의 세부 종류를 선택합니다.',
    },
    children: {
      control: 'number',
      description: '배지 내부에 표시될 내용입니다.',
    },
    maxDigits: {
      control: 'number',
      description: 'type이 count일 때, 최대 자릿수를 지정합니다.',
    },
  },
  args: {
    children: 'Badge',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const LevelSolid: Story = {
  args: {
    type: 'level',
    levelVariant: 'announcement',
    variant: 'announcement-solid',
    children: 'Level Solid',
  },
};

export const LevelSubtle: Story = {
  args: {
    type: 'level',
    levelVariant: 'announcement',
    variant: 'announcement-subtle',
    children: 'Level Subtle',
  },
};

export const StatusInfo: Story = {
  args: {
    type: 'status',
    statusVariant: 'info',
    variant: 'info-solid',
    children: 'Info',
  },
};

export const StatusSuccess: Story = {
  args: {
    type: 'status',
    statusVariant: 'success',
    variant: 'success-solid',
    children: 'Success',
  },
};

export const StatusWarning: Story = {
  args: {
    type: 'status',
    statusVariant: 'warning',
    variant: 'warning-solid',
    children: 'Warning',
  },
};

export const StatusError: Story = {
  args: {
    type: 'status',
    statusVariant: 'error',
    variant: 'error-solid',
    children: 'Error',
  },
};

export const Count: Story = {
  args: {
    type: 'count',
    children: 1,
  },
};

export const CountWithMaxDigits: Story = {
  args: {
    type: 'count',
    children: 100,
    maxDigits: 2,
  },
};

export const Dot: Story = {
  args: {
    type: 'dot',
    children: '',
  },
};
