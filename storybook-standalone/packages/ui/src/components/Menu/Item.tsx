import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Checkbox } from '../Checkbox';
import { Radio } from '../Radio';
import { Icon } from '../Icon';
import { Tooltip } from '../Tooltip';
import { cn } from '../utils';

const itemVariants = cva('flex min-w-[168px] max-w-[264px] py-component-inset-menu-item-y px-component-inset-menu-item-x items-center gap-component-gap-icon-label-x-md cursor-pointer transition-colors', ({
    variants: {
      "size": {
        "md": "text-button-md-medium",
        "sm": "text-button-sm-medium",
      },
      "state": {
        "default": "text-text-primary",
        "disabled": "",
        "focused": "",
        "hover": "",
        "pressed": "",
        "selected": "",
        "selected-hover": "",
        "selected-pressed": "",
      },
      "destructive": {
        "false": "",
        "true": "",
      },
    },
    defaultVariants: {
      "destructive": false,
      "size": "md",
      "state": "default",
    },
    compoundVariants: [
      {
        "class": "text-text-primary",
        "destructive": false,
        "state": "default",
      },
      {
        "class": "bg-state-overlay-on-neutral-hover",
        "destructive": false,
        "state": "hover",
      },
      {
        "class": "bg-state-overlay-on-colored-pressed",
        "destructive": false,
        "state": "pressed",
      },
      {
        "class": "text-text-disabled cursor-not-allowed",
        "state": "disabled",
      },
      {
        "class": "bg-bg-selection",
        "state": "selected",
      },
      {
        "class": "bg-brand-selection-hover",
        "state": "selected-hover",
      },
      {
        "class": "bg-brand-selection-pressed",
        "state": "selected-pressed",
      },
      {
        "class": "outline outline-2 outline-focus outline-offset-[-2px]",
        "destructive": false,
        "state": "focused",
      },
      {
        "class": "text-alert-error-text",
        "destructive": true,
      },
      {
        "class": "bg-state-overlay-on-neutral-hover",
        "destructive": true,
        "state": "hover",
      },
      {
        "class": "bg-state-overlay-on-colored-pressed",
        "destructive": true,
        "state": "pressed",
      },
    ],
  }));

/**
 * MenuItem 데이터 구조
 */
export interface MenuItem {
  id: string;
  label?: string;
  title?: string;
  description?: string;
  heading?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  selected?: boolean;
  children?: MenuItem[];
}

/**
 * 텍스트가 잘릴 때만 Tooltip을 표시하는 컴포넌트
 */
interface TruncateWithTooltipProps {
  text: string;
  className?: string;
}

const TruncateWithTooltip = ({ text, className }: TruncateWithTooltipProps) => {
  const [isTruncated, setIsTruncated] = React.useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const checkTruncation = React.useCallback(() => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  }, []);

  React.useEffect(() => {
    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [checkTruncation, text]);

  const textElement = (
    <span ref={textRef} className={`truncate ${className || ''}`}>
      {text}
    </span>
  );

  if (isTruncated) {
    return <Tooltip content={text}>{textElement}</Tooltip>;
  }

  return textElement;
};

/**
 * MenuItem Props
 */
interface ItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  item: MenuItem;
  size?: 'sm' | 'md';
  onItemClick?: (item: MenuItem) => void;
  onItemHover?: (item: MenuItem) => void;
  depth?: number;
  isFocused?: boolean;
  isExpanded?: boolean;
  /** 체크박스/라디오 모드 */
  checkboxMode?: 'none' | 'checkbox' | 'radio';
  /** 체크 상태 */
  isChecked?: boolean;
  /** 체크 변경 핸들러 */
  onCheckChange?: (id: string, checked: boolean) => void;
}

/**
 * MenuItem 컴포넌트
 */
