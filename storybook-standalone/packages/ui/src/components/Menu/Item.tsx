import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Checkbox } from '../Checkbox';
import { Icon } from '../Icon';
import { cn } from '../utils';
import { CheckboxValue, Interaction } from '../../types';
import type { MenuItemBase, MenuItem, LeadingType, TrailingType } from '../../types';
import { Badge } from '../Badge';
import { TruncateWithTooltip, MultiLineTruncateWithTooltip } from '../../utils';

/** Profile 타입 기본 아바타 아이콘 (Figma Type=avatar 고정) */
const avatarMaskStyle = { maskType: 'alpha' as const };
const DefaultAvatar = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <mask id="menu-avatar-mask" style={avatarMaskStyle} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <circle cx="12" cy="12" r="12" fill="#F4F6F8" />
    </mask>
    <g mask="url(#menu-avatar-mask)">
      <circle cx="12" cy="12" r="12" fill="#98B3EE" />
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0216 15C16.9557 15 20.9636 18.985 20.9923 23.9189L20.9992 25H3.0568L3.05094 24.0234C3.02199 19.0488 7.04694 15.0001 12.0216 15ZM11.9962 4.84961C14.2054 4.84961 15.9962 6.64047 15.9962 8.84961C15.9962 11.0587 14.2054 12.8496 11.9962 12.8496C9.78725 12.8495 7.99626 11.0586 7.99625 8.84961C7.99625 6.64056 9.78724 4.84976 11.9962 4.84961Z" fill="#ECEFF3" />
      <circle cx="12" cy="12" r="11.5" stroke="#98B3EE" />
    </g>
  </svg>
);

const itemVariants = cva('flex items-center transition-colors rounded-[4px] outline-none', ({
    variants: {
      "danger": {
        "false": "",
        "true": "",
      },
      "disabled": {
        "false": "cursor-pointer",
        "true": "cursor-not-allowed",
      },
      "empty": {
        "false": "",
        "true": "",
      },
      "focus": {
        "false": "",
        "true": "",
      },
      "interaction": {
        "default": "",
        "hover": "",
        "pressed": "",
        "selected": "",
        "selected-hover": "",
        "selected-pressed": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "md": "text-button-md-medium",
        "sm": "text-button-sm-medium",
      },
    },
    defaultVariants: {
      "danger": false,
      "disabled": false,
      "empty": false,
      "focus": false,
      "interaction": "default",
      "mode": "base",
      "size": "md",
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
        "danger": false,
        "disabled": false,
        "interaction": "default",
      },
      {
        "class": "bg-state-overlay-on-neutral-hover",
        "danger": false,
        "disabled": false,
        "interaction": "hover",
      },
      {
        "class": "bg-state-overlay-on-colored-pressed",
        "danger": false,
        "disabled": false,
        "interaction": "pressed",
      },
      {
        "class": "bg-bg-selection",
        "disabled": false,
        "interaction": "selected",
      },
      {
        "class": "bg-brand-selection-hover",
        "disabled": false,
        "interaction": "selected-hover",
      },
      {
        "class": "bg-brand-selection-pressed",
        "disabled": false,
        "interaction": "selected-pressed",
      },
      {
        "class": "opacity-40",
        "disabled": true,
      },
      {
        "class": "bg-bg-selection opacity-40",
        "disabled": true,
        "interaction": "selected",
      },
      {
        "class": "shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "disabled": false,
        "focus": true,
      },
      {
        "class": "text-semantic-error text-button-md-medium",
        "danger": true,
        "disabled": false,
        "size": "md",
      },
      {
        "class": "text-semantic-error text-button-sm-medium",
        "danger": true,
        "disabled": false,
        "size": "sm",
      },
      {
        "class": "bg-state-overlay-on-neutral-hover",
        "danger": true,
        "disabled": false,
        "interaction": "hover",
      },
      {
        "class": "bg-state-overlay-on-colored-pressed",
        "danger": true,
        "disabled": false,
        "interaction": "pressed",
      },
      {
        "class": "opacity-40",
        "danger": true,
        "disabled": true,
      },
    ],
  }));

/**
 * resolveType이 반환하는 내부 렌더링용 인터페이스
 */
interface ResolvedMenuItem {
  id: string;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  children?: MenuItem[];
  empty?: boolean;

