import { Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { DesktopLayout } from '@/components/layout/desktop-layout';
import { MobileLayout } from '@/components/layout/mobile-layout';

/**
 * 홈페이지 (Server Component)
 *
 * RSC 패턴 적용:
 * - 구조적 마크업(<div>, <main>)은 Server에서 렌더링
 * - 인터랙티브 컴포넌트(Header, DesktopLayout, MobileLayout)는 Client
 * - 향후 여기서 초기 데이터 fetch 가능 (async/await)
 */
export default function Page() {
  // 향후 Server에서 초기 데이터 fetch 가능
  // const config = await getStorybookConfig()
  // const cachedStories = await getCachedStories()

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      {/* Header: Client Component */}
      <Header />

      {/* Main Content: Server에서 구조 렌더링 */}
      <main className="relative flex flex-1 overflow-hidden">
        {/* Desktop Layout: Client (ResizablePanels) */}
        <div className="hidden h-full w-full md:block">
          <Suspense fallback={null}>
            <DesktopLayout />
          </Suspense>
        </div>

        {/* Mobile Layout: Client (BottomSheet) */}
        <div className="flex h-full w-full flex-col md:hidden">
          <Suspense fallback={null}>
            <MobileLayout />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
