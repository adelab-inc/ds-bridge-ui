import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Field } from '../components/Field';
import { createIcon, type IconName16, type IconName20, type IconSize } from '../components/Icon';
import { FieldInteraction, Size, Mode } from '../types';

// ─── Icon/Prefix 선택 옵션 ───

/**
 * Size별 아이콘 목록 — Field size → Icon size 매핑 (md→20, sm→16)
 */
const iconNamesBySize: Record<string, string[]> = {
  sm: ['add', 'announcement', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'external', 'loading', 'minus', 'more-vert', 'reset', 'search', 'star-fill', 'star-line'] satisfies IconName16[],
  md: ['add', 'all', 'arrow-drop-down', 'arrow-drop-up', 'arrow-right', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'error', 'external', 'filter-list', 'folder', 'folder-fill', 'format-align-center', 'format-align-left', 'format-align-right', 'format-bold', 'format-color-text', 'format-color-text-bg', 'format-italic', 'format-list-bulleted', 'format-list-numbered', 'format-underlined', 'help', 'image', 'info', 'keyboard-arrow-left', 'keyboard-arrow-right', 'keyboard-double-arrow-left', 'keyboard-double-arrow-right', 'link', 'loading', 'menu', 'minus', 'more-vert', 'person', 'post', 'redo', 'reset', 'search', 'star-fill', 'star-line', 'success', 'table', 'undo', 'video', 'warning', 'widgets'] satisfies IconName20[],
};

const prefixOptions: Record<string, React.ReactNode> = {
  '₩': '₩',
  '$': '$',
  '@': '@',
  '+82': '+82',
  'https://': 'https://',
};

/** 스토리 전용 레이아웃 스타일 — Go 템플릿 엔진 충돌 방지용 변수 분리 */
const selectStyle = { padding: '4px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 } as const;
const labelStyle = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 } as const;
const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: 16 } as const;
const flexOneStyle = { flex: 1 } as const;
const controlColumnStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 } as const;

/**
 * show* discriminated union을 Storybook args에서 안전하게 처리하는 렌더 래퍼
 * - showPrefix/showStartIcon/showEndIcon 토글에 따라 아이콘/prefix 선택 UI 표시
 */
type FieldStoryArgs = {
  size?: 'md' | 'sm';
  mode?: 'base' | 'compact' | null;
  interaction?: 'default' | 'editing' | 'value' | 'display' | 'readonly' | 'disabled' | null;
  hasError?: boolean;
  multiline?: boolean;
  rowsVariant?: 'flexible' | 'rows4' | 'rows6' | 'rows8';
  required?: boolean;
  placeholder?: string;
  showLabel?: boolean;
  label?: string;
  showHelptext?: boolean;
  helptext?: string;
  showPrefix?: boolean;
  showStartIcon?: boolean;
  showEndIcon?: boolean;
  startIconName?: string;
  endIconName?: string;
  [key: string]: unknown;
};

