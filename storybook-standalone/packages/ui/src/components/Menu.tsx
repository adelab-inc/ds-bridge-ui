import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Divider } from './Divider';
import { cn } from './utils';
import { Heading as MenuHeading, headingVariants as menuHeadingVariants } from './Menu/Heading';
import { Item as MenuItemComponent, itemVariants as menuItemVariants } from './Menu/Item';
import type { MenuItemBase, MenuItem } from '../types';

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

// ─── Compound Component Context ───

interface MenuContextValue {
  isOpen: boolean;
  position: { x: number; y: number } | undefined;
  triggerRef: React.RefObject<HTMLElement> | undefined;
  boundaryRef: React.RefObject<HTMLElement> | undefined;
  contentRef: React.RefObject<HTMLElement>;
  open: () => void;
  close: () => void;
  setPosition: (pos: { x: number; y: number }) => void;
}

const MenuContext = React.createContext<MenuContextValue | null>(null);

const useMenuContext = () => React.useContext(MenuContext);

// ─── Menu.Root ───

interface MenuRootProps {
  children: React.ReactNode;
  /** 메뉴 위치를 이 요소 경계 내로 제약 */
  boundary?: React.RefObject<HTMLElement>;
}

const MenuRoot: React.FC<MenuRootProps> = ({ children, boundary }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ x: number; y: number } | undefined>();
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentRef = React.useRef<HTMLElement>(null);

  const contextValue: MenuContextValue = {
    isOpen,
    position,
    triggerRef,
    boundaryRef: boundary,
    contentRef,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    setPosition,
  };

  return (
    <MenuContext.Provider value={contextValue}>
      {children}
    </MenuContext.Provider>
  );
};

// ─── Menu.Trigger ───

interface MenuTriggerProps {
  children: React.ReactElement;
}

const MenuTrigger: React.FC<MenuTriggerProps> = ({ children }) => {
  const ctx = useMenuContext();
  if (!ctx) throw new Error('Menu.Trigger must be used within Menu.Root');

  const handleClick = () => {
    if (ctx.isOpen) {
      ctx.close();
    } else {
      const el = ctx.triggerRef?.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        ctx.setPosition({ x: rect.left, y: rect.bottom + 4 });
      }
      ctx.open();
    }
  };

  // mousedown에서 열기를 처리하면 click 시점에 이미 메뉴가 마운트되어 포커스 가능
  // preventDefault로 브라우저 기본 포커스 이동을 차단하여 메뉴 포커스가 유지됨
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!ctx.isOpen) {
      e.preventDefault(); // 버튼에 포커스가 가는 것을 방지
    }
  };

  return React.cloneElement(children, {
    ref: ctx.triggerRef,
    onClick: handleClick,
    onMouseDown: handleMouseDown,
  });
};

// ─── Menu.ContextArea ───

interface MenuContextAreaProps {
  children: React.ReactNode;
  className?: string;
  /** true이면 메뉴가 열린 상태에서 마우스 이동 시 메뉴가 커서를 따라다닙니다. */
  followMouse?: boolean;
  /** 커서로부터 메뉴의 오프셋 (px). 기본값 { x: 0, y: 4 } */
  offset?: { x?: number; y?: number };
}

