'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { TABLES } from '@packages/shared-types/typescript/database/collections';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';
import { messageKeys } from '@/hooks/api/messageKeys';
import { STALE_TIME, GC_TIME } from '@/lib/query/cache-config';

/**
 * 메시지 단건 조회.
 *
 * 딥링크 `?mid=`가 첫 페이지(로드된 페이지)에 없을 때 프리뷰를 띄우기 위해 사용.
 * - `messageId`가 null이면 비활성.
 * - 없는 메시지(삭제됨/다른 룸)는 에러 대신 `null` (maybeSingle).
 * - 네트워크 일시 오류를 흡수하기 위해 1회만 재시도. 최종 실패는 `isError`로 노출되며
 *   호출 측(chat-section)이 URL의 mid를 보존한 채 처리한다.
 */
export function useGetMessageById({
  roomId,
  messageId,
}: {
  roomId: string;
  messageId: string | null;
}) {
  return useQuery({
    queryKey: messageKeys.detail(roomId, messageId ?? ''),
    queryFn: async (): Promise<ChatMessage | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(TABLES.CHAT_MESSAGES)
        .select('*')
        .eq('room_id', roomId)
        .eq('id', messageId!)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch message: ${error.message}`);
      }
      return (data as ChatMessage | null) ?? null;
    },
    enabled: !!roomId && !!messageId,
    retry: 1,
    staleTime: STALE_TIME.MESSAGES,
    gcTime: GC_TIME.MESSAGES,
  });
}
