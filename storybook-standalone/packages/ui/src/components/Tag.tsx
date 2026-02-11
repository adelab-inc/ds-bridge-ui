import React, { forwardRef, HTMLAttributes } from 'react'
import { cva, VariantProps } from 'class-variance-authority'
import { Icon } from './Icon'
import { useSpacingMode } from './SpacingModeProvider'

/**
 * colorSwatch prop에 사용 가능한 색상과 해당 Tailwind 클래스 매핑
 *
 * @internal
 */
const colorMap: Record<string, string> = {
  red: 'bg-hue-red-500',
  orange: 'bg-hue-orange-500',
  yellow: 'bg-hue-yellow-500',
  lime: 'bg-hue-lime-500',
  green: 'bg-hue-green-500',
  cyan: 'bg-hue-cyan-500',
  violet: 'bg-hue-violet-500',
  pink: 'bg-hue-pink-500',
}

import { cn } from './utils'

const tagVariants = cva('text-caption-xs-regular text-tag-default-text flex items-center self-stretch rounded-full whitespace-nowrap flex-shrink-0', ({
    variants: {
      "hasCloseButton": {
        "false": "",
        "true": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "variant": {
        "default": "bg-tag-default-bg",
        "more": "border border-tag-more-border bg-tag-more-bg cursor-pointer relative",
      },
    },
    defaultVariants: {
      "hasCloseButton": false,
      "mode": "base",
      "variant": "default",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-pill-y pr-component-inset-pill-x pl-component-inset-pill-with-icon-x gap-component-gap-icon-label-xs",
        "mode": "base",
      },
      {
        "class": "py-component-inset-pill-y-compact pr-component-inset-pill-x-compact pl-component-inset-pill-with-icon-x-compact gap-component-gap-icon-label-xs-compact",
        "mode": "compact",
      },
      {
        "class": "before:absolute before:inset-0 before:rounded-full before:bg-transparent hover:before:bg-black/[0.06] active:before:bg-black/[0.10] before:transition-colors",
        "variant": "more",
      },
    ],
  }))

/**
 * Tag 컴포넌트 Props
 *
 * 태그는 카테고리, 레이블, 필터, 키워드 등을 표시하는 데 사용되는 UI 요소입니다.
 * 선택적으로 색상 표시와 제거 기능을 포함할 수 있습니다.
 *
 * @example
 * ```tsx
 * // 기본 태그
 * <Tag>카테고리</Tag>
 *
 * // 색상 표시가 있는 태그
 * <Tag colorSwatch="red">중요</Tag>
 *
 * // 제거 가능한 태그
 * <Tag hasCloseButton onClose={() => console.log('제거')}>
 *   제거 가능
 * </Tag>
 *
 * // More 버튼 (TagGroup에서 사용)
 * <Tag variant="more">+5</Tag>
 * ```
 */
interface TagProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof tagVariants> {
  /**
   * 태그 제거 버튼 클릭 시 호출될 콜백 함수
   *
   * ⚠️ hasCloseButton prop과 함께 사용해야 제거 버튼이 표시됩니다.
   *
   * @example
   * ```tsx
   * <Tag hasCloseButton onClose={() => handleRemove(id)}>
   *   제거 가능 태그
   * </Tag>
   * ```
   */
  onClose?: () => void

  /**
   * 태그 왼쪽에 표시될 색상 점 (6px × 6px 원형)
   *
   * 8가지 색상을 지원합니다:
   * - `'red'` - 빨강
   * - `'orange'` - 주황
   * - `'yellow'` - 노랑
   * - `'lime'` - 연두
   * - `'green'` - 초록
   * - `'cyan'` - 청록
   * - `'violet'` - 보라
   * - `'pink'` - 분홍
   *
   * ⚠️ 잘못된 색상을 전달하면 개발 환경에서 console.warn이 출력되고,
   * 색상 점이 렌더링되지 않습니다.
   *
   * @default undefined (색상 점 미표시)
   *
   * @example
   * ```tsx
   * <Tag colorSwatch="red">빨간색 표시</Tag>
   * <Tag colorSwatch="green">초록색 표시</Tag>
   * ```
   */
  colorSwatch?: keyof typeof colorMap
}

