'use client';

import { useEffect, useRef } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  // 직전 인증 사용자 ID — 진짜 로그아웃/계정 전환 판별용
  const prevUidRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // 초기 세션 확인
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      prevUidRef.current = user?.id ?? null;
      setUser(user ? toAuthUser(user) : null);
    });

    // 인증 상태 변경 구독 - token도 함께 캐싱
    // TOKEN_REFRESHED 이벤트 시 자동으로 갱신된 token이 캐싱됨
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      const nextUid = session?.user?.id ?? null;
      const prevUid = prevUidRef.current;

      // 진짜 로그아웃 또는 계정 전환에서만 React Query 캐시를 비운다.
      // (이전 사용자의 룸/프로젝트명 잔존으로 인한 혼동·노출 방지)
      // ⚠️ TOKEN_REFRESHED(~1시간마다, 동일 uid)·첫 로그인(null→A)에서는 비우지 않는다.
      const isSignOut = event === 'SIGNED_OUT';
      const isSwitch =
        prevUid !== null && nextUid !== null && prevUid !== nextUid;
      if (isSignOut || isSwitch) {
        queryClient.clear();
      }

      prevUidRef.current = nextUid;
      setUser(session?.user ? toAuthUser(session.user) : null);
      setAccessToken(session?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setAccessToken, queryClient]);

  return null;
}
