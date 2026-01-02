import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';

const iconMap = {
  none: null,
  'alert-info': <Icon name="alert-info" />,
  'alert-success': <Icon name="alert-success" />,
  'alert-warning': <Icon name="alert-warning" />,
  'alert-error': <Icon name="alert-error" />,
  'search': <Icon name="search" />,
  'dehaze': <Icon name="dehaze" />,
  'list-alt': <Icon name="list-alt" />,
};

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'info', 'success', 'warning', 'error'],
    },
    isToast: {
      control: { type: 'boolean' },
    },
    hasCloseButton: {
      control: { type: 'boolean' },
    },
    title: {
      control: { type: 'text' },
    },
    children: {
      control: { type: 'text' },
    },
    icon: {
      options: Object.keys(iconMap),
      mapping: iconMap,
      control: { type: 'select' },
    },
    onClose: { action: 'closed', table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

// 1줄 레이아웃 (제목 없음)
export const OneLine: Story = {
  name: '1줄 - 기본',
  args: {
    variant: 'default',
    children: '이것은 기본 알림 메시지입니다.',
    icon: 'none',
    isToast: false,
  },
};

export const OneLineWithIcon: Story = {
  name: '1줄 - 아이콘 있음',
  args: {
    variant: 'default',
    children: '이것은 아이콘이 있는 알림 메시지입니다.',
    icon: 'alert-info',
    isToast: false,
  },
};

export const OneLineWithClose: Story = {
  name: '1줄 - 닫기 버튼',
  args: {
    variant: 'default',
    children: '이것은 닫기 버튼이 있는 알림 메시지입니다.',
    icon: 'none',
    onClose: () => console.log('Alert closed'),
    isToast: false,
  },
};

export const OneLineWithActions: Story = {
  name: '1줄 - 액션 버튼',
  args: {
    variant: 'default',
    children: '이것은 액션 버튼이 있는 알림 메시지입니다.',
    icon: 'none',
    actions: [
      { label: '실행', onClick: () => console.log('Action 1') },
      { label: '실행취소', onClick: () => console.log('Action 2') },
    ],
    isToast: false,
  },
};

// 2줄 레이아웃 (제목 있음)
export const TwoLines: Story = {
  name: '2줄 - 기본',
  args: {
    variant: 'default',
    title: '알림 제목',
    children: '이것은 제목이 있는 알림 메시지입니다. 본문 내용이 여기에 표시됩니다.',
    icon: 'none',
    isToast: false,
  },
};

export const TwoLinesWithIcon: Story = {
  name: '2줄 - 아이콘 있음',
  args: {
    variant: 'default',
    title: '알림 제목',
    children: '이것은 아이콘과 제목이 있는 알림 메시지입니다.',
    icon: 'alert-info',
    isToast: false,
  },
};

export const TwoLinesComplete: Story = {
  name: '2줄 - 전체 구성',
  args: {
    variant: 'default',
    title: '알림 제목',
    children: '이것은 모든 요소가 포함된 알림 메시지입니다.',
    icon: 'alert-info',
    actions: [
      { label: '확인', onClick: () => console.log('Confirm') },
      { label: '취소', onClick: () => console.log('Cancel') },
    ],
    onClose: () => console.log('Alert closed'),
    isToast: false,
  },
};

// State Variants
export const Info: Story = {
  name: 'Info',
  args: {
    variant: 'info',
    title: '정보 알림',
    children: '이것은 정보성 알림 메시지입니다.',
    onClose: () => console.log('Info closed'),
    isToast: false,
  },
};

export const Success: Story = {
  name: 'Success',
  args: {
    variant: 'success',
    title: '성공',
    children: '작업이 성공적으로 완료되었습니다.',
    onClose: () => console.log('Success closed'),
    isToast: false,
  },
};

export const Warning: Story = {
  name: 'Warning',
  args: {
    variant: 'warning',
    title: '경고',
    children: '이 작업을 수행하기 전에 주의가 필요합니다.',
    onClose: () => console.log('Warning closed'),
    isToast: false,
  },
};

export const Error: Story = {
  name: 'Error',
  args: {
    variant: 'error',
    title: '오류',
    children: '오류가 발생했습니다. 다시 시도해주세요.',
    onClose: () => console.log('Error closed'),
    isToast: false,
  },
};

// Toast 버전
export const ToastInfo: Story = {
  name: 'Toast - Info',
  args: {
    variant: 'info',
    children: '정보 알림입니다.',
    hasCloseButton: true,
    onClose: () => console.log('Toast closed'),
    isToast: true,
  },
};

export const ToastSuccess: Story = {
  name: 'Toast - Success',
  args: {
    variant: 'success',
    children: '성공적으로 저장되었습니다.',
    hasCloseButton: true,
    onClose: () => console.log('Toast closed'),
    isToast: true,
  },
};

export const ToastWarning: Story = {
  name: 'Toast - Warning',
  args: {
    variant: 'warning',
    children: '주의가 필요합니다.',
    hasCloseButton: true,
    onClose: () => console.log('Toast closed'),
    isToast: true,
  },
};

export const ToastError: Story = {
  name: 'Toast - Error',
  args: {
    variant: 'error',
    children: '오류가 발생했습니다.',
    hasCloseButton: true,
    onClose: () => console.log('Toast closed'),
    isToast: true,
  },
};
