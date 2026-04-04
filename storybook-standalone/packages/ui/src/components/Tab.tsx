import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

const tabVariants = cva('flex max-w-[1200px] items-center', ({
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
        "content": "",
        "equal": "",
      },
    },
    defaultVariants: {
      "disabled": false,
      "mode": "base",
      "widthMode": "content",
    },
    compoundVariants: [
      {
        "class": "gap-component-gap-tab-group",
        "mode": "base",
      },
      {
        "class": "gap-component-gap-tab-group-compact",
        "mode": "compact",
      },
    ],
  }));

export interface TabItem {
  /** 아이템의 고유 값 */
  value: string;
  /** 아이템에 표시될 라벨 (Figma: text) */
  label: string;
  /** 아이콘 표시 여부 (Figma: showIcon) */
  showIcon?: boolean;
  /** 아이콘 (Figma: icon-blank-20) */
  icon?: React.ReactNode;
  /** 탭 선택 시 표시될 컨텐츠 */
  content?: React.ReactNode;
  /** 개별 아이템 비활성화 여부 */
  disabled?: boolean;
}

export interface TabProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>,
    VariantProps<typeof tabVariants> {
  /** 탭 아이템 목록 */
  items: TabItem[];
  /** 현재 선택된 값 */
  value?: string;
  /** 값 변경 시 호출되는 콜백 */
  onChange?: (value: string) => void;
  /** 아이템 너비 모드: equal(균등 분배), content(컨텐츠에 맞춤, 기본값) (Figma: width mode) */
  widthMode?: 'equal' | 'content';
  /** 전체 탭 비활성화 */
  disabled?: boolean;
  /** 탭 리스트와 패널 사이 간격 (Tailwind 클래스, 예: 'gap-4', 'gap-layout-stack-md') */
  gap?: string;
}

const renderIcon = (icon: React.ReactNode) => {
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
      className: cn('w-5 h-5', (icon as React.ReactElement<{ className?: string }>).props.className),
    });
  }
  return icon;
};

const Tab = React.forwardRef<HTMLDivElement, TabProps>(
  (
    {
      className,
      items,
      value,
      onChange,
      widthMode = 'content',
      mode: propMode,
      disabled = false,
      gap,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = React.useState(false);
    const [canScrollRight, setCanScrollRight] = React.useState(false);

    // 스크롤 가능 여부 체크
    const checkScrollability = React.useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    }, []);

    React.useEffect(() => {
      checkScrollability();
      const container = scrollContainerRef.current;
      if (!container) return;

      container.addEventListener('scroll', checkScrollability);
      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(container);

      return () => {
        container.removeEventListener('scroll', checkScrollability);
        resizeObserver.disconnect();
      };
    }, [checkScrollability, items]);

    const scroll = (direction: 'left' | 'right') => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // 컨테이너 가용너비의 80%씩 이동 (보고 있던 지점의 끝을 놓치지 않고 최대한 많이 이동)
      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    };

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

      const container = scrollContainerRef.current;
      if (!container) return;
      const itemElements = container.querySelectorAll('[data-tab-item]');
      (itemElements[targetIndex] as HTMLElement)?.focus();
    };

    const showArrows = canScrollLeft || canScrollRight;
    const selectedItem = items.find((item) => item.value === value);

    return (
      <div className={cn("flex flex-col", gap)}>
        {/* 탭 리스트 */}
        <div
          ref={ref}
          role="tablist"
          className={cn(tabVariants({ mode, widthMode, disabled, className }))}
          {...props}
        >
          {/* 탭 아이템 컨테이너 */}
          <div
            ref={scrollContainerRef}
            className={cn(
              'flex flex-1 min-w-0 overflow-x-auto scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] p-0.5 -m-0.5',
              mode === 'base' ? 'gap-component-gap-tab-group' : 'gap-component-gap-tab-group-compact'
            )}
          >
            {items.map((item, index) => {
              const isActive = value === item.value;
              const isItemDisabled = disabled || item.disabled;

              return (
                <TabItemComponent
                  key={item.value}
                  mode={mode}
                  widthMode={widthMode}
                  active={isActive}
                  disabled={isItemDisabled}
                  onClick={() => handleItemClick(item.value, item.disabled)}
                  onKeyDown={(e) => handleKeyDown(e, item.value, index, item.disabled)}
                  tabIndex={isItemDisabled ? -1 : isActive ? 0 : -1}
                  data-tab-item
                  aria-selected={isActive}
                  aria-disabled={isItemDisabled}
                >
                  {item.showIcon && item.icon && (
                    <span className="shrink-0">{renderIcon(item.icon)}</span>
                  )}
                  {item.label}
                </TabItemComponent>
              );
            })}
          </div>

          {/* 스크롤 화살표 (우측에 함께 배치, Figma: IconButton) */}
          {showArrows && (
            <div className="flex flex-shrink-0 items-center gap-component-gap-control-group">
              <IconButton
                iconButtonType="ghost"
                size="lg"
                interaction={canScrollLeft ? 'default' : 'disabled'}
                iconOnly={<Icon name="chevron-left" size={24} />}
                onClick={() => scroll('left')}
                aria-label="이전 탭으로 스크롤"
                tooltip="이전 탭으로 스크롤"
              />
              <IconButton
                iconButtonType="ghost"
                size="lg"
                interaction={canScrollRight ? 'default' : 'disabled'}
                iconOnly={<Icon name="chevron-right" size={24} />}
                onClick={() => scroll('right')}
                aria-label="다음 탭으로 스크롤"
                tooltip="다음 탭으로 스크롤"
              />
            </div>
          )}
        </div>

        {/* 탭 패널 (선택된 탭의 컨텐츠) */}
        {selectedItem?.content && (
          <div role="tabpanel">
            {selectedItem.content}
          </div>
        )}
      </div>
    );
  },
);
Tab.displayName = 'Tab';

