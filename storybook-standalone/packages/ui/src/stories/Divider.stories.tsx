import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Divider } from "../components/Divider";

const meta = {
  title: "UI/Divider",
  component: Divider,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "구분선 컴포넌트.",
          "",
          "### Figma ↔ Code 인터페이스 매핑",
          "",
          "| Figma 속성 | Figma 값 | Code prop | Code 값 |",
          "| --- | --- | --- | --- |",
          "| `Orientation` | Horizontal, Vertical | `orientation` | `\"horizontal\"`, `\"vertical\"` |",
          "| `Tone` | Default, subtle, Strong, inverse | `tone` | `\"default\"`, `\"subtle\"`, `\"strong\"`, `\"inverse\"` |",
          "",
          "### V1 → V2 변경 사항",
          "",
          "| V1 prop | V2 prop | 변경 내용 |",
          "| --- | --- | --- |",
          "| `color` | `tone` | Figma 속성명 `Tone`과 일치시킴 |",
          "| — | `tone=\"inverse\"` | Figma에 존재하나 V1에 누락된 값 추가 |",
          "| `asChild` | — | 미사용 prop 제거 |",
        ].join("\n"),
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: { type: "select" },
      options: ["horizontal", "vertical"],
      description: "Figma: Orientation — Divider의 방향",
    },
    tone: {
      control: { type: "select" },
      options: ["default", "subtle", "strong", "inverse"],
      description: "Figma: Tone — Divider의 색상 톤",
    },
  },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    orientation: "horizontal",
    tone: "default",
  },
  render: (args: React.ComponentProps<typeof Divider>) => (
    <div
      className={`
        w-[200px] h-[200px] p-4 border rounded-md
        flex justify-center items-center
        ${args.orientation === 'horizontal' ? 'flex-col gap-2' : 'flex-row gap-2'}
        ${args.tone === 'inverse' ? 'bg-gray-800' : ''}
      `}
    >
      <p className={`text-sm ${args.tone === 'inverse' ? 'text-white' : ''}`}>Container</p>
      <Divider {...args} />
    </div>
  ),
};
