import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Checkbox } from '../Checkbox';
import { Icon } from '../Icon';
import { cn } from '../utils';

const itemVariants = cva('relative flex items-center py-component-inset-menu-item-y px-component-inset-menu-item-x gap-layout-stack-md text-text-primary', ({
    variants: {
      "depth": {
        "1": "",
        "2": "pl-8",
        "3": "pl-12",
        "4": "pl-16",
      },
      "size": {
        "md": "text-button-md-medium",
        "sm": "text-button-sm-medium",
      },
      "state": {
        "default": "cursor-pointer",
        "disabled": "text-text-disabled cursor-not-allowed",
        "hover": "rounded-[4px] cursor-pointer",
      },
    },
    defaultVariants: {
      "depth": "1",
      "size": "md",
      "state": "default",
    },
  }));

/**
 * z-index 스케일 정의 (Tailwind 정적 클래스)
 * - CONTENT: 기본 콘텐츠 레이어 (체크박스 등) - z-[10]
 * - OVERLAY_ACTIVE: 활성화된 오버레이 레이어 (체크박스 hover 시) - z-[20]
 *
 * 주의: Tailwind JIT는 동적 클래스를 인식하지 못하므로 정적 문자열 사용
 */
const Z_INDEX_CLASS = {
  CONTENT: 'z-[10]',
  OVERLAY_ACTIVE: 'z-[20]',
} as const;

/**
 * Hover 상태 통합 타입
 * - isItemHovered: 행 전체 hover 여부
 * - expandIcon: 펼침 아이콘 상태
 * - actionIcon: hover 액션 아이콘 상태
 * - isCheckboxHovered: 체크박스 hover 여부
 */
type HoverState = {
  isItemHovered: boolean;
  expandIcon: 'default' | 'hover' | 'pressed';
  actionIcon: 'default' | 'hover' | 'pressed';
  isCheckboxHovered: boolean;
};

/**
 * TreeMenu 사이즈 타입
 */
export type TreeMenuSize = 'sm' | 'md';

/**
 * TreeMenuItem 기본 데이터 구조
 */
interface TreeMenuItemDataBase {
  id: string;
  label: string;
  expandIcon?: React.ReactNode;
  hoverActionIcon?: React.ReactNode;
  onHoverActionClick?: () => void;
  disabled?: boolean;
}

/**
 * MD 전용 속성 (체크박스, 뱃지)
 */
interface TreeMenuItemDataMdOnly {
  /** 체크박스 표시 여부 (MD only) */
  showCheckbox?: boolean;
  /** 뱃지 (MD only) */
  badge?: React.ReactNode;
  /** badge를 텍스트 우측상단에 absolute로 배치 (dot badge용, MD only) */
  badgeDot?: boolean;
}

/**
 * SM 사이즈용 TreeMenuItem 데이터 구조
 * - 체크박스, 뱃지 사용 불가
 */
export interface TreeMenuItemDataSm extends TreeMenuItemDataBase {
  children?: TreeMenuItemDataSm[];
}

/**
 * MD 사이즈용 TreeMenuItem 데이터 구조
 * - 체크박스, 뱃지 사용 가능
 */
export interface TreeMenuItemDataMd extends TreeMenuItemDataBase, TreeMenuItemDataMdOnly {
  children?: TreeMenuItemDataMd[];
}

/**
 * TreeMenuItem 데이터 구조 (하위 호환성을 위한 타입 별칭)
 * 기본값은 MD
 */
export type TreeMenuItemData = TreeMenuItemDataMd;

/**
 * 드롭 위치 타입
 * - 'before': 대상 아이템 위에 삽입
 * - 'after': 대상 아이템 아래에 삽입
 * - 'inside': 대상 아이템의 하위로 이동
 */
export type DropPosition = 'before' | 'after' | 'inside';

/**
 * TreeMenu.Item 공통 Props
 */