/**
 * children prop에서 텍스트를 추출하여 접근성 레이블에 사용
 *
 * 복잡한 ReactNode (JSX Element 등)는 "태그"로 fallback 처리하여
 * aria-label이 항상 의미 있는 텍스트를 가지도록 보장합니다.
 *
 * @param children - Tag 컴포넌트의 children prop
 * @returns 추출된 텍스트 또는 "태그" fallback
 *
 * @internal
 *
 * @example
 * ```ts
 * extractTextFromChildren("카테고리")  // "카테고리"
 * extractTextFromChildren(123)        // "123"
 * extractTextFromChildren("")         // "태그" (빈 문자열 fallback)
 * extractTextFromChildren(<div>복잡</div>)  // "태그" (복잡한 노드 fallback)
 * ```
 */
const extractTextFromChildren = (children: React.ReactNode): string => {
  if (typeof children === 'string' || typeof children === 'number') {
    const text = String(children).trim()
    return text || '태그'
  }
  return '태그'
}

/**
 * Tag 컴포넌트
 *
 * 카테고리, 레이블, 필터, 키워드 등을 시각적으로 표시하는 UI 요소입니다.
 * 선택적으로 색상 표시자와 제거 버튼을 포함할 수 있습니다.
 *
 * ## 주요 기능
 *
 * - **기본 태그**: 텍스트만 표시하는 간단한 태그
 * - **색상 표시**: 8가지 색상의 점(6px)으로 시각적 구분
 * - **제거 가능**: 닫기 버튼으로 사용자가 태그 제거 가능
 * - **More 버튼**: TagGroup에서 숨겨진 태그 수를 표시하는 특수 variant
 * - **완전한 접근성**: 키보드 내비게이션, 스크린 리더 지원 (WCAG 2.1 AA)
 *
 * ## 접근성
 *
 * - 닫기 버튼은 `aria-label`로 스크린 리더에 의미 전달
 * - 장식용 요소(색상 점, 아이콘)는 `aria-hidden="true"`로 숨김
 * - 키보드로 닫기 버튼 포커스 및 작동 가능
 *
 * ## 엣지 케이스 처리
 *
 * - 잘못된 `colorSwatch` 값: console.warn 출력 후 무시 (개발 환경)
 * - `hasCloseButton={true}`, `onClose` 없음: 닫기 버튼 렌더링 안 함
 * - 빈 children: aria-label이 "태그 태그 제거"로 fallback
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <Tag>카테고리</Tag>
 *
 * // 색상 표시
 * <Tag colorSwatch="red">중요</Tag>
 * <Tag colorSwatch="green">완료</Tag>
 *
 * // 제거 가능한 태그
 * <Tag
 *   hasCloseButton
 *   onClose={() => handleRemove(id)}
 * >
 *   React
 * </Tag>
 *
 * // TagGroup과 함께 사용
 * <TagGroup>
 *   <Tag colorSwatch="cyan">디자인</Tag>
 *   <Tag colorSwatch="violet">개발</Tag>
 *   <Tag colorSwatch="pink">기획</Tag>
 * </TagGroup>
 * ```
 */
const Tag = forwardRef<HTMLDivElement, TagProps>(
  ({ className, variant, mode: propMode, colorSwatch, hasCloseButton, children, onClose, ...props }, ref) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // 방어 코드: colorSwatch 유효성 검증
    let swatchColorClass = ''
    if (colorSwatch) {
      if (colorSwatch in colorMap) {
        swatchColorClass = colorMap[colorSwatch]
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Tag] Invalid colorSwatch: "${colorSwatch}". Valid colors: ${Object.keys(colorMap).join(', ')}`)
      }
    }

    // 방어 코드: aria-label용 텍스트 추출
    const tagText = extractTextFromChildren(children)

    // 방어 코드: onClose가 없으면 hasCloseButton 무시
    const shouldShowCloseButton = hasCloseButton && onClose

    return (
      <div ref={ref} className={cn(tagVariants({ variant, mode, className }))} {...props}>
        {colorSwatch && swatchColorClass && (
          <div data-testid="color-swatch" className={`w-[6px] h-[6px] rounded-full ${swatchColorClass}`} aria-hidden="true" />
        )}
        {children}
        {shouldShowCloseButton && (
          <button
            onClick={onClose}
            aria-label={`${tagText} 태그 제거`}
            className="flex items-center justify-center rounded-full w-[12px] h-[12px] p-[1px] -m-[1px] hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
          >
            <Icon name="close" size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }
)

Tag.displayName = 'Tag'

export { Tag, tagVariants }