import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { Radio } from '../components/Radio';
import { RadioValue, Interaction } from '../types';

const meta: Meta<typeof Radio> = {
  title: 'UI/Radio',
  component: Radio,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `value` | `value` | 동일. `unchecked` / `checked` |',
          '| `disabled` | `interaction` | Figma의 `disabled`, `Focus` 등 개별 속성을 하나의 `interaction` enum으로 통합 (Button 패턴) |',
          '| `Height` | `size` | 이름 다름. 모든 컴포넌트가 `size`를 사용하므로 일관성을 위해 `height` 대신 `size` 유지. `16` / `18`(default) / `20` / `24` / `28` |',
          '| `Focus` | — | CSS `focus-visible` 자동 처리 |',
          '| `Interaction` | — | CSS `hover`/`active` 자동 처리 |',
          '',
          '### V1 → V2 변경 사항',
          '',
          '| V1 | V2 | 변경 내용 |',
          '|---|---|---|',
          '| `checked` (boolean) | `value` (enum) | Figma `value` 1:1 대응. `RadioValue.UNCHECKED` / `RadioValue.CHECKED` |',
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
      options: Object.values(RadioValue),
      description: 'Figma: `value`. 체크 상태 (unchecked/checked)',
    },
    interaction: {
      control: 'select',
      options: ['default', 'hover', 'pressed', 'disabled'],
      description: 'Figma: `Interaction` + `disabled` 통합. `disabled`만 기능적 효과 있음',
    },
    size: {
      control: 'select',
      options: ['16', '18', '20', '24', '28'],
      description: 'Figma: `Height`. 라디오 높이',
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
type Story = StoryObj<typeof Radio>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = React.useState<'unchecked' | 'checked'>(args.value || RadioValue.UNCHECKED);

    React.useEffect(() => {
      setValue(args.value || RadioValue.UNCHECKED);
    }, [args.value]);

    const handleClick = () => {
      if (args.interaction === Interaction.DISABLED) return;
      setValue(prev => prev === RadioValue.UNCHECKED ? RadioValue.CHECKED : RadioValue.UNCHECKED);
    };

    return (
      <div onClick={handleClick} className="contents">
        <Radio
          {...args}
          value={value}
          renderContainer="div"
          onChange={() => {}}
        />
      </div>
    );
  },
  args: {
    value: RadioValue.UNCHECKED,
    interaction: Interaction.DEFAULT,
    size: '18',
    'aria-label': 'Radio button',
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <Radio value={RadioValue.UNCHECKED} interaction={Interaction.DISABLED} aria-label="unchecked disabled" />
        <span className="text-xs text-text-secondary">Unchecked</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Radio value={RadioValue.CHECKED} interaction={Interaction.DISABLED} aria-label="checked disabled" />
        <span className="text-xs text-text-secondary">Checked</span>
      </div>
    </div>
  ),
};
