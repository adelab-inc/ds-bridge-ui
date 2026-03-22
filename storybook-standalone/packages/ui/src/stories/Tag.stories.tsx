import type { Meta, StoryObj } from '@storybook/react'
import { Tag } from '../components/Tag'
import { TagGroup } from '../components/TagGroup'
import { TagType, TagColor, Mode } from '../types'

const meta: Meta<typeof Tag> = {
  title: 'UI/Tag',
  component: Tag,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Type` (default/swatch/More) | `tagType` | Figma 이름 그대로 사용. V1 `variant`(2값)에서 `swatch` 분리하여 3값으로 확장 |',
          '| `Show Close` | `showClose` | Figma 이름 그대로 사용. V1 `hasCloseButton`에서 변경. `true`일 때 `onClose` 필수 (discriminated union) |',
          '| `Text` | `label` | Figma는 `Text`이지만 Button V2 등 컴포넌트 간 일관성을 위해 `label` 사용. `ReactNode` 타입 |',
          '| `Color` (swatch 전용) | `color` | Figma 이름 그대로 사용. V1 `colorSwatch`에서 간소화. `tagType="swatch"` 일 때만 제공 가능 (discriminated union) |',
          '| `Interaction` (More/CloseIcon) | CSS pseudo-state | Figma hover/pressed 상태는 CSS `:hover`/`:active`로 처리. Tag에 기능적 상태(disabled/loading)가 없어 `interaction` enum 미추가 |',
          '| `Count` (More 전용) | — | TagGroup 내부에서 `label={`+N`}` 형태로 자동 생성 |',
          '| — | `mode` | Figma에 없는 코드 전용 prop. spacing density (base/compact) |',
          '| — | `onClose` | Figma에 없는 코드 전용 prop. `showClose=true` 일 때 필수 콜백 |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Figma: `Text`. 태그 텍스트 (ReactNode)',
    },
    tagType: {
      control: 'select',
      options: Object.values(TagType),
      description: 'Figma: `Type`. 태그 유형 (default=일반, swatch=색상점 포함, more=더보기)',
    },
    mode: {
      control: 'select',
      options: Object.values(Mode),
      description: 'Spacing density mode (코드 전용)',
    },
    color: {
      control: 'select',
      options: [undefined, ...Object.values(TagColor)],
      description: 'Figma: `Color`. swatch 색상 점 (tagType=swatch 일 때 유효)',
      if: { arg: 'tagType', eq: TagType.SWATCH },
    },
    showClose: {
      control: 'boolean',
      description: 'Figma: `Show Close`. 닫기 버튼 표시. true일 때 onClose 필수',
      if: { arg: 'tagType', neq: TagType.MORE },
    },
    onClose: { table: { disable: true } },
  },
}

export default meta
type Story = StoryObj<Record<string, unknown>>

export const Default: Story = {
  args: {
    label: 'Tag Label',
    tagType: TagType.DEFAULT,
    color: TagColor.RED,
    mode: Mode.BASE,
    showClose: false,
  } as Record<string, unknown>,
}

export const TagGroupExample: Story = {
  argTypes: {
    label: { table: { disable: true } },
    tagType: { table: { disable: true } },
    showClose: { table: { disable: true } },
    color: { table: { disable: true } },
    onClose: { table: { disable: true } },
    layout: {
      control: 'select',
      options: ['inline', 'wrap', 'collapsible', 'horizontalScroll'],
      description: 'Figma: TagGroup 레이아웃 (inline=한줄잘림, wrap=줄바꿈, collapsible=더보기, horizontalScroll=가로스크롤)',
    },
    maxVisibleTags: {
      control: { type: 'number', min: 1, max: 8 },
      description: 'collapsible 레이아웃에서 처음 보여줄 태그 개수',
      if: { arg: 'layout', eq: 'collapsible' },
    },
  } as Record<string, unknown>,
  args: {
    mode: Mode.BASE,
    layout: 'wrap' as string,
    maxVisibleTags: 3 as number,
  } as Record<string, unknown>,
  render: (args: Record<string, unknown>) => {
    const colors = Object.values(TagColor)
    const tags = Array.from({ length: 8 }, (_, i) => {
      const hasSwatch = i % 2 === 1
      const hasClose = i % 3 === 0

      if (hasSwatch && hasClose) {
        return (
          <Tag
            key={i}
            tagType={TagType.SWATCH}
            color={colors[i % colors.length]}
            label={`Tag ${i + 1}`}
            showClose={true}
            onClose={() => console.log(`close ${i}`)}
          />
        )
      }
      if (hasSwatch) {
        return (
          <Tag
            key={i}
            tagType={TagType.SWATCH}
            color={colors[i % colors.length]}
            label={`Tag ${i + 1}`}
          />
        )
      }
      if (hasClose) {
        return (
          <Tag
            key={i}
            label={`Tag ${i + 1}`}
            showClose={true}
            onClose={() => console.log(`close ${i}`)}
          />
        )
      }
      return (
        <Tag
          key={i}
          label={`Tag ${i + 1}`}
        />
      )
    })

    return (
      <TagGroup layout={args.layout as 'inline' | 'wrap' | 'collapsible' | 'horizontalScroll'} mode={args.mode as 'base' | 'compact'} maxVisibleTags={args.maxVisibleTags as number} className="w-[400px]">
        {tags}
      </TagGroup>
    )
  },
}
