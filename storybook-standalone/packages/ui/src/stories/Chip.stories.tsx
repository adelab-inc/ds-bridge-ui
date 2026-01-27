import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Chip } from "../components/Chip";
import { ChipGroup } from "../components/ChipGroup";
import { Icon } from "../components/Icon";

const iconMap = {
  none: null,
  'dashed-square': 'dashed-square',
  'search': 'search',
  'close': 'close',
  'person': 'person',
};

const meta = {
  title: "UI/Chip",
  component: Chip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: { type: "text" },
      description: "Chip 내부 텍스트",
    },
    variant: {
      control: { type: "select" },
      options: ["default", "ghost"],
      description: "Chip 스타일 (default: 배경+테두리, ghost: 배경/테두리 없음)",
    },
    size: {
      control: { type: "select" },
      options: ["md", "sm"],
      description: "Chip 크기",
    },
    mode: {
      control: { type: "select" },
      options: ["base", "compact"],
      description: "Spacing density mode",
    },
    state: {
      control: { type: "select" },
      options: ["default", "selected", "disabled"],
      description: "Chip 상태",
    },
    icon: {
      control: { type: "select" },
      options: Object.keys(iconMap),
      description: "아이콘 선택 (none: 아이콘 없음)",
    },
    hasCloseButton: {
      control: { type: "boolean" },
      description: "닫기 버튼 표시 여부",
    },
    onClose: { table: { disable: true } },
    value: { table: { disable: true } },
    hasIcon: { table: { disable: true } },
    selectionStyle: { table: { disable: true } },
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const iconName = args.icon as keyof typeof iconMap;
    const iconSize = args.size === "sm" ? 16 : 20;
    const iconElement = iconName && iconName !== 'none'
      ? <Icon name={iconMap[iconName] as any} size={iconSize} />
      : undefined;

    return (
      <Chip
        {...args}
        icon={iconElement}
      />
    );
  },
  args: {
    children: "Chip",
    variant: "default",
    size: "md",
    mode: "base",
    state: "default",
    icon: "none",
    hasCloseButton: false,
  },
};

export const ChipGroupScroll: StoryObj<{ disabled: boolean }> = {
  render: (args) => (
    <div className="w-[420px] overflow-x-auto">
      <ChipGroup variant="scroll" disabled={args.disabled}>
        <Chip>Chip 1</Chip>
        <Chip>Chip 2</Chip>
        <Chip>Chip 3</Chip>
        <Chip>Chip 4</Chip>
        <Chip>Chip 5</Chip>
        <Chip>Chip 6</Chip>
        <Chip>Chip 7</Chip>
        <Chip>Chip 8</Chip>
      </ChipGroup>
    </div>
  ),
  args: {
    disabled: false,
  },
};

export const ChipGroupNoScroll: StoryObj<{ disabled: boolean }> = {
  render: (args) => (
    <ChipGroup variant="no-scroll" className="w-[400px]" disabled={args.disabled}>
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
  args: {
    disabled: false,
  },
};

export const SingleSelection: StoryObj<{ disabled: boolean }> = {
  render: (args) => {
    const chips = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
    return (
      <ChipGroup selectionType="single" defaultValue="Apple" className="w-[400px]" variant="no-scroll" disabled={args.disabled}>
        {chips.map((chip) => (
          <Chip key={chip} value={chip}>
            {chip}
          </Chip>
        ))}
      </ChipGroup>
    );
  },
  args: {
    disabled: false,
  },
};

export const MultipleSelection: StoryObj<{ disabled: boolean }> = {
  render: (args) => {
    const chips = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
    return (
      <ChipGroup selectionType="multiple" defaultValue={["Apple", "Cherry"]} className="w-[400px]" variant="no-scroll" disabled={args.disabled}>
        {chips.map((chip) => (
          <Chip key={chip} value={chip}>
            {chip}
          </Chip>
        ))}
      </ChipGroup>
    );
  },
  args: {
    disabled: false,
  },
};