const MenuContextArea: React.FC<MenuContextAreaProps> = ({ children, className, followMouse = false, offset }) => {
  const ctx = useMenuContext();
  if (!ctx) throw new Error('Menu.ContextArea must be used within Menu.Root');

  const ox = offset?.x ?? 0;
  const oy = offset?.y ?? 4;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    ctx.setPosition({ x: e.clientX + ox, y: e.clientY + oy });
    ctx.open();
  };

  const cachedRect = React.useRef<DOMRect | null>(null);
  const margin = Math.max(Math.abs(ox), Math.abs(oy)) + 4;

  // 메뉴 열림/닫힘 시 rect 캐시
  React.useEffect(() => {
    if (ctx.isOpen) {
      requestAnimationFrame(() => {
        const contentEl = ctx.contentRef?.current;
        if (contentEl) cachedRect.current = contentEl.getBoundingClientRect();
      });
    } else {
      cachedRect.current = null;
    }
  }, [ctx.isOpen, ctx.contentRef]);

  const handleMouseMove = followMouse
    ? (e: React.MouseEvent) => {
        if (!ctx.isOpen) return;
        // 캐시된 rect로 히트 테스트
        const rect = cachedRect.current;
        if (rect) {
          if (
            e.clientX >= rect.left - margin &&
            e.clientX <= rect.right + margin &&
            e.clientY >= rect.top - margin &&
            e.clientY <= rect.bottom + margin
          ) {
            return;
          }
        }
        ctx.setPosition({ x: e.clientX + ox, y: e.clientY + oy });
      }
    : undefined;

  return (
    <div className={className} onContextMenu={handleContextMenu} onMouseMove={handleMouseMove}>
      {children}
    </div>
  );
};

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
 * Menu Props
 */
