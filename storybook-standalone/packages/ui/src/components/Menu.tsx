import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Divider } from './Divider';
import { cn } from './utils';
import { Heading as MenuHeading } from './Menu/Heading';
import { Item as MenuItemComponent } from './Menu/Item';

const menuVariants = cva('flex flex-col max-h-[640px] min-w-[200px] max-w-[400px] rounded-lg border border-border-default bg-bg-surface shadow-[0_2px_4px_0_rgba(0,0,0,0.16)]', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "md": "",
        "sm": "",
      },
    },
    defaultVariants: {
      "mode": "base",
      "size": "md",
    },
  }));

/** 2D 좌표를 나타내는 타입 */
type Point = { x: number; y: number };

/**
 * Safe Triangle 알고리즘: 점이 삼각형 내부에 있는지 확인
 * 마우스가 하위 메뉴로 이동하는 동안 다른 메뉴 항목이 활성화되지 않도록 합니다.
 */
const isPointInTriangle = (p: Point, a: Point, b: Point, c: Point): boolean => {
  const s = a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y;
  const t = a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y;
  if (s < 0 !== t < 0 && s !== 0 && t !== 0) return false;
  const A = -b.y * c.x + a.y * (c.x - b.x) + a.x * (b.y - c.y) + b.x * c.y;
  return A < 0 ? s <= 0 && s + t >= A : s >= 0 && s + t <= A;
};

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
 * Menu Props
 */
export interface MenuProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof menuVariants> {
  items: MenuItem[];
  position?: { x: number; y: number };
  onItemClick?: (item: MenuItem) => void;
  onClose?: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
  title?: string;
  description?: string;
  emptyText?: string;

  /** 체크박스/라디오 모드 */
  checkboxMode?: 'none' | 'checkbox' | 'radio';
  /** 체크된 항목 ID 목록 */
  checkedIds?: Set<string>;
  /** 체크 상태 변경 핸들러 */
  onCheckChange?: (id: string, checked: boolean) => void;
}

/**
 * Menu 컴포넌트
 */
