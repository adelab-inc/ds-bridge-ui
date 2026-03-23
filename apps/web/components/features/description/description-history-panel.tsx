'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Copy01Icon,
  Tick01Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDescriptionStore } from '@/stores/useDescriptionStore';
import {
  useDescriptionVersions,
  useDescriptionVersion,
} from '@/hooks/api/useDescriptionQuery';
import { DescriptionHistoryItem } from './description-history-item';
import { TypedMarkdown } from '@/components/ui/typed-markdown';

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
  const { data: selectedVersion } = useDescriptionVersion(roomId, selectedId);

  // 복사 상태
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    const text = selectedVersion?.edited_content ?? selectedVersion?.content;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [selectedVersion]);

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
      <ScrollArea className="max-h-60 shrink-0 border-b">
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
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedVersion ? (
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                v{selectedVersion.version} 미리보기
              </span>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                <HugeiconsIcon
                  icon={isCopied ? Tick01Icon : Copy01Icon}
                  className="size-4"
                  strokeWidth={2}
                />
                {isCopied ? '복사됨' : '복사'}
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TypedMarkdown>
                {selectedVersion.edited_content ??
                  selectedVersion.content ??
                  ''}
              </TypedMarkdown>
            </div>
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
