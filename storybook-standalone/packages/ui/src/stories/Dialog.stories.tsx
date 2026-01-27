import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { Dialog } from '../components/Dialog';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Option } from '../components/Option';

const meta: Meta<typeof Dialog> = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Dialog의 크기를 선택합니다.',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    title: {
      control: 'text',
      description: 'Dialog의 제목입니다.',
    },
    subtitle: {
      control: 'text',
      description: 'Dialog의 부제목입니다 (선택사항).',
    },
    children: {
      control: 'text',
      description: 'Dialog의 본문 내용입니다.',
    },
    primaryLabel: {
      control: 'text',
      description: 'Primary 버튼의 라벨입니다.',
    },
    secondaryLabel: {
      control: 'text',
      description: 'Secondary 버튼의 라벨입니다.',
    },
    x: { table: { disable: true } },
    y: { table: { disable: true } },
    onClose: { table: { disable: true } },
    onPrimaryClick: { table: { disable: true } },
    onSecondaryClick: { table: { disable: true } },
    footerContent: { table: { disable: true } },
    open: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
        <Dialog
          size={args.size}
          mode={args.mode}
          title={args.title!}
          subtitle={args.subtitle}
          children={args.children}
          primaryLabel={args.primaryLabel}
          secondaryLabel={args.secondaryLabel}
          x={args.x}
          y={args.y}
          open={isOpen}
          onClose={() => setIsOpen(false)}
          onPrimaryClick={() => {
            console.log('Primary clicked, dontShowAgain:', dontShowAgain);
            setIsOpen(false);
          }}
          onSecondaryClick={() => {
            console.log('Secondary clicked');
            setIsOpen(false);
          }}
          footerContent={
            <Option label="다시 보지 않기">
              <Checkbox
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
            </Option>
          }
        />
      </div>
    );
  },
  args: {
    size: 'md',
    mode: 'base',
    title: 'Dialog Title',
    subtitle: 'This is a subtitle description',
    children: 'Dialog content goes here. This is the body of the dialog.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};
