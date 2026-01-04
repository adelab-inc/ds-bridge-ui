import { forwardRef, HTMLAttributes, useState, useMemo, Children } from 'react'
import { cva, VariantProps } from 'class-variance-authority'
import { cn } from './utils'
import { Tag } from './Tag'

const tagGroupVariants = cva('flex gap-component-gap-tags-x', ({
    variants: {
      "layout": {
        "horizontalScroll": "flex-nowrap",
        "singleLineWithMore": "",
        "wrap": "",
      },
    },
    defaultVariants: {
      "layout": "wrap",
    },
  }))

/**
 * TagGroup 컴포넌트 Props
 *
 * 여러 Tag 컴포넌트를 그룹화하고 다양한 레이아웃으로 표시합니다.
 * 태그가 많을 경우 자동으로 줄바꿈하거나, 스크롤하거나, 일부만 보여주고
 * "더보기" 버튼으로 확장할 수 있습니다.
 *
 * @example
 * ```tsx
 * // 기본 래핑 레이아웃
 * <TagGroup>
 *   <Tag>디자인</Tag>
 *   <Tag>개발</Tag>
 *   <Tag>기획</Tag>
 * </TagGroup>
 *
 * // 가로 스크롤
 * <TagGroup layout="horizontalScroll">
 *   {tags.map(tag => <Tag key={tag.id}>{tag.name}</Tag>)}
 * </TagGroup>
 *
 * // 더보기 버튼
 * <TagGroup layout="singleLineWithMore" maxVisibleTags={3}>
 *   {tags.map(tag => <Tag key={tag.id}>{tag.name}</Tag>)}
 * </TagGroup>
 * ```
 */
interface TagGroupProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof tagGroupVariants> {
  /**
   * `layout="singleLineWithMore"` 모드에서 처음에 보여줄 태그 개수
   *
   * 지정한 개수를 초과하는 태그는 "+N" 버튼 뒤에 숨겨지며,
   * 사용자가 버튼을 클릭하면 모든 태그를 펼쳐서 볼 수 있습니다.
   *
   * @default Infinity (모든 태그 표시)
   *
   * ⚠️ **엣지 케이스 처리**:
   * - `0` 이하의 값은 자동으로 `1`로 조정됩니다.
   * - 이유: 태그를 하나도 안 보여주면 사용자가 혼란스러워하므로,
   *   최소 1개는 항상 표시하는 것이 더 나은 UX입니다.
   *
   * @example
   * ```tsx
   * // 처음에 3개만 보여주고 나머지는 "+N" 버튼으로
   * // Tag 4, Tag 5는 숨겨지고 "+2" 버튼이 표시됨
   * <TagGroup layout="singleLineWithMore" maxVisibleTags={3}>
   *   <Tag>Tag 1</Tag>
   *   <Tag>Tag 2</Tag>
   *   <Tag>Tag 3</Tag>
   *   <Tag>Tag 4</Tag>
   *   <Tag>Tag 5</Tag>
   * </TagGroup>
   * ```
   */
  maxVisibleTags?: number
}

