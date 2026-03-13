'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useDescriptionStore } from '@/stores/useDescriptionStore';

/**
 * 디스크립션 읽기 전용 뷰어
 */
function DescriptionViewer() {
  const currentContent = useDescriptionStore((s) => s.currentContent);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <textarea
          readOnly
          value={currentContent ?? ''}
          className="bg-transparent text-foreground w-full resize-none border-none text-sm leading-relaxed outline-none"
          style={{ minHeight: '180px' }}
          rows={10}
        />
      </div>
    </ScrollArea>
  );
}

export { DescriptionViewer };
