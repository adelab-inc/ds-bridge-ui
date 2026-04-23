import { Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { ResponsiveLayout } from '@/components/layout/responsive-layout';
import { RoomProvider } from '@/components/providers/room-provider';

/**
 * 홈페이지 (Server Component)
 *
 * RSC 패턴 적용:
 * - 구조적 마크업(<div>, <main>)은 Server에서 렌더링
 * - 인터랙티브 컴포넌트(Header, ResponsiveLayout)는 Client
 * - 향후 여기서 초기 데이터 fetch 가능 (async/await)
 *
 * ResponsiveLayout은 뷰포트 기반으로 Desktop/Mobile 중 하나만 마운트한다.
 * 이전에 둘 다 CSS hidden으로 마운트하던 방식이 Supabase 채널 2중 구독 →
 * 답변 텍스트 중복을 유발해 조건부 렌더링으로 전환.
 * 관련 문서: docs/bug-issue/답변중복발행.md
 */
export default function Page() {
  // 향후 Server에서 초기 데이터 fetch 가능
  // const config = await getStorybookConfig()
  // const cachedStories = await getCachedStories()

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* Header: Client Component (useSearchParams → Suspense 필요) */}
      <Suspense fallback={null}>
        <Header />
      </Suspense>

      {/* Main Content: Server에서 구조 렌더링 */}
      <main className="relative flex flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <RoomProvider>
            <ResponsiveLayout />
          </RoomProvider>
        </Suspense>
      </main>
    </div>
  );
}
