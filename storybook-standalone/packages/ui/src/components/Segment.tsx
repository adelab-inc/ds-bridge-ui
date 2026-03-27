import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';
const segmentVariants = cva('flex items-center w-full rounded-[10px] border border-border-default bg-segment-group-bg', ({
    variants: {
      "disabled": {
        "false": "",
        "true": "cursor-not-allowed",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "widthMode": {
        "content": "w-fit",
        "equal": "",
      },
    },
    defaultVariants: {
      "disabled": false,
      "mode": "base",
      "widthMode": "equal",
    },
    compoundVariants: [
      {
        "class": "p-component-inset-segment-group-xy",
        "mode": "base",
      },
      {
        "class": "p-component-inset-segment-group-xy-compact",
        "mode": "compact",
      },
    ],
  }));

export interface SegmentItem {
  /** 아이템의 고유 값 */
  value: string;
  /** 아이템에 표시될 라벨 — Figma: text */
  label: string;
  /** 아이콘 표시 여부 — Figma: showIcon */
  showIcon?: boolean;
  /** 아이콘 — Figma: icon20 (showIcon=true일 때 사용) */
  icon?: React.ReactNode;
  /** 세그먼트 선택 시 표시될 컨텐츠 (코드 전용) */
  content?: React.ReactNode;
  /** 개별 아이템 비활성화 여부 (코드 전용) */
  disabled?: boolean;
}

export interface SegmentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>,
    VariantProps<typeof segmentVariants> {
  /** 세그먼트 아이템 목록 (2~5개 권장) */
  items: SegmentItem[];
  /** 현재 선택된 값 */
  value?: string;
  /** 값 변경 시 호출되는 콜백 */
  onChange?: (value: string) => void;
  /** 아이템 크기 — Figma: Size */
  size?: 'sm' | 'md' | 'lg';
  /** 아이템 너비 모드 — Figma: WidthMode. equal(균등 분배), content(컨텐츠에 맞춤) */
  widthMode?: 'equal' | 'content';
  /** 전체 세그먼트 비활성화 (코드 전용) */
  disabled?: boolean;
  /** 세그먼트 리스트와 패널 사이 간격 (Tailwind 클래스, 예: 'gap-4', 'gap-layout-stack-md') */
  gap?: string;
}

const Segment = React.forwardRef<HTMLDivElement, SegmentProps>(
  (
    {
      className,
      items,
      value,
      onChange,
      size = 'md',
      widthMode = 'equal',
      mode: propMode,
      disabled = false,
      gap,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;
    const listRef = React.useRef<HTMLDivElement>(null);

    const handleItemClick = (itemValue: string, itemDisabled?: boolean) => {
      if (disabled || itemDisabled) return;
      onChange?.(itemValue);
    };

    const handleKeyDown = (
      e: React.KeyboardEvent,
      itemValue: string,
      index: number,
      itemDisabled?: boolean,
    ) => {
      if (disabled || itemDisabled) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          onChange?.(itemValue);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          focusItem(index - 1, -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          focusItem(index + 1, 1);
          break;
      }
    };

    const focusItem = (index: number, direction: -1 | 1) => {
      const enabledItems = items.filter((item) => !item.disabled && !disabled);
      if (enabledItems.length === 0) return;

      let targetIndex = index;
      if (targetIndex < 0) targetIndex = items.length - 1;
      if (targetIndex >= items.length) targetIndex = 0;

      // 비활성화된 아이템은 건너뛰기
      while (items[targetIndex]?.disabled || disabled) {
        targetIndex += direction;
        if (targetIndex < 0) targetIndex = items.length - 1;
        if (targetIndex >= items.length) targetIndex = 0;
      }

      const container = listRef.current;
      if (!container) return;
      const itemElements = container.querySelectorAll('[data-segment-item]');
      (itemElements[targetIndex] as HTMLElement)?.focus();
    };

    const selectedItem = items.find((item) => item.value === value);

    return (
      <div className={cn("flex flex-col", gap)}>
        {/* 세그먼트 리스트 */}
        <div
          ref={(node) => {
            (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          role="tablist"
          className={cn(segmentVariants({ mode, widthMode, disabled }), size === 'sm' && 'rounded-lg', disabled && 'bg-bg-disabled-on-light', className)}
          {...props}
        >
          {items.map((item, index) => {
            const isActive = value === item.value;
            const isItemDisabled = disabled || item.disabled;

            return (
              <SegmentItemButton
                key={item.value}
                size={size}
                mode={mode}
                widthMode={widthMode}
                active={isActive}
                disabled={isItemDisabled}
                onClick={() => handleItemClick(item.value, item.disabled)}
                onKeyDown={(e) => handleKeyDown(e, item.value, index, item.disabled)}
                tabIndex={isItemDisabled ? -1 : isActive ? 0 : -1}
                data-segment-item
                aria-selected={isActive}
                aria-disabled={isItemDisabled}
              >
                {item.showIcon && item.icon && (
                  <span className="flex-shrink-0 flex items-center">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </SegmentItemButton>
            );
          })}
        </div>

        {/* 세그먼트 패널 (선택된 세그먼트의 컨텐츠) */}
        {selectedItem?.content && (
          <div role="tabpanel">
            {selectedItem.content}
          </div>
        )}
      </div>
    );
  },
);
Segment.displayName = 'Segment';

// SegmentItemButton 내부 컴포넌트
const segmentItemVariants = cva(
  'flex justify-center items-center min-w-[56px] max-w-[200px] rounded-lg transition-colors',
  {
    variants: {
      size: {
        lg: 'text-button-lg-medium',
        md: 'text-button-md-medium',
        sm: 'text-button-sm-medium rounded-md',
      },
      mode: {
        base: '',
        compact: '',
      },
      widthMode: {
        equal: 'flex-1',
        content: '',
      },
      active: {
        true: '',
        false: '',
      },
      disabled: {
        true: 'cursor-not-allowed',
        false: 'cursor-pointer',
      },
    },
    compoundVariants: [
      {
        mode: 'base',
        size: 'lg',
        class: 'py-component-inset-segment-item-y px-component-inset-segment-item-lg-x',
      },
      {
        mode: 'base',
        size: 'md',
        class: 'py-component-inset-segment-item-y px-component-inset-segment-item-md-x',
      },
      {
        mode: 'base',
        size: 'sm',
        class: 'py-component-inset-segment-item-y px-component-inset-segment-item-sm-x',
      },
      {
        mode: 'compact',
        size: 'lg',
        class: 'py-component-inset-segment-item-y-compact px-component-inset-segment-item-lg-x-compact',
      },
      {
        mode: 'compact',
        size: 'md',
        class: 'py-component-inset-segment-item-y-compact px-component-inset-segment-item-md-x-compact',
      },
      {
        mode: 'compact',
        size: 'sm',
        class: 'py-component-inset-segment-item-y-compact px-component-inset-segment-item-sm-x-compact',
      },
      {
        active: false,
        disabled: false,
        class:
          'text-text-primary hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]',
      },
      {
        active: true,
        disabled: false,
        class:
          'text-text-on-selection bg-segment-item-bg-selected hover:bg-brand-selection-hover active:bg-brand-selection-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]',
      },
      {
        active: true,
        disabled: true,
        class: 'bg-bg-disabled-on-filled text-text-disabled',
      },
      {
        active: false,
        disabled: true,
        class: 'text-text-disabled',
      },
    ],
    defaultVariants: {
      size: 'md',
      mode: 'base',
      widthMode: 'equal',
      active: false,
      disabled: false,
    },
  },
);

interface SegmentItemButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>,
    VariantProps<typeof segmentItemVariants> {}

const SegmentItemButton = React.forwardRef<HTMLButtonElement, SegmentItemButtonProps>(
  ({ className, size, mode, widthMode, active, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        className={cn(segmentItemVariants({ size, mode, widthMode, active, disabled, className }), 'focus-visible:relative focus-visible:z-[1]')}
        disabled={!!disabled}
        {...props}
      >
        <span className="flex items-center gap-component-gap-icon-label-sm">
          {children}
        </span>
      </button>
    );
  },
);
SegmentItemButton.displayName = 'SegmentItemButton';

export { Segment, segmentVariants, segmentItemVariants };