// TabItemComponent 내부 컴포넌트
const tabItemVariants = cva(
  'relative flex justify-center items-center whitespace-nowrap rounded text-button-lg-medium text-center transition-colors',
  {
    variants: {
      mode: {
        base: 'py-component-inset-tab-y px-component-inset-tab-x gap-component-gap-icon-label-md',
        compact: 'py-component-inset-tab-y-compact px-component-inset-tab-x-compact gap-component-gap-icon-label-md-compact',
      },
      widthMode: {
        equal: 'flex-1 min-w-[96px] max-w-[216px]',
        content: '',
      },
      active: {
        true: "after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px]",
        false: '',
      },
      disabled: {
        true: 'cursor-not-allowed',
        false: 'cursor-pointer',
      },
    },
    compoundVariants: [
      // 비선택 + 활성화 — Figma: text/secondary + hover/pressed overlay
      {
        active: false,
        disabled: false,
        class:
          'text-text-secondary hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]',
      },
      // 선택 + 활성화 — Figma: text/accent + border/selection 인디케이터
      {
        active: true,
        disabled: false,
        class:
          'after:bg-border-selection text-text-accent focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]',
      },
      // 비선택 + 비활성화 — Figma: text/disabled만 적용
      {
        active: false,
        disabled: true,
        class: 'text-text-disabled',
      },
      // 선택 + 비활성화 — Figma: text/disabled + 인디케이터 bg/disabled 색상
      {
        active: true,
        disabled: true,
        class: 'after:bg-bg-disabled-on-filled text-text-disabled',
      },
    ],
    defaultVariants: {
      mode: 'base',
      widthMode: 'content',
      active: false,
      disabled: false,
    },
  },
);

interface TabItemComponentProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>,
    VariantProps<typeof tabItemVariants> {}

const TabItemComponent = React.forwardRef<HTMLButtonElement, TabItemComponentProps>(
  ({ className, mode, widthMode, active, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        className={cn(tabItemVariants({ mode, widthMode, active, disabled, className }))}
        disabled={disabled ?? false}
        {...props}
      >
        {children}
      </button>
    );
  },
);
TabItemComponent.displayName = 'TabItemComponent';

export { Tab, tabVariants, tabItemVariants };
