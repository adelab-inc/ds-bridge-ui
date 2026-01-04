import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { Radio } from '../components/Radio';

const meta: Meta<typeof Radio> = {
  title: 'UI/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['16', '18', '20', '24', '28'],
      description: 'Radio 높이',
    },
    checked: {
      control: 'boolean',
      description: '체크 상태',
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태',
    },
    'aria-label': {
      control: 'text',
      description: '접근성 라벨',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Radio>;

export const Default: Story = {
  render: (args) => {
    const [checked, setChecked] = React.useState(args.checked || false);

    // args.checked가 변경되면 내부 상태도 업데이트
    React.useEffect(() => {
      setChecked(args.checked || false);
    }, [args.checked]);

    return (
      <Radio
        {...args}
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked);
          args.onChange?.(e);
        }}
      />
    );
  },
  args: {
    checked: false,
    disabled: false,
    size: '18',
    'aria-label': 'Radio button',
  },
};
