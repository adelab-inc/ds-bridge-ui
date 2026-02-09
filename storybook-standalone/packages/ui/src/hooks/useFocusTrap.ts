import { useEffect, useRef, type RefObject } from 'react';

/**
 * 포커스 가능한 요소를 찾기 위한 셀렉터
 * - 기본 HTML 폼 요소
 * - tabindex가 있는 요소
 * - ARIA role이 있는 커스텀 컴포넌트 (sr-only input 포함)
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[role="slider"]:not([aria-disabled="true"])',
  '[role="combobox"]:not([aria-disabled="true"])',
  '[role="listbox"]:not([aria-disabled="true"])',
  '[role="menu"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
].join(', ');

/**
 * 컨테이너 내의 포커스 가능한 요소들을 반환
 */
const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
};

export interface UseFocusTrapOptions {
  /** Focus Trap 활성화 여부 */
  enabled: boolean;
  /** 비활성화 시 이전 포커스 요소로 복원 여부 (기본: true) */
  restoreFocus?: boolean;
}

/**
 * 모달/다이얼로그에서 포커스를 가두고 관리하는 훅
 *
 * 기능:
 * - 활성화 시 컨테이너 내 첫 번째 포커스 가능 요소로 포커스 이동
 * - Tab/Shift+Tab 시 컨테이너 내에서만 포커스 순환
 * - 비활성화 시 이전 포커스 요소로 복원
 *
 * @param containerRef - 포커스를 가둘 컨테이너의 ref
 * @param options - 옵션 객체
 *
 * @example
 * ```tsx
 * const dialogRef = useRef<HTMLDivElement>(null);
 * useFocusTrap(dialogRef, { enabled: isOpen });
 * ```
 */
export const useFocusTrap = (
  containerRef: RefObject<HTMLElement>,
  options: UseFocusTrapOptions
) => {
  const { enabled, restoreFocus = true } = options;
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // 포커스 복원을 위해 이전 포커스 요소 저장
  useEffect(() => {
    if (enabled) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
    }
  }, [enabled]);

  // 초기 포커스 이동
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = getFocusableElements(container);

    // 첫 번째 포커스 가능 요소로 이동
    if (focusableElements.length > 0) {
      // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 포커스
      requestAnimationFrame(() => {
        focusableElements[0].focus();
      });
    }
  }, [enabled, containerRef]);

  // Tab 키 트랩 처리
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift + Tab: 첫 번째 요소에서 마지막으로
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // Tab: 마지막 요소에서 첫 번째로
      else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, containerRef]);

  // 포커스 복원
  useEffect(() => {
    if (!restoreFocus) return;

    return () => {
      // cleanup 시 (enabled가 false로 변경될 때) 이전 포커스로 복원
      if (previouslyFocusedRef.current && typeof previouslyFocusedRef.current.focus === 'function') {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [enabled, restoreFocus]);
};
