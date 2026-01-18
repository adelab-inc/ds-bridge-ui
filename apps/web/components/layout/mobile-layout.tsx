'use client';

import * as React from 'react';

import { LAYOUT } from '@/lib/constants';
import { RightPanel } from '@/components/layout/right-panel';
import { MobileSheet } from '@/components/layout/mobile-sheet';
import { useRoom } from '@/hooks/useRoom';

// Feature components
import { ChatSection } from '@/components/features/chat/chat-section';
import { ComponentListSection } from '@/components/features/component-list/component-list-section';
import { ActionsSection } from '@/components/features/actions/actions-section';
import { PreviewSection } from '@/components/features/preview/preview-section';
import type { CodeEvent } from '@/types/chat';

interface MobileLayoutProps {
  onURLSubmit?: (url: string) => void;
  onJSONUpload?: (file: File) => void;
}

function MobileLayout({ onURLSubmit, onJSONUpload }: MobileLayoutProps) {
  const { roomId, isLoading, error } = useRoom({
    storybookUrl: 'https://microsoft.github.io/vscode-webview-ui-toolkit',
    userId: 'anonymous',
  });

  // AI 생성 코드 상태
  const [generatedCode, setGeneratedCode] = React.useState<CodeEvent | null>(null);
  // 코드 생성 진행 상태 (로딩 인디케이터용)
  const [isGeneratingCode, setIsGeneratingCode] = React.useState(false);

  // 스트리밍 시작 핸들러
  const handleStreamStart = React.useCallback(() => {
    setGeneratedCode(null);
    setIsGeneratingCode(true);
  }, []);

  // 스트리밍 종료 핸들러
  const handleStreamEnd = React.useCallback(() => {
    setIsGeneratingCode(false);
  }, []);

  // 코드 생성 완료 핸들러
  const handleCodeGenerated = React.useCallback((code: CodeEvent) => {
    setGeneratedCode(code);
    setIsGeneratingCode(false);
  }, []);

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
          roomId={roomId}
          onCodeGenerated={handleCodeGenerated}
          onStreamStart={handleStreamStart}
          onStreamEnd={handleStreamEnd}
        />
      );
    }
    return null;
  }, [isLoading, error, roomId, handleCodeGenerated, handleStreamStart, handleStreamEnd]);

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

export { MobileLayout };
export type { MobileLayoutProps };
