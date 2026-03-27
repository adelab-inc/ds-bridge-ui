import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { LabelValue } from '../components/LabelValue';
import { createIcon, type IconName16, type IconName20, type IconSize } from '../components/Icon';
import { Size, Mode, LabelValueLabelWidth } from '../types';

// ─── Icon/Prefix 선택 옵션 ───

const iconNamesBySize: Record<string, string[]> = {
  sm: ['add', 'announcement', 'blank', 'calendar', 'check', 'chevron-down', 'close', 'search'] satisfies IconName16[],
  md: ['add', 'arrow-right', 'blank', 'calendar', 'check', 'chevron-down', 'close', 'info', 'search', 'person'] satisfies IconName20[],
};

const prefixOptions: Record<string, React.ReactNode> = {
  '\u20A9': '\u20A9',
  '$': '$',
  '@': '@',
  '+82': '+82',
  'https://': 'https://',
};

/** 스토리 전용 레이아웃 스타일 */
const selectStyle = { padding: '4px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 } as const;
const labelStyle = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 } as const;
const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: 16 } as const;
const flexOneStyle = { flex: 1 } as const;
const controlColumnStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 } as const;

type LabelValueStoryArgs = {
  size?: 'md' | 'sm';
  mode?: 'base' | 'compact' | null;
  labelWidth?: 'compact' | 'default' | 'wide';
  text?: string;
  showLabel?: boolean;
  label?: string;
  showHelptext?: boolean;
  helptext?: string;
  showPrefix?: boolean;
  showStartIcon?: boolean;
  showEndIcon?: boolean;
  [key: string]: unknown;
};

const LabelValueWithControls = (args: LabelValueStoryArgs) => {
  const sizeKey = args.size || 'md';
  const icons = iconNamesBySize[sizeKey] || iconNamesBySize.md;
  const [startIconName, setStartIconName] = React.useState(icons[0]);
  const [endIconName, setEndIconName] = React.useState(icons[0]);
  const [prefixKey, setPrefixKey] = React.useState<string>('\u20A9');

  const currentStart = icons.includes(startIconName) ? startIconName : icons[0];
  const currentEnd = icons.includes(endIconName) ? endIconName : icons[0];

  const iconSizeMap: Record<string, IconSize> = { sm: 16, md: 20 };
  const iconSize = iconSizeMap[sizeKey];

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

  return (
    <div style={rowStyle}>
      <div style={flexOneStyle}>
        <LabelValue
          {...{
            size: args.size,
            mode: args.mode,
            labelWidth: args.labelWidth,
            text: args.text || '',
            ...labelProps,
            ...helptextProps,
            ...prefixProps,
            ...startIconProps,
            ...endIconProps,
          } as React.ComponentProps<typeof LabelValue>}
        />
      </div>
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
    </div>
  );
};

const meta: Meta<typeof LabelValue> = {
  title: 'UI/LabelValue',
  component: LabelValue,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: [
          '## Figma \u2194 Code \uC778\uD130\uD398\uC774\uC2A4 \uB9E4\uD551',
          '',
          '| Figma Property | Code Prop | \uCC28\uC774\uC810 \uBC0F \uC774\uC720 |',
          '|---|---|---|',
          '| `Size` | `size` | \uB3D9\uC77C (sm/md) |',
          '| `Label Width` | `labelWidth` | \uB3D9\uC77C (compact/default/wide) |',
          '| `showLabel` | `showLabel` | \uB3D9\uC77C. Discriminated union |',
          '| `showHelptext` | `showHelptext` | \uB3D9\uC77C. Discriminated union |',
          '| `showPrefix` | `showPrefix` | \uB3D9\uC77C |',
          '| `showStartIcon` | `showStartIcon` | \uB3D9\uC77C |',
          '| `showEndIcon` | `showEndIcon` | \uB3D9\uC77C |',
          '| `text` | `text` | \uD45C\uC2DC\uD560 \uAC12 \uD14D\uC2A4\uD2B8 |',
          '',
          '> `mode` prop\uC740 Figma\uC5D0 \uC5C6\uB294 \uCF54\uB4DC \uC804\uC6A9 \uC18D\uC131\uC73C\uB85C, `SpacingModeProvider`\uB97C \uD1B5\uD574 \uC77C\uAD04 \uC81C\uC5B4\uB429\uB2C8\uB2E4.',
          '',
          '### LabelValue vs Field',
          '',
          '| \uAD6C\uBD84 | LabelValue | Field |',
          '|---|---|---|',
          '| \uC6A9\uB3C4 | \uC870\uD68C \uC804\uC6A9 \uD45C\uC2DC | \uC785\uB825/\uD3B8\uC9D1 |',
          '| \uB808\uC774\uC544\uC6C3 | \uC218\uD3C9 (label \uC67C\uCABD, value \uC624\uB978\uCABD) | \uC218\uC9C1 (label \uC0C1\uB2E8, input \uD558\uB2E8) |',
          '| \uAC12 \uC601\uC5ED | `<p>` \uD14D\uC2A4\uD2B8 + `bg-field-bg-filled` | `<input>` + border |',
          '| Interaction | \uC5C6\uC74C (\uC21C\uC218 \uC870\uD68C) | default/editing/display/readonly/disabled |',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: [Size.MD, Size.SM],
      description: 'Figma: Size',
    },
    labelWidth: {
      control: { type: 'select' },
      options: Object.values(LabelValueLabelWidth),
      description: 'Figma: Label Width',
    },
    text: {
      control: { type: 'text' },
      description: '\uD45C\uC2DC\uD560 \uAC12 \uD14D\uC2A4\uD2B8',
    },
    showLabel: {
      control: { type: 'boolean' },
      description: 'Figma: showLabel',
    },
    label: {
      control: { type: 'text' },
      description: 'Figma: label',
      if: { arg: 'showLabel', eq: true },
    },
    showHelptext: {
      control: { type: 'boolean' },
      description: 'Figma: showHelptext',
    },
    helptext: {
      control: { type: 'text' },
      description: 'Figma: helptext',
      if: { arg: 'showHelptext', eq: true },
    },
    showPrefix: {
      control: { type: 'boolean' },
      description: 'Figma: showPrefix',
    },
    showStartIcon: {
      control: { type: 'boolean' },
      description: 'Figma: showStartIcon',
    },
    showEndIcon: {
      control: { type: 'boolean' },
      description: 'Figma: showEndIcon',
    },
    mode: {
      control: { type: 'select' },
      options: Object.values(Mode),
      description: 'SpacingModeProvider \uC77C\uAD04 \uC81C\uC5B4',
    },

    // ─── 컨트롤 패널에서 숨길 Props ───
    prefix: { table: { disable: true } },
    startIcon: { table: { disable: true } },
    endIcon: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof LabelValue>;

// 기본 LabelValue
export const Default: Story = {
  name: '\uAE30\uBCF8',
  args: {
    size: 'md',
    mode: Mode.BASE,
    labelWidth: LabelValueLabelWidth.DEFAULT,
    text: '\uD45C\uC2DC \uAC12',
    showLabel: true,
    label: '\uB808\uC774\uBE14',
    showHelptext: true,
    helptext: '\uB3C4\uC6C0\uB9D0 \uD14D\uC2A4\uD2B8\uC785\uB2C8\uB2E4.',
    showPrefix: false,
    showStartIcon: false,
    showEndIcon: false,
  },
  render: (args) => <LabelValueWithControls {...args} />,
};
