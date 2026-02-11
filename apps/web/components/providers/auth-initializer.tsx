'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/useAuthStore';
import { toAuthUser } from '@/types/auth';

/**
 * Firebase Auth 상태를 Zustand store에 동기화하는 초기화 컴포넌트
 * UI를 렌더하지 않음 (root layout에 배치)
 */
export function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(toAuthUser(firebaseUser));
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [setUser]);

  return null;
}
