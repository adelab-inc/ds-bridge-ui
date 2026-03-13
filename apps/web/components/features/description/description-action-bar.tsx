'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  File02Icon,
  Clock01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDescriptionStore } from '@/stores/useDescriptionStore';
import { useCodeGenerationStore } from '@/stores/useCodeGenerationStore';
import { useExtractDescription } from '@/hooks/api/useDescriptionQuery';

interface DescriptionActionBarProps {
  roomId: string;
  /** 메시지 존재 여부 (0건이면 추출 비활성화) */
  hasMessages: boolean;
}

/**
 * 디자인 모드 탭 내 ChatInput 위 액션바
 * 상태별 버튼: idle([추출]), viewing/waiting([추출]+[이력]), editing([편집 중]+[이력])
 */
function DescriptionActionBar({ roomId, hasMessages }: DescriptionActionBarProps) {
  const uiState = useDescriptionStore((s) => s.uiState);
  const isExtracting = useDescriptionStore((s) => s.isExtracting);
  const setIsExtracting = useDescriptionStore((s) => s.setIsExtracting);
  const setCurrentDescription = useDescriptionStore(
    (s) => s.setCurrentDescription
  );
  const editHistory = useDescriptionStore((s) => s.editHistory);
  const openHistory = useDescriptionStore((s) => s.openHistory);
  const versions = useDescriptionStore((s) => s.versions);

  const isGeneratingCode = useCodeGenerationStore((s) => s.isGeneratingCode);
  const generatedCode = useCodeGenerationStore((s) => s.generatedCode);

  const extractMutation = useExtractDescription();

  // 추출 버튼 비활성화 조건
  const isExtractDisabled =
    !hasMessages || isGeneratingCode || isExtracting || extractMutation.isPending;

  // 이력 버튼 표시 조건 (1회 이상 추출 완료)
  const showHistoryButton = uiState !== 'idle' && versions.length > 0;

  // 디스크립션 추출 핸들러
  const handleExtract = React.useCallback(() => {
    setIsExtracting(true);

    const payload: {
      room_id: string;
      current_code?: string;
      current_code_path?: string;
      edit_history?: { original: string; edited: string };
    } = {
      room_id: roomId,
    };

    // 최신 생성 코드 포함
    if (generatedCode) {
      payload.current_code = generatedCode.content;
      payload.current_code_path = generatedCode.path;
    }

    // 편집 이력 자동 포함
    if (editHistory) {
      payload.edit_history = {
        original: editHistory.original_content,
        edited: editHistory.edited_content,
      };
    }

    extractMutation.mutate(payload, {
      onSuccess: (data) => {
        setCurrentDescription(data);
      },
      onError: () => {
        setIsExtracting(false);
      },
    });
  }, [
    roomId,
    generatedCode,
    editHistory,
    extractMutation,
    setIsExtracting,
    setCurrentDescription,
  ]);

  // 편집 중 스타일
  const isEditing = uiState === 'editing';

  return (
    <div
      className={cn(
        'border-border flex items-center gap-2 border-t px-3 py-2',
        isEditing && 'border-t-orange-400 border-t-2'
      )}
    >
      {/* 좌측: 추출/편집 중 버튼 */}
      {isEditing ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-orange-600 hover:text-orange-700"
          disabled
        >
          <HugeiconsIcon icon={File02Icon} className="size-4" strokeWidth={2} />
          편집 중
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExtract}
          disabled={isExtractDisabled}
        >
          {isExtracting || extractMutation.isPending ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin"
              strokeWidth={2}
            />
          ) : (
            <HugeiconsIcon
              icon={File02Icon}
              className="size-4"
              strokeWidth={2}
            />
          )}
          디스크립션 추출
        </Button>
      )}

      {/* 우측: 생성 이력 버튼 */}
      {showHistoryButton && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={openHistory}
        >
          <HugeiconsIcon icon={Clock01Icon} className="size-4" strokeWidth={2} />
          생성 이력
        </Button>
      )}
    </div>
  );
}

export { DescriptionActionBar };
export type { DescriptionActionBarProps };
