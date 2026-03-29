import type { Meta, StoryObj } from '@storybook/react';

import { useState } from 'react';
import { Button, type ButtonProps } from '../components/Button';
import { createIcon, type IconName16, type IconName20, type IconSize } from '../components/Icon';
import { ButtonType, Interaction, Size, Mode } from '../types';

/**
 * Size별 아이콘 목록 — Button size → Icon size 매핑 (lg→20, md→16, sm→16)
 */
const iconNamesBySize: Record<string, string[]> = {
  sm: ['add', 'announcement', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'external', 'loading', 'minus', 'more-vert', 'reset', 'search', 'star-fill', 'star-line'] satisfies IconName16[],
  md: ['add', 'announcement', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'external', 'loading', 'minus', 'more-vert', 'reset', 'search', 'star-fill', 'star-line'] satisfies IconName16[],
  lg: ['add', 'all', 'arrow-drop-down', 'arrow-drop-up', 'arrow-right', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'error', 'external', 'filter-list', 'folder', 'folder-fill', 'format-align-center', 'format-align-left', 'format-align-right', 'format-bold', 'format-color-text', 'format-color-text-bg', 'format-italic', 'format-list-bulleted', 'format-list-numbered', 'format-underlined', 'help', 'image', 'info', 'keyboard-arrow-left', 'keyboard-arrow-right', 'keyboard-double-arrow-left', 'keyboard-double-arrow-right', 'link', 'loading', 'menu', 'minus', 'more-vert', 'person', 'post', 'redo', 'reset', 'search', 'star-fill', 'star-line', 'success', 'table', 'undo', 'video', 'warning', 'widgets'] satisfies IconName20[],
};

