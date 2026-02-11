import * as React from 'react';

/** 모달 스택 아이템 */
interface ModalStackItem {
  id: string;
  zIndex: number;
}

/** 모달 스택 Context 값 */
interface ModalStackContextValue {
  /** 모달을 스택에 등록하고 z-index 반환 */
  register: (id: string) => number;
  /** 모달을 스택에서 해제 */
  unregister: (id: string) => void;
  /** 해당 모달이 최상위인지 확인 */
  isTopModal: (id: string) => boolean;
  /** 해당 모달의 z-index 반환 */
  getZIndex: (id: string) => number;
}

const ModalStackContext = React.createContext<ModalStackContextValue | null>(null);

/** 기본 z-index 시작값 */
const BASE_Z_INDEX = 40;
/** 각 모달 레이어당 z-index 증가값 (backdrop + dialog를 위해 10씩) */
const Z_INDEX_INCREMENT = 10;

export interface ModalStackProviderProps {
  children: React.ReactNode;
  /** 기본 z-index 시작값 (기본: 40) */
  baseZIndex?: number;
}

/**
 * 중첩 모달의 z-index와 포커스를 자동으로 관리하는 Provider
 *
 * 기능:
 * - 열린 모달들을 스택으로 관리
 * - z-index를 스택 순서에 따라 자동 계산
 * - 최상위 모달 판별 (Focus Trap, ESC 키용)
 *
 * @example
 * ```tsx
 * // App.tsx
 * <ModalStackProvider>
 *   <App />
 * </ModalStackProvider>
 *
 * // 컴포넌트 내부
 * <Dialog open={isOpen1}>첫 번째 모달</Dialog>
 * <Dialog open={isOpen2}>중첩 모달 (자동으로 위에 표시)</Dialog>
 * ```
 */
export const ModalStackProvider: React.FC<ModalStackProviderProps> = ({
  children,
  baseZIndex = BASE_Z_INDEX,
}) => {
  const [stack, setStack] = React.useState<ModalStackItem[]>([]);

  const register = React.useCallback((id: string): number => {
    let zIndex = baseZIndex;

    setStack((prev) => {
      // 이미 등록된 경우 기존 z-index 반환
      const existing = prev.find((item) => item.id === id);
      if (existing) {
        zIndex = existing.zIndex;
        return prev;
      }

      // 새 z-index 계산: 기존 스택의 최대값 + INCREMENT
      const maxZIndex = prev.length > 0
        ? Math.max(...prev.map((item) => item.zIndex))
        : baseZIndex - Z_INDEX_INCREMENT;
      zIndex = maxZIndex + Z_INDEX_INCREMENT;

      return [...prev, { id, zIndex }];
    });

    return zIndex;
  }, [baseZIndex]);

  const unregister = React.useCallback((id: string) => {
    setStack((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const isTopModal = React.useCallback((id: string): boolean => {
    if (stack.length === 0) return false;
    return stack[stack.length - 1].id === id;
  }, [stack]);

  const getZIndex = React.useCallback((id: string): number => {
    const item = stack.find((item) => item.id === id);
    return item?.zIndex ?? baseZIndex;
  }, [stack, baseZIndex]);

  const value = React.useMemo<ModalStackContextValue>(
    () => ({ register, unregister, isTopModal, getZIndex }),
    [register, unregister, isTopModal, getZIndex]
  );

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
};

/**
 * ModalStack Context를 사용하는 훅
 * Provider 없이도 동작하도록 fallback 제공
 */
export const useModalStackContext = (): ModalStackContextValue | null => {
  return React.useContext(ModalStackContext);
};

ModalStackProvider.displayName = 'ModalStackProvider';