interface ItemPropsCommon extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick' | 'onDragStart' | 'onDragEnd' | 'onDragOver' | 'onDragEnter' | 'onDragLeave' | 'onDrop'> {
  depth?: 1 | 2 | 3 | 4;
  hasChildren?: boolean;
  isExpanded?: boolean;
  isFocused?: boolean;
  /** Tab 키로 진입 가능한 첫 번째 아이템 여부 (접근성) */
  isFirstFocusable?: boolean;
  onExpandToggle?: () => void;
  onItemClick?: () => void;
  /** 드래그 가능 여부 */
  draggable?: boolean;
  /** 현재 드래그 중인 아이템인지 여부 */
  isDragging?: boolean;
  /** 현재 드롭 대상 위치 (인디케이터 표시용) */
  dragOverPosition?: DropPosition | null;
  /** 드래그 시작 핸들러 */
  onDragStart?: (e: React.DragEvent) => void;
  /** 드래그 종료 핸들러 */
  onDragEnd?: (e: React.DragEvent) => void;
  /** 드래그 오버 핸들러 */
  onDragOver?: (e: React.DragEvent) => void;
  /** 드래그 진입 핸들러 */
  onDragEnter?: (e: React.DragEvent) => void;
  /** 드래그 이탈 핸들러 */
  onDragLeave?: (e: React.DragEvent) => void;
  /** 드롭 핸들러 */
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * SM 사이즈 전용 Props (판별 유니온)
 * - checkboxMode, checkState, onCheckChange 사용 불가
 */
interface ItemPropsSm extends ItemPropsCommon {
  size: 'sm';
  item: TreeMenuItemDataSm;
}

/**
 * MD 사이즈 전용 Props (판별 유니온)
 * - checkboxMode, checkState, onCheckChange 사용 가능
 */
interface ItemPropsMd extends ItemPropsCommon {
  size?: 'md';
  item: TreeMenuItemDataMd;
  /** 체크박스 모드 (MD only) */
  checkboxMode?: boolean;
  /** 체크 상태 (MD only) */
  checkState?: 'checked' | 'unchecked' | 'indeterminate' | null;
  /** 체크 상태 변경 핸들러 (MD only) */
  onCheckChange?: (checked: boolean) => void;
}

/**
 * TreeMenu.Item Props (판별 유니온)
 * size="sm" 일 때 checkboxMode 등 MD 전용 props 사용 시 타입 에러 발생
 */
export type ItemProps = ItemPropsSm | ItemPropsMd;

/**
 * TreeMenu.Item 내부 컴포넌트
 * 트리 메뉴의 개별 아이템을 렌더링하는 프레젠테이션 컴포넌트
 */
