import { useEffect } from 'react';

/**
 * 컴포넌트가 마운트되는 동안 body 스크롤을 막는 훅
 * Modal/Dialog와 같은 overlay 컴포넌트에서 사용
 */
export const useBodyScrollLock = () => {
  useEffect(() => {
    // 현재 overflow 값을 저장
    const originalOverflow = document.body.style.overflow;

    // body 스크롤 막기
    document.body.style.overflow = 'hidden';

    // 컴포넌트 언마운트 시 원래 값으로 복원
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
};
