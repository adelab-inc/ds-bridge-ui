'use client';

import * as React from 'react';
import { usePanelRef } from 'react-resizable-panels';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
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
import { useCodeGenerationStore } from '@/stores/useCodeGenerationStore';

// Feature components
import { ChatSection } from '@/components/features/chat/chat-section';
import { ComponentListSection } from '@/components/features/component-list/component-list-section';
import { ActionsSection } from '@/components/features/actions/actions-section';
import { PreviewSection } from '@/components/features/preview/preview-section';

interface DesktopLayoutProps {
  onURLSubmit?: (url: string) => void;
  onJSONUpload?: (file: File) => void;
}

function DesktopLayout({ onURLSubmit, onJSONUpload }: DesktopLayoutProps) {
  const leftPanelRef = usePanelRef();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = React.useState(0);

  const handleTogglePanel = React.useCallback(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [leftPanelRef]);

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
  } = useCodeGenerationStore();

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
      <div className="relative h-full w-full">
        <ResizablePanelGroup orientation="horizontal" id="main-layout">
          {/* Left Panel */}
          <ResizablePanel
            id="left-panel"
            defaultSize={LAYOUT.LEFT_PANEL_DEFAULT}
            minSize={`${LAYOUT.LEFT_PANEL_MIN_PX}px`}
            maxSize={`${LAYOUT.LEFT_PANEL_MAX_PX}px`}
            collapsible
            collapsedSize={LAYOUT.LEFT_PANEL_COLLAPSED_SIZE}
            panelRef={leftPanelRef}
            onResize={(panelSize) => {
              setLeftPanelWidth(panelSize.inPixels);
              setIsCollapsed(panelSize.asPercentage === 0);
            }}
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
                  onCodeGenerated={onCodeGenerated}
                  onStreamStart={onStreamStart}
                  onStreamEnd={onStreamEnd}
                />
              ) : null}
              {/* <ComponentListSection />
              <ActionsSection /> */}
            </LeftPanel>
          </ResizablePanel>

          {/* Resize Handle — 접힌 상태에서는 숨김 */}
          <ResizableHandle
            withHandle
            className={isCollapsed ? 'invisible' : ''}
          />

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

        {/* Panel Toggle Button — ResizableHandle과 완전히 분리 */}
        <button
          type="button"
          onClick={handleTogglePanel}
          className="bg-background hover:bg-accent border-border absolute top-[calc(50%-28px)] z-20 flex h-6 w-3.5 -translate-y-1/2 items-center justify-center rounded-sm border transition-colors"
          style={{
            left: `${isCollapsed ? leftPanelWidth : leftPanelWidth - 7}px`,
          }}
          aria-label={isCollapsed ? '패널 펼치기' : '패널 접기'}
        >
          <HugeiconsIcon
            icon={isCollapsed ? ArrowRight01Icon : ArrowLeft01Icon}
            className="size-3"
            strokeWidth={2}
          />
        </button>
      </div>
    </ClientOnly>
  );
}

export { DesktopLayout };
export type { DesktopLayoutProps };
