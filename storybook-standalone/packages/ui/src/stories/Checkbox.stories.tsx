import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { Checkbox } from '../components/Checkbox';
import { CheckboxValue, Interaction } from '../types';

const meta: Meta<typeof Checkbox> = {
  title: 'UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Value` | `value` | 동일. `unchecked` / `checked` / `indeterminate` |',
          '| `Disabled` | `interaction` | Figma의 `Disabled`, `Focus` 등 개별 속성을 하나의 `interaction` enum으로 통합 (Button 패턴) |',
          '| `Height` | `size` | 이름 다름. 모든 컴포넌트가 `size`를 사용하므로 일관성을 위해 `height` 대신 `size` 유지. `16` / `18`(default) / `20` / `24` / `28` |',
          '| `Focus` | — | CSS `focus-visible` 자동 처리 |',
          '| `Interaction` | — | CSS `hover`/`active` 자동 처리 |',
          '',
          '### V1 → V2 변경 사항',
          '',
          '| V1 | V2 | 변경 내용 |',
          '|---|---|---|',
          '| `checked` (boolean) + `variant` (checked/indeterminate) | `value` (unchecked/checked/indeterminate) | Figma `Value` 단일 prop으로 통합 |',
          '| `disabled` (boolean) | `interaction` (enum) | `Interaction.DISABLED`로 통합 (Button 패턴) |',
          '| `size` (string) | `size` (string) | 유지 |',
        ].join('\n'),
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex items-center min-h-[40px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    value: {
      control: 'select',
      options: Object.values(CheckboxValue),
      description: 'Figma: `Value`. 체크 상태 (unchecked/checked/indeterminate)',
    },
    interaction: {
      control: 'select',
      options: ['default', 'hover', 'pressed', 'disabled'],
      description: 'Figma: `Interaction` + `Disabled` 통합. `disabled`만 기능적 효과 있음',
    },
    size: {
      control: 'select',
      options: ['16', '18', '20', '24', '28'],
      description: 'Figma: `Height`. 체크박스 높이',
    },
    'aria-label': {
      control: 'text',
      description: '접근성 라벨',
    },
    onChange: { table: { disable: true } },
    renderContainer: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<'unchecked' | 'checked' | 'indeterminate'>(args.value || CheckboxValue.UNCHECKED);

    React.useEffect(() => {
      setValue(args.value || CheckboxValue.UNCHECKED);
    }, [args.value]);

    const onValue = args.value === CheckboxValue.UNCHECKED ? CheckboxValue.CHECKED : args.value || CheckboxValue.CHECKED;

    const handleChange = () => {
      setValue(prev => prev === CheckboxValue.UNCHECKED ? onValue : CheckboxValue.UNCHECKED);
    };

    return (
      <Checkbox
        {...args}
        value={value}
        onChange={handleChange}
      />
    );
  },
  args: {
    value: CheckboxValue.UNCHECKED,
    interaction: Interaction.DEFAULT,
    size: '18',
    'aria-label': 'Checkbox',
  },
};

export const Disabled: Story = {
  argTypes: {
    size: { table: { disable: true } },
    value: { table: { disable: true } },
    interaction: { table: { disable: true } },
    'aria-label': { table: { disable: true } },
  },
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <Checkbox value={CheckboxValue.UNCHECKED} interaction={Interaction.DISABLED} aria-label="unchecked disabled" />
        <span className="text-xs text-text-secondary">Unchecked</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Checkbox value={CheckboxValue.CHECKED} interaction={Interaction.DISABLED} aria-label="checked disabled" />
        <span className="text-xs text-text-secondary">Checked</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Checkbox value={CheckboxValue.INDETERMINATE} interaction={Interaction.DISABLED} aria-label="indeterminate disabled" />
        <span className="text-xs text-text-secondary">Indeterminate</span>
      </div>
    </div>
  ),
};
