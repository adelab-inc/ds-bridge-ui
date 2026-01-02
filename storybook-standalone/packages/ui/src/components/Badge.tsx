import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils'; // 경로 수정

const badgeVariants = cva(
  'inline-flex items-center shrink-0 rounded-full',
  ({
    variants: {
      "levelVariant": {
        "announcement": "",
      },
      "statusVariant": {
        "error": "",
        "info": "",
        "success": "",
        "warning": "",
      },
      "variant": {
        "announcement-solid": "",
        "announcement-subtle": "",
        "error-solid": "",
        "error-subtle": "",
        "info-solid": "",
        "info-subtle": "",
        "solid": "",
        "subtle": "",
        "success-solid": "",
        "success-subtle": "",
        "warning-solid": "",
        "warning-subtle": "",
      },
      "type": {
        "count": "py-component-inset-pill-y px-component-inset-pill-x gap-component-gap-icon-label-x-xs text-caption-xs-medium",
        "dot": "w-[6px] h-[6px]",
        "level": "py-component-inset-pill-y px-component-inset-pill-x gap-component-gap-icon-label-x-xs text-caption-xs-regular",
        "status": "py-component-inset-pill-y px-component-inset-pill-x gap-component-gap-icon-label-x-xs text-caption-xs-regular",
      },
    },
    defaultVariants: {
      "levelVariant": "announcement",
      "type": "level",
      "variant": "announcement-solid",
    },
    compoundVariants: [
      {
        "class": "bg-badge-primary-solid-bg text-badge-solid-text",
        "levelVariant": "announcement",
        "type": "level",
        "variant": "announcement-solid",
      },
      {
        "class": "bg-badge-primary-subtle-bg text-badge-primary-subtle-text",
        "levelVariant": "announcement",
        "type": "level",
        "variant": "announcement-subtle",
      },
      {
        "class": "bg-bg-semantic-info text-badge-solid-text",
        "statusVariant": "info",
        "type": "status",
        "variant": "info-solid",
      },
      {
        "class": "bg-badge-status-info-subtle-bg text-badge-status-info-subtle-text",
        "statusVariant": "info",
        "type": "status",
        "variant": "info-subtle",
      },
      {
        "class": "bg-bg-semantic-success text-badge-solid-text",
        "statusVariant": "success",
        "type": "status",
        "variant": "success-solid",
      },
      {
        "class": "bg-badge-status-success-subtle-bg text-badge-status-success-subtle-text",
        "statusVariant": "success",
        "type": "status",
        "variant": "success-subtle",
      },
      {
        "class": "bg-bg-semantic-warning text-badge-solid-text",
        "statusVariant": "warning",
        "type": "status",
        "variant": "warning-solid",
      },
      {
        "class": "bg-badge-status-warning-subtle-bg text-badge-status-warning-subtle-text",
        "statusVariant": "warning",
        "type": "status",
        "variant": "warning-subtle",
      },
      {
        "class": "bg-bg-semantic-error text-badge-solid-text",
        "statusVariant": "error",
        "type": "status",
        "variant": "error-solid",
      },
      {
        "class": "bg-badge-status-error-subtle-bg text-badge-status-error-subtle-text",
        "statusVariant": "error",
        "type": "status",
        "variant": "error-subtle",
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

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  maxDigits?: number;
  levelVariant?: 'announcement';
  statusVariant?: 'info' | 'success' | 'warning' | 'error';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, type, variant, levelVariant, statusVariant, children, maxDigits, ...props }, ref) => {
    const content =
      type === 'count' && typeof children === 'number' && maxDigits && children > Math.pow(10, maxDigits) - 1
        ? `${String(Math.pow(10, maxDigits) - 1)}+`
        : children;

    return (
      <div
        className={cn(badgeVariants({ type, variant, levelVariant, statusVariant, className }))}
        ref={ref}
        {...props}
      >
        {type !== 'dot' ? content : null}
      </div>
    );
  },
);
Badge.displayName = 'Badge';

export { Badge };