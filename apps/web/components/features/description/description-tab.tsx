'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { FileTextIcon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { useDescriptionStore } from '@/stores/useDescriptionStore';
import { useLatestDescription } from '@/hooks/api/useDescriptionQuery';
import { DescriptionViewer } from './description-viewer';

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

  // 최신 디스크립션 조회 (마운트 시 자동 fetch)
  const { data: latestDescription } = useLatestDescription(roomId);

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
        <DescriptionViewer />
      </div>
    );
  }

  // editing: 편집 모드 (후속 커밋에서 DescriptionEditor로 교체)
  if (uiState === 'editing') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DescriptionViewer />
      </div>
    );
  }

  // history: 이력 패널 (후속 커밋에서 DescriptionHistoryPanel로 교체)
  if (uiState === 'history') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-muted-foreground text-sm">생성 이력 (구현 예정)</p>
      </div>
    );
  }

  return null;
}

export { DescriptionTab };
export type { DescriptionTabProps };
