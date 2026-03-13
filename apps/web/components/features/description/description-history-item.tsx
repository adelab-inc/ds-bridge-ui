'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { DescriptionVersionSummary } from '@ds-hub/shared-types/typescript/database/description';

interface DescriptionHistoryItemProps {
  version: DescriptionVersionSummary;
  isLatest: boolean;
  isSelected: boolean;
  onClick: () => void;
}

/** 생성 사유 표시 텍스트 */
const reasonLabels: Record<string, string> = {
  initial: '최초 생성',
  regenerated_with_edits: '편집 이력 반영 재생성',
  regenerated: '재생성',
};

/** 상대 시간 포맷 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '방금 전';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

/**
 * 생성 이력 항목
 * - 버전 뱃지, 최신/이전 뱃지, 상대 시각, 생성 사유, 변경 태그
 */
function DescriptionHistoryItem({
  version,
  isLatest,
  isSelected,
  onClick,
}: DescriptionHistoryItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:bg-muted/50 flex w-full flex-col gap-1.5 border-b px-4 py-3 text-left transition-colors cursor-pointer',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            isLatest
              ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
              : 'border-border text-muted-foreground'
          )}
        >
          v{version.version}
        </Badge>
        {isLatest && (
          <Badge variant="secondary" className="text-xs">
            최신
          </Badge>
        )}
        <span className="text-muted-foreground ml-auto text-xs">
          {formatRelativeTime(version.created_at)}
        </span>
      </div>

      <p className="text-foreground text-xs">
        {reasonLabels[version.reason] ?? version.reason}
      </p>

      {version.change_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {version.change_tags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">
              {tag.label}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}

export { DescriptionHistoryItem };
export type { DescriptionHistoryItemProps };
