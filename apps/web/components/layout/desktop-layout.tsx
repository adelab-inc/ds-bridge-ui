'use client';

import * as React from 'react';
import { LAYOUT } from '@/lib/constants';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { ClientOnly } from '@/components/ui/client-only';
import { LeftPanel } from '@/components/layout/left-panel';
import { RightPanel } from '@/components/layout/right-panel';
import { useRoom } from '@/hooks/useRoom';

// Feature components
import { ChatSection } from '@/components/features/chat/chat-section';
import { ComponentListSection } from '@/components/features/component-list/component-list-section';
import { ActionsSection } from '@/components/features/actions/actions-section';
import { PreviewSection } from '@/components/features/preview/preview-section';
import type { CodeEvent } from '@/types/chat';

interface DesktopLayoutProps {
  onURLSubmit?: (url: string) => void;
  onJSONUpload?: (file: File) => void;
}

function DesktopLayout({ onURLSubmit, onJSONUpload }: DesktopLayoutProps) {
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

  return (
    <ClientOnly
      fallback={
        <div className="flex h-full w-full">
          <div
            className="bg-card h-full"
            style={{ width: `${LAYOUT.LEFT_PANEL_DEFAULT}%` }}
          />
          <div className="bg-border w-px" />
          <div className="bg-background h-full flex-1" />
        </div>
      }
    >
      <ResizablePanelGroup orientation="horizontal" id="main-layout">
        {/* Left Panel */}
        <ResizablePanel
          id="left-panel"
          defaultSize={LAYOUT.LEFT_PANEL_DEFAULT}
          minSize={`${LAYOUT.LEFT_PANEL_MIN_PX}px`}
          maxSize={`${LAYOUT.LEFT_PANEL_MAX_PX}px`}
        >
          <LeftPanel>
            {isLoading ? (
              <div className="flex h-full items-center justify-center p-4">
                <p className="text-muted-foreground text-sm">
                  채팅방 준비 중...
                </p>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-4">
                <p className="text-destructive text-sm">Error: {error}</p>
              </div>
            ) : roomId ? (
              <ChatSection
                roomId={roomId}
                onCodeGenerated={handleCodeGenerated}
                onStreamStart={handleStreamStart}
                onStreamEnd={handleStreamEnd}
              />
            ) : null}
            <ComponentListSection />
            <ActionsSection />
          </LeftPanel>
        </ResizablePanel>

        {/* Resize Handle */}
        <ResizableHandle withHandle />

        {/* Right Panel */}
        <ResizablePanel
          id="right-panel"
          defaultSize={100 - LAYOUT.LEFT_PANEL_DEFAULT}
        >
          <RightPanel>
            <PreviewSection
              aiCode={generatedCode?.content}
              aiFilePath={generatedCode?.path}
              isGeneratingCode={isGeneratingCode}
            />
          </RightPanel>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ClientOnly>
  );
}

export { DesktopLayout };
export type { DesktopLayoutProps };