  showDescription?: boolean;
  description?: string;
  showLeading?: boolean;
  leadingType?: LeadingType;
  leadingContent?: React.ReactNode;
  showTrailing?: boolean;
  trailingType?: TrailingType;
  trailingContent?: React.ReactNode;
  showCloseTrailing?: boolean;
  closeTrailingType?: TrailingType;
  closeTrailingContent?: React.ReactNode;
}

/**
 * type 기반 MenuItemBase → 내부 렌더링 구조로 변환
 */
const resolveType = (item: MenuItemBase): ResolvedMenuItem => {
  const base: ResolvedMenuItem = {
    id: item.id,
    label: item.label,
    onClick: item.onClick,
    disabled: item.disabled,
    danger: item.danger,
    selected: item.selected,
  };

  switch (item.type) {
    case 'text-only':
      return base;
    case 'icon-label':
      return { ...base, showLeading: true, leadingType: 'icon', leadingContent: item.leadingIcon };
    case 'shortcut':
      return { ...base, showTrailing: true, trailingType: 'shortcut', trailingContent: item.shortcutText };
    case 'destructive':
      return { ...base, danger: true };
    case 'submenu':
      return { ...base, children: item.children };
    case 'link':
      return { ...base, showTrailing: true, trailingType: 'external' };
    case 'checkbox':
      return { ...base, showLeading: true, leadingType: 'checkbox' };
    case 'toggle':
      return { ...base, showLeading: true, leadingType: 'check' };
    case 'selection':
      return { ...base, showTrailing: true, trailingType: 'check' };
    case 'empty-state':
      return { ...base, empty: true };
    case 'badge':
      return { ...base, showCloseTrailing: true, closeTrailingType: 'badge', closeTrailingContent: item.badgeContent };
    case 'profile':
      return { ...base, showLeading: true, leadingType: 'avatar', leadingContent: item.avatarContent, showDescription: true, description: item.description };
    case 'description':
      return { ...base, showDescription: true, description: item.description };
    case 'icon-label-badge':
      return { ...base, showLeading: true, leadingType: 'icon', leadingContent: item.leadingIcon, showCloseTrailing: true, closeTrailingType: 'badge', closeTrailingContent: item.badgeContent };
    case 'checkbox-label-badge':
      return { ...base, showLeading: true, leadingType: 'checkbox', showCloseTrailing: true, closeTrailingType: 'badge', closeTrailingContent: item.badgeContent };
    case 'label-icon-badge':
      return { ...base, showCloseTrailing: true, closeTrailingType: 'icon', closeTrailingContent: item.closeTrailingIcon, showTrailing: true, trailingType: 'badge', trailingContent: item.badgeContent };
  }
};

/** md-only type 집합 */
const MD_ONLY_TYPES: Set<string> = new Set([
  'badge', 'profile', 'description',
  'icon-label-badge', 'checkbox-label-badge', 'label-icon-badge',
]);

/**
 * MenuItem Props
 */
interface ItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  item: MenuItemBase;
  size?: 'sm' | 'md';
  onItemClick?: (item: MenuItemBase) => void;
  onItemHover?: (item: MenuItemBase) => void;
  depth?: number;
  isFocused?: boolean;
  isExpanded?: boolean;
  /** 아이템의 ARIA role override. 기본값은 menuitem (checkable이면 menuitemcheckbox). Select에서는 "option" */
  itemRole?: string;
}

/**
 * Trailing 슬롯 렌더링 헬퍼
 */
