'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDescriptionStore } from '@/stores/useDescriptionStore';
import {
  useDescriptionVersions,
  useDescriptionVersion,
} from '@/hooks/api/useDescriptionQuery';
import { DescriptionHistoryItem } from './description-history-item';

interface DescriptionHistoryPanelProps {
  roomId: string;
}

/**
 * 생성 이력 패널
 * - 이력 목록 (최신 순) + 선택 시 미리보기
 */
function DescriptionHistoryPanel({ roomId }: DescriptionHistoryPanelProps) {
  const closeHistory = useDescriptionStore((s) => s.closeHistory);
  const setVersions = useDescriptionStore((s) => s.setVersions);

  const { data: versionsData } = useDescriptionVersions(roomId);
  const versions = versionsData?.versions ?? [];

  // 버전 목록을 스토어에 동기화
  React.useEffect(() => {
    if (versions.length > 0) {
      setVersions(versions);
    }
  }, [versions, setVersions]);

  // 선택된 버전 ID
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // 선택된 버전 상세 조회
  const { data: selectedVersion } = useDescriptionVersion(
    roomId,
    selectedId
  );

  // 최신 버전 번호
  const latestVersion = versions.length > 0 ? versions[0].version : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 헤더 */}
      <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
        <h3 className="text-sm font-medium">생성 이력</h3>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={closeHistory}
          aria-label="이력 패널 닫기"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            className="size-4"
            strokeWidth={2}
          />
        </Button>
      </div>

      {/* 이력 목록 */}
      <ScrollArea className="max-h-[40%] shrink-0 border-b">
        {versions.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-xs">
            생성 이력이 없습니다
          </p>
        ) : (
          versions.map((v) => (
            <DescriptionHistoryItem
              key={v.id}
              version={v}
              isLatest={v.version === latestVersion}
              isSelected={v.id === selectedId}
              onClick={() => setSelectedId(v.id)}
            />
          ))
        )}
      </ScrollArea>

      {/* 미리보기 */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {selectedVersion ? (
          <div className="flex flex-1 flex-col p-4">
            <div className="text-muted-foreground mb-2 text-xs">
              v{selectedVersion.version} 미리보기
            </div>
            <textarea
              readOnly
              value={selectedVersion.content}
              className="bg-transparent text-foreground h-full min-h-[120px] w-full resize-none border-none text-sm leading-relaxed outline-none"
              rows={8}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center py-12">
            <p className="text-muted-foreground text-xs">
              버전을 선택하면 미리보기가 표시됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export { DescriptionHistoryPanel };
export type { DescriptionHistoryPanelProps };
