'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';
import { toAuthUser } from '@/types/auth';

/**
 * Supabase Auth 상태를 Zustand store에 동기화하는 초기화 컴포넌트
 * UI를 렌더하지 않음 (root layout에 배치)
 */
export function AuthInitializer() {
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  useEffect(() => {
    const supabase = createClient();

    // 초기 세션 확인
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ? toAuthUser(user) : null);
    });

    // 인증 상태 변경 구독 - token도 함께 캐싱
    // TOKEN_REFRESHED 이벤트 시 자동으로 갱신된 token이 캐싱됨
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setAccessToken(session?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setAccessToken]);

  return null;
}
