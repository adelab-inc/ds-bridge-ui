'use client';

import * as React from 'react';

import { LAYOUT } from '@/lib/constants';
import { ClientOnly } from '@/components/ui/client-only';
import { RightPanel } from '@/components/layout/right-panel';
import { MobileSheet } from '@/components/layout/mobile-sheet';
import { useRoom } from '@/hooks/useRoom';
import { useCodeGenerationStore } from '@/stores/useCodeGenerationStore';

// Feature components
import { ChatSection } from '@/components/features/chat/chat-section';
import { ComponentListSection } from '@/components/features/component-list/component-list-section';
import { ActionsSection } from '@/components/features/actions/actions-section';
import { PreviewSection } from '@/components/features/preview/preview-section';

// Skeleton for SSR fallback
function MobileLayoutSkeleton() {
  return (
    <div className="h-full w-full">
      <div
        className="bg-background h-full"
        style={{ paddingBottom: `${LAYOUT.MOBILE_SHEET_DEFAULT_HEIGHT}vh` }}
      />
    </div>
  );
}

// Content component - hooks are called here (client only)
function MobileLayoutContent() {
  const { roomId, isLoading, error } = useRoom({
    storybookUrl: 'https://microsoft.github.io/vscode-webview-ui-toolkit',
    userId: 'anonymous',
  });

  // Zustand 스토어에서 상태 및 핸들러 가져오기
  const {
    generatedCode,
    isGeneratingCode,
    onStreamStart,
    onStreamEnd,
    onCodeGenerated,
    reset: resetCodeGeneration,
  } = useCodeGenerationStore();

  // roomId 변경 시 프리뷰 상태 초기화
  React.useEffect(() => {
    resetCodeGeneration();
  }, [roomId, resetCodeGeneration]);

  // 채팅 컨텐츠 렌더링
  const chatContent = React.useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center p-4">
          <p className="text-muted-foreground text-sm">채팅방 준비 중...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex h-full items-center justify-center p-4">
          <p className="text-destructive text-sm">Error: {error}</p>
        </div>
      );
    }
    if (roomId) {
      return (
        <ChatSection
          key={roomId}
          roomId={roomId}
          onCodeGenerated={onCodeGenerated}
          onStreamStart={onStreamStart}
          onStreamEnd={onStreamEnd}
        />
      );
    }
    return null;
  }, [isLoading, error, roomId, onCodeGenerated, onStreamStart, onStreamEnd]);

  return (
    <>
      {/* Preview takes full height minus bottom sheet */}
      <div
        className="flex-1 overflow-hidden"
        style={{ paddingBottom: `${LAYOUT.MOBILE_SHEET_DEFAULT_HEIGHT}vh` }}
      >
        <RightPanel className="h-full">
          <PreviewSection
            aiCode={generatedCode?.content}
            aiFilePath={generatedCode?.path}
            isGeneratingCode={isGeneratingCode}
          />
        </RightPanel>
      </div>

      {/* Mobile Bottom Sheet */}
      <MobileSheet
        chatContent={chatContent}
        componentsContent={<ComponentListSection />}
        actionsContent={<ActionsSection />}
      />
    </>
  );
}

// Main component - wraps content with ClientOnly
function MobileLayout() {
  return (
    <ClientOnly fallback={<MobileLayoutSkeleton />}>
      <MobileLayoutContent />
    </ClientOnly>
  );
}

export { MobileLayout };
