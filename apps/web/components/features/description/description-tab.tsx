'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { FileTextIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { useDescriptionStore } from '@/stores/useDescriptionStore';

interface DescriptionTabProps {
  roomId: string;
}

/**
 * 디스크립션 모드 탭 루트 컴포넌트 (stub)
 * 후속 커밋에서 uiState 기반 분기로 확장 예정
 */
function DescriptionTab({ roomId }: DescriptionTabProps) {
  const { setActiveTab } = useDescriptionStore();

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

export { DescriptionTab };
export type { DescriptionTabProps };
