'use client';

import * as React from 'react';

import { BREAKPOINTS } from '@/lib/constants';
import { DesktopLayout } from '@/components/layout/desktop-layout';
import { MobileLayout } from '@/components/layout/mobile-layout';

/**
 * 뷰포트 기반으로 Desktop / Mobile 레이아웃 중 **하나만** 마운트한다.
 *
 * 이전에는 page.tsx에서 두 레이아웃을 CSS `hidden md:block` / `md:hidden`으로
 * 모두 마운트한 뒤 시각만 전환했다. 이 방식은 React 트리에 두 레이아웃이 모두
 * 올라가 각각의 ChatSection → useChatStreamLifecycle → useRoomChannel이 실행되어
 * **같은 Supabase Broadcast 채널을 두 번 구독**하는 문제를 일으켰다
 * (모든 broadcast 이벤트가 2번 수신되고 텍스트 중복 누적).
 *
 * 조건부 렌더링으로 바꿔 채널 구독이 정확히 1개만 유지되도록 한다.
 *
 * SSR 시점에는 viewport를 알 수 없어 null을 반환하며, 실제 렌더링은
 * 클라이언트 hydration 직후 한 차례 수행한다. 해당 짧은 공백은 상위의
 * Suspense fallback이 덮기 때문에 사용자 체감상 영향은 크지 않다.
 *
 * 관련 문서: docs/bug-issue/답변중복발행.md
 */
export function ResponsiveLayout() {
  const [isMobile, setIsMobile] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BREAKPOINTS.MD - 1}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // SSR + hydration 직후 한 프레임: 레이아웃 확정 전이라 null 반환.
  // 이 짧은 공백 동안은 상위 Suspense의 fallback이 보인다.
  if (isMobile === null) return null;

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}
