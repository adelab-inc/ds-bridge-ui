import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { ToggleSwitch } from '../components/ToggleSwitch';
import { ToggleSwitchSelected } from '../types';

const meta: Meta<typeof ToggleSwitch> = {
  title: 'UI/ToggleSwitch',
  component: ToggleSwitch,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `selected` | `selected` | 동일. `on` / `off` / `disabled` |',
          '',
          '### V1 → V2 변경 사항',
          '',
          '| V1 | V2 | 변경 내용 |',
          '|---|---|---|',
          '| `checked` (boolean) + `disabled` (boolean) | `selected` (enum) | Figma `selected` 1:1 대응. `ToggleSwitchSelected.ON` / `.OFF` / `.DISABLED` |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    selected: {
      control: 'select',
      options: Object.values(ToggleSwitchSelected),
      description: 'Figma: `selected`. 토글 상태 (on/off/disabled)',
    },
    'aria-label': {
      control: 'text',
      description: '접근성을 위한 ARIA 레이블',
    },
  },
  args: {
    selected: ToggleSwitchSelected.OFF,
    'aria-label': 'Toggle switch',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [selected, setSelected] = React.useState<'on' | 'off' | 'disabled'>(args.selected ?? ToggleSwitchSelected.OFF);

    React.useEffect(() => {
      setSelected(args.selected ?? ToggleSwitchSelected.OFF);
    }, [args.selected]);

    return (
      <ToggleSwitch
        selected={selected}
        onChange={() => {
          if (selected !== ToggleSwitchSelected.DISABLED) {
            setSelected(selected === ToggleSwitchSelected.ON ? ToggleSwitchSelected.OFF : ToggleSwitchSelected.ON);
          }
        }}
        aria-label={args['aria-label']}
      />
    );
  },
};
