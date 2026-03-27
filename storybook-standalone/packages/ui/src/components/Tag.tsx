import React, { forwardRef, HTMLAttributes } from 'react'
import { cva, VariantProps } from 'class-variance-authority'
import { useSpacingMode } from './SpacingModeProvider'
import { Icon } from './Icon'

/**
 * color prop에 사용 가능한 색상과 해당 Tailwind 클래스 매핑
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

const tagVariants = cva('text-caption-sm-regular text-tag-default-text flex items-center self-stretch rounded-full whitespace-nowrap flex-shrink-0', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
      "showClose": {
        "false": "",
        "true": "",
      },
      "tagType": {
        "default": "bg-tag-default-bg",
        "more": "border border-tag-more-border bg-tag-more-bg cursor-pointer relative",
        "swatch": "bg-tag-default-bg",
      },
    },
    defaultVariants: {
      "mode": "base",
      "showClose": false,
      "tagType": "default",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-pill-y px-component-inset-pill-x gap-component-gap-icon-label-xs",
        "mode": "base",
        "showClose": false,
        "tagType": "default",
      },
      {
        "class": "py-component-inset-pill-y-compact px-component-inset-pill-x-compact gap-component-gap-icon-label-xs-compact",
        "mode": "compact",
        "showClose": false,
        "tagType": "default",
      },
      {
        "class": "py-component-inset-pill-y pl-component-inset-pill-x pr-component-inset-pill-with-icon-x gap-component-gap-icon-label-xs",
        "mode": "base",
        "showClose": true,
        "tagType": "default",
      },
      {
        "class": "py-component-inset-pill-y-compact pl-component-inset-pill-x-compact pr-component-inset-pill-with-icon-x-compact gap-component-gap-icon-label-xs-compact",
        "mode": "compact",
        "showClose": true,
        "tagType": "default",
      },
      {
        "class": "py-component-inset-pill-y px-component-inset-pill-x gap-component-gap-icon-label-xs",
        "mode": "base",
        "showClose": false,
        "tagType": "swatch",
      },
      {
        "class": "py-component-inset-pill-y-compact px-component-inset-pill-x-compact gap-component-gap-icon-label-xs-compact",
        "mode": "compact",
        "showClose": false,
        "tagType": "swatch",
      },
      {
        "class": "py-component-inset-pill-y pl-component-inset-pill-x pr-component-inset-pill-with-icon-x gap-component-gap-icon-label-xs",
        "mode": "base",
        "showClose": true,
        "tagType": "swatch",
      },
      {
        "class": "py-component-inset-pill-y-compact pl-component-inset-pill-x-compact pr-component-inset-pill-with-icon-x-compact gap-component-gap-icon-label-xs-compact",
        "mode": "compact",
        "showClose": true,
        "tagType": "swatch",
      },
      {
        "class": "py-component-inset-pill-y px-component-inset-pill-x before:absolute before:inset-0 before:rounded-full before:bg-transparent hover:before:bg-black/[0.06] active:before:bg-black/[0.10] before:transition-colors",
        "mode": "base",
        "tagType": "more",
      },
      {
        "class": "py-component-inset-pill-y-compact px-component-inset-pill-x-compact before:absolute before:inset-0 before:rounded-full before:bg-transparent hover:before:bg-black/[0.06] active:before:bg-black/[0.10] before:transition-colors",
        "mode": "compact",
        "tagType": "more",
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
 * <Tag label="카테고리" />
 *
 * // 색상 표시가 있는 태그
 * <Tag tagType={TagType.SWATCH} color={TagColor.RED} label="중요" />
 *
 * // 제거 가능한 태그
 * <Tag label="제거 가능" showClose={true} onClose={() => console.log('제거')} />
 *
 * // More 버튼 (TagGroup에서 사용)
 * <Tag tagType={TagType.MORE} label="+5" />
 * ```
 */

// showClose discriminated union — showClose 값에 따라 onClose 타입 제어
type CloseProps =
  | { showClose: true; onClose: () => void }
  | { showClose?: false; onClose?: never }

