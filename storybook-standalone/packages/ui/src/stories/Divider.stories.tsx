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
      control: { type: "select" },
      options: ["horizontal", "vertical"],
      description: "Divider의 방향을 선택합니다.",
    },
    color: {
      control: { type: "select" },
      options: ["default", "subtle", "strong"],
      description: "Divider의 색상을 선택합니다.",
    },
  },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
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
