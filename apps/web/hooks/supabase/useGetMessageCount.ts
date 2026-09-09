'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { TABLES } from '@packages/shared-types/typescript/database/collections';
import { messageKeys } from '@/hooks/api/messageKeys';
import { STALE_TIME, GC_TIME } from '@/lib/query/cache-config';

/**
 * 룸의 총 메시지 수 (HEAD + count=exact, 본문 전송 없음).
 *
 * 키가 `messageKeys.byRoom` 하위라 메시지 삭제/룸 이동 등 기존 invalidate가 함께 갱신한다.
 * 스트리밍 완료 후에는 chat-section이 목록 refetch와 함께 명시적으로 refetch한다.
 */
export function useGetMessageCount(roomId: string) {
  return useQuery({
    queryKey: messageKeys.count(roomId),
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from(TABLES.CHAT_MESSAGES)
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId);

      if (error) {
        throw new Error(`Failed to count messages: ${error.message}`);
      }
      return count ?? 0;
    },
    enabled: !!roomId,
    staleTime: STALE_TIME.MESSAGES,
    gcTime: GC_TIME.MESSAGES,
  });
}
