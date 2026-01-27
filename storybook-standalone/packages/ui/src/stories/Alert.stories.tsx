import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';

const iconMap = {
  none: null,
  'alert-info': <Icon name="alert-info" size={20} />,
  'alert-success': <Icon name="alert-success" size={20} />,
  'alert-warning': <Icon name="alert-warning" size={20} />,
  'alert-error': <Icon name="alert-error" size={20} />,
  'search': <Icon name="search" size={20} />,
  'dehaze': <Icon name="dehaze" size={20} />,
  'list-alt': <Icon name="list-alt" size={20} />,
};

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'info', 'success', 'warning', 'error'],
      description: '알림 유형을 선택합니다',
    },
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    isToast: {
      control: { type: 'boolean' },
      description: 'Toast 모드 (고정 너비 360px + 그림자)',
    },
    hasCloseButton: {
      control: { type: 'boolean' },
      description: '닫기 버튼 표시 여부',
    },
    hasActions: {
      control: { type: 'boolean' },
      description: '액션 버튼 표시 (실행/실행취소)',
    },
    title: {
      control: { type: 'text' },
      description: '알림 제목 (있으면 2줄 레이아웃)',
    },
    children: {
      control: { type: 'text' },
      description: '알림 본문 내용',
    },
    icon: {
      options: Object.keys(iconMap),
      mapping: iconMap,
      control: { type: 'select' },
      description: '커스텀 아이콘 (variant 아이콘 대신 표시)',
    },
    actions: {
      table: { disable: true },
    },
    onClose: { action: 'closed', table: { disable: true } },
  } as any,
};

export default meta;
type Story = StoryObj<typeof Alert>;

type AlertStoryArgs = React.ComponentProps<typeof Alert> & {
  hasActions?: boolean;
};

// 단일 통합 스토리 - Controls에서 모든 옵션 제어 가능
export const Default: StoryObj<AlertStoryArgs> = {
  args: {
    variant: 'default',
    mode: 'base',
    children: '이것은 알림 메시지입니다. Controls 패널에서 모든 옵션을 변경할 수 있습니다.',
    title: '',
    icon: 'none',
    isToast: false,
    hasCloseButton: false,
    hasActions: false,
    onClose: () => console.log('Alert closed'),
  },
  render: (args) => {
    const { hasActions, ...restArgs } = args;
    const actions = hasActions
      ? [
          { label: '실행', onClick: () => console.log('Action 1') },
          { label: '실행취소', onClick: () => console.log('Action 2') },
        ]
      : undefined;

    return <Alert {...restArgs} actions={actions} />;
  },
};