const FieldWithControls = (args: FieldStoryArgs) => {
  const sizeKey = args.size || 'md';
  const icons = iconNamesBySize[sizeKey] || iconNamesBySize.md;
  const [startIconName, setStartIconName] = React.useState(icons[0]);
  const [endIconName, setEndIconName] = React.useState(icons[0]);
  const [prefixKey, setPrefixKey] = React.useState<string>('₩');

  const currentStart = icons.includes(startIconName) ? startIconName : icons[0];
  const currentEnd = icons.includes(endIconName) ? endIconName : icons[0];

  const iconSizeMap: Record<string, IconSize> = { sm: 16, md: 20 };
  const iconSize = iconSizeMap[sizeKey];

  // show* 에 따라 discriminated union props 조합
  const labelProps = args.showLabel
    ? { showLabel: true as const, label: args.label ?? '' }
    : { showLabel: false as const };

  const helptextProps = args.showHelptext
    ? { showHelptext: true as const, helptext: args.helptext ?? '' }
    : { showHelptext: false as const };

  const prefixProps = args.showPrefix
    ? { showPrefix: true as const, prefix: prefixOptions[prefixKey] }
    : { showPrefix: false as const };

  const startIconProps = args.showStartIcon
    ? { showStartIcon: true as const, startIcon: createIcon(currentStart, iconSize) }
    : { showStartIcon: false as const };

  const endIconProps = args.showEndIcon
    ? { showEndIcon: true as const, endIcon: createIcon(currentEnd, iconSize) }
    : { showEndIcon: false as const };

  // multiline이면 prefix/icon props 제외
  const singleLineOnlyProps = args.multiline
    ? {}
    : { ...prefixProps, ...startIconProps, ...endIconProps };

  return (
    <div style={rowStyle}>
      <div style={flexOneStyle}>
        <Field
          {...{
            size: args.size,
            mode: args.mode,
            interaction: args.interaction,
            hasError: args.hasError,
            multiline: args.multiline,
            rowsVariant: args.rowsVariant,
            required: args.required,
            placeholder: args.placeholder,
            ...labelProps,
            ...helptextProps,
            ...singleLineOnlyProps,
          } as React.ComponentProps<typeof Field>}
        />
      </div>
      {!args.multiline && (
        <div style={controlColumnStyle}>
          {args.showPrefix && (
            <label style={labelStyle}>
              Prefix:
              <select value={prefixKey} onChange={(e) => setPrefixKey(e.target.value)} style={selectStyle}>
                {Object.keys(prefixOptions).map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
          )}
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
        </div>
      )}
    </div>
  );
};

const meta: Meta<typeof Field> = {
  title: 'UI/Field',
  component: Field,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Size` | `size` | 동일 |',
          '| `Interaction` + `Disabled` | `interaction` | Figma의 `Interaction`(default/editing/value/readonly)과 `Disabled` boolean을 하나의 `FieldInteraction` enum으로 통합 |',
          '| `showLabel` | `showLabel` | 동일. Discriminated union — `true`일 때 `label` 필수, `false`일 때 `label` 전달 불가 |',
          '| `showHelptext` | `showHelptext` | 동일. `showLabel`과 동일한 타입 패턴 |',
          '| `showPrefix` | `showPrefix` | 동일. single-line 전용 |',
          '| `showStartIcon` | `showStartIcon` | 동일. single-line 전용 |',
          '| `showEndIcon` | `showEndIcon` | 동일. single-line 전용 |',
          '| `showAsterisk` | `required` | HTML 시맨틱 우선. `required` 설정 시 `*` 표시 + aria-required 자동 처리 |',
          '| `label` | `label` | 동일 |',
          '| `helptext` | `helptext` | 동일. V1의 `helperText`에서 Figma 매칭으로 변경 |',
          '| `prefix` | `prefix` | 동일. single-line 전용 |',
          '| `Focus` | — | CSS `focus-visible`로 자동 처리 |',
          '| `Display` | `interaction: "display"` | 보여주기 전용. readOnly와 유사하나 배경이 `bg/filled`로 다름 |',
          '',
          '> `mode` prop은 Figma에 없는 코드 전용 속성으로, `SpacingModeProvider`를 통해 일괄 제어됩니다.',
          '',
          '### interaction prop 참고',
          '',
          '| 값 | 동작 | 비고 |',
          '|---|---|---|',
          '| `default` | 일반 상태. hover/focus는 CSS pseudo-state가 자동 처리 | **대부분의 사용 케이스** |',
          '| `editing` | Figma 상태 대응용 예약값. 현재 `default`와 동일하게 동작 | 내부 focus/change로 자동 관리 |',
          '| `value` | Figma 상태 대응용 예약값. 현재 `default`와 동일하게 동작 | 내부 value 상태로 자동 관리 |',
          '| `display` | readOnly + `bg/filled` 배경 + 탭 포커스 제외 + 폼 제출 제외. 순수 텍스트 표시 전용 | **실제 기능** |',
          '| `readonly` | HTML readOnly + 읽기 전용 배경 스타일 | **실제 기능** |',
          '| `disabled` | HTML disabled + 비활성 스타일 + cursor not-allowed | **실제 기능** |',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    // ─── Figma 주요 Props ───
    size: {
      control: { type: 'select' },
      options: Object.values(Size).filter(v => v !== 'lg'),
      description: 'Figma: Size',
    },
    interaction: {
      control: { type: 'select' },
      options: Object.values(FieldInteraction),
      description: 'Figma: Interaction + Disabled 통합',
    },
    hasError: {
      control: { type: 'boolean' },
      description: '에러 상태',
    },
    multiline: {
      control: { type: 'boolean' },
      description: '여러 줄 입력 모드 (textarea)',
    },
    rowsVariant: {
      control: { type: 'select' },
      options: ['flexible', 'rows4', 'rows6', 'rows8'],
      description: 'Multiline 모드에서 행 수',
      if: { arg: 'multiline', eq: true },
    },
    required: {
      control: { type: 'boolean' },
      description: '필수 입력 표시 (Figma: showAsterisk)',
    },
    placeholder: {
      control: { type: 'text' },
      description: '플레이스홀더 텍스트',
    },

    // ─── show* 토글 ───
    showLabel: {
      control: { type: 'boolean' },
      description: 'Figma: showLabel. true이면 label 필수, false이면 label 전달 불가',
    },
    label: {
      control: { type: 'text' },
      description: 'Figma: label',
      if: { arg: 'showLabel', eq: true },
    },
    showHelptext: {
      control: { type: 'boolean' },
      description: 'Figma: showHelptext. true이면 helptext 필수, false이면 helptext 전달 불가',
    },
    helptext: {
      control: { type: 'text' },
      description: 'Figma: helptext',
      if: { arg: 'showHelptext', eq: true },
    },
    showPrefix: {
      control: { type: 'boolean' },
      description: 'Figma: showPrefix (single-line 전용). prefix는 렌더 영역 옆 드롭다운에서 선택',
      if: { arg: 'multiline', eq: false },
    },
    showStartIcon: {
      control: { type: 'boolean' },
      description: 'Figma: showStartIcon (single-line 전용). 아이콘은 렌더 영역 옆 드롭다운에서 선택',
      if: { arg: 'multiline', eq: false },
    },
    showEndIcon: {
      control: { type: 'boolean' },
      description: 'Figma: showEndIcon (single-line 전용). 아이콘은 렌더 영역 옆 드롭다운에서 선택',
      if: { arg: 'multiline', eq: false },
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(Mode),
      description: 'Figma에 없는 코드 전용 속성. SpacingModeProvider로 일괄 제어',
    },

    // ─── 컨트롤 패널에서 숨길 Props ───
    prefix: { table: { disable: true } },
    startIcon: { table: { disable: true } },
    endIcon: { table: { disable: true } },
    onStartIconClick: { table: { disable: true } },
    onEndIconClick: { table: { disable: true } },
    inputProps: { table: { disable: true } },
    labelProps: { table: { disable: true } },
    helperTextProps: { table: { disable: true } },
    startIconProps: { table: { disable: true } },
    endIconProps: { table: { disable: true } },
    id: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Field>;

// 기본 Field
export const Default: Story = {
  name: '기본',
  args: {
    size: 'md',
    mode: Mode.BASE,
    interaction: FieldInteraction.DEFAULT,
    hasError: false,
    multiline: false,
    required: false,
    showLabel: true,
    label: '레이블',
    showHelptext: true,
    helptext: '도움말 텍스트입니다.',
    showPrefix: false,
    showStartIcon: false,
    showEndIcon: false,
    placeholder: '입력하세요',
  },
  render: (args) => <FieldWithControls {...args} />,
};

// Multiline Field
export const Multiline: Story = {
  name: 'Multiline (Textarea)',
  args: {
    multiline: true,
    rowsVariant: 'rows4',
    size: 'md',
    mode: Mode.BASE,
    interaction: FieldInteraction.DEFAULT,
    hasError: false,
    required: false,
    showLabel: true,
    label: '설명',
    showHelptext: true,
    helptext: '최대 500자까지 입력 가능합니다.',
    placeholder: '여러 줄 입력하세요',
  },
  render: (args) => <FieldWithControls {...args} />,
};

