import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Checkbox } from '../Checkbox';
import { Radio } from '../Radio';
import { Icon } from '../Icon';
import { cn } from '../utils';
import { TruncateWithTooltip, MultiLineTruncateWithTooltip } from '../../utils';

const itemVariants = cva('flex items-center transition-colors rounded-[4px]', ({
    variants: {
      "destructive": {
        "false": "",
        "true": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "md": "text-button-md-medium",
        "sm": "text-button-sm-medium",
      },
      "state": {
        "default": "cursor-pointer",
        "disabled": "cursor-not-allowed",
        "focused": "cursor-pointer",
        "hover": "cursor-pointer",
        "pressed": "cursor-pointer",
        "selected": "cursor-pointer",
        "selected-hover": "cursor-pointer",
        "selected-pressed": "cursor-pointer",
      },
    },
    defaultVariants: {
      "destructive": false,
      "mode": "base",
      "size": "md",
      "state": "default",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-menu-item-y px-component-inset-menu-item-x gap-component-gap-icon-label-md",
        "mode": "base",
      },
      {
        "class": "py-component-inset-menu-item-y-compact px-component-inset-menu-item-x-compact gap-component-gap-icon-label-md-compact",
        "mode": "compact",
      },
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
        "class": "text-text-disabled",
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
        "class": "shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "destructive": false,
        "state": "focused",
      },
      {
        "class": "text-semantic-error text-button-md-medium",
        "destructive": true,
        "size": "md",
      },
      {
        "class": "text-semantic-error text-button-sm-medium",
        "destructive": true,
        "size": "sm",
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
  /** badge를 텍스트 우측상단에 absolute로 배치 (dot badge용) */
  badgeDot?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  selected?: boolean;
  children?: MenuItem[];
}

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

    // icon size 결정
    const iconSize = size === 'sm' ? 16 : 20;
    const iconBoxSize = size === 'sm' ? 'w-[16px] h-[16px]' : 'w-[20px] h-[20px]';

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
            (item.children || item.rightIcon) ? 'justify-between' : '',
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
          <div className="flex gap-component-gap-icon-label-md flex-1 min-w-0">
            {/* 왼쪽 아이콘 영역 - Checkbox/Radio 또는 커스텀 아이콘 */}
            {checkboxMode !== 'none' ? (
              <span
                className={cn('flex-shrink-0 inline-flex items-center justify-center pointer-events-none', iconBoxSize)}
                aria-hidden="true"
              >
                {checkboxMode === 'checkbox' ? (
                  <Checkbox
                    size={String(iconSize) as '16' | '20'}
                    renderContainer="div"
                    checked={isChecked}
                    disabled={item.disabled}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                ) : (
                  <Radio
                    size={String(iconSize) as '16' | '20'}
                    renderContainer="div"
                    checked={isChecked}
                    disabled={item.disabled}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                )}
              </span>
            ) : item.leftIcon ? (
              <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize)}>{item.leftIcon}</span>
            ) : null}

            {/* 메인 콘텐츠 영역 (title + description) */}
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-layout-stack-xs">
                {item.badgeDot && item.badge ? (
                  <span className="relative inline-flex items-start min-w-0">
                    <TruncateWithTooltip text={item.title || ''} className={cn('truncate', size === 'sm' ? 'text-button-sm-medium' : 'text-button-md-medium')} />
                    {item.badge}
                  </span>
                ) : item.badge ? (
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <TruncateWithTooltip text={item.title || ''} className={cn('truncate', size === 'sm' ? 'text-button-sm-medium' : 'text-button-md-medium')} />
                    <span className="flex-shrink-0 inline-flex items-center justify-center">{item.badge}</span>
                  </span>
                ) : (
                  <TruncateWithTooltip text={item.title || ''} className={cn('truncate', size === 'sm' ? 'text-button-sm-medium' : 'text-button-md-medium')} />
                )}
              </div>
              <MultiLineTruncateWithTooltip text={item.description || ''} className="text-caption-xs-regular text-text-tertiary line-clamp-2" />
            </div>
          </div>
          {/* 우측 영역 - rightIcon 또는 중첩메뉴 화살표 */}
          {(item.rightIcon || item.children) && (
            <span className={cn('flex-shrink-0 inline-flex items-center justify-center ml-2 [&>svg]:w-full [&>svg]:h-full', iconBoxSize)}>
              {item.children ? <Icon name="chevron-right" size={16} /> : item.rightIcon}
            </span>
          )}
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
          (item.children || item.rightIcon) ? 'justify-between' : '',
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
        {/* 좌측 콘텐츠 영역 */}
        <div className="flex items-center gap-component-gap-icon-label-md flex-1 min-w-0">
          {/* 왼쪽 아이콘 영역 - Checkbox/Radio 또는 커스텀 아이콘 */}
          {checkboxMode !== 'none' ? (
            <span
              className={cn('flex-shrink-0 inline-flex items-center justify-center pointer-events-none', iconBoxSize)}
              aria-hidden="true"
            >
              {checkboxMode === 'checkbox' ? (
                <Checkbox
                  size={String(iconSize) as '16' | '20'}
                  renderContainer="div"
                  checked={isChecked}
                  disabled={item.disabled}
                  tabIndex={-1}
                  onChange={() => {}}
                />
              ) : (
                <Radio
                  size={String(iconSize) as '16' | '20'}
                  renderContainer="div"
                  checked={isChecked}
                  disabled={item.disabled}
                  tabIndex={-1}
                  onChange={() => {}}
                />
              )}
            </span>
          ) : item.leftIcon ? (
            <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize)}>{item.leftIcon}</span>
          ) : null}
          {item.badgeDot && item.badge ? (
            <span className="relative inline-flex items-start">
              <TruncateWithTooltip text={item.label || ''} className="truncate" />
              {item.badge}
            </span>
          ) : item.badge ? (
            <span className="inline-flex items-center gap-2 min-w-0">
              <TruncateWithTooltip text={item.label || ''} className="truncate" />
              <span className="flex-shrink-0 inline-flex items-center justify-center">{item.badge}</span>
            </span>
          ) : (
            <TruncateWithTooltip text={item.label || ''} className="truncate min-w-0" />
          )}
        </div>
        {/* 우측 영역 - rightIcon 또는 중첩메뉴 화살표 */}
        {(item.rightIcon || item.children) && (
          <span className={cn('flex-shrink-0 inline-flex items-center justify-center ml-2 [&>svg]:w-full [&>svg]:h-full', iconBoxSize)}>
            {item.children ? <Icon name="chevron-right" size={16} /> : item.rightIcon}
          </span>
        )}
      </div>
    );
  }
);
Item.displayName = 'Item';

export { Item };
