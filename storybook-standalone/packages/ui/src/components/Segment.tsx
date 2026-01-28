import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const segmentVariants = cva('flex items-center w-full rounded-[10px] border border-border-default bg-segment-group-bg', ({
    variants: {
      "isDisabled": {
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
      "isDisabled": false,
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
  /** 아이템에 표시될 라벨 */
  label: string;
  /** 세그먼트 선택 시 표시될 컨텐츠 */
  content?: React.ReactNode;
  /** 개별 아이템 비활성화 여부 */
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
  /** 아이템 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 아이템 너비 모드: equal(균등 분배), content(컨텐츠에 맞춤) */
  widthMode?: 'equal' | 'content';
  /** 전체 세그먼트 비활성화 */
  disabled?: boolean;
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
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

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
        case 'ArrowUp':
          e.preventDefault();
          focusItem(index - 1);
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          focusItem(index + 1);
          break;
      }
    };

    const focusItem = (index: number) => {
      const enabledItems = items.filter((item) => !item.disabled && !disabled);
      if (enabledItems.length === 0) return;

      let targetIndex = index;
      if (targetIndex < 0) targetIndex = items.length - 1;
      if (targetIndex >= items.length) targetIndex = 0;

      // 비활성화된 아이템은 건너뛰기
      while (items[targetIndex]?.disabled || disabled) {
        targetIndex = index < 0 ? targetIndex - 1 : targetIndex + 1;
        if (targetIndex < 0) targetIndex = items.length - 1;
        if (targetIndex >= items.length) targetIndex = 0;
      }

      const itemElements = document.querySelectorAll('[data-segment-item]');
      (itemElements[targetIndex] as HTMLElement)?.focus();
    };

    const selectedItem = items.find((item) => item.value === value);

    return (
      <div className="flex flex-col">
        {/* 세그먼트 리스트 */}
        <div
          ref={ref}
          role="tablist"
          className={cn(segmentVariants({ mode, widthMode, isDisabled: disabled, className }))}
          {...props}
        >
          {items.map((item, index) => {
            const isSelected = value === item.value;
            const isItemDisabled = disabled || item.disabled;

            return (
              <SegmentItem
                key={item.value}
                size={size}
                mode={mode}
                widthMode={widthMode}
                isSelected={isSelected}
                isDisabled={isItemDisabled}
                onClick={() => handleItemClick(item.value, item.disabled)}
                onKeyDown={(e) => handleKeyDown(e, item.value, index, item.disabled)}
                tabIndex={isItemDisabled ? -1 : isSelected ? 0 : -1}
                data-segment-item
                aria-selected={isSelected}
                aria-disabled={isItemDisabled}
              >
                {item.label}
              </SegmentItem>
            );
          })}
        </div>

        {/* 세그먼트 패널 (선택된 세그먼트의 컨텐츠) */}
        {selectedItem?.content && (
          <div role="tabpanel" className="pt-4">
            {selectedItem.content}
          </div>
        )}
      </div>
    );
  },
);
Segment.displayName = 'Segment';

// SegmentItem 내부 컴포넌트
const segmentItemVariants = cva(
  'flex justify-center items-center min-w-[56px] max-w-[200px] rounded-lg cursor-pointer transition-colors',
  {
    variants: {
      size: {
        lg: 'text-button-lg-medium',
        md: 'text-button-md-medium',
        sm: 'text-button-sm-medium',
      },
      mode: {
        base: '',
        compact: '',
      },
      widthMode: {
        equal: 'flex-1',
        content: '',
      },
      isSelected: {
        true: '',
        false: '',
      },
      isDisabled: {
        true: 'cursor-not-allowed',
        false: '',
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
        isSelected: false,
        isDisabled: false,
        class:
          'text-text-primary hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]',
      },
      {
        isSelected: true,
        isDisabled: false,
        class:
          'text-text-on-selection bg-segment-item-bg-selected hover:bg-brand-selection-hover active:bg-brand-selection-pressed focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]',
      },
      {
        isDisabled: true,
        class: 'bg-bg-disabled-on-filled text-text-disabled',
      },
    ],
    defaultVariants: {
      size: 'md',
      mode: 'base',
      widthMode: 'equal',
      isSelected: false,
      isDisabled: false,
    },
  },
);

interface SegmentItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof segmentItemVariants> {}

const SegmentItem = React.forwardRef<HTMLButtonElement, SegmentItemProps>(
  ({ className, size, mode, widthMode, isSelected, isDisabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        className={cn(segmentItemVariants({ size, mode, widthMode, isSelected, isDisabled, className }))}
        disabled={isDisabled ?? false}
        {...props}
      >
        {children}
      </button>
    );
  },
);
SegmentItem.displayName = 'SegmentItem';

export { Segment, segmentVariants, segmentItemVariants };