const renderTrailingSlot = (
  type: TrailingType | undefined,
  content: React.ReactNode | undefined,
  iconBoxSize: string,
  iconSize: 16 | 20,
  iconColor: string,
) => {
  switch (type) {
    case 'shortcut':
      return <span className="text-text-secondary text-caption-xs-regular">{content}</span>;
    case 'chevron':
      return (
        <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize, iconColor)}>
          <Icon name="chevron-right" size={iconSize} />
        </span>
      );
    case 'external':
      return (
        <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize, iconColor)}>
          <Icon name="external" size={iconSize} />
        </span>
      );
    case 'icon':
      return (
        <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize, iconColor)}>
          {content}
        </span>
      );
    case 'badge':
      return <span className="flex-shrink-0 inline-flex items-center justify-center">{content}</span>;
    case 'check':
      return (
        <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize, iconColor)}>
          <Icon name="check" size={iconSize} />
        </span>
      );
    default:
      return content ? <span>{content}</span> : null;
  }
};

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
    itemRole: itemRoleProp,
    className,
    ...props
  }, ref) => {
    // md-only 런타임 경고
    if (process.env.NODE_ENV !== 'production' && size === 'sm' && MD_ONLY_TYPES.has(item.type)) {
      console.warn(`[MenuItem] type "${item.type}" is md-only. size="sm" is not supported.`);
    }

    // type → 내부 렌더링 구조로 변환
    const resolved = resolveType(item);

    // Select(option role): 선택된 항목에 trailing 체크 아이콘 자동 표시
    if (itemRoleProp === 'option' && item.selected) {
      resolved.showTrailing = true;
      resolved.trailingType = 'check';
    }

    // ARIA: role 결정 — itemRoleProp이 있으면 우선 사용 (Select: "option")
    const isCheckable = item.type === 'checkbox' || item.type === 'toggle' || item.type === 'checkbox-label-badge';
    const ariaRole = itemRoleProp || (isCheckable ? 'menuitemcheckbox' : 'menuitem');
    const ariaChecked = isCheckable ? (item.selected ? true : false) : undefined;
    // aria-selected: role="option"일 때 선택 상태 전달
    const ariaSelected = ariaRole === 'option' ? (item.selected ?? false) : undefined;

    // ARIA: shortcut/description 접근성 연결
    const shortcutId = resolved.trailingType === 'shortcut' ? `${item.id}-shortcut` : undefined;
    const descriptionId = resolved.showDescription && resolved.description ? `${item.id}-desc` : undefined;
    const ariaDescribedBy = [shortcutId, descriptionId].filter(Boolean).join(' ') || undefined;

    const [itemState, setItemState] = React.useState<'default' | 'hover' | 'pressed'>('default');

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
        // focus는 별도 axis로 관리, itemState는 변경하지 않음
      }
    };

    const handleBlur = () => {
      if (!item.disabled) {
        setItemState('default');
      }
    };

    // interaction 값 결정
    const getInteraction = () => {
      if (item.selected) {
        if (itemState === 'hover') return 'selected-hover' as const;
        if (itemState === 'pressed') return 'selected-pressed' as const;
        return 'selected' as const;
      }
      return itemState;
    };

    const effectiveInteraction = getInteraction();

    // icon size 결정
    const iconSize = size === 'sm' ? 16 : 20;
    const iconBoxSize = size === 'sm' ? 'w-[16px] h-[16px]' : 'w-[20px] h-[20px]';

    // icon color 결정 (상태별)
    const iconColor = resolved.danger
      ? 'text-semantic-error'
      : 'text-icon-interactive-default';

    // Leading 슬롯 렌더링
    const renderLeading = () => {
      if (!resolved.showLeading) return null;

      switch (resolved.leadingType) {
        case 'icon':
          return (
            <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize, iconColor)}>
              {resolved.leadingContent}
            </span>
          );
        case 'check':
          return (
            <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize, iconColor)}>
              <Icon name="check" size={iconSize} />
            </span>
          );
        case 'checkbox':
          return (
            <span
              className={cn('flex-shrink-0 inline-flex items-center justify-center', iconBoxSize)}
              aria-hidden="true"
            >
              <Checkbox
                size={String(iconSize) as '16' | '20'}
                renderContainer="div"
                value={item.selected ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED}
                interaction={item.disabled ? Interaction.DISABLED : Interaction.DEFAULT}
                tabIndex={-1}
                onChange={() => {}}
              />
            </span>
          );
        case 'avatar':
          return (
            <span className="flex-shrink-0 inline-flex items-center justify-center w-[24px] h-[24px] rounded-full overflow-hidden">
              {resolved.leadingContent ?? <DefaultAvatar />}
            </span>
          );
        case 'tree':
          return (
            <span className={cn('flex-shrink-0 inline-flex items-center justify-center', iconBoxSize, iconColor)}>
              {resolved.leadingContent}
            </span>
          );
        default:
          return resolved.leadingContent ? (
            <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize, iconColor)}>
              {resolved.leadingContent}
            </span>
          ) : null;
      }
    };

    // label 렌더링 (dotBadge 지원)
    const renderLabel = (className?: string) => {
      const label = <TruncateWithTooltip text={item.label || ''} className={cn('truncate', className)} />;
      if (item.dotBadge) {
        return (
          <span className="relative inline-flex">
            {label}
            <Badge type="dot" position="top-right" />
          </span>
        );
      }
      return label;
    };

    // 하위 메뉴 또는 trailing 존재 여부
    const hasTrailingContent =
      resolved.showTrailing ||
      resolved.showCloseTrailing ||
      (resolved.children && resolved.children.length > 0);

    // CVA 클래스 결정
    const isFocusActive = isFocused && !item.disabled;
    const variantClass = itemVariants({
      size,
      interaction: effectiveInteraction,
      disabled: resolved.empty ? false : item.disabled,
      focus: isFocusActive,
      danger: resolved.danger,
      empty: resolved.empty,
    });
    const focusZClass = isFocusActive ? 'relative z-[1]' : '';

    // label + description 레이아웃
    if (resolved.showDescription && resolved.description) {
      return (
        <div
          ref={ref}
          role={ariaRole}
          aria-checked={ariaChecked}
          aria-selected={ariaSelected}
          aria-describedby={ariaDescribedBy}
          tabIndex={isFocused && !item.disabled ? 0 : -1}
          data-depth={depth}
          aria-disabled={item.disabled}
          aria-haspopup={resolved.children && resolved.children.length > 0 ? 'menu' : undefined}
          aria-expanded={resolved.children && resolved.children.length > 0 ? isExpanded : undefined}
          className={cn(
            variantClass,
            focusZClass,
            hasTrailingContent ? 'justify-between' : '',
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
            {renderLeading()}
            <div className="flex-1 flex flex-col gap-layout-stack-xs min-w-0">
              <div className="flex items-center gap-component-gap-icon-label-md">
                {renderLabel(size === 'sm' ? 'text-button-sm-medium' : 'text-button-md-medium')}
                {resolved.showCloseTrailing && resolved.closeTrailingContent && (
                  <span className="flex-shrink-0 inline-flex items-center justify-center">
                    {renderTrailingSlot(resolved.closeTrailingType, resolved.closeTrailingContent, iconBoxSize, iconSize, iconColor)}
                  </span>
                )}
              </div>
              <MultiLineTruncateWithTooltip id={descriptionId} text={resolved.description || ''} className="text-caption-xs-regular text-text-tertiary line-clamp-2" />
            </div>
          </div>
          {/* Trailing 슬롯 (distant) 또는 중첩메뉴 화살표 */}
          {resolved.showTrailing && (
            <span id={shortcutId} className="flex-shrink-0 inline-flex items-center justify-center">
              {renderTrailingSlot(resolved.trailingType, resolved.trailingContent, iconBoxSize, iconSize, iconColor)}
            </span>
          )}
          {!resolved.showTrailing && resolved.children && resolved.children.length > 0 && (
            <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize)}>
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
        role={ariaRole}
        aria-checked={ariaChecked}
        aria-selected={ariaSelected}
        aria-describedby={ariaDescribedBy}
        tabIndex={isFocused && !item.disabled ? 0 : -1}
        data-depth={depth}
        aria-disabled={item.disabled}
        aria-haspopup={resolved.children && resolved.children.length > 0 ? 'menu' : undefined}
        aria-expanded={resolved.children && resolved.children.length > 0 ? isExpanded : undefined}
        className={cn(
          variantClass,
          focusZClass,
          hasTrailingContent ? 'justify-between' : '',
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
          {renderLeading()}
          {renderLabel('min-w-0')}
          {resolved.showCloseTrailing && resolved.closeTrailingContent && (
            <span className="flex-shrink-0 inline-flex items-center justify-center">
              {renderTrailingSlot(resolved.closeTrailingType, resolved.closeTrailingContent, iconBoxSize, iconSize, iconColor)}
            </span>
          )}
        </div>
        {/* Trailing 슬롯 (distant) 또는 중첩메뉴 화살표 */}
        {resolved.showTrailing && (
          <span id={shortcutId} className="flex-shrink-0 inline-flex items-center justify-center">
            {renderTrailingSlot(resolved.trailingType, resolved.trailingContent, iconBoxSize, iconSize, iconColor)}
          </span>
        )}
        {!resolved.showTrailing && resolved.children && resolved.children.length > 0 && (
          <span className={cn('flex-shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full', iconBoxSize)}>
            <Icon name="chevron-right" size={16} />
          </span>
        )}
      </div>
    );
  }
);
Item.displayName = 'Item';

export { Item, itemVariants };
