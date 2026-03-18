'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Edit02Icon,
  Copy01Icon,
  Tick01Icon,
  Clock01Icon,
  Cancel01Icon,
  FloppyDiskIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import type { DescriptionUiState } from '@/stores/useDescriptionStore';

interface DescriptionToolbarProps {
  uiState: DescriptionUiState;
  /** 편집 시작 */
  onEdit: () => void;
  /** 저장 후 닫기 */
  onSave: () => void;
  /** 수정 취소 */
  onCancel: () => void;
  /** 복사 대상 텍스트 */
  copyText: string | null;
  /** 생성 이력 열기 */
  onOpenHistory: () => void;
  /** 이력 버튼 표시 여부 */
  showHistoryButton: boolean;
  /** 저장 비활성화 (빈 내용 or 변경 없음) */
  isSaveDisabled: boolean;
}

/**
 * 디스크립션 모드 툴바
 * - viewing: [수정하기], [복사], [생성 이력]
 * - editing: [저장 후 닫기], [수정 취소], [복사], [생성 이력]
 */
function DescriptionToolbar({
  uiState,
  onEdit,
  onSave,
  onCancel,
  copyText,
  onOpenHistory,
  showHistoryButton,
  isSaveDisabled,
}: DescriptionToolbarProps) {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    if (!copyText) return;
    await navigator.clipboard.writeText(copyText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [copyText]);

  const isEditing = uiState === 'editing';

  return (
    <div className="border-border flex items-center gap-1 border-b px-3 py-1.5">
      {/* 좌측 버튼 */}
      {isEditing ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={isSaveDisabled}
          >
            <HugeiconsIcon icon={FloppyDiskIcon} className="size-4" strokeWidth={2} />
            저장
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" strokeWidth={2} />
            수정 취소
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <HugeiconsIcon icon={Edit02Icon} className="size-4" strokeWidth={2} />
          수정하기
        </Button>
      )}

      {/* 우측 버튼 */}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={!copyText}
        >
          <HugeiconsIcon
            icon={isCopied ? Tick01Icon : Copy01Icon}
            className="size-4"
            strokeWidth={2}
          />
          {isCopied ? '복사됨' : '복사'}
        </Button>

        {showHistoryButton && (
          <Button variant="ghost" size="sm" onClick={onOpenHistory}>
            <HugeiconsIcon icon={Clock01Icon} className="size-4" strokeWidth={2} />
            생성 이력
          </Button>
        )}
      </div>
    </div>
  );
}

export { DescriptionToolbar };
export type { DescriptionToolbarProps };
