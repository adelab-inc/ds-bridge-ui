import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Scrollbar } from '../components/Scrollbar';

const meta: Meta<typeof Scrollbar> = {
  title: 'UI/Scrollbar',
  component: Scrollbar,
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: {
        type: 'text',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Scrollbar>;

const scrollbarStyle = { height: '200px', width: '300px' };
const contentStyle = { height: '500px', width: '600px' };

export const Default: Story = {
  render: (args) => (
    <Scrollbar {...args} style={scrollbarStyle}>
      <div style={contentStyle}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante
        dibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris. Fusce
        nec tellus sed augue semper porta. Mauris massa. Vestibulum lacinia arcu eget nulla. Class aptent taciti
        sociosqu ad litora torquent per conubia nostra, per inceptos himeneos. Curabitur sodales ligula in libero. Sed
        dignissim lacinia nunc.
      </div>
    </Scrollbar>
  ),
  args: {
    variant: 'default',
  },
};
