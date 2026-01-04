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
    footerContent: {
      control: false,
      description: 'Footer 영역에 표시할 커스텀 콘텐츠입니다 (Button, Checkbox 등).',
    },
    x: {
      control: 'text',
      description: 'Dialog의 수평 위치입니다 (기본: 50%).',
    },
    y: {
      control: 'text',
      description: 'Dialog의 수직 위치입니다 (기본: 50%).',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component for interactive stories
const DialogWrapper = (args: any) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
      <Dialog
        {...args}
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onPrimaryClick={args.onPrimaryClick || (() => {
          console.log('Primary clicked');
          setIsOpen(false);
        })}
        onSecondaryClick={args.onSecondaryClick || (() => {
          console.log('Secondary clicked');
          setIsOpen(false);
        })}
      />
    </div>
  );
};

export const Sm: Story = {
  render: (args) => <DialogWrapper {...args} />,
  args: {
    size: 'sm',
    title: 'Small Dialog',
    children: 'Dialog content goes here. This is the body of the dialog.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};

export const Md: Story = {
  render: (args) => <DialogWrapper {...args} />,
  args: {
    size: 'md',
    title: 'Medium Dialog',
    children: 'Dialog content goes here. This is the body of the dialog.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};

export const Lg: Story = {
  render: (args) => <DialogWrapper {...args} />,
  args: {
    size: 'lg',
    title: 'Large Dialog',
    children: 'Dialog content goes here. This is the body of the dialog.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};

export const Xl: Story = {
  render: (args) => <DialogWrapper {...args} />,
  args: {
    size: 'xl',
    title: 'Extra Large Dialog',
    children: 'Dialog content goes here. This is the body of the dialog.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};

export const WithSubtitle: Story = {
  render: (args) => <DialogWrapper {...args} />,
  args: {
    size: 'md',
    title: 'Dialog with Subtitle',
    subtitle: 'This is a subtitle description',
    children: 'Dialog content goes here. This is the body of the dialog.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};

export const LongContent: Story = {
  render: (args) => <DialogWrapper {...args} />,
  args: {
    size: 'md',
    title: 'Dialog with Long Content',
    subtitle: 'Scrollable content example',
    children: (
      <div>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco.</p>
        <p>Duis aute irure dolor in reprehenderit in voluptate velit.</p>
        <p>Excepteur sint occaecat cupidatat non proident.</p>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco.</p>
        <p>Duis aute irure dolor in reprehenderit in voluptate velit.</p>
        <p>Excepteur sint occaecat cupidatat non proident.</p>
      </div>
    ),
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};

export const WithFooterContent: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
        <Dialog
          size={args.size}
          title={args.title!}
          subtitle={args.subtitle}
          children={args.children}
          open={isOpen}
          onClose={() => setIsOpen(false)}
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
    title: 'Dialog with Footer Content Only',
    subtitle: 'Footer content without action buttons',
    children: 'This dialog has custom footer content but no primary/secondary buttons.',
  },
};

export const WithFooterContentAndButtons: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);
    const [deleteRelated, setDeleteRelated] = useState(false);

    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
        <Dialog
          size={args.size}
          title={args.title!}
          subtitle={args.subtitle}
          children={args.children}
          primaryLabel={args.primaryLabel}
          secondaryLabel={args.secondaryLabel}
          open={isOpen}
          onClose={() => setIsOpen(false)}
          onPrimaryClick={() => {
            console.log('Delete clicked, deleteRelated:', deleteRelated);
            setIsOpen(false);
          }}
          onSecondaryClick={() => {
            console.log('Cancel clicked');
            setIsOpen(false);
          }}
          footerContent={
            <Option label="관련 파일도 함께 삭제">
              <Checkbox
                checked={deleteRelated}
                onChange={(e) => setDeleteRelated(e.target.checked)}
              />
            </Option>
          }
        />
      </div>
    );
  },
  args: {
    size: 'md',
    title: 'Delete Confirmation',
    subtitle: 'This action cannot be undone',
    children: 'Are you sure you want to delete this item? This will permanently remove the item and all associated data.',
    primaryLabel: '삭제',
    secondaryLabel: '취소',
  },
};

export const WithMultipleFooterElements: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);
    const [autoSave, setAutoSave] = useState(false);
    const [notification, setNotification] = useState(true);

    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
        <Dialog
          size={args.size}
          title={args.title!}
          subtitle={args.subtitle}
          children={args.children}
          primaryLabel={args.primaryLabel}
          secondaryLabel={args.secondaryLabel}
          open={isOpen}
          onClose={() => setIsOpen(false)}
          onPrimaryClick={() => {
            console.log('Save clicked, autoSave:', autoSave, 'notification:', notification);
            setIsOpen(false);
          }}
          onSecondaryClick={() => {
            console.log('Cancel clicked');
            setIsOpen(false);
          }}
          footerContent={
            <div className="flex gap-component-gap-actions-x">
              <Option label="자동 저장">
                <Checkbox
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                />
              </Option>
              <Option label="알림 받기">
                <Checkbox
                  checked={notification}
                  onChange={(e) => setNotification(e.target.checked)}
                />
              </Option>
            </div>
          }
        />
      </div>
    );
  },
  args: {
    size: 'lg',
    title: 'Settings',
    subtitle: 'Configure your preferences',
    children: (
      <div>
        <p>Adjust the following settings according to your needs.</p>
        <ul className="list-disc pl-5 mt-2">
          <li>Option 1: Enabled</li>
          <li>Option 2: Disabled</li>
          <li>Option 3: Auto</li>
        </ul>
      </div>
    ),
    primaryLabel: '저장',
    secondaryLabel: '취소',
  },
};