/**
 * TagGroup 컴포넌트
 *
 * 여러 Tag 컴포넌트를 하나의 그룹으로 묶어 다양한 레이아웃으로 표시합니다.
 * 태그 개수와 사용 맥락에 따라 최적의 레이아웃을 선택할 수 있습니다.
 *
 * ## 레이아웃 옵션
 *
 * ### 1. `wrap` (기본값)
 * 태그가 많으면 자동으로 여러 줄로 줄바꿈됩니다.
 * - 사용 예: 필터 칩, 카테고리 목록
 * - 장점: 모든 태그가 항상 보임
 *
 * ### 2. `horizontalScroll`
 * 한 줄로 표시하고 가로 스크롤이 생깁니다.
 * - 사용 예: 탭 메뉴, 캐러셀 형태의 태그
 * - 장점: 세로 공간 절약
 * - 주의: Scrollbar 컴포넌트로 감싸서 사용해야 스크롤이 표시됩니다.
 *
 * ### 3. `singleLineWithMore`
 * 일부만 표시하고 나머지는 "+N" 버튼으로 숨깁니다.
 * - 사용 예: 프로필 태그, 미리보기 태그
 * - 장점: 공간 효율적, 필요시에만 확장
 * - 동작: 버튼 클릭 시 모든 태그 펼침 (2행 구조)
 *
 * ## 접근성
 *
 * - More 버튼은 키보드로 접근 가능 (Tab, Enter, Space)
 * - `role="button"`, `tabIndex={0}` 적용
 * - `aria-label`: "N개 태그 더보기" / "태그 접기"
 * - `aria-expanded`: 펼침/접힘 상태 전달
 * - WCAG 2.1 AA 수준 준수
 *
 * ## 엣지 케이스 처리
 *
 * - `maxVisibleTags <= 0`: 자동으로 1로 조정 (최소 1개는 보여줌)
 * - 빈 children: 빈 div만 렌더링 (에러 없음)
 * - `totalTags <= maxVisibleTags`: More 버튼 표시 안 함
 *
 * @example
 * ```tsx
 * // 기본 사용 (wrap 레이아웃)
 * <TagGroup>
 *   <Tag colorSwatch="red">디자인</Tag>
 *   <Tag colorSwatch="blue">개발</Tag>
 *   <Tag colorSwatch="green">기획</Tag>
 * </TagGroup>
 *
 * // 가로 스크롤 (Scrollbar 필요)
 * <Scrollbar>
 *   <TagGroup layout="horizontalScroll">
 *     {tags.map(tag => (
 *       <Tag key={tag.id} colorSwatch={tag.color}>
 *         {tag.name}
 *       </Tag>
 *     ))}
 *   </TagGroup>
 * </Scrollbar>
 *
 * // 더보기 버튼 (처음에 3개만 표시)
 * // Next.js, Storybook은 숨겨지고 "+2" 버튼 표시
 * <TagGroup layout="singleLineWithMore" maxVisibleTags={3}>
 *   <Tag>React</Tag>
 *   <Tag>TypeScript</Tag>
 *   <Tag>Tailwind</Tag>
 *   <Tag>Next.js</Tag>
 *   <Tag>Storybook</Tag>
 * </TagGroup>
 *
 * // 제거 가능한 태그 그룹
 * <TagGroup>
 *   {selectedTags.map(tag => (
 *     <Tag
 *       key={tag.id}
 *       hasCloseButton
 *       onClose={() => removeTag(tag.id)}
 *     >
 *       {tag.name}
 *     </Tag>
 *   ))}
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
      if (layout !== 'singleLineWithMore' || totalTags <= validMaxVisibleTags) {
        return childrenArray
      }
      // singleLineWithMore: 항상 maxVisibleTags만 첫 줄에 표시
      return childrenArray.slice(0, validMaxVisibleTags)
    }, [childrenArray, layout, validMaxVisibleTags, totalTags])

    const remainingTags = useMemo(() => {
      if (layout !== 'singleLineWithMore' || !isExpanded || totalTags <= validMaxVisibleTags) {
        return []
      }
      return childrenArray.slice(validMaxVisibleTags)
    }, [childrenArray, isExpanded, layout, validMaxVisibleTags, totalTags])

    // 방어 코드: hiddenTagsCount 음수 방지
    const hiddenTagsCount = Math.max(0, totalTags - validMaxVisibleTags)
    const canBeCollapsed = layout === 'singleLineWithMore' && totalTags > validMaxVisibleTags

    return (
      <div ref={ref} className={cn(tagGroupVariants({ layout, className }), layout === 'wrap' && 'flex-wrap', canBeCollapsed && 'flex-col')} {...props}>
        {canBeCollapsed ? (
          <>
            <div className="flex flex-nowrap gap-component-gap-tags-x">
              {visibleTags}
              <Tag
                variant="more"
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
              >
                {isExpanded ? '접기' : `+${hiddenTagsCount}`}
              </Tag>
            </div>
            {isExpanded && remainingTags.length > 0 && (
              <div className="flex flex-wrap gap-component-gap-tags-x">
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
