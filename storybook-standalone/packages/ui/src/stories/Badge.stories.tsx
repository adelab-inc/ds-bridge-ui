import type { Meta, StoryObj } from '@storybook/react';

import { Badge, type BadgeProps } from '../components/Badge';

/** Storybook 컨트롤용 — discriminated union의 모든 필드를 옵셔널로 합친 타입 */
type BadgeStoryArgs = {
  type: BadgeProps['type'];
  level?: string;
  status?: string;
  appearance?: string;
  label?: string;
  maxDigits?: number;
  position?: string;
  mode?: string;
};

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '### Badge (Type별 서브 컴포넌트 통합)',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Type` (Level/Status/Count/dot) | `type` | 이름 동일. discriminated union으로 type별 prop 제한 |',
          '| `Level` (Primary/neutral) | `level` | V1 `levelVariant`에서 Figma 이름으로 간결화 |',
          '| `Status` (info/success/warning/error) | `status` | V1 `statusVariant`에서 Figma 이름으로 간결화 |',
          '| `Style` (solid/subtle) | `appearance` | HTML `style` 속성 충돌 회피. Button의 `type`→`buttonType`과 동일 논리 |',
          '| `label` | `label` | V1 `children`에서 Figma 이름으로 변경. ReactNode 타입 유지 |',
          '| `digits` (single/multi) | `maxDigits` | Figma는 시각 구분용, 코드는 실용적 자릿수 제한 (99+ 표시) |',
          '',
          '### 코드 전용 기능 (Figma에 없음)',
          '',
          '| Code Prop | 설명 |',
          '|---|---|',
          '| `mode` (base/compact) | SpacingModeProvider 연동. spacing density 제어 |',
          '| `position` (top-right 등) | dot type 전용. 부모 기준 절대 위치 배치 |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['level', 'status', 'count', 'dot'],
      description: 'Figma: `Type`. 배지의 타입을 선택합니다.',
    },
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode (코드 전용)',
    },
    level: {
      control: { type: 'select' },
      options: ['primary', 'neutral'],
      description: 'Figma: `Level`. level 타입의 세부 종류',
      if: { arg: 'type', eq: 'level' },
    },
    status: {
      control: { type: 'select' },
      options: ['info', 'success', 'warning', 'error'],
      description: 'Figma: `Status`. status 타입의 세부 종류',
      if: { arg: 'type', eq: 'status' },
    },
    appearance: {
      control: { type: 'select' },
      options: ['solid', 'subtle'],
      description: 'Figma: `Style`. 배지의 스타일 (solid: 채워진 배경, subtle: 연한 배경)',
      if: { arg: 'type', neq: 'dot' },
    },
    label: {
      control: { type: 'text' },
      description: 'Figma: `label`. 배지 내부에 표시될 내용 (dot 제외)',
      if: { arg: 'type', neq: 'dot' },
    },
    maxDigits: {
      control: { type: 'number' },
      description: 'Figma: `digits`의 구현체. 최대 자릿수 초과 시 "99+" 형태 표시',
      if: { arg: 'type', eq: 'count' },
    },
    position: {
      control: { type: 'select' },
      options: [undefined, 'top-right', 'top-left', 'bottom-right', 'bottom-left'],
      description: 'dot type 전용. 부모 요소(relative) 기준 절대 위치 배치',
      if: { arg: 'type', eq: 'dot' },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<BadgeStoryArgs>;

export const Default: Story = {
  render: (args) => {
    const { type, position, ...rest } = args as BadgeStoryArgs;

    // dot type: relative 부모 컨테이너(truncate 텍스트)로 감싸서 절대 위치 시연
    if (type === 'dot') {
      return (
        <span className="relative inline-flex">
          <span className="truncate text-body-sm-regular text-text-secondary">알림</span>
          <Badge type="dot" position={position as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'} mode={rest.mode as 'base' | 'compact'} />
        </span>
      );
    }

    return <Badge {...({ type, ...rest } as BadgeProps)} />;
  },
  args: {
    type: 'level',
    level: 'primary',
    status: 'info',
    mode: 'base',
    appearance: 'solid',
    label: 'Badge',
    position: 'top-right',
  },
};
