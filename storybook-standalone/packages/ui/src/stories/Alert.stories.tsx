import type { Meta, StoryObj } from '@storybook/react';

import { Alert } from '../components/Alert';
import { Icon } from '../components/Icon';

const iconMap = {
  none: undefined,
  'info': <Icon name="info" size={20} />,
  'success': <Icon name="success" size={20} />,
  'warning': <Icon name="warning" size={20} />,
  'error': <Icon name="error" size={20} />,
  'search': <Icon name="search" size={20} />,
};

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '### AlertInline / AlertToast 공통',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Layout` (Single/Stacked) | 제거됨 | Figma에서 케이스 분류용 속성. `showTitle` 여부로 자동 결정 |',
          '| `Type` (AlertInline) / `State` (AlertToast) | `type` | Figma 내부에서도 이름 불일치. `type`으로 통일 |',
          '| `body` | `body` | Figma는 string이지만 코드는 `ReactNode`로 확장 |',
          '| `title` | `title` | `showTitle=true`일 때만 제공 가능 (discriminated union) |',
          '| `showTitle` | `showTitle` | `true`이면 stacked 레이아웃 자동 적용 |',
          '| `showIcon` | `showIcon` | `true`일 때만 `icon` prop 제공 가능 |',
          '| `showClose` | `showClose` | V1 `hasCloseButton`에서 Figma 이름으로 변경 |',
          '| `showActionGroup` | `showActionGroup` | `true`일 때 `showAction1`/`showAction2` 활성화 |',
          '| `showAction1` / `showAction2` | `showAction1` / `showAction2` | `true`일 때 label+onClick 필수 |',
          '| `icon20` (instance swap) | `icon` | `showIcon=true`일 때 커스텀 아이콘 전달 |',
          '',
          '---',
          '',
          '## Prop 제약사항 (Discriminated Union)',
          '',
          '모든 제약은 TypeScript 컴파일 레벨에서 강제됩니다. 위반 시 타입 에러가 발생합니다.',
          '',
          '### 레이아웃 자동 결정',
          '',
          '| showTitle | 렌더링 | body 동작 |',
          '|---|---|---|',
          '| `false` (기본값) | 단순 레이아웃 (아이콘 + 본문 + 액션 + 닫기) | 자연 줄바꿈, 제한 없음 |',
          '| `true` | Stacked 레이아웃 (제목 아래 본문, 액션 분리) | 자연 줄바꿈, 제한 없음 |',
          '',
          '### Icon 제약',
          '',
          '| showIcon | icon prop | 동작 |',
          '|---|---|---|',
          '| `false` (기본값) | 사용 불가 (`never`) | 아이콘 영역 렌더링 안 됨 |',
          '| `true` | 생략 가능 | 생략 시 `type`별 기본 아이콘 자동 표시. `type="default"`는 기본 아이콘 없음 |',
          '| `true` | 커스텀 아이콘 전달 | 기본 아이콘 대신 커스텀 아이콘 표시 |',
          '',
          '### Title 제약',
          '',
          '| showTitle | title prop | 동작 |',
          '|---|---|---|',
          '| `false` (기본값) | 사용 불가 (`never`) | 제목 행 렌더링 안 됨 |',
          '| `true` | **필수** (`string`) | 제목 행 표시. 닫기 버튼은 제목 우측에 배치 |',
          '',
          '### Action 제약 (중첩 Discriminated Union)',
          '',
          '| showActionGroup | showAction1/2 | label/onClick |',
          '|---|---|---|',
          '| `false` (기본값) | 사용 불가 (`never`) | 사용 불가 (`never`) |',
          '| `true` | 개별 ON/OFF 가능 | `showAction1=true`이면 `action1Label` + `action1OnClick` **필수** |',
          '',
          '### Close 버튼',
          '',
          '`showClose`만으로는 닫기 버튼이 표시되지 않습니다. **`onClose` 핸들러가 반드시 함께 필요**합니다.',
          '',
          '### Toast 모드 (`isToast=true`)',
          '',
          '| 항목 | Inline (`isToast=false`) | Toast (`isToast=true`) |',
          '|---|---|---|',
          '| 너비 | 부모 컨테이너에 맞춤 (`w-full`) | **고정 480px** |',
          '| 그림자 | 없음 | `shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]` |',
          '| body | 자연 줄바꿈 (제한 없음) | **2줄 제한** (`line-clamp-2`, 말줄임표 없음) |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    type: {
      control: 'select',
      options: ['default', 'info', 'success', 'warning', 'error'],
      description: 'Figma: `Type` / `State`. 알림 유형',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    isToast: {
      control: 'boolean',
      description: 'Figma: AlertToast. 고정 너비 480px + 그림자 + 2줄 제한',
    },
    body: {
      control: 'text',
      description: 'Figma: `body`. 알림 본문 (ReactNode)',
    },
    showIcon: {
      control: 'boolean',
      description: 'Figma: `showIcon`. true일 때 icon 제공 가능',
    },
    icon: {
      options: Object.keys(iconMap),
      mapping: iconMap,
      control: 'select',
      description: 'showIcon=true일 때 커스텀 아이콘. 생략 시 type별 기본 아이콘',
    },
    showTitle: {
      control: 'boolean',
      description: 'Figma: `showTitle`. true이면 stacked 레이아웃 자동 적용',
    },
    title: {
      control: 'text',
      description: 'showTitle=true일 때 제목 텍스트',
      if: { arg: 'showTitle', truthy: true },
    },
    showClose: {
      control: 'boolean',
      description: 'Figma: `showClose`. 닫기 버튼 표시 (Toast일 때는 항상 표시)',
      if: { arg: 'isToast', truthy: false },
    },
    showActionGroup: {
      control: 'boolean',
      description: 'Figma: `showActionGroup`. true일 때 액션 버튼 영역 활성화',
    },
    showAction1: {
      control: 'boolean',
      description: 'Figma: `showAction1`. 첫 번째 액션 버튼',
      if: { arg: 'showActionGroup', truthy: true },
    },
    action1Label: {
      control: 'text',
      description: 'showAction1=true일 때 버튼 라벨',
      if: { arg: 'showAction1', truthy: true },
    },
    showAction2: {
      control: 'boolean',
      description: 'Figma: `showAction2`. 두 번째 액션 버튼',
      if: { arg: 'showActionGroup', truthy: true },
    },
    action2Label: {
      control: 'text',
      description: 'showAction2=true일 때 버튼 라벨',
      if: { arg: 'showAction2', truthy: true },
    },
    onClose: { table: { disable: true } },
    action1OnClick: { table: { disable: true } },
    action2OnClick: { table: { disable: true } },
  } as Record<string, unknown>,
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  args: {
    type: 'info',
    mode: 'base',
    isToast: false,
    body: '이것은 알림 메시지입니다. Controls 패널에서 모든 옵션을 변경할 수 있습니다.',
    showIcon: true,
    showTitle: false,
    title: '알림 제목',
    showClose: false,
    showActionGroup: false,
    showAction1: true,
    action1Label: '확인',
    action1OnClick: () => console.log('Action 1'),
    showAction2: false,
    action2Label: '취소',
    action2OnClick: () => console.log('Action 2'),
    onClose: () => console.log('Alert closed'),
  } as Record<string, unknown>,
};