// tagType × showClose 교차 discriminated union
// more 타입은 color, showClose, onClose 모두 차단
type TagVariantProps =
  | ({ tagType?: 'default'; color?: never } & CloseProps)
  | ({ tagType: 'swatch'; color: string } & CloseProps)
  | { tagType: 'more'; color?: never; showClose?: false; onClose?: never }

type TagProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> &
  VariantProps<typeof tagVariants> &
  TagVariantProps & {
    /** 태그 텍스트 */
    label: React.ReactNode
  }

/**
 * label prop에서 텍스트를 추출하여 접근성 레이블에 사용
 *
 * 복잡한 ReactNode (JSX Element 등)는 "태그"로 fallback 처리하여
 * aria-label이 항상 의미 있는 텍스트를 가지도록 보장합니다.
 *
 * @internal
 */
const extractTextFromLabel = (label: React.ReactNode): string => {
  if (typeof label === 'string' || typeof label === 'number') {
    const text = String(label).trim()
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
 * - **색상 표시**: 8가지 색상의 점(6px)으로 시각적 구분 (`tagType="swatch"`)
 * - **제거 가능**: 닫기 버튼으로 사용자가 태그 제거 가능 (`showClose={true}`)
 * - **More 버튼**: TagGroup에서 숨겨진 태그 수를 표시하는 특수 타입 (`tagType="more"`)
 * - **완전한 접근성**: 키보드 내비게이션, 스크린 리더 지원 (WCAG 2.1 AA)
 *
 * ## 접근성
 *
 * - 닫기 버튼은 `aria-label`로 스크린 리더에 의미 전달
 * - 장식용 요소(색상 점, 아이콘)는 `aria-hidden="true"`로 숨김
 * - 키보드로 닫기 버튼 포커스 및 작동 가능
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <Tag label="카테고리" />
 *
 * // 색상 표시
 * <Tag tagType={TagType.SWATCH} color={TagColor.RED} label="중요" />
 *
 * // 제거 가능한 태그
 * <Tag label="React" showClose={true} onClose={() => handleRemove(id)} />
 *
 * // TagGroup과 함께 사용
 * <TagGroup>
 *   <Tag tagType={TagType.SWATCH} color={TagColor.CYAN} label="디자인" />
 *   <Tag tagType={TagType.SWATCH} color={TagColor.VIOLET} label="개발" />
 * </TagGroup>
 * ```
 */
const Tag = forwardRef<HTMLDivElement, TagProps>(
  (allProps, ref) => {
    const {
      className,
      tagType,
      mode: propMode,
      showClose,
      label,
      ...rest
    } = allProps

    // discriminated union에서 color, onClose 추출
    const color = 'color' in allProps ? (allProps as { color: string }).color : undefined
    const onClose = 'onClose' in allProps ? (allProps as { onClose: () => void }).onClose : undefined

    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // 방어 코드: color 유효성 검증 (tagType="swatch" 일 때)
    let swatchColorClass = ''
    if (tagType === 'swatch' && color) {
      if (color in colorMap) {
        swatchColorClass = colorMap[color]
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Tag] Invalid color: "${color}". Valid colors: ${Object.keys(colorMap).join(', ')}`)
      }
    }

    // 방어 코드: aria-label용 텍스트 추출
    const tagText = extractTextFromLabel(label)

    return (
      <div ref={ref} className={cn(tagVariants({ tagType, mode, showClose: showClose ?? false, className }))} {...rest}>
        {tagType === 'swatch' && swatchColorClass && (
          <div data-testid="color-swatch" className={`w-[6px] h-[6px] rounded-full ${swatchColorClass}`} aria-hidden="true" />
        )}
        {label}
        {showClose && onClose && (
          <button
            onClick={onClose}
            aria-label={`${tagText} 태그 제거`}
            className="flex items-center justify-center rounded-full w-[16px] h-[16px] p-[2px] -m-[2px] hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
          >
            <Icon name="close" size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }
)

Tag.displayName = 'Tag'

export { Tag, tagVariants }