export interface MenuProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof menuVariants> {
  items: MenuItem[];
  position?: { x: number; y: number };
  onItemClick?: (item: MenuItemBase) => void;
  onClose?: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
  /** 메뉴 위치를 이 컨테이너 내부로 제약합니다. triggerRef와 함께 사용하면 스크롤 추적 시에도 컨테이너 경계를 벗어나지 않습니다. */
  containerRef?: React.RefObject<HTMLElement>;
  emptyText?: string;
  /** 리스트 컨테이너의 ARIA role. 기본값 "menu". Select에서는 "listbox"로 override */
  listRole?: string;
  /** 개별 아이템의 ARIA role. 기본값 "menuitem". Select에서는 "option"으로 override */
  itemRole?: string;
  /** 메뉴 열릴 때 메뉴 컨테이너에 자동 포커스 여부. 기본값 true. Select에서는 false로 설정 */
  autoFocusMenu?: boolean;
  /** 외부에서 제어하는 하이라이트 인덱스 (Select의 aria-activedescendant용). 지정 시 내부 focusedIndexMap[0] 대신 사용 */
  highlightedIndex?: number;
  /** 하이라이트 인덱스 변경 콜백 (마우스 hover 시 외부 상태 동기화) */
  onHighlightedIndexChange?: (index: number) => void;
  /** 아이템 DOM id 접두사. 지정 시 각 아이템에 id="{prefix}-{item.id}" 부여 */
  itemIdPrefix?: string;
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
      position: propPosition,
      onItemClick,
      onClose: propOnClose,
      triggerRef: propTriggerRef,
      containerRef: propContainerRef,
      emptyText = '값이 없습니다',
      listRole,
      itemRole,
      autoFocusMenu = true,
      highlightedIndex: externalHighlightedIndex,
      onHighlightedIndexChange,
      itemIdPrefix,
      ...props
    },
    ref
  ) => {
    const ctx = useMenuContext();

    // context가 있으면 context 값 사용, 없으면 prop 값 사용
    const triggerRef = propTriggerRef ?? ctx?.triggerRef;
    const containerRef = propContainerRef ?? ctx?.boundaryRef;
    const position = propPosition ?? ctx?.position;
    const onClose = propOnClose ?? ctx?.close;

    const internalRef = React.useRef<HTMLDivElement>(null);
    const menuRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;

    // compound 모드: contentRef를 menuRef와 동기화
    React.useEffect(() => {
      if (ctx?.contentRef) {
        (ctx.contentRef as React.MutableRefObject<HTMLElement | null>).current = menuRef.current;
        return () => {
          (ctx.contentRef as React.MutableRefObject<HTMLElement | null>).current = null;
        };
      }
    });

    const [activeIdPath, setActiveIdPath] = React.useState<string[]>([]);

    // depth별 포커스 인덱스 관리 (depth 0, 1, 2, ...)
    const [focusedIndexMap, setFocusedIndexMap] = React.useState<Record<number, number>>({ 0: -1 });

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

    // 메뉴 열릴 때 메뉴 컨테이너에 포커스 (아이템은 키보드 탐색 시작 시 포커스)
    const isOpen = ctx?.isOpen;
    React.useEffect(() => {
      if (isOpen && autoFocusMenu) {
        menuRef.current?.focus();
      }
    }, [isOpen, autoFocusMenu]);

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

    // triggerRef 기반 위치 추적 (스크롤/리사이즈 시 메뉴가 트리거에 붙어있도록)
    const [trackedPosition, setTrackedPosition] = React.useState<{ x: number; y: number } | null>(null);
    // containerRef 제약 시 메뉴 너비 캐싱
    const measuredWidthRef = React.useRef(0);
    // viewport 경계 보정된 위치
    const [correctedPosition, setCorrectedPosition] = React.useState<{ x: number; y: number } | null>(null);

    React.useEffect(() => {
      if (!triggerRef?.current) return;

      const updatePosition = () => {
        const triggerRect = triggerRef.current?.getBoundingClientRect();
        if (!triggerRect) return;

        let x = triggerRect.left;
        const y = triggerRect.bottom + 4;

        // containerRef가 있으면 메뉴가 컨테이너 오른쪽을 넘어가지 않도록 제약
        if (containerRef?.current && measuredWidthRef.current > 0) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const pr = parseInt(getComputedStyle(containerRef.current).paddingRight || '0');
          const rightEdge = containerRect.right - pr;
          if (x + measuredWidthRef.current > rightEdge) {
            x = rightEdge - measuredWidthRef.current;
          }
        }

        setTrackedPosition({ x, y });
      };

      // 초기 위치 계산
      updatePosition();

      // 스크롤 시 메뉴 닫기
      const handleScroll = () => {
        propOnClose?.();
      };
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updatePosition);
      };
    }, [triggerRef, containerRef, propOnClose]);

    const closeDelayRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleItemHover = (item: MenuItemBase, depth: number, focusableIndex: number) => {
      if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
      if (closeDelayRef.current) clearTimeout(closeDelayRef.current);

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

      // 서브메뉴가 열려있는데 서브메뉴 없는 아이템으로 이동 시 Close Delay 적용
      const hasChildren = item.children && item.children.length > 0;
      if (!hasChildren && activeIdPath.length > depth) {
        closeDelayRef.current = setTimeout(() => {
          setActiveIdPath(newPath);
        }, 300);
        return;
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

    const handleItemClickInternal = (item: MenuItemBase) => {
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
    const getFocusableItems = (menuItems: MenuItem[]): MenuItemBase[] => {
      return menuItems.filter(
        (item): item is MenuItemBase =>
          item.type !== 'divider' &&
          item.type !== 'heading' &&
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
        const parent = targetMenuItems.find(
          (item): item is MenuItemBase => item.type !== 'divider' && item.type !== 'heading' && item.id === parentId
        );
        if (parent?.children) {
          targetMenuItems = parent.children;
        }
      }

      const focusableItems = getFocusableItems(targetMenuItems);
      const currentFocusedIndex = focusedIndexMap[focusedDepth] ?? -1;
      const currentItem = currentFocusedIndex >= 0 ? focusableItems[currentFocusedIndex] : undefined;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = currentFocusedIndex < 0 ? 0 : (currentFocusedIndex + 1) % focusableItems.length;
          setFocusedIndexMap(prev => ({ ...prev, [focusedDepth]: nextIndex }));
          setTimeout(() => {
            itemRefsMap.current[focusedDepth]?.[nextIndex]?.focus();
          }, 0);
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = currentFocusedIndex <= 0
            ? focusableItems.length - 1
            : currentFocusedIndex - 1;
          setFocusedIndexMap(prev => ({ ...prev, [focusedDepth]: prevIndex }));
          setTimeout(() => {
            itemRefsMap.current[focusedDepth]?.[prevIndex]?.focus();
          }, 0);
          break;
        }

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
      // 서브메뉴 계층 제한 경고 (최대 3단계 권장)
      if (process.env.NODE_ENV !== 'production' && depth > 3) {
        console.warn(`[Menu] 서브메뉴 depth ${depth}단계 감지. 최대 3단계까지만 권장합니다.`);
      }

      // depth별 itemRefs 배열 초기화
      if (!itemRefsMap.current[depth]) {
        itemRefsMap.current[depth] = [];
      }

      let focusableIndex = 0;
      const currentFocusedIndex = focusedIndexMap[depth] ?? -1;

      return menuItems.map((item, index) => {
        // Heading
        if (item.type === 'heading') {
          return (
            <React.Fragment key={item.id || `heading-${index}`}>
              <MenuHeading>{item.heading}</MenuHeading>
            </React.Fragment>
          );
        }

        // Divider
        if (item.type === 'divider') {
          return (
            <div key={item.id || `divider-${index}`} className="py-component-inset-menu-divider-y px-component-inset-menu-item-x">
              <Divider tone="subtle" />
            </div>
          );
        }

        const hasSubmenu = item.children && item.children.length > 0;
        const isActive = activeIdPath[depth] === item.id;
        // 외부 하이라이트 제어: depth 0에서 externalHighlightedIndex가 지정되면 사용
        const isFocused = (depth === 0 && externalHighlightedIndex !== undefined)
          ? externalHighlightedIndex === focusableIndex
          : currentFocusedIndex === focusableIndex;
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
            id={depth === 0 && itemIdPrefix ? `${itemIdPrefix}-${item.id}` : undefined}
            item={itemWithSelected}
            size={size || 'md'}
            onItemClick={handleItemClickInternal}
            onItemHover={(hoveredItem: MenuItemBase) => {
              // 외부 하이라이트 동기화 (마우스 hover 시)
              if (depth === 0 && onHighlightedIndexChange && !item.disabled) {
                onHighlightedIndexChange(currentFocusableIndex);
              }
              if (hasSubmenu) {
                handleItemHover(hoveredItem, depth, currentFocusableIndex);
              }
            }}
            depth={depth}
            isFocused={isFocused}
            isExpanded={isActive}
            itemRole={itemRole}
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
        const activeItem = currentItems.find(
          (item): item is MenuItemBase => item.type !== 'divider' && item.type !== 'heading' && item.id === activeId
        );

        if (activeItem?.children && activeItem.children.length > 0) {
          // 부모 MenuItem의 viewport 기준 위치 계산 (Portal용)
          const focusedIndex = focusedIndexMap[depth] ?? 0;
          const parentElement = itemRefsMap.current[depth]?.[Math.max(0, focusedIndex)];

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

            // 서브메뉴 수직 정렬: 부모 아이템 Top = 서브메뉴 첫 아이템 Top (메뉴 패딩 4px 보정)
            const SUBMENU_Y_OFFSET = -4;
            parentTop = rect.top + SUBMENU_Y_OFFSET;

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
                menuVariants({ size: size || 'md' }),
                'relative flex flex-col animate-menu-enter'
              )}
              style={submenuStyle}
              role={listRole || "menu"}
              aria-orientation="vertical"
            >
              <div className="menu-scroll-container">
                <div className="menu-scroll-inner py-component-inset-menu-y px-component-inset-menu-x max-h-[640px]">
                  {renderMenuItems(activeItem.children, depth + 1)}
                </div>
              </div>
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

    // containerRef 제약: 메뉴 렌더 후 너비 측정 → 위치 재계산
    React.useEffect(() => {
      if (!containerRef?.current || !menuRef.current) return;
      const width = menuRef.current.offsetWidth;
      if (width > 0 && width !== measuredWidthRef.current) {
        measuredWidthRef.current = width;
        // 측정 후 위치 즉시 재계산
        if (triggerRef?.current) {
          const triggerRect = triggerRef.current.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          const pr = parseInt(getComputedStyle(containerRef.current).paddingRight || '0');
          const rightEdge = containerRect.right - pr;
          let x = triggerRect.left;
          if (x + width > rightEdge) {
            x = rightEdge - width;
          }
          setTrackedPosition({ x, y: triggerRect.bottom + 4 });
        }
      }
    });

    // triggerRef 기반 추적 위치 > position prop > 없음
    const effectivePosition = triggerRef?.current ? trackedPosition : position;

    // Viewport boundary correction: effectivePosition 기준으로 메뉴 크기 측정 후 보정
    const prevEffectivePosRef = React.useRef<{ x: number; y: number } | null | undefined>(undefined);
    React.useLayoutEffect(() => {
      const el = menuRef.current;
      if (!el || !effectivePosition) {
        if (correctedPosition) setCorrectedPosition(null);
        prevEffectivePosRef.current = effectivePosition;
        return;
      }

      // effectivePosition이 변경되지 않았으면 재계산 스킵 (무한루프 방지)
      const prev = prevEffectivePosRef.current;
      if (prev && prev.x === effectivePosition.x && prev.y === effectivePosition.y) return;
      prevEffectivePosRef.current = effectivePosition;

      const menuW = el.offsetWidth;
      const menuH = el.offsetHeight;
      // clientWidth/clientHeight: 스크롤바 제외한 실제 보이는 영역
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const { x, y } = effectivePosition;

      let newX = x;
      let newY = y;
      let needsCorrection = false;

      // X축: viewport 오른쪽 벗어남 → 커서 왼쪽으로 Flip
      if (x + menuW > vw) {
        newX = Math.max(0, x - menuW);
        needsCorrection = true;
      }

      // Y축: viewport 하단 벗어남
      if (y + menuH > vh) {
        if (triggerRef?.current) {
          // 버튼 클릭: 트리거 위쪽으로 Flip
          const triggerRect = triggerRef.current.getBoundingClientRect();
          newY = Math.max(0, triggerRect.top - menuH - 4);
        } else {
          // 우클릭: 커서 위쪽으로 Flip
          newY = Math.max(0, y - menuH);
        }
        needsCorrection = true;
      }

      setCorrectedPosition(needsCorrection ? { x: newX, y: newY } : null);
    });

    // compound 모드에서 isOpen=false이면 렌더링 안 함
    if (ctx && !ctx.isOpen) return null;

    // viewport 보정된 위치가 있으면 우선 사용
    const finalPosition = correctedPosition ?? effectivePosition;
    const positionStyles = finalPosition
      ? {
          position: 'fixed' as const,
          left: `${finalPosition.x}px`,
          top: `${finalPosition.y}px`,
          zIndex: 9999,
        }
      : {};

    return (
      <div
        ref={menuRef}
        role={listRole || "menu"}
        tabIndex={-1}
        aria-orientation="vertical"
        className={cn(menuVariants({ size, className }), 'relative flex flex-col outline-none animate-menu-enter')}
        style={positionStyles}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          const related = e.relatedTarget as Node | null;
          // 포커스가 메뉴(컨테이너 + 서브메뉴 Portal) 바깥으로 나가면 focus 인덱스 리셋
          const isInsideMenu = menuRef.current?.contains(related);
          const isInsideSubmenu = submenuRefs.current.some(ref => ref?.contains(related));
          if (!isInsideMenu && !isInsideSubmenu) {
            setFocusedIndexMap({ 0: -1 });
          }
        }}
        onMouseLeave={handleMenuMouseLeave}
        {...props}
      >
        <div className="menu-scroll-container">
          <div className="menu-scroll-inner py-component-inset-menu-y px-component-inset-menu-x max-h-[640px]">
            {items.length === 0 ? (
              emptyText ? (
                <div
                  role="status"
                  aria-live="polite"
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

// ─── Compound Export ───

const MenuContent = Menu;

type MenuComponent = typeof Menu & {
  Root: typeof MenuRoot;
  Trigger: typeof MenuTrigger;
  ContextArea: typeof MenuContextArea;
  Content: typeof MenuContent;
};

const MenuCompound = Menu as MenuComponent;
MenuCompound.Root = MenuRoot;
MenuCompound.Trigger = MenuTrigger;
MenuCompound.ContextArea = MenuContextArea;
MenuCompound.Content = MenuContent;

export { MenuCompound as Menu, menuVariants, menuItemVariants, menuHeadingVariants };
export type { MenuItemBase, MenuItemDivider, MenuItemHeading, MenuItem } from '../types';
