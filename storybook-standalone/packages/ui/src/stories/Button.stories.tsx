import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { userEvent, within } from '@storybook/test';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

const iconMap = {
  none: null,
  dashedSquare: <Icon name="dashed-square" />,
  spinner: <Icon name="spinner" />,
};

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'destructive', 'tertiary', 'outline-destructive'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    isLoading: {
      control: { type: 'boolean' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    children: {
      control: { type: 'text' },
    },
    onClick: { action: 'clicked', table: { disable: true } },
    onMouseEnter: { action: 'hovered', table: { disable: true } },
    leftIcon: {
      options: Object.keys(iconMap),
      mapping: iconMap,
      control: { type: 'select' },
    },
    rightIcon: {
      options: Object.keys(iconMap),
      mapping: iconMap,
      control: { type: 'select' },
    },
    isDisabled: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

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

export const Primary: Story = {
  name: 'Primary',
  args: {
    variant: 'primary',
    size: 'md',
    children: 'Button',
    isLoading: false,
    disabled: false,
    leftIcon: 'none',
    rightIcon: 'none',
  },
  play: interactionTest,
};

export const Secondary: Story = {
  name: 'Secondary',
  args: {
    ...Primary.args,
    variant: 'secondary',
  },
  play: interactionTest,
};

export const Outline: Story = {
  name: 'Outline',
  args: {
    ...Primary.args,
    variant: 'outline',
  },
  play: interactionTest,
};

export const Tertiary: Story = {
  name: 'Tertiary',
  args: {
    ...Primary.args,
    variant: 'tertiary',
  },
  play: interactionTest,
};

export const Destructive: Story = {
  name: 'Destructive',
  args: {
    ...Primary.args,
    variant: 'destructive',
  },
  play: interactionTest,
};

export const OutlineDestructive: Story = {
  name: 'Outline Destructive',
  args: {
    ...Primary.args,
    variant: 'outline-destructive',
  },
  play: interactionTest,
};