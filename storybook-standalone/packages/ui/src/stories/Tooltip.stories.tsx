import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Tooltip } from '../components/Tooltip';
import { Button } from '../components/Button';

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    truncation: {
      control: 'boolean',
      description: 'truncation이 true일 경우 최대 너비 540px, 높이 240px이 적용되고 overflow-y-scroll이 활성화됩니다.',
    },
    content: {
      control: 'text',
      description: '툴팁에 표시될 내용입니다.',
    },
    delay: {
      control: 'number',
      description: '툴팁이 표시되기 전 지연 시간(ms)입니다.',
    },
    closeDelay: {
      control: 'number',
      description: '툴팁이 사라지기 전 지연 시간(ms)입니다.',
    },
    preferredPosition: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      description: '툴팁의 우선 표시 위치입니다. 공간이 없으면 자동으로 다른 위치로 이동합니다.',
    },
    followCursor: {
      control: 'boolean',
      description: '마우스 커서를 따라다니는 툴팁을 활성화합니다.',
    },
    cursorOffset: {
      control: 'object',
      description: '커서와 툴팁 사이의 오프셋입니다. (예: { x: 10, y: 10 })',
    },
  },
  args: {
    content: 'This is a tooltip',
    delay: 200,
    closeDelay: 500,
    preferredPosition: 'top',
    truncation: false,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'This is a default tooltip with short content',
    truncation: false,
  },
  render: (args) => (
    <Tooltip {...args}>
      <Button>Hover me</Button>
    </Tooltip>
  ),
};

export const Truncation: Story = {
  args: {
    content: `This is a truncation tooltip with very long content.
    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
    Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
    nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
    reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia
    deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste
    natus error sit voluptatem accusantium doloremque laudantium.`,
    truncation: true,
  },
  render: (args) => (
    <Tooltip {...args}>
      <Button>Hover for long content</Button>
    </Tooltip>
  ),
};

export const PositionTop: Story = {
  args: {
    content: 'Tooltip positioned at top',
    preferredPosition: 'top',
  },
  render: (args) => (
    <div className="pt-[100px]">
      <Tooltip {...args}>
        <Button>Top Tooltip</Button>
      </Tooltip>
    </div>
  ),
};

export const PositionBottom: Story = {
  args: {
    content: 'Tooltip positioned at bottom',
    preferredPosition: 'bottom',
  },
  render: (args) => (
    <Tooltip {...args}>
      <Button>Bottom Tooltip</Button>
    </Tooltip>
  ),
};

export const PositionLeft: Story = {
  args: {
    content: 'Tooltip positioned at left',
    preferredPosition: 'left',
  },
  render: (args) => (
    <div className="pl-[200px]">
      <Tooltip {...args}>
        <Button>Left Tooltip</Button>
      </Tooltip>
    </div>
  ),
};

export const PositionRight: Story = {
  args: {
    content: 'Tooltip positioned at right',
    preferredPosition: 'right',
  },
  render: (args) => (
    <Tooltip {...args}>
      <Button>Right Tooltip</Button>
    </Tooltip>
  ),
};

export const WithDelay: Story = {
  args: {
    content: 'This tooltip appears after 500ms',
    delay: 500,
  },
  render: (args) => (
    <Tooltip {...args}>
      <Button>Hover (500ms delay)</Button>
    </Tooltip>
  ),
};

export const WithCloseDelay: Story = {
  args: {
    content: 'This tooltip stays for 1000ms after mouse leave',
    closeDelay: 1000,
  },
  render: (args) => (
    <Tooltip {...args}>
      <Button>Hover (stays 1s)</Button>
    </Tooltip>
  ),
};

export const CustomContent: Story = {
  args: {
    content: (
      <div>
        <strong>Custom Content</strong>
        <p>You can use any React element as content!</p>
      </div>
    ),
  },
  render: (args) => (
    <Tooltip {...args}>
      <Button>Custom Content</Button>
    </Tooltip>
  ),
};

export const FollowCursor: Story = {
  args: {
    content: 'This tooltip follows your cursor!',
    followCursor: true,
    delay: 100,
  },
  render: (args) => (
    <div className="w-[400px] h-[300px] flex items-center justify-center border-2 border-dashed border-border-default rounded-lg">
      <Tooltip {...args}>
        <Button>Move your mouse around</Button>
      </Tooltip>
    </div>
  ),
};

export const FollowCursorCustomOffset: Story = {
  args: {
    content: 'Tooltip with custom offset (x: 20, y: 20)',
    followCursor: true,
    cursorOffset: { x: 20, y: 20 },
    delay: 100,
  },
  render: (args) => (
    <div className="w-[400px] h-[300px] flex items-center justify-center border-2 border-dashed border-border-default rounded-lg">
      <Tooltip {...args}>
        <Button>Custom offset</Button>
      </Tooltip>
    </div>
  ),
};