const Menu = React.forwardRef<HTMLDivElement, MenuProps>(
  (
    {
      className,
      size,
      items,
      position,
      onItemClick,
      onClose,
      triggerRef,
      title,
      description,
      emptyText = '값이 없습니다',
      checkboxMode = 'none',
      checkedIds,
      onCheckChange,
      ...props
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLDivElement>(null);
    const menuRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;
    const [activeIdPath, setActiveIdPath] = React.useState<string[]>([]);

    // depth별 포커스 인덱스 관리 (depth 0, 1, 2, ...)
    const [focusedIndexMap, setFocusedIndexMap] = React.useState<Record<number, number>>({ 0: 0 });

    const mousePosRef = React.useRef<Point>({ x: 0, y: 0 });
    const prevMousePosRef = React.useRef<Point>({ x: 0, y: 0 });
    const submenuRefs = React.useRef<(HTMLDivElement | null)[]>([]);
    const activationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // depth별 itemRefs 관리 (depth -> [HTMLDivElement])
    const itemRefsMap = React.useRef<Record<number, (HTMLDivElement | null)[]>>({});

    React.useEffect(() => {
      const handleMouseMove = (event: MouseEvent) => {
        prevMousePosRef.current = mousePosRef.current;
        mousePosRef.current = { x: event.clientX, y: event.clientY };
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // 메뉴 열릴 때 첫 항목에 자동 포커스
    React.useEffect(() => {
      if (itemRefsMap.current[0]?.[0]) {
        itemRefsMap.current[0][0].focus();
      }
    }, []);

    React.useEffect(() => {
      if (!onClose) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;

        // triggerRef 클릭은 무시 (토글 버튼)
        if (triggerRef?.current?.contains(target)) {
          return;
        }

        if (menuRef.current && !menuRef.current.contains(target)) {
          onClose();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, menuRef, triggerRef]);

    // cleanup: 컴포넌트 unmount 시 타이머 정리
    React.useEffect(() => {
      return () => {
        if (activationTimeoutRef.current) {
          clearTimeout(activationTimeoutRef.current);
        }
      };
    }, []);

    // 브라우저 resize 시 서브메뉴 닫기
    React.useEffect(() => {
      if (activeIdPath.length === 0) return;

      const handleResize = () => {
        setActiveIdPath([]);
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [activeIdPath.length]);

    const handleItemHover = (item: MenuItem, depth: number, focusableIndex: number) => {
      if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);

      const newPath = activeIdPath.slice(0, depth);
      newPath.push(item.id);

      // 마우스 hover 시 focusedIndexMap도 업데이트하여 키보드와 동기화
      setFocusedIndexMap(prev => ({ ...prev, [depth]: focusableIndex }));

      // Safe Triangle 알고리즘 적용
      const submenuEl = submenuRefs.current[depth];
      if (submenuEl && activeIdPath.length > depth) {
        const rect = submenuEl.getBoundingClientRect();
        const pA = { x: rect.left, y: rect.top - 10 };
        const pB = { x: rect.left, y: rect.bottom + 10 };
        const pC = prevMousePosRef.current;

        if (isPointInTriangle(mousePosRef.current, pA, pB, pC)) {
          activationTimeoutRef.current = setTimeout(() => {
            setActiveIdPath(newPath);
          }, 300);
          return;
        }
      }

      setActiveIdPath(newPath);
    };

    const handleMenuMouseLeave = () => {
      // 마우스가 메뉴를 완전히 떠났을 때 모든 서브메뉴 닫기
      if (activationTimeoutRef.current) {
        clearTimeout(activationTimeoutRef.current);
      }
      setActiveIdPath([]);
    };

    const handleItemClickInternal = (item: MenuItem) => {
      // 하위 메뉴가 있으면 토글 (열기/닫기)
      if (item.children?.length) {
        const newPath = [...activeIdPath];

        // 이미 열려있는지 확인: activeIdPath의 마지막 항목이 현재 item.id인지 체크
        const isAlreadyOpen = activeIdPath[activeIdPath.length - 1] === item.id;

        if (isAlreadyOpen) {
          // 하위 메뉴 닫기
          newPath.pop();
          setActiveIdPath(newPath);
        } else {
          // 하위 메뉴 열기 (Enter/Space: 포커스는 현재 항목 유지)
          newPath.push(item.id);
          setActiveIdPath(newPath);

          // 포커스는 현재 항목에 유지 (ArrowRight와 다른 동작)
          // 하위 메뉴로 이동하려면 ArrowRight 사용
        }
      } else {
        // 하위 메뉴가 없으면 일반 클릭 동작
        onItemClick?.(item);
        onClose?.();
      }
    };

    // 포커스 가능한 아이템 목록 생성 (heading, divider 제외)
    const getFocusableItems = (menuItems: MenuItem[]): MenuItem[] => {
      return menuItems.filter(
        (item) =>
          !item.heading &&
          !item.id.startsWith('divider') &&
          item.id !== 'divider' &&
          !item.disabled
      );
    };

    // 키보드 네비게이션 핸들러
    const handleKeyDown = (e: React.KeyboardEvent) => {
      // 현재 포커스된 요소의 depth를 가져옴
      const focusedElement = e.target as HTMLElement;
      const focusedDepth = parseInt(focusedElement.getAttribute('data-depth') || '0', 10);

      // 해당 depth의 메뉴 아이템 목록을 가져옴
      let targetMenuItems = items;
      for (let i = 0; i < focusedDepth; i++) {
        const parentId = activeIdPath[i];
        const parent = targetMenuItems.find(item => item.id === parentId);
        if (parent?.children) {
          targetMenuItems = parent.children;
        }
      }

      const focusableItems = getFocusableItems(targetMenuItems);
      const currentFocusedIndex = focusedIndexMap[focusedDepth] || 0;
      const currentItem = focusableItems[currentFocusedIndex];

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          const nextIndex = (currentFocusedIndex + 1) % focusableItems.length;
          setFocusedIndexMap(prev => ({ ...prev, [focusedDepth]: nextIndex }));
          setTimeout(() => {
            itemRefsMap.current[focusedDepth]?.[nextIndex]?.focus();
          }, 0);
          break;

        case 'ArrowUp':
          e.preventDefault();
          const prevIndex = currentFocusedIndex - 1 < 0
            ? focusableItems.length - 1
            : currentFocusedIndex - 1;
          setFocusedIndexMap(prev => ({ ...prev, [focusedDepth]: prevIndex }));
          setTimeout(() => {
            itemRefsMap.current[focusedDepth]?.[prevIndex]?.focus();
          }, 0);
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (currentItem?.children && currentItem.children.length > 0) {
            // 하위 메뉴를 열기 위한 새로운 경로 구성
            // focusedDepth까지의 경로 + 현재 아이템
            const newPath = [...activeIdPath.slice(0, focusedDepth), currentItem.id];
            setActiveIdPath(newPath);

            // 하위 메뉴 첫 항목에 포커스
            const nextDepth = focusedDepth + 1;
            setFocusedIndexMap(prev => ({ ...prev, [nextDepth]: 0 }));

            setTimeout(() => {
              itemRefsMap.current[nextDepth]?.[0]?.focus();
            }, 0);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (focusedDepth > 0) {
            // 하위 메뉴 닫기 및 부모 항목으로 포커스 복귀
            const newPath = [...activeIdPath];
            newPath.pop();
            setActiveIdPath(newPath);

            // 부모 depth로 포커스 복귀
            const parentDepth = focusedDepth - 1;
            const parentFocusedIndex = focusedIndexMap[parentDepth] || 0;

            setTimeout(() => {
              itemRefsMap.current[parentDepth]?.[parentFocusedIndex]?.focus();
            }, 0);
          } else {
            // 최상위 메뉴에서 왼쪽 화살표 시 메뉴 닫기
            onClose?.();
            triggerRef?.current?.focus();
          }
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndexMap(prev => ({ ...prev, [focusedDepth]: 0 }));
          setTimeout(() => {
            itemRefsMap.current[focusedDepth]?.[0]?.focus();
          }, 0);
          break;

        case 'End':
          e.preventDefault();
          const lastIndex = focusableItems.length - 1;
          setFocusedIndexMap(prev => ({ ...prev, [focusedDepth]: lastIndex }));
          setTimeout(() => {
            itemRefsMap.current[focusedDepth]?.[lastIndex]?.focus();
          }, 0);
          break;

        case 'Escape':
          e.preventDefault();
          onClose?.();
          triggerRef?.current?.focus();
          break;

        case 'Tab':
          e.preventDefault();
          // Tab 키로 순환 네비게이션 (같은 depth 내에서)
          const direction = e.shiftKey ? -1 : 1;
          const tabNextIndex = (currentFocusedIndex + direction + focusableItems.length) % focusableItems.length;
          setFocusedIndexMap(prev => ({ ...prev, [focusedDepth]: tabNextIndex }));
          setTimeout(() => {
            itemRefsMap.current[focusedDepth]?.[tabNextIndex]?.focus();
          }, 0);
          break;

        default:
          break;
      }
    };

    // MenuItem만 렌더링 (하위 메뉴 제외)
    const renderMenuItems = (menuItems: MenuItem[], depth: number = 0): React.ReactNode => {
      // depth별 itemRefs 배열 초기화
      if (!itemRefsMap.current[depth]) {
        itemRefsMap.current[depth] = [];
      }

      let focusableIndex = 0;
      const currentFocusedIndex = focusedIndexMap[depth] || 0;

      return menuItems.map((item) => {
        // Heading
        if (item.heading) {
          return (
            <React.Fragment key={item.id}>
              <MenuHeading>{item.heading}</MenuHeading>
            </React.Fragment>
          );
        }

        // Divider
        if (item.id === 'divider' || item.id.startsWith('divider-')) {
          return (
            <div key={item.id} className="py-component-inset-menu-divider-y px-component-inset-menu-item-x">
              <Divider />
            </div>
          );
        }

        const hasSubmenu = item.children && item.children.length > 0;
        const isActive = activeIdPath[depth] === item.id;
        const isFocused = currentFocusedIndex === focusableIndex;
        const currentFocusableIndex = focusableIndex;

        // disabled가 아닌 경우에만 포커스 인덱스 증가
        if (!item.disabled) {
          focusableIndex++;
        }

        // 하위 메뉴가 열려있을 때 상위 메뉴에 selected 표시
        const itemWithSelected = hasSubmenu && isActive
          ? { ...item, selected: true }
          : item;

        return (
          <MenuItemComponent
            key={item.id}
            ref={(el) => {
              if (!item.disabled) {
                itemRefsMap.current[depth][currentFocusableIndex] = el;
              }
            }}
            item={itemWithSelected}
            size={size || 'md'}
            onItemClick={handleItemClickInternal}
            onItemHover={(hoveredItem: MenuItem) => {
              if (hasSubmenu) {
                handleItemHover(hoveredItem, depth, currentFocusableIndex);
              }
            }}
            depth={depth}
            isFocused={isFocused}
            isExpanded={isActive}
            checkboxMode={checkboxMode}
            isChecked={checkedIds?.has(item.id)}
            onCheckChange={onCheckChange}
          />
        );
      });
    };

    // 활성화된 하위 메뉴만 렌더링 (Portal 사용)
    const renderActiveSubmenus = (): React.ReactNode => {
      const submenus: React.ReactNode[] = [];

      // activeIdPath를 따라가며 활성화된 하위 메뉴만 렌더링
      let currentItems = items;
      let parentLeft = 0;
      let parentTop = 0;
      // 이전 서브메뉴의 배치 방향 추적 (연속된 서브메뉴는 같은 방향으로)
      let previousPlacement: 'right' | 'left' = 'right';

      // 서브메뉴 예상 너비 (min-w-[200px] 기준)
      const SUBMENU_WIDTH = 200;
      const GAP = 4;

      for (let depth = 0; depth < activeIdPath.length; depth++) {
        const activeId = activeIdPath[depth];
        const activeItem = currentItems.find(item => item.id === activeId);

        if (activeItem?.children && activeItem.children.length > 0) {
          // 부모 MenuItem의 viewport 기준 위치 계산 (Portal용)
          const focusedIndex = focusedIndexMap[depth] || 0;
          const parentElement = itemRefsMap.current[depth]?.[focusedIndex];

          if (parentElement) {
            const rect = parentElement.getBoundingClientRect();

            // 화면 경계 체크 및 위치 자동 조정
            const rightSpace = window.innerWidth - rect.right - GAP;
            const leftSpace = rect.left - GAP;

            // 기본: 오른쪽 배치, 공간 부족 시 왼쪽 배치
            // 이전 서브메뉴가 왼쪽이면 계속 왼쪽으로 (일관성 유지)
            if (previousPlacement === 'left' || rightSpace < SUBMENU_WIDTH) {
              if (leftSpace >= SUBMENU_WIDTH) {
                // 왼쪽에 배치
                parentLeft = rect.left - SUBMENU_WIDTH - GAP;
                previousPlacement = 'left';
              } else {
                // 양쪽 다 부족하면 오른쪽에 배치 (잘리더라도)
                parentLeft = rect.right + GAP;
                previousPlacement = 'right';
              }
            } else {
              // 오른쪽에 배치
              parentLeft = rect.right + GAP;
              previousPlacement = 'right';
            }

            parentTop = rect.top;

            // 화면 아래 경계 체크 (서브메뉴가 화면 아래로 넘어가는 경우)
            const estimatedHeight = Math.min(activeItem.children.length * 40, 400);
            if (parentTop + estimatedHeight > window.innerHeight) {
              parentTop = Math.max(8, window.innerHeight - estimatedHeight - 8);
            }
          }

          const submenuStyle = {
            position: 'fixed' as const,
            left: parentLeft + 'px',
            top: parentTop + 'px',
            zIndex: 9999,
          };

          submenus.push(
            <div
              key={'submenu-' + depth + '-' + activeId}
              ref={(el) => (submenuRefs.current[depth] = el)}
              className={cn(
                menuVariants({ size: size || 'md' })
              )}
              style={submenuStyle}
              role="menu"
              aria-orientation="vertical"
            >
              {renderMenuItems(activeItem.children, depth + 1)}
            </div>
          );

          currentItems = activeItem.children;
        }
      }

      // Portal을 사용하여 document.body에 직접 렌더링
      if (typeof document !== 'undefined' && submenus.length > 0) {
        return ReactDOM.createPortal(
          <>{submenus}</>,
          document.body
        );
      }

      return null;
    };

    const positionStyles = position
      ? {
          position: 'fixed' as const,
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999,
        }
      : {};

    return (
      <div
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        className={cn(menuVariants({ size, className }), 'relative flex flex-col')}
        style={positionStyles}
        onKeyDown={handleKeyDown}
        onMouseLeave={handleMenuMouseLeave}
        {...props}
      >
        {(title || description) && (
          <div
            className={cn(
              "flex flex-col gap-layout-stack-xs self-stretch py-component-inset-menu-item-y px-component-inset-menu-item-x",
              items.length > 0 && "border-b border-border-primary"
            )}
          >
            {title && <div className="text-label-md-bold text-text-primary">{title}</div>}
            {description && <div className="text-body-sm-regular text-text-secondary">{description}</div>}
          </div>
        )}
        <div className="menu-scroll-container">
          <div className={cn("menu-scroll-inner py-component-inset-menu-y px-component-inset-menu-x", size === 'sm' ? 'max-h-[180px]' : 'max-h-[224px]')}>
            {items.length === 0 ? (
              emptyText ? (
                <div
                  className={cn(
                    'py-component-inset-menu-item-y px-component-inset-menu-item-x text-center text-text-tertiary',
                    size === 'sm' ? 'text-button-sm-medium' : 'text-button-md-medium'
                  )}
                >
                  {emptyText}
                </div>
              ) : null
            ) : (
              renderMenuItems(items, 0)
            )}
          </div>
          {renderActiveSubmenus()}
        </div>
      </div>
    );
  },
);
Menu.displayName = 'Menu';

export { Menu, menuVariants };
