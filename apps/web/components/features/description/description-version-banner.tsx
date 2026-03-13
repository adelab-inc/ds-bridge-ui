'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { DescriptionReason } from '@ds-hub/shared-types/typescript/database/description';

interface DescriptionVersionBannerProps {
  version: number;
  reason: DescriptionReason;
  isLatest: boolean;
  isEditing: boolean;
}

/** 생성 사유 → 표시 텍스트 매핑 */
const reasonLabels: Record<DescriptionReason, string> = {
  initial: '최초 생성',
  regenerated_with_edits: '편집 이력 반영 재생성',
  regenerated: '재생성',
};

/**
 * 디스크립션 버전 배너
 * - viewing: 파란/초록 배경 + v{n} + 최신 뱃지 + 생성 사유
 * - editing: 주황 배경 + 편집 중 + v{n} 기반 수정
 */
function DescriptionVersionBanner({
  version,
  reason,
  isLatest,
  isEditing,
}: DescriptionVersionBannerProps) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 border-b border-orange-200 bg-orange-50 px-4 py-2 dark:border-orange-800 dark:bg-orange-950/30">
        <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400">
          편집 중
        </Badge>
        <span className="text-muted-foreground text-xs">
          v{version} 기반 수정
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b px-4 py-2',
        isLatest
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
      )}
    >
      <Badge
        variant="outline"
        className={cn(
          isLatest
            ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
            : 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400'
        )}
      >
        v{version}
      </Badge>
      {isLatest && (
        <Badge variant="secondary" className="text-xs">
          최신
        </Badge>
      )}
      <span className="text-muted-foreground text-xs">
        {reasonLabels[reason]}
      </span>
    </div>
  );
}

export { DescriptionVersionBanner };
export type { DescriptionVersionBannerProps };
