import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Checkbox } from '../Checkbox';
import { Radio } from '../Radio';
import { Icon } from '../Icon';
import { Tooltip } from '../Tooltip';
import { cn } from '../utils';

const itemVariants = cva('flex items-center cursor-pointer transition-colors rounded-[4px]', ({
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
        "default": "text-text-primary",
        "disabled": "",
        "focused": "",
        "hover": "",
        "pressed": "",
        "selected": "",
        "selected-hover": "",
        "selected-pressed": "",
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
        "class": "shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
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
  /** badge를 텍스트 우측상단에 absolute로 배치 (dot badge용) */
  badgeDot?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  selected?: boolean;
  children?: MenuItem[];
}

/**
 * 텍스트가 잘릴 때만 Tooltip을 표시하는 컴포넌트 (단일 라인)
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
 * 다중 라인 텍스트가 잘릴 때 Tooltip을 표시하는 컴포넌트 (line-clamp용)
 */
interface MultiLineTruncateWithTooltipProps {
  text: string;
  className?: string;
}

const MultiLineTruncateWithTooltip = ({ text, className }: MultiLineTruncateWithTooltipProps) => {
  const [isTruncated, setIsTruncated] = React.useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const checkTruncation = React.useCallback(() => {
    if (textRef.current) {
      // line-clamp 적용 시 scrollHeight와 clientHeight 비교
      const el = textRef.current;
      // 1px 여유를 두어 부동소수점 오차 방지
      setIsTruncated(el.scrollHeight > el.clientHeight + 1);
    }
  }, []);

  React.useEffect(() => {
    // 레이아웃 완료 후 체크 (requestAnimationFrame 2번 호출로 paint 이후 체크)
    let rafId: number;
    const checkAfterLayout = () => {
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          checkTruncation();
        });
      });
    };

    checkAfterLayout();
    window.addEventListener('resize', checkTruncation);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkTruncation);
    };
  }, [checkTruncation, text]);

  const textElement = (
    <span ref={textRef} className={className}>
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
            item.children ? 'justify-between' : '',
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
              <span className={cn('flex-shrink-0 inline-flex items-center justify-center', iconBoxSize)}>{item.leftIcon}</span>
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
                {item.rightIcon && <span className={cn('flex-shrink-0 inline-flex items-center justify-center', iconBoxSize)}>{item.rightIcon}</span>}
              </div>
              <MultiLineTruncateWithTooltip text={item.description || ''} className="text-caption-xs-regular text-text-tertiary line-clamp-2" />
            </div>
          </div>
          {/* 중첩메뉴 화살표 - 우측 정렬 */}
          {item.children && (
            <span className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center ml-2">
              <Icon name="chevron-right" size={16} />
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
          item.children ? 'justify-between' : '',
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
            <span className={cn('flex-shrink-0 inline-flex items-center justify-center', iconBoxSize)}>{item.leftIcon}</span>
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
          {item.rightIcon && <span className={cn('flex-shrink-0 inline-flex items-center justify-center', iconBoxSize)}>{item.rightIcon}</span>}
        </div>
        {/* 중첩메뉴 화살표 - 우측 정렬 */}
        {item.children && (
          <span className="flex-shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center ml-2">
            <Icon name="chevron-right" size={16} />
          </span>
        )}
      </div>
    );
  }
);
Item.displayName = 'Item';

export { Item };
