'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useDescriptionStore } from '@/stores/useDescriptionStore';

/**
 * 디스크립션 편집 모드 뷰
 * editDraft를 바인딩하여 실시간 편집
 */
function DescriptionEditor() {
  const editDraft = useDescriptionStore((s) => s.editDraft);
  const updateEditDraft = useDescriptionStore((s) => s.updateEditDraft);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <textarea
          value={editDraft ?? ''}
          onChange={(e) => updateEditDraft(e.target.value)}
          className="bg-background text-foreground border-input w-full resize-none rounded-md border p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-orange-700"
          style={{ minHeight: '180px' }}
          rows={10}
          placeholder="디스크립션을 입력하세요..."
        />
      </div>
    </ScrollArea>
  );
}

export { DescriptionEditor };
