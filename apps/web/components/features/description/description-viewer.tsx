'use client';

import { useDescriptionStore } from '@/stores/useDescriptionStore';

/**
 * 디스크립션 읽기 전용 뷰어
 */
function DescriptionViewer() {
  const currentContent = useDescriptionStore((s) => s.currentContent);

  return (
    <div className="flex-1 overflow-hidden p-4">
      <textarea
        readOnly
        value={currentContent ?? ''}
        className="bg-transparent text-foreground h-full min-h-[180px] w-full resize-none border-none text-sm leading-relaxed outline-none"
        rows={10}
      />
    </div>
  );
}

export { DescriptionViewer };
