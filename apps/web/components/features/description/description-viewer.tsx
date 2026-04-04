'use client';

import { TypedMarkdown } from '@/components/ui/typed-markdown';
import { useDescriptionStore } from '@/stores/useDescriptionStore';

/**
 * 디스크립션 읽기 전용 뷰어
 */
function DescriptionViewer() {
  const currentContent = useDescriptionStore((s) => s.currentContent);

  return (
    <div className="flex-1 overflow-auto p-4">
      <TypedMarkdown>{currentContent ?? ''}</TypedMarkdown>
    </div>
  );
}

export { DescriptionViewer };
