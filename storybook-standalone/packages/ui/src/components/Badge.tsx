import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils'; // 경로 수정
import { useSpacingMode } from './SpacingModeProvider';

const badgeVariants = cva(
  'inline-flex items-center shrink-0 rounded-full',
  ({
    variants: {
      "appearance": {
        "solid": "",
        "subtle": "",
      },
      "levelVariant": {
        "announcement": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "statusVariant": {
        "error": "",
        "info": "",
        "success": "",
        "warning": "",
      },
      "type": {
        "count": "text-caption-xs-medium",
        "dot": "w-[6px] h-[6px]",
        "level": "text-caption-xs-regular",
        "status": "text-caption-xs-regular",
      },
    },
    defaultVariants: {
      "appearance": "solid",
      "levelVariant": "announcement",
      "mode": "base",
      "type": "level",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-pill-y px-component-inset-pill-x gap-component-gap-icon-label-xs",
        "mode": "base",
        "type": ["level", "status", "count"],
      },
      {
        "class": "py-component-inset-pill-y-compact px-component-inset-pill-x-compact gap-component-gap-icon-label-xs-compact",
        "mode": "compact",
        "type": ["level", "status", "count"],
      },
      {
        "appearance": "solid",
        "class": "bg-badge-primary-solid-bg text-badge-solid-text",
        "levelVariant": "announcement",
        "type": "level",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-primary-subtle-bg text-badge-primary-subtle-text",
        "levelVariant": "announcement",
        "type": "level",
      },
      {
        "appearance": "solid",
        "class": "bg-bg-semantic-info text-badge-solid-text",
        "statusVariant": "info",
        "type": "status",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-status-info-subtle-bg text-badge-status-info-subtle-text",
        "statusVariant": "info",
        "type": "status",
      },
      {
        "appearance": "solid",
        "class": "bg-bg-semantic-success text-badge-solid-text",
        "statusVariant": "success",
        "type": "status",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-status-success-subtle-bg text-badge-status-success-subtle-text",
        "statusVariant": "success",
        "type": "status",
      },
      {
        "appearance": "solid",
        "class": "bg-bg-semantic-warning text-badge-solid-text",
        "statusVariant": "warning",
        "type": "status",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-status-warning-subtle-bg text-badge-status-warning-subtle-text",
        "statusVariant": "warning",
        "type": "status",
      },
      {
        "appearance": "solid",
        "class": "bg-bg-semantic-error text-badge-solid-text",
        "statusVariant": "error",
        "type": "status",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-status-error-subtle-bg text-badge-status-error-subtle-text",
        "statusVariant": "error",
        "type": "status",
      },
      {
        "class": "bg-badge-primary-solid-bg",
        "type": "dot",
      },
      {
        "class": "bg-badge-primary-solid-bg text-badge-solid-text",
        "type": "count",
      },
    ],
  })
);

// CVA에서 생성되는 기본 variant props (type, mode, appearance 제외)
type CVAVariantProps = Omit<VariantProps<typeof badgeVariants>, 'type' | 'levelVariant' | 'statusVariant'>;

// 공통 props
type BadgeBaseProps = React.HTMLAttributes<HTMLDivElement> & CVAVariantProps;

// type별 discriminated union
type BadgeLevelProps = BadgeBaseProps & {
  type: 'level';
  levelVariant: 'announcement';
  statusVariant?: never;
  maxDigits?: never;
};

type BadgeStatusProps = BadgeBaseProps & {
  type: 'status';
  statusVariant: 'info' | 'success' | 'warning' | 'error';
  levelVariant?: never;
  maxDigits?: never;
};

type BadgeCountProps = BadgeBaseProps & {
  type: 'count';
  levelVariant?: never;
  statusVariant?: never;
  maxDigits?: number;
};

type BadgeDotProps = BadgeBaseProps & {
  type: 'dot';
  levelVariant?: never;
  statusVariant?: never;
  maxDigits?: never;
  /** dot type일 때만 유효. 부모 요소(relative)의 꼭지점에 dot 중앙을 배치 */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
};

export type BadgeProps = BadgeLevelProps | BadgeStatusProps | BadgeCountProps | BadgeDotProps;

// position prop에 따른 positioning 클래스
// dot 중심이 부모의 꼭지점에 위치 → dot 반지름(3px)만큼 텍스트 박스와 겹침
const positionClasses = {
  'top-right': 'absolute top-0 right-0 -translate-y-1/2 translate-x-1/2',
  'top-left': 'absolute top-0 left-0 -translate-y-1/2 -translate-x-1/2',
  'bottom-right': 'absolute bottom-0 right-0 translate-y-1/2 translate-x-1/2',
  'bottom-left': 'absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2',
} as const;

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (props, ref) => {
    const { className, type, mode: propMode, appearance, children, ...rest } = props;
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // type별로 필요한 props 추출
    const levelVariant = type === 'level' ? (props as BadgeLevelProps).levelVariant : undefined;
    const statusVariant = type === 'status' ? (props as BadgeStatusProps).statusVariant : undefined;
    const rawMaxDigits = type === 'count' ? (props as BadgeCountProps).maxDigits : undefined;
    // maxDigits는 1 이상의 값만 유효
    const maxDigits = rawMaxDigits !== undefined && rawMaxDigits >= 1 ? rawMaxDigits : undefined;
    // position은 dot type일 때만 유효
    const position = type === 'dot' ? (props as BadgeDotProps).position : undefined;

    // type이 count일 때 children을 숫자로 변환
    const numericValue = type === 'count' ? Number(children) : null;
    const isValidNumber = numericValue !== null && !isNaN(numericValue);

    const content =
      type === 'count' && isValidNumber && maxDigits && numericValue > Math.pow(10, maxDigits) - 1
        ? `${String(Math.pow(10, maxDigits) - 1)}+`
        : children;

    // rest에서 never 타입 props 제거
    const { levelVariant: _, statusVariant: __, maxDigits: ___, position: ____, ...divProps } = rest as any;

    // position 클래스 (dot type + position prop이 있을 때만 적용)
    const positionClass = position ? positionClasses[position] : undefined;

    return (
      <div
        className={cn(badgeVariants({ type, mode, appearance, levelVariant, statusVariant, className }), positionClass)}
        ref={ref}
        {...divProps}
      >
        {type !== 'dot' ? content : null}
      </div>
    );
  },
);
Badge.displayName = 'Badge';

export { Badge };
