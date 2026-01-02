import { useEffect } from 'react';

/**
 * ESC 키를 눌렀을 때 콜백 함수를 실행하는 훅
 * @param onEscape - ESC 키를 눌렀을 때 실행할 콜백 함수
 */
export const useEscapeKey = (onEscape: () => void) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onEscape]);
};
