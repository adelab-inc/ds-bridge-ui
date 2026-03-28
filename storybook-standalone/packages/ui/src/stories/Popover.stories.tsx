import type { Meta, StoryObj } from '@storybook/react';

import { Popover } from '../components/Popover';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { Icon } from '../components/Icon';

interface PopoverStoryArgs {
  side: 'bottom' | 'top';
  align: 'start' | 'center' | 'end';
  sideOffset: number;
}

const meta: Meta<typeof Popover> = {
  title: 'UI/Popover',
  component: Popover,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          'Popover는 트리거 클릭 시 나타나는 플로팅 콘텐츠 패널입니다.',
          'Compound 패턴(`Popover.Trigger` + `Popover.Content`)으로 구성됩니다.',
          '',
          '| Figma Property | Code Prop | 설명 |',
          '|---|---|---|',
          '| Background | `bg-bg-surface` | CVA base에 포함 |',
          '| Border | `border-border-subtle` | CVA base에 포함 |',
          '| Shadow | `shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]` | Dialog와 동일 |',
          '| Border Radius | `rounded-xl` (12px) | CVA base에 포함 |',
          '| Padding (base) | `px-component-inset-popover-x py-component-inset-popover-y` | mode="base" |',
          '| Padding (compact) | `px-component-inset-popover-x-compact py-component-inset-popover-y-compact` | mode="compact" |',
          '| Trigger Gap | `sideOffset={8}` | 기본 8px |',
          '| Max Height | `maxHeight={420}` | 초과 시 body 스크롤 |',
          '| Width | `widthMode` | "match-trigger" 또는 "hug-content" |',
          '| Alignment | `align` | "start", "center", "end" |',
          '| Side | `side` | "bottom" (기본), "top" |',
          '| Flip | 자동 | 공간 부족 시 반대편 자동 전환 |',
          '| Close | 외부 클릭 | mousedown 이벤트 |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<PopoverStoryArgs>;

/** 툴바 팝오버: 아이콘 버튼 그룹 */
export const Default: Story = {
  args: {
    side: 'bottom',
    align: 'start',
    sideOffset: 8,
  },
  argTypes: {
    side: {
      control: 'radio',
      options: ['bottom', 'top'],
      description: 'Figma: 팝오버가 나타나는 방향',
    },
    align: {
      control: 'radio',
      options: ['start', 'center', 'end'],
      description: 'Figma: 트리거 대비 수평 정렬',
    },
    sideOffset: {
      control: { type: 'number', min: 0, max: 32, step: 4 },
      description: 'Figma: 트리거와 콘텐츠 사이 간격 (px)',
    },
  },
  render: (args) => {
    const { side, align, sideOffset } = args;
    return (
      <Popover>
        <Popover.Trigger>
          <Button label="툴바 열기" showStartIcon={false} showEndIcon={false} />
        </Popover.Trigger>
        <Popover.Content side={side} align={align} sideOffset={sideOffset}>
          <div className="flex items-center gap-2">
            <IconButton iconOnly={<Icon name="undo" size={20} />} iconButtonType="ghost" size="md" aria-label="실행 취소" tooltip="실행 취소" />
            <IconButton iconOnly={<Icon name="redo" size={20} />} iconButtonType="ghost" size="md" aria-label="다시 실행" tooltip="다시 실행" />
            <IconButton iconOnly={<Icon name="link" size={20} />} iconButtonType="ghost" size="md" aria-label="링크" tooltip="링크" />
            <IconButton iconOnly={<Icon name="delete" size={20} />} iconButtonType="ghost-destructive" size="md" aria-label="삭제" tooltip="삭제" />
          </div>
        </Popover.Content>
      </Popover>
    );
  },
};