/** 스토리 전용 레이아웃 스타일 — Go 템플릿 엔진 충돌 방지용 변수 분리 */
const rowStyle = { display: 'flex', alignItems: 'center', gap: 16 } as const;
const labelStyle = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 } as const;
const selectStyle = { padding: '4px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 } as const;
const captionStyle = { fontSize: 12, color: '#888' } as const;
const ghostInverseBgStyle = { background: '#7B68EE', padding: 24, borderRadius: 8 } as const;

/**
 * size별 아이콘 선택 드롭다운을 포함하는 렌더 래퍼
 */
const ButtonWithIconSelect = (args: ButtonProps & { startIconName?: string; endIconName?: string }) => {
  const sizeKey = args.size || 'md';
  const icons = iconNamesBySize[sizeKey] || iconNamesBySize.md;
  const [startIconName, setStartIconName] = useState(icons[0]);
  const [endIconName, setEndIconName] = useState(icons[0]);

  const currentStart = icons.includes(startIconName) ? startIconName : icons[0];
  const currentEnd = icons.includes(endIconName) ? endIconName : icons[0];

  const iconSizeMap: Record<string, IconSize> = { sm: 16, md: 16, lg: 20 };
  const iconSize = iconSizeMap[sizeKey];

  const startIconProps = args.showStartIcon
    ? { showStartIcon: true as const, startIcon: createIcon(currentStart, iconSize) }
    : { showStartIcon: false as const };

  const endIconProps = args.showEndIcon
    ? { showEndIcon: true as const, endIcon: createIcon(currentEnd, iconSize) }
    : { showEndIcon: false as const };

  return (
    <div style={rowStyle}>
      <Button
        buttonType={args.buttonType}
        size={args.size}
        mode={args.mode}
        interaction={args.interaction}
        label={args.label}
        {...startIconProps}
        {...endIconProps}
      />
      {args.showStartIcon && (
        <label style={labelStyle}>
          Start:
          <select value={currentStart} onChange={(e) => setStartIconName(e.target.value)} style={selectStyle}>
            {icons.map((name: string) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      )}
      {args.showEndIcon && (
        <label style={labelStyle}>
          End:
          <select value={currentEnd} onChange={(e) => setEndIconName(e.target.value)} style={selectStyle}>
            {icons.map((name: string) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      )}
      <span style={captionStyle}>
        Icon{iconSize} · {icons.length}개
      </span>
    </div>
  );
};

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Type` | `buttonType` | HTML `<button type="submit">` 과 충돌 방지를 위해 `buttonType`으로 우회 |',
          '| `Size` | `size` | 동일 |',
          '| `Interaction` | `interaction` | Figma의 `Disabled`, `Focus` 등 개별 속성을 하나의 `interaction` enum으로 통합. `hover`/`pressed`/`focused`는 CSS pseudo-state가 처리하므로 코드에서 직접 지정할 필요 없음 |',
          '| `Show Start Icon` | `showStartIcon` | 동일. Discriminated union — `true`일 때 `startIcon` 필수, `false`일 때 `startIcon` 전달 불가 |',
          '| `Show End Icon` | `showEndIcon` | 동일. `showStartIcon`과 동일한 패턴 |',
          '| `Start Icon` | `startIcon` | size별 사용 가능 아이콘이 다름 (sm/md→Icon16, lg→Icon20) |',
          '| `End Icon` | `endIcon` | size별 사용 가능 아이콘이 다름 (sm/md→Icon16, lg→Icon20) |',
          '| *(children)* | `label` | Figma에서 텍스트 레이어 이름이 `Label`이므로 `label` prop으로 명시화. Self-closing `<Button label="텍스트" />` 형태로 사용 |',
          '',
          '> **참고**: Figma에서 `Disabled`, `Focus` 등은 별도 boolean 속성이지만, 코드에서는 `interaction` enum 하나로 통합하여 상태를 관리합니다. `mode` prop은 Figma에 없는 코드 전용 속성으로, `SpacingModeProvider`를 통해 일괄 제어됩니다.',
          '',
          '### interaction prop 참고',
          '',
          '| 값 | 동작 | 비고 |',
          '|---|---|---|',
          '| `default` | 일반 상태. hover/active/focus는 CSS pseudo-state가 자동 처리 | **대부분의 사용 케이스** |',
          '| `disabled` | HTML disabled + 비활성 스타일 + cursor not-allowed | 클릭 차단 |',
          '| `loading` | HTML disabled + 스피너 표시 + cursor wait | 클릭 차단 |',
          '| `hover` / `pressed` / `focused` | Figma 상태 대응용 예약값. 현재 `default`와 동일하게 동작 | 스타일 강제 적용 미구현 |',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    buttonType: {
      control: { type: 'select' },
      options: Object.values(ButtonType),
      description: 'Figma: `Type`. HTML `type` 속성 충돌 방지를 위해 `buttonType`으로 명명',
    },
    size: {
      control: { type: 'select' },
      options: Object.values(Size),
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(Mode),
      description: 'Figma에 없는 코드 전용 속성. `SpacingModeProvider`로 일괄 제어 가능, 개별 prop으로 오버라이드 가능',
    },
    interaction: {
      control: { type: 'select' },
      options: Object.values(Interaction),
      description: 'Figma의 Disabled, Focus 등 개별 속성을 하나의 enum으로 통합. `disabled`/`loading`만 기능적 효과 있음',
    },
    label: {
      control: { type: 'text' },
      description: 'Figma: `Label` 텍스트 레이어. V1의 `children` 대체',
    },
    showStartIcon: {
      control: { type: 'boolean' },
      description: 'Figma: `Show Start Icon`. `true`이면 `startIcon` 필수, `false`이면 `startIcon` 전달 불가 (discriminated union)',
    },
    showEndIcon: {
      control: { type: 'boolean' },
      description: 'Figma: `Show End Icon`. `showStartIcon`과 동일한 타입 패턴',
    },
    startIcon: {
      control: false,
      description: 'size별 사용 가능 아이콘이 다름 (sm/md→Icon16, lg→Icon20). render에서 동적 선택',
    },
    endIcon: {
      control: false,
      description: 'size별 사용 가능 아이콘이 다름 (sm/md→Icon16, lg→Icon20). render에서 동적 선택',
    },
    onClick: { action: 'clicked', table: { disable: true } },
    onMouseEnter: { action: 'hovered', table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  name: 'Primary',
  args: {
    buttonType: ButtonType.PRIMARY,
    size: Size.MD,
    mode: Mode.BASE,
    interaction: Interaction.DEFAULT,
    label: 'Button',
    showStartIcon: false,
    showEndIcon: false,
  },
  render: (args) => <ButtonWithIconSelect {...args} />,
};

export const Secondary: Story = {
  name: 'Secondary',
  args: {
    ...Primary.args,
    buttonType: ButtonType.SECONDARY,
  },
  render: (args) => <ButtonWithIconSelect {...args} />,
};

export const Ghost: Story = {
  name: 'Ghost',
  args: {
    ...Primary.args,
    buttonType: ButtonType.GHOST,
  },
  render: (args) => <ButtonWithIconSelect {...args} />,
};

export const Tertiary: Story = {
  name: 'Tertiary',
  args: {
    ...Primary.args,
    buttonType: ButtonType.TERTIARY,
  },
  render: (args) => <ButtonWithIconSelect {...args} />,
};

export const Destructive: Story = {
  name: 'Destructive',
  args: {
    ...Primary.args,
    buttonType: ButtonType.DESTRUCTIVE,
  },
  render: (args) => <ButtonWithIconSelect {...args} />,
};

export const SecondaryDestructive: Story = {
  name: 'Secondary Destructive',
  args: {
    ...Primary.args,
    buttonType: ButtonType.SECONDARY_DESTRUCTIVE,
  },
  render: (args) => <ButtonWithIconSelect {...args} />,
};

export const GhostInverse: Story = {
  name: 'Ghost Inverse',
  args: {
    ...Primary.args,
    buttonType: ButtonType.GHOST_INVERSE,
  },
  decorators: [(Story) => (
    <div style={ghostInverseBgStyle}>
      <Story />
    </div>
  )],
  render: (args) => <ButtonWithIconSelect {...args} />,
};