const Item = React.forwardRef<HTMLDivElement, ItemProps>(
  ({
    item,
    size = 'md',
    onItemClick,
    onItemHover,
    depth = 0,
    isFocused = false,
    isExpanded = false,
    checkboxMode = 'none',
    isChecked = false,
    onCheckChange,
    className,
    ...props
  }, ref) => {
    const [itemState, setItemState] = React.useState<'default' | 'hover' | 'pressed' | 'focused'>('default');

    const handleMouseEnter = () => {
      if (!item.disabled) {
        setItemState('hover');
        onItemHover?.(item);
      }
    };

    const handleMouseLeave = () => {
      if (!item.disabled) {
        setItemState('default');
      }
    };

    const handleMouseDown = () => {
      if (!item.disabled) {
        setItemState('pressed');
      }
    };

    const handleMouseUp = () => {
      if (!item.disabled) {
        setItemState('hover');
      }
    };

    const handleClick = () => {
      if (!item.disabled) {
        // checkboxMode일 때 자동으로 체크 상태 토글
        if (checkboxMode === 'checkbox') {
          onCheckChange?.(item.id, !isChecked);
        } else if (checkboxMode === 'radio') {
          onCheckChange?.(item.id, true);
        }

        onItemClick?.(item);
        item.onClick?.();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    const handleFocus = () => {
      if (!item.disabled && itemState !== 'pressed') {
        setItemState('focused');
      }
    };

    const handleBlur = () => {
      if (!item.disabled) {
        setItemState('default');
      }
    };

    // 상태 결정 로직
    const getState = () => {
      if (item.disabled) return 'disabled';
      if (item.selected) {
        if (itemState === 'hover') return 'selected-hover';
        if (itemState === 'pressed') return 'selected-pressed';
        return 'selected';
      }
      if (itemState === 'focused') return 'focused';
      return itemState;
    };

    const state = getState();

    // role 결정 로직
    const getRole = () => {
      if (checkboxMode === 'checkbox') return 'menuitemcheckbox';
      if (checkboxMode === 'radio') return 'menuitemradio';
      return 'menuitem';
    };

    // title + description 형태
    if (item.title && item.description) {
      return (
        <div
          ref={ref}
          role={getRole()}
          tabIndex={isFocused ? 0 : -1}
          data-depth={depth}
          aria-disabled={item.disabled}
          aria-checked={checkboxMode !== 'none' ? isChecked : undefined}
          aria-haspopup={item.children && item.children.length > 0 ? 'menu' : undefined}
          aria-expanded={item.children && item.children.length > 0 ? isExpanded : undefined}
          className={cn(
            itemVariants({ size, state, destructive: item.destructive }),
            className
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        >
          <div className="flex gap-component-gap-icon-label-x-md">
            {/* 왼쪽 아이콘 영역 - Checkbox/Radio 또는 커스텀 아이콘 */}
            {checkboxMode !== 'none' ? (
              <span
                className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center pointer-events-none"
                aria-hidden="true"
              >
                {checkboxMode === 'checkbox' ? (
                  <Checkbox
                    size="16"
                    renderContainer="div"
                    checked={isChecked}
                    disabled={item.disabled}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                ) : (
                  <Radio
                    size="16"
                    renderContainer="div"
                    checked={isChecked}
                    disabled={item.disabled}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                )}
              </span>
            ) : item.leftIcon ? (
              <span className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center">{item.leftIcon}</span>
            ) : null}

            {/* 메인 콘텐츠 영역 (title + description) */}
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-layout-stack-xs">
                <span className={cn('truncate', size === 'sm' ? 'text-button-sm-medium' : 'text-button-md-medium')}>{item.title}</span>
                {item.badge && <span className="flex-shrink-0 inline-flex items-center justify-center ml-2">{item.badge}</span>}
                {item.rightIcon && <span className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center">{item.rightIcon}</span>}
                {item.children && (
                  <span className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center">
                    <Icon name="chevron-right" size={16} />
                  </span>
                )}
              </div>
              <span className="text-caption-xs-regular text-text-tertiary line-clamp-2">{item.description}</span>
            </div>
          </div>
        </div>
      );
    }

    // 일반 메뉴 아이템
    return (
      <div
        ref={ref}
        role={getRole()}
        tabIndex={isFocused ? 0 : -1}
        data-depth={depth}
        aria-disabled={item.disabled}
        aria-checked={checkboxMode !== 'none' ? isChecked : undefined}
        aria-haspopup={item.children && item.children.length > 0 ? 'menu' : undefined}
        aria-expanded={item.children && item.children.length > 0 ? isExpanded : undefined}
        className={cn(
          itemVariants({ size, state, destructive: item.destructive }),
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      >
        {/* 왼쪽 아이콘 영역 - Checkbox/Radio 또는 커스텀 아이콘 */}
        {checkboxMode !== 'none' ? (
          <span
            className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            {checkboxMode === 'checkbox' ? (
              <Checkbox
                size="16"
                renderContainer="div"
                checked={isChecked}
                disabled={item.disabled}
                tabIndex={-1}
                onChange={() => {}}
              />
            ) : (
              <Radio
                size="16"
                renderContainer="div"
                checked={isChecked}
                disabled={item.disabled}
                tabIndex={-1}
                onChange={() => {}}
              />
            )}
          </span>
        ) : item.leftIcon ? (
          <span className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center">{item.leftIcon}</span>
        ) : null}
        <TruncateWithTooltip text={item.label || ''} className="truncate" />
        {item.badge && <span className="flex-shrink-0 inline-flex items-center justify-center ml-2">{item.badge}</span>}
        {item.rightIcon && <span className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center">{item.rightIcon}</span>}
        {item.children && (
          <span className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center">
            <Icon name="chevron-right" size={16} />
          </span>
        )}
      </div>
    );
  }
);
Item.displayName = 'Item';

export { Item };
