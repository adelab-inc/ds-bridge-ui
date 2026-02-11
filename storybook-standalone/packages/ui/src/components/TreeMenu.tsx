import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';
import {
  Item as TreeMenuItem,
  TreeMenuItemData,
  TreeMenuItemDataSm,
  TreeMenuItemDataMd,
  TreeMenuSize,
  DropPosition,
} from './TreeMenu/Item';
import { useControllableState } from '../hooks/useControllableState';

const treeMenuVariants = cva('flex flex-col max-h-[640px] overflow-y-auto', ({
    variants: {
      "size": {
        "md": "",
        "sm": "",
      },
    },
    defaultVariants: {
      "size": "md",
    },
  }));

export type { TreeMenuItemData, TreeMenuItemDataSm, TreeMenuItemDataMd, TreeMenuSize, DropPosition };

/**
 * 체크 상태 맵 타입
 */
type CheckStateMap = Map<string, 'checked' | 'unchecked' | 'indeterminate'>;

/**
 * TreeMenu 공통 Props
 */
interface TreeMenuPropsCommon
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof treeMenuVariants>, 'size'> {
  /** 초기 펼침 상태 - Uncontrolled 모드 (기본: 모두 닫힘) */
  defaultExpandedIds?: Set<string>;
  /** 현재 펼침 상태 - Controlled 모드 */
  expandedIds?: Set<string>;
  /** 펼침 상태 변경 콜백 - Controlled 모드에서 필수 */
  onExpandChange?: (expandedIds: Set<string>) => void;
  /** 단일 아이템 토글 콜백 (디버깅/로깅용, 선택적) */
  onExpandToggle?: (id: string, isExpanded: boolean) => void;
  /** 드래그 앤 드롭 활성화 */
  draggable?: boolean;
  /** 아이템 이동 콜백 - 드래그 앤 드롭 완료 시 호출 */
  onItemMove?: (draggedItemId: string, targetItemId: string, position: DropPosition) => void;
}

/**
 * SM 사이즈 전용 Props (판별 유니온)
 * - checkboxMode, checkedIds, onCheckChange 사용 불가
 */
interface TreeMenuPropsSm extends TreeMenuPropsCommon {
  /** 트리 메뉴 사이즈 */
  size: 'sm';
  /** 트리 메뉴 아이템 데이터 (SM) */
  items: TreeMenuItemDataSm[];
  /** 아이템 클릭 핸들러 (SM) */
  onItemClick?: (item: TreeMenuItemDataSm) => void;
}

/**
 * MD 사이즈 전용 Props (판별 유니온)
 * - checkboxMode, checkedIds, onCheckChange 사용 가능
 */
interface TreeMenuPropsMd extends TreeMenuPropsCommon {
  /** 트리 메뉴 사이즈 */
  size?: 'md';
  /** 트리 메뉴 아이템 데이터 (MD) */
  items: TreeMenuItemDataMd[];
  /** 아이템 클릭 핸들러 (MD) */
  onItemClick?: (item: TreeMenuItemDataMd) => void;
  /** 체크박스 모드 활성화 (MD only) */
  checkboxMode?: boolean;
  /** 체크된 아이템 ID Set (MD only) */
  checkedIds?: Set<string>;
  /** 체크 상태 변경 핸들러 (부모-자식 연동 로직 포함, MD only) */
  onCheckChange?: (id: string, checked: boolean, affectedIds: string[]) => void;
}

/**
 * TreeMenu Props (판별 유니온)
 * size="sm" 일 때 checkboxMode 등 MD 전용 props 사용 시 타입 에러 발생
 */
export type TreeMenuProps = TreeMenuPropsSm | TreeMenuPropsMd;

/**
 * 트리 구조에서 모든 자손 ID를 수집
 * (내부 유틸리티)
 */
const getAllDescendantIds = (item: TreeMenuItemDataMd): string[] => {
  const ids: string[] = [];
  if (item.children) {
    for (const child of item.children) {
      ids.push(child.id);
      ids.push(...getAllDescendantIds(child));
    }
  }
  return ids;
};

/**
 * 특정 아이템의 부모 경로를 찾기
 * (내부 유틸리티)
 */
const findParentPath = (
  items: TreeMenuItemDataMd[],
  targetId: string,
  path: TreeMenuItemDataMd[] = []
): TreeMenuItemDataMd[] | null => {
  for (const item of items) {
    if (item.id === targetId) {
      return path;
    }
    if (item.children) {
      const found = findParentPath(item.children, targetId, [...path, item]);
      if (found) return found;
    }
  }
  return null;
};

/**
 * 체크 상태 계산 (부모-자식 연동)
 * (내부 유틸리티)
 */
