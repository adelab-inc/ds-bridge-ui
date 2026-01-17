'use client';

import * as React from 'react';

import { LAYOUT } from '@/lib/constants';
import { RightPanel } from '@/components/layout/right-panel';
import { MobileSheet } from '@/components/layout/mobile-sheet';

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
  // AI 생성 코드 상태
  const [generatedCode, setGeneratedCode] = React.useState<CodeEvent | null>(null);

  const handleCodeGenerated = React.useCallback((code: CodeEvent) => {
    setGeneratedCode(code);
  }, []);

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
          />
        </RightPanel>
      </div>

      {/* Mobile Bottom Sheet */}
      <MobileSheet
        chatContent={<ChatSection roomId="" onCodeGenerated={handleCodeGenerated} />}
        componentsContent={<ComponentListSection />}
        actionsContent={<ActionsSection />}
      />
    </>
  );
}

export { MobileLayout };
export type { MobileLayoutProps };
