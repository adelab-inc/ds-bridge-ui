import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { userEvent, within } from '@storybook/test';
import { IconButton } from '../components/IconButton';
import { Icon } from '../components/Icon';

const iconMap = {
  'add': <Icon name="add" />,
  'chevron-left': <Icon name="chevron-left" />,
  'chevron-right': <Icon name="chevron-right" />,
  'dashed-square': <Icon name="dashed-square" />,
};

const meta: Meta<typeof IconButton> = {
  title: 'UI/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['ghost', 'secondary', 'tertiary', 'ghost-destructive'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    isLoading: {
      control: { type: 'boolean' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    icon: {
      options: Object.keys(iconMap),
      mapping: iconMap,
      control: { type: 'select' },
    },
    onClick: { action: 'clicked', table: { disable: true } },
    onMouseEnter: { action: 'hovered', table: { disable: true } },
    isDisabled: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

const interactionTest: Story['play'] = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  const button = canvas.getByRole('button');

  // Interaction Simulation (for visual check and action logging)
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  await userEvent.hover(button);
  await delay(500);
  await userEvent.tab();
  await delay(500);
  await userEvent.click(button);
  await delay(500);
  await userEvent.unhover(button);
  button.blur();
};

export const Ghost: Story = {
  name: 'Ghost',
  args: {
    variant: 'ghost',
    size: 'md',
    mode: 'base',
    isLoading: false,
    disabled: false,
    icon: 'dashed-square',
  },
  play: interactionTest,
};

export const Secondary: Story = {
  name: 'Secondary',
  args: {
    ...Ghost.args,
    variant: 'secondary',
  },
  play: interactionTest,
};

export const Tertiary: Story = {
  name: 'Tertiary',
  args: {
    ...Ghost.args,
    variant: 'tertiary',
  },
  play: interactionTest,
};

export const GhostDestructive: Story = {
  name: 'Ghost Destructive',
  args: {
    ...Ghost.args,
    variant: 'ghost-destructive',
  },
  play: interactionTest,
};
