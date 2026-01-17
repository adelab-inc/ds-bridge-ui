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

  const handleCodeGenerated = React.useCallback((code: CodeEvent) => {
    setGeneratedCode(code);
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
              <ChatSection roomId={roomId} onCodeGenerated={handleCodeGenerated} />
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
            />
          </RightPanel>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ClientOnly>
  );
}

export { DesktopLayout };
export type { DesktopLayoutProps };
