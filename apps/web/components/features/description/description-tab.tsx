'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { FileTextIcon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { useDescriptionStore } from '@/stores/useDescriptionStore';
import {
  useLatestDescription,
  useSaveEditHistory,
} from '@/hooks/api/useDescriptionQuery';
import { DescriptionViewer } from './description-viewer';
import { DescriptionEditor } from './description-editor';
import { DescriptionVersionBanner } from './description-version-banner';
import { DescriptionToolbar } from './description-toolbar';
import { DescriptionHistoryPanel } from './description-history-panel';

interface DescriptionTabProps {
  roomId: string;
}

/**
 * 디스크립션 모드 탭 루트 컴포넌트
 * uiState 기반으로 idle / viewing / editing / waiting / history 분기
 */
function DescriptionTab({ roomId }: DescriptionTabProps) {
  const uiState = useDescriptionStore((s) => s.uiState);
  const setActiveTab = useDescriptionStore((s) => s.setActiveTab);
  const setCurrentDescription = useDescriptionStore(
    (s) => s.setCurrentDescription
  );
  const currentVersion = useDescriptionStore((s) => s.currentVersion);
  const currentContent = useDescriptionStore((s) => s.currentContent);
  const currentDescription = useDescriptionStore((s) => s.currentDescription);
  const editDraft = useDescriptionStore((s) => s.editDraft);
  const startEditing = useDescriptionStore((s) => s.startEditing);
  const saveEdit = useDescriptionStore((s) => s.saveEdit);
  const cancelEdit = useDescriptionStore((s) => s.cancelEdit);
  const openHistory = useDescriptionStore((s) => s.openHistory);
  const versions = useDescriptionStore((s) => s.versions);

  // 최신 디스크립션 조회 (마운트 시 자동 fetch)
  const { data: latestDescription } = useLatestDescription(roomId);

  // 편집 이력 BE 저장 mutation
  const saveEditMutation = useSaveEditHistory();

  // [저장 후 닫기] 핸들러: BE 저장 → 스토어 상태 전이
  const handleSave = React.useCallback(() => {
    const draft = useDescriptionStore.getState().editDraft;
    if (!draft?.trim()) return;

    saveEditMutation.mutate(
      { roomId, edited_content: draft },
      {
        onSuccess: () => {
          saveEdit(); // 스토어: editHistory 생성 + waiting + 디자인 탭
        },
      }
    );
  }, [roomId, saveEditMutation, saveEdit]);

  // 서버 데이터 → 스토어 동기화 (최초 로드 or 새 버전)
  React.useEffect(() => {
    if (latestDescription && uiState === 'idle') {
      setCurrentDescription(latestDescription);
    }
  }, [latestDescription, uiState, setCurrentDescription]);

  // idle: 빈 상태 안내
  if (uiState === 'idle') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <HugeiconsIcon
            icon={FileTextIcon}
            className="text-muted-foreground size-6"
            strokeWidth={1.5}
          />
        </div>
        <div className="text-center">
          <p className="text-foreground text-sm font-medium">
            디스크립션을 먼저 추출해 주세요
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            디자인 모드에서 대화를 진행한 후, 디스크립션 추출 버튼을 클릭하세요.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveTab('design')}
        >
          디자인 모드로 이동
        </Button>
      </div>
    );
  }

  // viewing / waiting: 읽기 전용 뷰어
  if (uiState === 'viewing' || uiState === 'waiting') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {currentDescription && currentVersion && (
          <DescriptionVersionBanner
            version={currentVersion}
            reason={currentDescription.reason}
            isLatest={!latestDescription || currentVersion >= latestDescription.version}
            isEditing={false}
          />
        )}
        <DescriptionToolbar
          uiState={uiState}
          onEdit={startEditing}
          onSave={handleSave}
          onCancel={cancelEdit}
          copyText={currentContent}
          onOpenHistory={openHistory}
          showHistoryButton={versions.length > 0}
          isSaveDisabled={false}
        />
        <DescriptionViewer />
      </div>
    );
  }

  // editing: 편집 모드
  if (uiState === 'editing') {
    const isDraftEmpty = !editDraft?.trim();
    const isUnchanged = editDraft === currentContent;

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {currentVersion && (
          <DescriptionVersionBanner
            version={currentVersion}
            reason={currentDescription?.reason ?? 'initial'}
            isLatest={false}
            isEditing
          />
        )}
        <DescriptionToolbar
          uiState={uiState}
          onEdit={startEditing}
          onSave={handleSave}
          onCancel={cancelEdit}
          copyText={editDraft}
          onOpenHistory={openHistory}
          showHistoryButton={versions.length > 0}
          isSaveDisabled={isDraftEmpty || isUnchanged}
        />
        <DescriptionEditor />
      </div>
    );
  }

  // history: 이력 패널
  if (uiState === 'history') {
    return <DescriptionHistoryPanel roomId={roomId} />;
  }

  return null;
}

export { DescriptionTab };
export type { DescriptionTabProps };
