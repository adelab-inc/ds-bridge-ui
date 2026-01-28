import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { Checkbox } from '../components/Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex items-center min-h-[40px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    size: {
      control: 'select',
      options: ['16', '18', '20', '24', '28'],
      description: 'Checkbox 높이',
    },
    checked: {
      control: 'boolean',
      description: '체크 여부',
    },
    variant: {
      control: 'select',
      options: ['checked', 'indeterminate'],
      description: '체크 시 아이콘 종류 (checked: 체크마크, indeterminate: 가로선)',
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태',
    },
    'aria-label': {
      control: 'text',
      description: '접근성 라벨',
    },
    onChange: { table: { disable: true } },
    renderContainer: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: (args) => {
    const [checked, setChecked] = React.useState<boolean>(args.checked || false);

    // args.checked가 변경되면 내부 상태도 업데이트
    React.useEffect(() => {
      setChecked(args.checked || false);
    }, [args.checked]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setChecked(e.target.checked);
      args.onChange?.(e);
    };

    return (
      <Checkbox
        {...args}
        checked={checked}
        onChange={handleChange}
      />
    );
  },
  args: {
    checked: false,
    variant: 'checked',
    disabled: false,
    size: '18',
    'aria-label': 'Checkbox',
  },
};
