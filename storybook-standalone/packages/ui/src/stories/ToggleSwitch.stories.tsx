import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { ToggleSwitch } from '../components/ToggleSwitch';

const meta: Meta<typeof ToggleSwitch> = {
  title: 'UI/ToggleSwitch',
  component: ToggleSwitch,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'ToggleSwitch의 체크 상태를 설정합니다.',
    },
    disabled: {
      control: 'boolean',
      description: 'ToggleSwitch를 비활성화합니다.',
    },
    'aria-label': {
      control: 'text',
      description: '접근성을 위한 ARIA 레이블입니다.',
    },
  },
  args: {
    checked: false,
    disabled: false,
    'aria-label': 'Toggle switch',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [checked, setChecked] = React.useState(false);

    return (
      <div className="flex flex-col gap-4">
        <ToggleSwitch
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          aria-label="Default toggle switch"
        />
        <p className="text-sm">상태: {checked ? 'ON' : 'OFF'}</p>
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    checked: false,
    disabled: true,
    'aria-label': 'Disabled toggle switch',
  },
};