const calculateCheckStates = (
  items: TreeMenuItemDataMd[],
  checkedIds: Set<string>
): CheckStateMap => {
  const stateMap: CheckStateMap = new Map();

  const processItem = (item: TreeMenuItemDataMd): 'checked' | 'unchecked' | 'indeterminate' => {
    if (!item.children || item.children.length === 0) {
      // Leaf node
      const state = checkedIds.has(item.id) ? 'checked' : 'unchecked';
      stateMap.set(item.id, state);
      return state;
    }

    // Parent node - 자식 상태에 따라 결정
    const childStates = item.children.map(child => processItem(child));
    const allChecked = childStates.every(s => s === 'checked');
    const allUnchecked = childStates.every(s => s === 'unchecked');

    let state: 'checked' | 'unchecked' | 'indeterminate';
    if (allChecked) {
      state = 'checked';
    } else if (allUnchecked) {
      state = 'unchecked';
    } else {
      state = 'indeterminate';
    }

    stateMap.set(item.id, state);
    return state;
  };

  items.forEach(item => processItem(item));
  return stateMap;
};

/**
 * TreeMenu 내부 컴포넌트
 * 트리 구조의 메뉴를 렌더링하는 컨테이너 컴포넌트
 */
function TreeMenuInner(
  props: TreeMenuProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  // TypeScript 판별 유니온을 신뢰하여 단순하게 구조분해
  // SM에서는 checkboxMode 등이 타입 에러로 전달 불가 → 런타임 방어 불필요
  const {
    className,
    size = 'md',
    items,
    onItemClick,
    defaultExpandedIds = new Set(),
    expandedIds: controlledExpandedIds,
    onExpandChange,
    onExpandToggle: onExpandToggleCallback,
    checkboxMode = false,
    checkedIds = new Set<string>(),
    onCheckChange,
    // Drag & Drop props
    draggable = false,
    onItemMove,
    ...restProps
  } = props as TreeMenuPropsMd;

  // items를 MD 타입으로 단언 (내부 구현용)
  const mdItems = items as TreeMenuItemDataMd[];

  // 펼침 상태 관리 (Controlled/Uncontrolled 자동 처리)
  const [expandedIds, setExpandedIds] = useControllableState(
    controlledExpandedIds,
    defaultExpandedIds,
    onExpandChange
  );

  // 포커스 인덱스 관리
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  // 체크 상태 계산
  const checkStates = React.useMemo(
    () => calculateCheckStates(mdItems, checkedIds),
    [mdItems, checkedIds]
  );

  // 아이템 refs 관리
  const itemRefs = React.useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Drag & Drop 상태 관리
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = React.useState<DropPosition | null>(null);

  // 자동 펼침 타이머 (드래그 중 접힌 폴더 위에 일정 시간 hover 시 자동 펼침)
  const autoExpandTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_EXPAND_DELAY = 800; // ms

  /**
   * 특정 아이템이 대상 아이템의 자손인지 확인
   * (순환 참조 방지용)
   */
  const isDescendantOf = React.useCallback((itemId: string, potentialAncestorId: string): boolean => {
    const findInChildren = (menuItems: TreeMenuItemDataMd[]): boolean => {
      for (const item of menuItems) {
        if (item.id === potentialAncestorId) {
          // potentialAncestorId를 찾았으면, 그 자손 중에 itemId가 있는지 확인
          const checkDescendants = (children: TreeMenuItemDataMd[] | undefined): boolean => {
            if (!children) return false;
            for (const child of children) {
              if (child.id === itemId) return true;
              if (checkDescendants(child.children)) return true;
            }
            return false;
          };
          return checkDescendants(item.children);
        }
        if (item.children && findInChildren(item.children)) {
          return true;
        }
      }
      return false;
    };
    return findInChildren(mdItems);
  }, [mdItems]);

  /**
   * ID로 아이템 찾기
   * (자동 펼침용)
   */
  const findItemById = React.useCallback((targetId: string): TreeMenuItemDataMd | null => {
    const search = (menuItems: TreeMenuItemDataMd[]): TreeMenuItemDataMd | null => {
      for (const item of menuItems) {
        if (item.id === targetId) return item;
        if (item.children) {
          const found = search(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(mdItems);
  }, [mdItems]);

  /**
   * 자동 펼침 타이머 취소
   */
  const clearAutoExpandTimer = React.useCallback(() => {
    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }
  }, []);

  /**
   * 드롭 위치 계산 (마우스 Y 좌표 기반)
   * - 상단 25%: 'before'
   * - 하단 25%: 'after'
   * - 중앙 50%: 'inside'
   */
  const calculateDropPosition = (e: React.DragEvent, element: HTMLElement): DropPosition => {
    const rect = element.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const ratio = y / height;

    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'inside';
  };

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggingId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
  };

  // 드래그 종료
  const handleDragEnd = () => {
    clearAutoExpandTimer();
    setDraggingId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  // 드래그 오버 (성능 최적화: 값 변경 시에만 setState)
  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === itemId) return;

    // 자신의 자손에게 드롭 불가 - 인디케이터 상태 초기화
    if (isDescendantOf(itemId, draggingId)) {
      e.dataTransfer.dropEffect = 'none';
      if (dragOverId !== null) setDragOverId(null);
      if (dragOverPosition !== null) setDragOverPosition(null);
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    const position = calculateDropPosition(e, e.currentTarget as HTMLElement);

    // 값이 변경되었을 때만 setState (불필요한 리렌더 방지)
    if (dragOverId !== itemId) {
      setDragOverId(itemId);
    }
    if (dragOverPosition !== position) {
      setDragOverPosition(position);
    }
  };

  // 드래그 진입
  const handleDragEnter = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === itemId) return;

    // 기존 타이머 취소
    clearAutoExpandTimer();

    // 자신의 자손에게 드롭 불가 - 인디케이터 상태 초기화
    if (isDescendantOf(itemId, draggingId)) {
      setDragOverId(null);
      setDragOverPosition(null);
      return;
    }

    // 접힌 폴더면 일정 시간 후 자동 펼침
    const item = findItemById(itemId);
    if (item?.children && item.children.length > 0 && !expandedIds.has(itemId)) {
      autoExpandTimerRef.current = setTimeout(() => {
        setExpandedIds(prev => new Set([...prev, itemId]));
      }, AUTO_EXPAND_DELAY);
    }

    setDragOverId(itemId);
  };

  // 드래그 이탈 (성능 최적화: 값 변경 시에만 setState)
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // relatedTarget이 현재 요소의 자식이 아닌 경우에만 상태 초기화
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      clearAutoExpandTimer();
      if (dragOverId !== null) setDragOverId(null);
      if (dragOverPosition !== null) setDragOverPosition(null);
    }
  };

  // 드롭
  const handleDrop = (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    if (!draggingId || !dragOverPosition || draggingId === targetItemId) return;

    // 자신의 자손에게 드롭 불가
    if (isDescendantOf(targetItemId, draggingId)) return;

    onItemMove?.(draggingId, targetItemId, dragOverPosition);

    // 상태 초기화
    clearAutoExpandTimer();
    setDraggingId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  // 펼침/접힘 토글
  const handleExpandToggle = (itemId: string) => {
    const wasExpanded = expandedIds.has(itemId);

    setExpandedIds(prev => {
      const next = new Set(prev);
      if (wasExpanded) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });

    // 단일 아이템 토글 콜백 (선택적)
    onExpandToggleCallback?.(itemId, !wasExpanded);
  };

  // 체크 상태 변경 (부모-자식 연동)
  const handleCheckChange = (item: TreeMenuItemDataMd, checked: boolean) => {
    if (!onCheckChange) return;

    const affectedIds: string[] = [item.id];

    // 자손 모두 영향 받음
    if (item.children) {
      affectedIds.push(...getAllDescendantIds(item));
    }

    onCheckChange(item.id, checked, affectedIds);
  };

  // 아이템 클릭
  const handleItemClick = (item: TreeMenuItemDataMd) => {
    // onItemClick 호출 (타입 안전성을 위해 any 사용)
    (onItemClick as ((item: TreeMenuItemDataMd) => void) | undefined)?.(item);
  };

  // Flat 리스트로 변환 (키보드 네비게이션용)
  const getFlatItems = React.useCallback((): { item: TreeMenuItemDataMd; depth: number }[] => {
    const flat: { item: TreeMenuItemDataMd; depth: number }[] = [];

    const traverse = (menuItems: TreeMenuItemDataMd[], depth: number) => {
      for (const item of menuItems) {
        if (item.disabled) continue;
        flat.push({ item, depth });
        if (item.children && expandedIds.has(item.id)) {
          traverse(item.children, depth + 1);
        }
      }
    };

    traverse(mdItems, 1);
    return flat;
  }, [mdItems, expandedIds]);

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const flatItems = getFlatItems();
    const currentIndex = flatItems.findIndex(f => f.item.id === focusedId);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (flatItems.length > 0) {
          const nextIndex = (currentIndex + 1) % flatItems.length;
          const nextId = flatItems[nextIndex].item.id;
          setFocusedId(nextId);
          itemRefs.current.get(nextId)?.focus();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (flatItems.length > 0) {
          const prevIndex = currentIndex - 1 < 0 ? flatItems.length - 1 : currentIndex - 1;
          const prevId = flatItems[prevIndex].item.id;
          setFocusedId(prevId);
          itemRefs.current.get(prevId)?.focus();
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (focusedId) {
          const currentItem = flatItems[currentIndex]?.item;
          if (currentItem?.children && !expandedIds.has(focusedId)) {
            handleExpandToggle(focusedId);
          }
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (focusedId && expandedIds.has(focusedId)) {
          handleExpandToggle(focusedId);
        } else if (focusedId) {
          // 부모로 이동
          const parentPath = findParentPath(mdItems, focusedId);
          if (parentPath && parentPath.length > 0) {
            const parentId = parentPath[parentPath.length - 1].id;
            setFocusedId(parentId);
            itemRefs.current.get(parentId)?.focus();
          }
        }
        break;

      case 'Home':
        e.preventDefault();
        if (flatItems.length > 0) {
          const firstId = flatItems[0].item.id;
          setFocusedId(firstId);
          itemRefs.current.get(firstId)?.focus();
        }
        break;

      case 'End':
        e.preventDefault();
        if (flatItems.length > 0) {
          const lastId = flatItems[flatItems.length - 1].item.id;
          setFocusedId(lastId);
          itemRefs.current.get(lastId)?.focus();
        }
        break;
    }
  };

  // 첫 번째 포커스 가능 아이템 ID 계산 (접근성: Tab 진입점)
  const firstFocusableId = React.useMemo(() => {
    const findFirst = (menuItems: TreeMenuItemDataMd[]): string | null => {
      for (const item of menuItems) {
        if (!item.disabled) return item.id;
      }
      return null;
    };
    return findFirst(mdItems);
  }, [mdItems]);

  // 재귀적 렌더링
  // MD 전용 props(checkboxMode, checkState, onCheckChange)도 항상 전달
  // Item에서 isMdSize 체크로 렌더링 여부 결정 (badge와 동일한 방식으로 일관성 확보)
  const renderItems = (menuItems: TreeMenuItemDataMd[], depth: number = 1): React.ReactNode => {
    return menuItems.map(item => {
      const hasChildren = !!(item.children && item.children.length > 0);
      const isExpanded = expandedIds.has(item.id);
      const isFocused = focusedId === item.id;
      const checkState = checkStates.get(item.id) || null;
      // focusedId가 없을 때만 첫 번째 아이템에 Tab 진입 허용
      const isFirstFocusable = focusedId === null && item.id === firstFocusableId;
      // 드래그 상태
      const isDragging = draggingId === item.id;
      const itemDragOverPosition = dragOverId === item.id ? dragOverPosition : null;

      return (
        <React.Fragment key={item.id}>
          <TreeMenuItem
            ref={(el) => {
              itemRefs.current.set(item.id, el);
            }}
            item={item}
            size={size}
            depth={Math.min(depth, 4) as 1 | 2 | 3 | 4}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            isFocused={isFocused}
            isFirstFocusable={isFirstFocusable}
            checkboxMode={checkboxMode}
            checkState={checkState}
            onCheckChange={(checked: boolean) => handleCheckChange(item, checked)}
            onExpandToggle={() => handleExpandToggle(item.id)}
            onItemClick={() => handleItemClick(item)}
            onFocus={() => setFocusedId(item.id)}
            // Drag & Drop props
            draggable={draggable && !item.disabled}
            isDragging={isDragging}
            dragOverPosition={itemDragOverPosition}
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragEnter={(e) => handleDragEnter(e, item.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.id)}
          />
          {hasChildren && isExpanded && (
            <div role="group">
              {renderItems(item.children!, depth + 1)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div
      ref={ref}
      role="tree"
      aria-label="Tree Menu"
      className={cn(treeMenuVariants({ size }), className)}
      onKeyDown={handleKeyDown}
      {...restProps}
    >
      {renderItems(mdItems)}
    </div>
  );
}

/**
 * TreeMenu 컴포넌트 (판별 유니온 패턴)
 * size prop에 따라 타입이 자동으로 결정됩니다.
 * - size="md" (기본값): 체크박스 관련 props 사용 가능, items에 badge 사용 가능
 * - size="sm": 체크박스/뱃지 관련 props 사용 불가 (타입 에러)
 */
const TreeMenu = React.forwardRef(TreeMenuInner) as React.ForwardRefExoticComponent<
  TreeMenuProps & React.RefAttributes<HTMLDivElement>
>;

TreeMenu.displayName = 'TreeMenu';

export { TreeMenu, treeMenuVariants };
