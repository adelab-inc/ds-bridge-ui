'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * selectedMessageId 로컬 상태 + URL `?mid=` 파라미터 동기화 훅.
 *
 * - 초기값은 현재 URL의 `mid` 파라미터
 * - 외부에서 URL이 변경되면(룸 전환 등) 로컬 상태를 즉시 동기화
 * - `updateSelectedMessageId` 호출 시 로컬 상태 + URL 모두 갱신 (pushState 대신 replaceState)
 */
export function useSelectedMessage() {
  const searchParams = useSearchParams();

  const [selectedMessageId, setSelectedMessageId] = React.useState<
    string | null
  >(() => searchParams.get('mid'));

  // 외부 URL 변경 시 로컬 상태 동기화 (룸 전환 등)
  const urlMid = searchParams.get('mid');
  React.useEffect(() => {
    setSelectedMessageId(urlMid);
  }, [urlMid]);

  const updateSelectedMessageId = React.useCallback(
    (messageId: string | null) => {
      setSelectedMessageId(messageId);
      const url = new URL(window.location.href);
      if (messageId) {
        url.searchParams.set('mid', messageId);
      } else {
        url.searchParams.delete('mid');
      }
      window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search
      );
    },
    []
  );

  return { selectedMessageId, updateSelectedMessageId };
}
