import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { userEvent, within } from '@storybook/test';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { SpacingModeProvider } from '../components/SpacingModeProvider';

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
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode - can be controlled by SpacingModeProvider or individual prop',
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
    mode: 'base',
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

export const WithSpacingModeProvider: Story = {
  name: '🌐 With SpacingModeProvider',
  render: () => (
    <div className="space-y-8 p-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Global Base Mode (Default)</h3>
        <SpacingModeProvider mode="base">
          <div className="flex gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
          </div>
        </SpacingModeProvider>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Global Compact Mode</h3>
        <SpacingModeProvider mode="compact">
          <div className="flex gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
          </div>
        </SpacingModeProvider>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Prop Override (Provider: compact, Prop: base)</h3>
        <SpacingModeProvider mode="compact">
          <div className="flex gap-4">
            <Button variant="primary">Inherits Compact</Button>
            <Button variant="secondary" mode="base">Overrides to Base</Button>
            <Button variant="outline">Inherits Compact</Button>
          </div>
        </SpacingModeProvider>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Nested Providers</h3>
        <SpacingModeProvider mode="base">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Outer: Base</p>
              <Button variant="primary">Base from Outer</Button>
            </div>
            <SpacingModeProvider mode="compact">
              <div>
                <p className="text-sm text-gray-600 mb-2">Inner: Compact (overrides outer)</p>
                <Button variant="secondary">Compact from Inner</Button>
              </div>
            </SpacingModeProvider>
          </div>
        </SpacingModeProvider>
      </div>
    </div>
  ),
};

export const ModeComparison: Story = {
  name: '🔬 Mode Comparison',
  render: () => (
    <div className="space-y-8 p-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Base Mode (8px vertical spacing)</h3>
        <div className="flex gap-4 items-center">
          <Button mode="base" size="lg" variant="primary" leftIcon={<Icon name="dashed-square" />}>
            Large
          </Button>
          <Button mode="base" size="md" variant="primary" leftIcon={<Icon name="dashed-square" />}>
            Medium
          </Button>
          <Button mode="base" size="sm" variant="primary" leftIcon={<Icon name="dashed-square" />}>
            Small
          </Button>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Compact Mode (6px vertical spacing - 25% reduction)</h3>
        <div className="flex gap-4 items-center">
          <Button mode="compact" size="lg" variant="primary" leftIcon={<Icon name="dashed-square" />}>
            Large
          </Button>
          <Button mode="compact" size="md" variant="primary" leftIcon={<Icon name="dashed-square" />}>
            Medium
          </Button>
          <Button mode="compact" size="sm" variant="primary" leftIcon={<Icon name="dashed-square" />}>
            Small
          </Button>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Side-by-Side Comparison</h3>
        <div className="flex gap-8 items-start">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2 font-semibold">Base Mode</p>
            <Button mode="base" size="md" variant="secondary" leftIcon={<Icon name="dashed-square" />} rightIcon={<Icon name="spinner" />}>
              Button Text
            </Button>
            <p className="text-xs text-gray-500 mt-2">py: 8px, gap: 8px</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2 font-semibold">Compact Mode</p>
            <Button mode="compact" size="md" variant="secondary" leftIcon={<Icon name="dashed-square" />} rightIcon={<Icon name="spinner" />}>
              Button Text
            </Button>
            <p className="text-xs text-gray-500 mt-2">py: 6px, gap: 6px</p>
          </div>
        </div>
      </div>
    </div>
  ),
};