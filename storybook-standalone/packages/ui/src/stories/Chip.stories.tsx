import { useState, useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
// @ts-expect-error -- @storybook/preview-api is a transitive dependency; not hoisted in pnpm
import { useArgs } from "@storybook/preview-api";
import { Chip } from "../components/Chip";
import { ChipGroup } from "../components/ChipGroup";
import { createIcon, type IconName16, type IconName20, type IconSize } from "../components/Icon";
import { Mode } from "../types";

/**
 * Size별 아이콘 목록 — Chip size → Icon size 매핑 (sm→16, md→20)
 */
/** 스토리 전용 레이아웃 스타일 — Go 템플릿 엔진 충돌 방지용 변수 분리 */
const rowStyle = { display: 'flex', alignItems: 'center', gap: 16 } as const;
const labelStyle = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 } as const;
const selectStyle = { padding: '4px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 } as const;
const captionStyle = { fontSize: 12, color: '#888' } as const;

const iconNamesBySize: Record<string, string[]> = {
  sm: ['add', 'announcement', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'external', 'loading', 'minus', 'more-vert', 'reset', 'search', 'star-fill', 'star-line'] satisfies IconName16[],
  md: ['add', 'all', 'arrow-drop-down', 'arrow-drop-up', 'arrow-right', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'error', 'external', 'filter-list', 'folder', 'folder-fill', 'format-align-center', 'format-align-left', 'format-align-right', 'format-bold', 'format-color-text', 'format-color-text-bg', 'format-italic', 'format-list-bulleted', 'format-list-numbered', 'format-underlined', 'help', 'image', 'info', 'keyboard-arrow-left', 'keyboard-arrow-right', 'keyboard-double-arrow-left', 'keyboard-double-arrow-right', 'link', 'loading', 'menu', 'minus', 'more-vert', 'person', 'post', 'redo', 'reset', 'search', 'star-fill', 'star-line', 'success', 'table', 'undo', 'video', 'warning', 'widgets'] satisfies IconName20[],
};

const meta = {
  title: "UI/Chip",
  component: Chip,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Type` | `type` | 동일. `<div>` 기반이므로 HTML 충돌 없음 (Alert 패턴) |',
          '| `Size` | `size` | 동일 |',
          '| `Interaction` | `interaction` | 동일. `hover`/`pressed`는 CSS pseudo-state가 처리하므로 코드에서 직접 지정할 필요 없음 |',
          '| `Selected` | `selected` | Figma `off/on` → 코드 `boolean`. Interaction과 독립 |',
          '| `Disable` | `disabled` | Figma `False/True` → 코드 `boolean`. **Interaction과 별도** (Button과 다른 점) |',
          '| `Show Icon` | `showIcon` | Discriminated union — `true`일 때 `icon` 필수, `false`일 때 전달 불가 |',
          '| `Show Close` | `showClose` | 동일 |',
          '| `Icon Only` | `iconOnly` | Discriminated union — `true`일 때 `label` 전달 불가 |',
          '| `Label` | `label` | optional ReactNode. `iconOnly: true`일 때 전달 불가 |',
          '',
          '> **참고**: `mode` prop은 Figma에 없는 코드 전용 속성으로, `SpacingModeProvider`를 통해 일괄 제어됩니다.',
          '> **Button과의 차이**: Button은 `Interaction`에 `Disabled`가 포함되지만, Chip은 `Disable`이 별도 boolean입니다.',
        ].join('\n'),
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: { type: "text" },
      description: "Figma: `Label`. 라벨 텍스트. optional (iconOnly일 때 불필요)",
    },
    type: {
      control: { type: "select" },
      options: ["default", "ghost"],
      description: "Figma: `Type`. Chip 스타일 (default: 배경+테두리, ghost: 배경/테두리 없음)",
    },
    size: {
      control: { type: "select" },
      options: ["md", "sm"],
      description: "Figma: `Size`",
    },
    mode: {
      control: { type: "select" },
      options: Object.values(Mode),
      description: "Figma에 없는 코드 전용 속성. `SpacingModeProvider`로 일괄 제어 가능",
    },
    interaction: {
      control: { type: "select" },
      options: ["default", "hover", "pressed"],
      description: "Figma: `Interaction`. hover/pressed는 CSS pseudo-state가 처리. disabled는 별도 prop",
    },
    selected: {
      control: { type: "boolean" },
      description: "Figma: `Selected`. 선택 상태. disabled와 독립적으로 조합 가능",
    },
    disabled: {
      control: { type: "boolean" },
      description: "Figma: `Disable`. Interaction과 별도 boolean (Button과 다른 점)",
    },
    iconOnly: {
      control: { type: "boolean" },
      description: "Figma: `Icon Only`. Discriminated union — `true`일 때 `label` 전달 불가",
    },
    showIcon: {
      control: { type: "boolean" },
      description: "Figma: `Show Icon`. `true`이면 `icon` 필수 (discriminated union)",
    },
    showClose: {
      control: { type: "boolean" },
      description: "Figma: `Show Close`. 닫기 버튼 표시 여부",
    },
    icon: {
      control: false,
      description: "아이콘 선택 (`showIcon=true`일 때만 사용). size별 사용 가능 아이콘이 다름 (sm→Icon16, md→Icon20)",
    },
    onClose: { table: { disable: true } },
    value: { table: { disable: true } },
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    const sizeKey = args.size || 'md';
    const icons = iconNamesBySize[sizeKey] || iconNamesBySize.md;
    const [selectedIcon, setSelectedIcon] = useState(icons[0]);
    const currentIcon = icons.includes(selectedIcon) ? selectedIcon : icons[0];

    const iconSize: IconSize = sizeKey === "sm" ? 16 : 20;
    const iconElement = createIcon(currentIcon, iconSize);

    // iconOnly=true → showIcon 강제 true, showClose 강제 false (타입 제약)
    useEffect(() => {
      if (args.iconOnly) {
        updateArgs({ showIcon: true, showClose: false });
      }
    }, [args.iconOnly]);

    const effectiveShowIcon = args.iconOnly ? true : args.showIcon;

    const iconProps = effectiveShowIcon
      ? { showIcon: true as const, icon: iconElement }
      : { showIcon: false as const };

    const iconOnlyProps = args.iconOnly
      ? { iconOnly: true as const }
      : { iconOnly: false as const, label: args.label, showClose: args.showClose };

    return (
      <div style={rowStyle}>
        <Chip
          type={args.type}
          size={args.size}
          mode={args.mode}
          interaction={args.interaction}
          selected={args.selected}
          disabled={args.disabled}
          onClick={() => !args.disabled && updateArgs({ selected: !args.selected })}
          {...iconProps}
          {...iconOnlyProps}
        />
        {effectiveShowIcon && (
          <label style={labelStyle}>
            Icon:
            <select value={currentIcon} onChange={(e) => setSelectedIcon(e.target.value)} style={selectStyle}>
              {icons.map((name: string) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        )}
        <span style={captionStyle}>
          Icon{iconSize} · {icons.length}개
        </span>
      </div>
    );
  },
  args: {
    label: "Chip",
    type: "default",
    size: "md",
    mode: "base",
    interaction: "default",
    selected: false,
    disabled: false,
    iconOnly: false,
    showIcon: false,
    showClose: false,
  },
};

/** disabled, size 외 모든 컨트롤 숨김 (ChipGroup 스토리 공용) */
const chipGroupArgTypes = {
  label: { table: { disable: true } },
  type: { table: { disable: true } },
  size: { control: 'select', options: ['md', 'sm'], description: 'ChipGroup 내 Chip 사이즈' },
  mode: { table: { disable: true } },
  interaction: { table: { disable: true } },
  selected: { table: { disable: true } },
  iconOnly: { table: { disable: true } },
  showIcon: { table: { disable: true } },
  showClose: { table: { disable: true } },
  icon: { table: { disable: true } },
};

export const ChipGroupScroll: StoryObj<{ disabled: boolean; size: 'md' | 'sm' }> = {
  argTypes: chipGroupArgTypes as Record<string, unknown>,
  render: (args) => (
    <div className="w-[420px] overflow-x-auto">
      <ChipGroup variant="scroll" disabled={args.disabled} size={args.size}>
        <Chip label="Chip 1" showIcon={false} showClose={false} iconOnly={false} />
        <Chip label="Chip 2" showIcon={false} showClose={false} iconOnly={false} />
        <Chip label="Chip 3" showIcon={false} showClose={false} iconOnly={false} />
        <Chip label="Chip 4" showIcon={false} showClose={false} iconOnly={false} />
        <Chip label="Chip 5" showIcon={false} showClose={false} iconOnly={false} />
        <Chip label="Chip 6" showIcon={false} showClose={false} iconOnly={false} />
        <Chip label="Chip 7" showIcon={false} showClose={false} iconOnly={false} />
        <Chip label="Chip 8" showIcon={false} showClose={false} iconOnly={false} />
      </ChipGroup>
    </div>
  ),
  args: {
    disabled: false,
    size: 'md',
  },
};

export const ChipGroupNoScroll: StoryObj<{ disabled: boolean; size: 'md' | 'sm' }> = {
  argTypes: chipGroupArgTypes as Record<string, unknown>,
  render: (args) => (
    <ChipGroup variant="no-scroll" className="w-[400px]" disabled={args.disabled} size={args.size}>
      <Chip label="Chip 1" showIcon={false} showClose={false} iconOnly={false} />
      <Chip label="Chip 2" showIcon={false} showClose={false} iconOnly={false} />
      <Chip label="Chip 3" showIcon={false} showClose={false} iconOnly={false} />
      <Chip label="Chip 4" showIcon={false} showClose={false} iconOnly={false} />
      <Chip label="Chip 5" showIcon={false} showClose={false} iconOnly={false} />
      <Chip label="Chip 6" showIcon={false} showClose={false} iconOnly={false} />
      <Chip label="Chip 7" showIcon={false} showClose={false} iconOnly={false} />
      <Chip label="Chip 8" showIcon={false} showClose={false} iconOnly={false} />
    </ChipGroup>
  ),
  args: {
    disabled: false,
    size: 'md',
  },
};

export const SingleSelection: StoryObj<{ disabled: boolean; size: 'md' | 'sm' }> = {
  argTypes: chipGroupArgTypes as Record<string, unknown>,
  render: (args) => {
    const chips = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
    return (
      <ChipGroup selectionType="single" defaultValue="Apple" className="w-[400px]" variant="no-scroll" disabled={args.disabled} size={args.size}>
        {chips.map((chip) => (
          <Chip key={chip} value={chip} label={chip} showIcon={false} showClose={false} iconOnly={false} />
        ))}
      </ChipGroup>
    );
  },
  args: {
    disabled: false,
    size: 'md',
  },
};

export const MultipleSelection: StoryObj<{ disabled: boolean; size: 'md' | 'sm' }> = {
  argTypes: chipGroupArgTypes as Record<string, unknown>,
  render: (args) => {
    const chips = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
    return (
      <ChipGroup selectionType="multiple" defaultValue={["Apple", "Cherry"]} className="w-[400px]" variant="no-scroll" disabled={args.disabled} size={args.size}>
        {chips.map((chip) => (
          <Chip key={chip} value={chip} label={chip} showIcon={false} showClose={false} iconOnly={false} />
        ))}
      </ChipGroup>
    );
  },
  args: {
    disabled: false,
    size: 'md',
  },
};

export const ChipGroupWithClose: StoryObj<{ disabled: boolean; size: 'md' | 'sm' }> = {
  argTypes: chipGroupArgTypes as Record<string, unknown>,
  render: (args) => {
    const chips = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
    return (
      <ChipGroup selectionType="multiple" defaultValue={["Apple", "Cherry"]} className="w-[400px]" variant="no-scroll" disabled={args.disabled} size={args.size}>
        {chips.map((chip) => (
          <Chip key={chip} value={chip} label={chip} showIcon={false} showClose={true} iconOnly={false} />
        ))}
      </ChipGroup>
    );
  },
  args: {
    disabled: false,
    size: 'md',
  },
};
