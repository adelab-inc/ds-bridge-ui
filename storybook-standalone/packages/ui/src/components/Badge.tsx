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
      "level": {
        "neutral": "",
        "primary": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "status": {
        "error": "",
        "info": "",
        "success": "",
        "warning": "",
      },
      "type": {
        "count": "text-caption-xs-regular",
        "dot": "w-[6px] h-[6px] ring-1 ring-border-contrast",
        "level": "text-caption-xs-regular",
        "status": "text-caption-xs-regular",
      },
    },
    defaultVariants: {
      "appearance": "solid",
      "level": "primary",
      "mode": "base",
      "type": "level",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-pill-y px-component-inset-pill-x gap-component-gap-icon-label-xs",
        "mode": "base",
        "type": ["level", "status"],
      },
      {
        "class": "py-component-inset-pill-y-compact px-component-inset-pill-x-compact gap-component-gap-icon-label-xs-compact",
        "mode": "compact",
        "type": ["level", "status"],
      },
      {
        "appearance": "solid",
        "class": "bg-badge-primary-solid-bg text-badge-primary-solid-text",
        "level": "primary",
        "type": "level",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-primary-subtle-bg text-badge-primary-subtle-text",
        "level": "primary",
        "type": "level",
      },
      {
        "appearance": "solid",
        "class": "bg-badge-neutral-solid-bg text-badge-neutral-solid-text",
        "level": "neutral",
        "type": "level",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-neutral-subtle-bg text-badge-neutral-subtle-text",
        "level": "neutral",
        "type": "level",
      },
      {
        "appearance": "solid",
        "class": "bg-bg-semantic-info text-badge-primary-solid-text",
        "status": "info",
        "type": "status",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-status-info-subtle-bg text-badge-status-info-subtle-text",
        "status": "info",
        "type": "status",
      },
      {
        "appearance": "solid",
        "class": "bg-bg-semantic-success text-badge-primary-solid-text",
        "status": "success",
        "type": "status",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-status-success-subtle-bg text-badge-status-success-subtle-text",
        "status": "success",
        "type": "status",
      },
      {
        "appearance": "solid",
        "class": "bg-bg-semantic-warning text-badge-primary-solid-text",
        "status": "warning",
        "type": "status",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-status-warning-subtle-bg text-badge-status-warning-subtle-text",
        "status": "warning",
        "type": "status",
      },
      {
        "appearance": "solid",
        "class": "bg-bg-semantic-error text-badge-primary-solid-text",
        "status": "error",
        "type": "status",
      },
      {
        "appearance": "subtle",
        "class": "bg-badge-status-error-subtle-bg text-badge-status-error-subtle-text",
        "status": "error",
        "type": "status",
      },
      {
        "class": "bg-badge-primary-solid-bg",
        "type": "dot",
      },
      {
        "class": "bg-badge-primary-solid-bg text-badge-primary-solid-text",
        "type": "count",
      },
    ],
  })
);

// CVA에서 생성되는 기본 variant props (type, level, status 제외)
type CVAVariantProps = Omit<VariantProps<typeof badgeVariants>, 'type' | 'level' | 'status'>;

// 공통 props
type BadgeBaseProps = React.HTMLAttributes<HTMLDivElement> & CVAVariantProps;

// type별 discriminated union
type BadgeLevelProps = BadgeBaseProps & {
  type: 'level';
  level: 'primary' | 'neutral';
  status?: never;
  label: React.ReactNode;
  maxDigits?: never;
  position?: never;
};

type BadgeStatusProps = BadgeBaseProps & {
  type: 'status';
  status: 'info' | 'success' | 'warning' | 'error';
  level?: never;
  label: React.ReactNode;
  maxDigits?: never;
  position?: never;
};

type BadgeCountProps = BadgeBaseProps & {
  type: 'count';
  level?: never;
  status?: never;
  label: React.ReactNode;
  maxDigits?: number;
  position?: never;
};

type BadgeDotProps = BadgeBaseProps & {
  type: 'dot';
  level?: never;
  status?: never;
  label?: never;
  maxDigits?: never;
  /** dot type일 때만 유효. 부모 요소(relative)의 꼭지점에 dot 중앙을 배치 */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
};

export type BadgeProps = BadgeLevelProps | BadgeStatusProps | BadgeCountProps | BadgeDotProps;

// position prop에 따른 positioning 클래스
// dot(6px)을 4px 바깥으로 이동 → label 영역과 2px만 겹침
const positionClasses = {
  'top-right': 'absolute top-0 right-0 -translate-y-[4px] translate-x-[4px]',
  'top-left': 'absolute top-0 left-0 -translate-y-[4px] -translate-x-[4px]',
  'bottom-right': 'absolute bottom-0 right-0 translate-y-[4px] translate-x-[4px]',
  'bottom-left': 'absolute bottom-0 left-0 translate-y-[4px] -translate-x-[4px]',
} as const;

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (props, ref) => {
    const { className, type, mode: propMode, appearance, ...rest } = props;
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // type별로 필요한 props 추출
    const label = type !== 'dot' ? (props as BadgeLevelProps | BadgeStatusProps | BadgeCountProps).label : undefined;
    const level = type === 'level' ? (props as BadgeLevelProps).level : undefined;
    const status = type === 'status' ? (props as BadgeStatusProps).status : undefined;
    const rawMaxDigits = type === 'count' ? (props as BadgeCountProps).maxDigits : undefined;
    // maxDigits는 1 이상의 값만 유효
    const maxDigits = rawMaxDigits !== undefined && rawMaxDigits >= 1 ? rawMaxDigits : undefined;
    // position은 dot type일 때만 유효
    const position = type === 'dot' ? (props as BadgeDotProps).position : undefined;

    // type이 count일 때 label을 숫자로 변환
    const numericValue = type === 'count' ? Number(label) : null;
    const isValidNumber = numericValue !== null && !isNaN(numericValue);

    const content =
      type === 'count' && isValidNumber && maxDigits && numericValue > Math.pow(10, maxDigits) - 1
        ? `${String(Math.pow(10, maxDigits) - 1)}+`
        : label;

    // count single digit: 표시 문자열 길이 1 → 18×18 고정 원형 (Figma digits=single)
    // count multi digit: 패딩 hug (Figma digits=multi)
    const contentStr = type === 'count' ? String(content ?? '') : '';
    const isSingleDigit = type === 'count' && contentStr.length === 1;
    const countSizeClass = type === 'count'
      ? isSingleDigit
        ? 'w-[18px] h-[18px] justify-center'  // single: 고정 크기 원형
        : 'h-[18px] px-component-inset-pill-x justify-center'  // multi: 패딩 hug
      : undefined;

    // rest에서 never 타입 props 제거
    const { level: _l, status: _s, label: _lb, maxDigits: _md, position: _p, ...divProps } =
      rest as Record<string, unknown>;

    // position 클래스 (dot type + position prop이 있을 때만 적용)
    const positionClass = position ? positionClasses[position] : undefined;

    return (
      <div
        className={cn(badgeVariants({ type, mode, appearance, level, status, className }), positionClass, countSizeClass)}
        ref={ref}
        {...divProps}
      >
        {type !== 'dot' ? content : null}
      </div>
    );
  },
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
