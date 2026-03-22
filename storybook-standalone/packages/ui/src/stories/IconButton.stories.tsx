import type { Meta, StoryObj } from '@storybook/react';

import { useState } from 'react';
import { IconButton, type IconButtonProps } from '../components/IconButton';
import { createIcon, type IconName16, type IconName20, type IconName24, type IconSize } from '../components/Icon';
import { IconButtonType, Interaction, Size } from '../types';

/**
 * Size별 아이콘 목록 — IconButton size → Icon size 매핑 (sm→16, md→20, lg→24)
 */
const iconNamesBySize: Record<string, string[]> = {
  sm: ['add', 'announcement', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'external', 'loading', 'minus', 'more-vert', 'reset', 'search', 'star-fill', 'star-line'] satisfies IconName16[],
  md: ['add', 'all', 'arrow-drop-down', 'arrow-drop-up', 'arrow-right', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'error', 'external', 'filter-list', 'folder', 'folder-fill', 'format-align-center', 'format-align-left', 'format-align-right', 'format-bold', 'format-color-text', 'format-color-text-bg', 'format-italic', 'format-list-bulleted', 'format-list-numbered', 'format-underlined', 'help', 'image', 'info', 'keyboard-arrow-left', 'keyboard-arrow-right', 'keyboard-double-arrow-left', 'keyboard-double-arrow-right', 'link', 'loading', 'menu', 'minus', 'more-vert', 'person', 'post', 'redo', 'reset', 'search', 'star-fill', 'star-line', 'success', 'table', 'undo', 'video', 'warning', 'widgets'] satisfies IconName20[],
  lg: ['add', 'all', 'arrow-drop-down', 'arrow-drop-up', 'blank', 'chevron-down', 'chevron-left', 'chevron-right', 'close', 'dehaze', 'delete', 'edit', 'filter-list', 'loading', 'menu', 'more-vert', 'person', 'post', 'search', 'star-fill', 'star-line', 'widgets'] satisfies IconName24[],
};

const meta: Meta<typeof IconButton> = {
  title: 'UI/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: [
          '## Figma ↔ Code Prop 매핑',
          '',
          '| Figma 속성 | Code prop | 값 |',
          '|---|---|---|',
          '| Type | `iconButtonType` | `ghost` · `ghost-destructive` · `secondary` · `tertiary` |',
          '| Size | `size` | `lg` · `md` · `sm` |',
          '| Interaction | `interaction` | `default` · `hover` · `pressed` · `focused` · `disabled` · `loading` |',
          '| Icon only | `iconOnly` | `React.ReactNode` — size별 사용 가능 아이콘이 다름 (sm→Icon16, md→Icon20, lg→Icon24) |',
          '',
          '> **Note**: Figma에서 `Focused`, `Disabled`는 각각 독립 속성이었으나, Button과 동일하게 `interaction` enum으로 통합하였습니다.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    iconButtonType: {
      control: { type: 'select' },
      options: Object.values(IconButtonType),
      description: 'Figma "Type" — 버튼 스타일',
    },
    size: {
      control: { type: 'select' },
      options: Object.values(Size),
    },
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    interaction: {
      control: { type: 'select' },
      options: Object.values(Interaction),
      description: 'Figma "Interaction" — 상호작용 상태',
    },
    iconOnly: {
      control: false,
      description: 'Figma "Icon only" — size별 사용 가능 아이콘이 다름 (sm→Icon16, md→Icon20, lg→Icon24)',
    },
    'aria-label': {
      control: { type: 'text' },
      description: '접근성 라벨 (필수) — 스크린 리더가 읽는 버튼 이름',
    },
    tooltip: {
      control: { type: 'text' },
      description: 'Tooltip 텍스트 — 있으면 Tooltip 자동 렌더링',
    },
    onClick: { action: 'clicked', table: { disable: true } },
    onMouseEnter: { action: 'hovered', table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

/** 스토리 전용 레이아웃 스타일 — Go 템플릿 엔진 충돌 방지용 변수 분리 */
const rowStyle = { display: 'flex', alignItems: 'center', gap: 16 } as const;
const selectStyle = { padding: '4px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 } as const;
const captionStyle = { fontSize: 12, color: '#888' } as const;

/**
 * size별 아이콘 선택 드롭다운을 포함하는 렌더 래퍼
 * - size가 변경되면 해당 size에서 사용 가능한 아이콘 목록으로 갱신
 */
const iconSizeByButtonSize: Record<string, IconSize> = { sm: 16, md: 20, lg: 24 };

const IconButtonWithIconSelect = (args: IconButtonProps & { selectedIcon?: string }) => {
  const sizeKey = args.size || 'md';
  const icons = iconNamesBySize[sizeKey] || iconNamesBySize.md;
  const [selectedIcon, setSelectedIcon] = useState(icons[0]);

  const currentIcon = icons.includes(selectedIcon) ? selectedIcon : icons[0];
  const iconSize = iconSizeByButtonSize[sizeKey];

  return (
    <div style={rowStyle}>
      <IconButton {...args} iconOnly={createIcon(currentIcon, iconSize)} />
      <select
        value={currentIcon}
        onChange={(e) => setSelectedIcon(e.target.value)}
        style={selectStyle}
      >
        {icons.map((name: string) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <span style={captionStyle}>
        Icon{iconSize} · {icons.length}개
      </span>
    </div>
  );
};

export const Ghost: Story = {
  name: 'Ghost',
  args: {
    iconButtonType: IconButtonType.GHOST,
    size: Size.MD,
    mode: 'base',
    interaction: Interaction.DEFAULT,
    'aria-label': '아이콘 버튼',
    tooltip: '아이콘 버튼',
  },
  render: (args) => <IconButtonWithIconSelect {...args} />,
};

export const Secondary: Story = {
  name: 'Secondary',
  args: {
    ...Ghost.args,
    iconButtonType: IconButtonType.SECONDARY,
  },
  render: (args) => <IconButtonWithIconSelect {...args} />,
};

export const Tertiary: Story = {
  name: 'Tertiary',
  args: {
    ...Ghost.args,
    iconButtonType: IconButtonType.TERTIARY,
  },
  render: (args) => <IconButtonWithIconSelect {...args} />,
};

export const GhostDestructive: Story = {
  name: 'Ghost Destructive',
  args: {
    ...Ghost.args,
    iconButtonType: IconButtonType.GHOST_DESTRUCTIVE,
  },
  render: (args) => <IconButtonWithIconSelect {...args} />,
};
