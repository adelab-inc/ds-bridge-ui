import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useRef } from 'react';

import { Tooltip } from '../components/Tooltip';
import { Button } from '../components/Button';

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `context` (Default/contrast) | `context` | Figma 이름 그대로 사용. Default=일반 배경, contrast=복잡한 배경/이미지 위 |',
          '| `truncation` (False/True) | `truncation` | False: 2줄 말줄임(320px), True: 스크롤(500px) |',
          '| `text` | `content` | Figma는 `text`(string)이지만 코드는 `content`(ReactNode)로 확장. 이름 변경 없음 |',
          '| — | `children` | 트리거 요소 (Figma에 없음, React 래퍼 패턴) |',
          '| — | `mode` | SpacingMode (base/compact). Figma variant에는 없지만 디자인 시스템 공통 메커니즘 |',
          '| — | `preferredPosition` | 위치 우선순위 (top/bottom/left/right). Figma에서는 문서로 설명 |',
          '| — | `followCursor` | 커서 추적 모드. Figma에 없는 코드 전용 기능 |',
          '',
          '### V1 → V2 주요 변경',
          '',
          '| 변경 항목 | V1 | V2 |',
          '|---|---|---|',
          '| **context** | 없음 (border/shadow 하드코딩) | `context` prop 추가 (default/contrast) |',
          '| **truncation=false 폰트** | caption/xs 고정 | caption/xs (CVA compoundVariant) |',
          '| **truncation=true 폰트** | caption/xs 고정 | body/sm (14px) — Figma 스펙 반영 |',
          '| **truncation=false max-height** | 없음 | 120px + overflow-hidden |',
          '| **line-clamp 적용** | 컨테이너 직접 (동작 안 함) | 내부 래퍼 `<div>` (정상 동작) |',
          '| **base display** | `flex` (line-clamp 충돌) | 제거 (패딩으로 레이아웃) |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    context: {
      control: 'select',
      options: ['default', 'contrast'],
      description: 'Figma: `context`. 시각적 강조 수준. default=일반 배경, contrast=복잡한 배경/이미지 위',
    },
    truncation: {
      control: 'boolean',
      description: 'Figma: `truncation`. true: 최대 500×320px 스크롤, false: 최대 320×120px 2줄 말줄임',
    },
    content: {
      control: 'text',
      description: 'Figma: `text`. 툴팁에 표시될 내용 (ReactNode)',
    },
    delay: {
      control: 'number',
      description: '툴팁이 표시되기 전 지연 시간(ms)',
    },
    closeDelay: {
      control: 'number',
      description: '툴팁이 사라지기 전 지연 시간(ms)',
    },
    preferredPosition: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      description: '툴팁의 우선 표시 위치. 공간이 없으면 top → bottom → right → left 순으로 자동 이동',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'SpacingMode. base(기본) 또는 compact(조밀) 간격',
    },
    followCursor: {
      control: 'boolean',
      description: '마우스 커서를 따라다니는 툴팁 활성화',
    },
    children: {
      table: { disable: true },
    },
    cursorOffset: {
      control: 'object',
      description: '커서와 툴팁 사이의 오프셋. followCursor=true일 때만 적용',
      if: { arg: 'followCursor', truthy: true },
    },
  },
  args: {
    context: 'default',
    content: '툴팁입니다.',
    delay: 200,
    closeDelay: 500,
    preferredPosition: 'top',
    truncation: false,
    followCursor: false,
    cursorOffset: { x: 10, y: 10 },
  },
};

export default meta;

type TooltipStoryArgs = React.ComponentProps<typeof Tooltip>;

const LONG_TEXT =
  '이것은 매우 긴 툴팁 내용입니다. 여러 줄에 걸쳐 표시되어야 합니다. 스크롤이 가능해야 하며 뷰포트를 벗어나지 않아야 합니다. 이 텍스트는 의도적으로 길게 작성되었습니다. 추가 텍스트를 더 넣어서 높이가 충분히 커지도록 만들겠습니다. 이렇게 하면 truncation 모드에서 스크롤이 필요한 상황이 만들어집니다. 더 많은 텍스트가 필요합니다. 계속 추가합니다. 아직 더 필요합니다. 충분히 긴 텍스트가 되어야 합니다. 뷰포트보다 긴 콘텐츠를 테스트하기 위해 계속 작성합니다.';

const DefaultRenderer = (args: TooltipStoryArgs) => (
  <Tooltip {...args}>
    <Button label="Hover me" showStartIcon={false} showEndIcon={false} />
  </Tooltip>
);

const truncationLocked = { truncation: { control: { disable: true } } };

export const TruncationFalse: StoryObj<TooltipStoryArgs> = {
  name: 'truncation=false (기본)',
  argTypes: truncationLocked,
  args: {
    truncation: false,
  },
  render: (args) => <DefaultRenderer {...args} />,
};

export const TruncationTrue: StoryObj<TooltipStoryArgs> = {
  name: 'truncation=true (스크롤)',
  argTypes: truncationLocked,
  args: {
    truncation: true,
    content: LONG_TEXT,
  },
  render: (args) => <DefaultRenderer {...args} />,
};

const AlwaysVisibleRenderer = (args: TooltipStoryArgs) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const button = container.querySelector('button');
    if (!button) return;

    const blockFocusOut = (e: FocusEvent) => {
      e.stopPropagation();
    };
    container.addEventListener('focusout', blockFocusOut, true);

    button.focus();

    return () => {
      container.removeEventListener('focusout', blockFocusOut, true);
    };
  }, []);

  return (
    <div ref={containerRef} className="p-20">
      <Tooltip {...args}>
        <Button label="툴팁이 항상 표시됩니다" showStartIcon={false} showEndIcon={false} />
      </Tooltip>
    </div>
  );
};

export const AlwaysVisibleFalse: StoryObj<TooltipStoryArgs> = {
  name: 'Always Visible - truncation=false (검수용)',
  argTypes: truncationLocked,
  args: {
    delay: 0,
    closeDelay: 999999999,
    truncation: false,
  },
  render: (args) => <AlwaysVisibleRenderer {...args} />,
};

export const AlwaysVisibleTrue: StoryObj<TooltipStoryArgs> = {
  name: 'Always Visible - truncation=true (검수용)',
  argTypes: truncationLocked,
  args: {
    delay: 0,
    closeDelay: 999999999,
    truncation: true,
    content: LONG_TEXT,
  },
  render: (args) => <AlwaysVisibleRenderer {...args} />,
};
