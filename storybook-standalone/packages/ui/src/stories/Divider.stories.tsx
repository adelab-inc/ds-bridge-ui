import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Divider } from "../components/Divider";

const meta = {
  title: "UI/Divider",
  component: Divider,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
    },
    color: {
      control: "radio",
      options: ["default", "subtle", "strong"],
    },
  },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
    color: "default",
  },
  render: (args: React.ComponentProps<typeof Divider>) => (
    <div
      className={`
        w-[200px] h-[200px] p-4 border rounded-md
        flex justify-center items-center
        ${args.orientation === 'horizontal' ? 'flex-col gap-2' : 'flex-row gap-2'}
      `}
    >
      <p className="text-sm">Container</p>
      <Divider {...args} />
    </div>
  ),
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
    color: "default",
  },
  render: (args: React.ComponentProps<typeof Divider>) => (
    <div
      className={`
        w-[200px] h-[200px] p-4 border rounded-md
        flex justify-center items-center
        ${args.orientation === 'horizontal' ? 'flex-col gap-2' : 'flex-row gap-2'}
      `}
    >
      <p className="text-sm">Container</p>
      <Divider {...args} />
    </div>
  ),
};

export const Subtle: Story = {
  args: {
    orientation: "horizontal",
    color: "subtle",
  },
  render: (args: React.ComponentProps<typeof Divider>) => (
    <div className="w-[200px] h-[200px] p-4 border rounded-md">
      <Divider {...args} />
    </div>
  ),
};

export const Strong: Story = {
  args: {
    orientation: "horizontal",
    color: "strong",
  },
  render: (args: React.ComponentProps<typeof Divider>) => (
    <div className="w-[200px] h-[200px] p-4 border rounded-md">
      <Divider {...args} />
    </div>
  ),
};