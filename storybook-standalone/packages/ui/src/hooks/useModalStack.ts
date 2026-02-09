import { useEffect, useId, useRef, useState } from 'react';
import { useModalStackContext } from '../components/ModalStackProvider';

/** 기본 z-index (Provider 없이 사용 시) */
const DEFAULT_Z_INDEX = 40;

export interface UseModalStackOptions {
  /** 모달 활성화 여부 */
  enabled: boolean;
}

export interface UseModalStackReturn {
  /** backdrop용 z-index */
  backdropZIndex: number;
  /** dialog용 z-index */
  dialogZIndex: number;
  /** 현재 모달이 스택의 최상위인지 여부 */
  isTopModal: boolean;
}

/**
 * 모달을 스택에 등록하고 z-index를 관리하는 훅
 *
 * ModalStackProvider가 있으면 자동으로 스택 관리
 * Provider가 없으면 기본 z-index 사용 (단일 모달 사용 시)
 *
 * @param options - 옵션 객체
 * @returns z-index와 isTopModal 정보
 *
 * @example
 * ```tsx
 * const { backdropZIndex, dialogZIndex, isTopModal } = useModalStack({ enabled: open });
 *
 * // Focus Trap은 최상위 모달에만 적용
 * useFocusTrap(ref, { enabled: open && isTopModal });
 *
 * // ESC 키도 최상위 모달에만 반응
 * useEscapeKey(isTopModal ? onClose : () => {});
 * ```
 */
export const useModalStack = (options: UseModalStackOptions): UseModalStackReturn => {
  const { enabled } = options;
  const modalId = useId();
  const context = useModalStackContext();

  // context를 ref로 저장하여 안정적인 참조 유지 (무한 루프 방지)
  const contextRef = useRef(context);
  contextRef.current = context;

  const [zIndex, setZIndex] = useState(DEFAULT_Z_INDEX);
  const [isTop, setIsTop] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    const ctx = contextRef.current;

    // Provider가 없으면 기본값 사용
    if (!ctx) {
      setZIndex(DEFAULT_Z_INDEX);
      setIsTop(true);
      return;
    }

    // 스택에 등록
    const registeredZIndex = ctx.register(modalId);
    setZIndex(registeredZIndex);

    return () => {
      ctx.unregister(modalId);
    };
  }, [enabled, modalId]);

  // isTopModal 상태 업데이트 (스택 변경 시)
  useEffect(() => {
    if (!enabled) {
      setIsTop(true);
      return;
    }

    const ctx = contextRef.current;
    if (!ctx) {
      setIsTop(true);
      return;
    }

    // 스택 변경을 감지하기 위해 polling
    const checkIsTop = () => {
      const currentCtx = contextRef.current;
      if (currentCtx) {
        setIsTop(currentCtx.isTopModal(modalId));
      }
    };

    checkIsTop();

    const intervalId = setInterval(checkIsTop, 50);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, modalId]);

  return {
    backdropZIndex: zIndex,
    dialogZIndex: zIndex + 1,
    isTopModal: isTop,
  };
};
