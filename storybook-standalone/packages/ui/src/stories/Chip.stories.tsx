import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Chip } from "../components/Chip";
import { ChipGroup } from "../components/ChipGroup";
import { Scrollbar } from "../components/Scrollbar";
import { Icon } from "../components/Icon";

const meta = {
  title: "UI/Chip",
  component: Chip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "radio",
      options: ["md", "sm"],
    },
    state: {
      control: "radio",
      options: ["default", "selected", "disabled"],
    },
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Chip",
    size: "md",
    state: "default",
  },
};

export const WithIcon: Story = {
  render: (args: React.ComponentProps<typeof Chip>) => <Chip {...args} icon={<Icon name="dashed-square" size={args.size === "sm" ? 16 : 20} />} />,
  args: {
    ...Default.args,
    hasIcon: true,
  },
};

export const IconOnly: Story = {
  render: (args: React.ComponentProps<typeof Chip>) => <Chip {...args} children={null} icon={<Icon name="dashed-square" size={args.size === "sm" ? 16 : 20} />} />,
  args: {
    ...Default.args,
    children: null,
    hasIcon: true,
  },
};

export const WithCloseButton: Story = {
  args: {
    ...Default.args,
    hasCloseButton: true,
  },
};

export const WithIconAndClose: Story = {
  render: (args: React.ComponentProps<typeof Chip>) => <Chip {...args} icon={<Icon name="dashed-square" size={args.size === "sm" ? 16 : 20} />} />,
  args: {
    ...Default.args,
    hasIcon: true,
    hasCloseButton: true,
  },
};

export const ChipGroupScroll: Story = {
  render: () => (
    <Scrollbar className="w-[420px]">
      <ChipGroup variant="scroll">
        <Chip>Chip 1</Chip>
        <Chip>Chip 2</Chip>
        <Chip>Chip 3</Chip>
        <Chip>Chip 4</Chip>
        <Chip>Chip 5</Chip>
        <Chip>Chip 6</Chip>
        <Chip>Chip 7</Chip>
        <Chip>Chip 8</Chip>
      </ChipGroup>
    </Scrollbar>
  ),
};

export const ChipGroupNoScroll: Story = {
  render: () => (
    <ChipGroup variant="no-scroll" className="w-[400px]">
      <Chip>Chip 1</Chip>
      <Chip>Chip 2</Chip>
      <Chip>Chip 3</Chip>
      <Chip>Chip 4</Chip>
      <Chip>Chip 5</Chip>
      <Chip>Chip 6</Chip>
      <Chip>Chip 7</Chip>
      <Chip>Chip 8</Chip>
    </ChipGroup>
  ),
};

export const SingleSelection: Story = {
  render: () => {
    const chips = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
    return (
      <ChipGroup selectionType="single" defaultValue="Apple" className="w-[400px]" variant="no-scroll">
        {chips.map((chip) => (
          <Chip key={chip} value={chip}>
            {chip}
          </Chip>
        ))}
      </ChipGroup>
    );
  },
};

export const MultipleSelection: Story = {
  render: () => {
    const chips = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
    return (
      <ChipGroup selectionType="multiple" defaultValue={["Apple", "Cherry"]} className="w-[400px]" variant="no-scroll">
        {chips.map((chip) => (
          <Chip key={chip} value={chip}>
            {chip}
          </Chip>
        ))}
      </ChipGroup>
    );
  },
};