function ItemInner(
  props: ItemProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  // TypeScript 판별 유니온을 신뢰하여 단순하게 구조분해
  // SM에서는 checkboxMode 등이 타입 에러로 전달 불가 → 런타임 방어 불필요
  const {
    item,
    size: rawSize = 'md',
    depth = 1,
    hasChildren = false,
    isExpanded = false,
    isFocused = false,
    isFirstFocusable = false,
    className,
    onExpandToggle,
    onItemClick,
    checkboxMode = false,
    checkState = null,
    onCheckChange,
    // Drag & Drop props
    draggable = false,
    isDragging = false,
    dragOverPosition = null,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    ...restProps
  } = props as ItemPropsMd;

  // size를 TreeMenuSize로 타입 복원 (타입 단언으로 인한 타입 축소 보정)
  const size = rawSize as TreeMenuSize;

  // item을 MD 타입으로 단언 (내부 구현용)
  const mdItem = item as TreeMenuItemDataMd;

  // 통합 hover 상태 관리
  const [hoverState, setHoverState] = React.useState<HoverState>({
    isItemHovered: false,
    expandIcon: 'default',
    actionIcon: 'default',
    isCheckboxHovered: false,
  });

  // 부분 상태 업데이트 헬퍼
  const updateHover = React.useCallback((partial: Partial<HoverState>) => {
    setHoverState(prev => ({ ...prev, ...partial }));
  }, []);

  // 상태 리셋 (disabled 전환 등에서 사용)
  const resetHoverState = React.useCallback(() => {
    setHoverState({
      isItemHovered: false,
      expandIcon: 'default',
      actionIcon: 'default',
      isCheckboxHovered: false,
    });
  }, []);

  // 아이콘 크기와 hover 영역 (padding으로 확보, negative margin으로 위치 보정)
  const iconSize = size === 'sm' ? 16 : 20;
  // md: 20px icon + 3px padding = 26px hover area, sm: 16px icon + 3px padding = 22px hover area
  const iconPaddingClass = 'p-[3px] -m-[3px]';

  // 펼침 아이콘 클릭 (버블링 방지)
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.disabled && hasChildren) {
      onExpandToggle?.();
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!item.disabled) {
      onCheckChange?.(e.target.checked);
    }
  };

  // hover 액션 아이콘 클릭 (버블링 방지)
  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.disabled) {
      item.onHoverActionClick?.();
    }
  };

  // 체크박스 영역 클릭 (버블링 방지 - 행 클릭과 분리)
  const handleCheckboxWrapperClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // 행 전체 클릭 (텍스트, 뱃지, 빈 공간 모두 포함)
  const handleRowClick = () => {
    if (!item.disabled) {
      onItemClick?.();
    }
  };

  // 키보드 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (hasChildren) {
        onExpandToggle?.();
      } else {
        onItemClick?.();
      }
    }
  };

  // 체크박스/뱃지 표시 여부 (TypeScript가 SM에서 사용 방지)
  const showCheckbox = checkboxMode && mdItem.showCheckbox !== false;
  const showBadge = !!mdItem.badge;

  // 체크 상태 결정
  const isChecked = checkState === 'checked';
  const isIndeterminate = checkState === 'indeterminate';

  return (
    <div
      ref={ref}
      role="treeitem"
      tabIndex={isFocused || isFirstFocusable ? 0 : -1}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-disabled={item.disabled}
      aria-checked={showCheckbox ? (isIndeterminate ? 'mixed' : isChecked) : undefined}
      aria-grabbed={draggable ? isDragging : undefined}
      data-depth={depth}
      draggable={draggable && !item.disabled}
      className={cn(
        'group', // CSS group-hover 활성화
        itemVariants({
          size,
          depth: String(depth) as '1' | '2' | '3' | '4',
          state: item.disabled ? 'disabled' : (hoverState.isItemHovered ? 'hover' : 'default'),
        }),
        item.disabled && 'cursor-not-allowed',
        // 드래그 중인 아이템 스타일
        isDragging && 'opacity-50',
        // 드래그 가능 커서
        draggable && !item.disabled && 'cursor-grab',
        className
      )}
      onClick={handleRowClick}
      onMouseEnter={() => !item.disabled && updateHover({ isItemHovered: true })}
      onMouseLeave={() => !item.disabled && resetHoverState()}
      onKeyDown={handleKeyDown}
      // Drag & Drop 이벤트
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      {...restProps}
    >
      {/* Hover 오버레이 (CSS group-hover로 표시, 체크박스 hover 시 z-index 상승) */}
      <div
        className={cn(
          'absolute inset-0 rounded-[4px] bg-state-overlay-on-neutral-hover pointer-events-none transition-opacity',
          // CSS group-hover: disabled가 아닐 때만 hover 효과 적용
          item.disabled ? 'opacity-0' : 'opacity-0 group-hover:opacity-100',
          // 체크박스 hover 시: 오버레이가 체크박스 위로 올라옴
          hoverState.isCheckboxHovered && Z_INDEX_CLASS.OVERLAY_ACTIVE
        )}
      />

      {/* 드롭 인디케이터 - 'before' 위치 (상단 라인) */}
      {dragOverPosition === 'before' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-bg-accent pointer-events-none z-[30]" />
      )}

      {/* 드롭 인디케이터 - 'after' 위치 (하단 라인) */}
      {dragOverPosition === 'after' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bg-accent pointer-events-none z-[30]" />
      )}

      {/* 드롭 인디케이터 - 'inside' 위치 (전체 하이라이트) */}
      {dragOverPosition === 'inside' && (
        <div className="absolute inset-0 rounded-[4px] border-2 border-border-accent bg-bg-accent/10 pointer-events-none z-[30]" />
      )}


      {/* 왼쪽 콘텐츠 그룹: (icon+checkbox) -8px- (text) -8px- (badge) */}
      <div className="flex items-center gap-component-gap-icon-label-md min-w-0 flex-1">
        {/* 펼침 아이콘 + 체크박스 그룹 (4px gap) */}
        {(hasChildren || showCheckbox) && (
          <div className="flex items-center gap-component-gap-icon-label-xs flex-shrink-0">
            {/* 펼침 아이콘 영역 */}
            {hasChildren && (
              <div
                className={cn(
                  'flex-shrink-0 flex items-center justify-center rounded-full transition-colors',
                  iconPaddingClass,
                  !item.disabled && hoverState.expandIcon === 'hover' && 'bg-state-overlay-on-neutral-hover',
                  !item.disabled && hoverState.expandIcon === 'pressed' && 'bg-state-overlay-on-neutral-pressed',
                  item.disabled && 'cursor-not-allowed'
                )}
                onClick={handleExpandClick}
                onMouseEnter={() => !item.disabled && updateHover({ expandIcon: 'hover' })}
                onMouseLeave={() => !item.disabled && updateHover({ expandIcon: 'default' })}
                onMouseDown={() => !item.disabled && updateHover({ expandIcon: 'pressed' })}
                onMouseUp={() => !item.disabled && updateHover({ expandIcon: 'hover' })}
              >
                {item.expandIcon || (
                  <Icon
                    name={isExpanded ? 'chevron-down' : 'chevron-right'}
                    size={iconSize}
                    className={item.disabled ? 'text-icon-disabled' : 'text-icon-primary'}
                  />
                )}
              </div>
            )}

            {/* 체크박스 영역 (MD only) - 클릭 시 행 클릭과 분리 */}
            {showCheckbox && (
              <div
                className={cn(
                  'relative flex items-center justify-center',
                  Z_INDEX_CLASS.CONTENT,
                  // 행은 hover지만 체크박스는 hover 아닐 때: 배경으로 오버레이 마스킹
                  hoverState.isItemHovered && !hoverState.isCheckboxHovered && !item.disabled && 'bg-surface-primary-default'
                  // 체크박스 hover 시: overlay가 z-20으로 올라와서 전체 행을 덮음
                )}
                onClick={handleCheckboxWrapperClick}
                onMouseEnter={() => !item.disabled && updateHover({ isCheckboxHovered: true })}
                onMouseLeave={() => !item.disabled && updateHover({ isCheckboxHovered: false })}
              >
                <Checkbox
                  size="16"
                  checked={isChecked || isIndeterminate}
                  variant={isIndeterminate ? 'indeterminate' : 'checked'}
                  disabled={item.disabled}
                  onChange={handleCheckboxChange}
                  renderContainer="label"
                  tabIndex={-1}
                />
              </div>
            )}
          </div>
        )}

        {/* 텍스트 영역 (클릭은 행 전체에서 처리) */}
        {showBadge && mdItem.badgeDot ? (
          // dot badge: 텍스트 우측상단에 absolute 배치
          <span className="relative inline-flex items-start min-w-0">
            <span className="truncate">{item.label}</span>
            {mdItem.badge}
          </span>
        ) : (
          <span className="truncate">
            {item.label}
          </span>
        )}

        {/* 뱃지 영역 (dot badge 제외) */}
        {showBadge && !mdItem.badgeDot && (
          <div className="flex-shrink-0">
            {mdItem.badge}
          </div>
        )}
      </div>

      {/* hover 액션 아이콘 영역 (CSS group-hover로 표시, 오른쪽 끝 배치) */}
      {item.hoverActionIcon && (
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center rounded-full transition-all',
            iconPaddingClass,
            // CSS group-hover: disabled가 아닐 때만 hover 시 표시
            item.disabled
              ? 'opacity-0 pointer-events-none'
              : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto',
            hoverState.actionIcon === 'hover' && 'bg-state-overlay-on-neutral-hover',
            hoverState.actionIcon === 'pressed' && 'bg-state-overlay-on-neutral-pressed'
          )}
          onClick={handleActionClick}
          onMouseEnter={() => updateHover({ actionIcon: 'hover' })}
          onMouseLeave={() => updateHover({ actionIcon: 'default' })}
          onMouseDown={() => updateHover({ actionIcon: 'pressed' })}
          onMouseUp={() => updateHover({ actionIcon: 'hover' })}
        >
          {item.hoverActionIcon}
        </div>
      )}
    </div>
  );
}

/**
 * TreeMenu.Item 컴포넌트 (판별 유니온 패턴)
 * size prop에 따라 타입이 자동으로 결정됩니다.
 * - size="md" (기본값): 체크박스, 뱃지 사용 가능
 * - size="sm": 체크박스, 뱃지 사용 불가 (타입 에러)
 */
const Item = React.forwardRef(ItemInner) as React.ForwardRefExoticComponent<
  ItemProps & React.RefAttributes<HTMLDivElement>
>;

Item.displayName = 'Item';

export { Item };
