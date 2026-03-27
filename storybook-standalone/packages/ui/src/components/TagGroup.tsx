import { forwardRef, HTMLAttributes, useState, useMemo, Children } from 'react'
import { cva, VariantProps } from 'class-variance-authority'
import { cn } from './utils'
import { Tag } from './Tag'

const tagGroupVariants = cva('flex', ({
    variants: {
      "layout": {
        "collapsible": "",
        "horizontalScroll": "flex-nowrap overflow-x-auto",
        "inline": "flex-nowrap overflow-hidden",
        "wrap": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
    },
    defaultVariants: {
      "layout": "wrap",
      "mode": "base",
    },
    compoundVariants: [
      {
        "class": "gap-component-gap-tag-group",
        "mode": "base",
      },
      {
        "class": "gap-component-gap-tag-group-compact",
        "mode": "compact",
      },
    ],
  }))

/**
 * TagGroup 컴포넌트 Props
 *
 * 여러 Tag 컴포넌트를 그룹화하고 다양한 레이아웃으로 표시합니다.
 *
 * @example
 * ```tsx
 * // 기본 래핑 레이아웃
 * <TagGroup>
 *   <Tag label="디자인" />
 *   <Tag label="개발" />
 * </TagGroup>
 *
 * // 한 줄 + 더보기
 * <TagGroup layout="collapsible" maxVisibleTags={3}>
 *   {tags.map(tag => <Tag key={tag.id} label={tag.name} />)}
 * </TagGroup>
 * ```
 */
interface TagGroupProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof tagGroupVariants> {
  /**
   * `layout="collapsible"` 모드에서 처음에 보여줄 태그 개수
   *
   * 지정한 개수를 초과하는 태그는 "+N" 버튼 뒤에 숨겨지며,
   * 사용자가 버튼을 클릭하면 모든 태그를 펼쳐서 볼 수 있습니다.
   *
   * @default Infinity (모든 태그 표시)
   *
   * ⚠️ **엣지 케이스 처리**:
   * - `0` 이하의 값은 자동으로 `1`로 조정됩니다.
   */
  maxVisibleTags?: number
}

/**
 * TagGroup 컴포넌트
 *
 * 여러 Tag 컴포넌트를 하나의 그룹으로 묶어 다양한 레이아웃으로 표시합니다.
 *
 * ## Figma ↔ Code 레이아웃 매핑
 *
 * | Figma | Code `layout` | 동작 |
 * |-------|---------------|------|
 * | `TagGroup/Inline` | `inline` | 한 줄 배열, 넘치면 잘림 (overflow hidden) |
 * | `TagGroup/Wrap` | `wrap` (기본값) | 자동 줄바꿈 |
 * | `TagGroup/Collapsible` | `collapsible` | 한 줄 + "+N" 더보기 버튼 |
 * | — | `horizontalScroll` | 코드 전용. 한 줄 + 가로 스크롤 |
 *
 * ## 접근성
 *
 * - More 버튼은 키보드로 접근 가능 (Tab, Enter, Space)
 * - `role="button"`, `tabIndex={0}` 적용
 * - `aria-label`: "N개 태그 더보기" / "태그 접기"
 * - `aria-expanded`: 펼침/접힘 상태 전달
 *
 * @example
 * ```tsx
 * // Figma: TagGroup/Inline — 한 줄, 넘치면 잘림
 * <TagGroup layout="inline">
 *   <Tag label="React" />
 *   <Tag label="TypeScript" />
 * </TagGroup>
 *
 * // Figma: TagGroup/Wrap — 자동 줄바꿈 (기본값)
 * <TagGroup>
 *   <Tag label="React" />
 *   <Tag label="TypeScript" />
 * </TagGroup>
 *
 * // Figma: TagGroup/Collapsible — 한 줄 + 더보기
 * <TagGroup layout="collapsible" maxVisibleTags={3}>
 *   <Tag label="React" />
 *   <Tag label="TypeScript" />
 *   <Tag label="Tailwind" />
 *   <Tag label="Next.js" />
 *   <Tag label="Storybook" />
 * </TagGroup>
 *
 * // 코드 전용: 가로 스크롤
 * <TagGroup layout="horizontalScroll">
 *   {tags.map(tag => <Tag key={tag.id} label={tag.name} />)}
 * </TagGroup>
 * ```
 */
const TagGroup = forwardRef<HTMLDivElement, TagGroupProps>(
  ({ className, layout, children, maxVisibleTags = Infinity, ...props }, ref) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const childrenArray = Children.toArray(children)
    const totalTags = childrenArray.length

    // 방어 코드: maxVisibleTags 유효성 검증
    const validMaxVisibleTags = maxVisibleTags <= 0 ? 1 : maxVisibleTags

    // 방어 코드: 빈 children 조기 반환
    if (totalTags === 0) {
      return <div ref={ref} className={cn(tagGroupVariants({ layout, className }))} {...props} />
    }

    const handleToggle = () => {
      setIsExpanded(prev => !prev)
    }

    const visibleTags = useMemo(() => {
      if (layout !== 'collapsible' || totalTags <= validMaxVisibleTags) {
        return childrenArray
      }
      return childrenArray.slice(0, validMaxVisibleTags)
    }, [childrenArray, layout, validMaxVisibleTags, totalTags])

    const remainingTags = useMemo(() => {
      if (layout !== 'collapsible' || !isExpanded || totalTags <= validMaxVisibleTags) {
        return []
      }
      return childrenArray.slice(validMaxVisibleTags)
    }, [childrenArray, isExpanded, layout, validMaxVisibleTags, totalTags])

    // 방어 코드: hiddenTagsCount 음수 방지
    const hiddenTagsCount = Math.max(0, totalTags - validMaxVisibleTags)
    const canBeCollapsed = layout === 'collapsible' && totalTags > validMaxVisibleTags

    return (
      <div ref={ref} className={cn(tagGroupVariants({ layout, className }), layout === 'wrap' && 'flex-wrap', canBeCollapsed && 'flex-col')} {...props}>
        {canBeCollapsed ? (
          <>
            <div className="flex flex-nowrap gap-component-gap-tag-group">
              {visibleTags}
              <Tag
                tagType="more"
                label={isExpanded ? '접기' : `+${hiddenTagsCount}`}
                onClick={handleToggle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleToggle()
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={isExpanded ? '태그 접기' : `${hiddenTagsCount}개 태그 더보기`}
                aria-expanded={isExpanded}
                className="ml-auto"
              />
            </div>
            {isExpanded && remainingTags.length > 0 && (
              <div className="flex flex-wrap gap-component-gap-tag-group">
                {remainingTags}
              </div>
            )}
          </>
        ) : (
          visibleTags
        )}
      </div>
    )
  }
)

TagGroup.displayName = 'TagGroup'

export { TagGroup, tagGroupVariants }
