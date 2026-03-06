'use client';

import {
  InfiniteData,
  UndefinedInitialDataInfiniteOptions,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { TABLES } from '@packages/shared-types/typescript/database/collections';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';

const PAGE_SIZE_DEFAULT = 20;

/**
 * Supabase에서 페이지네이션된 메시지를 가져오는 함수
 */
const fetchMessages = async ({
  roomId,
  pageSize,
  pageParam,
}: {
  roomId: string;
  pageSize: number;
  pageParam?: number;
}): Promise<ChatMessage[]> => {
  const supabase = createClient();

  let query = supabase
    .from(TABLES.CHAT_MESSAGES)
    .select('*')
    .eq('room_id', roomId)
    .order('question_created_at', { ascending: false })
    .limit(pageSize);

  // 커서 기반 페이지네이션: 이전 페이지의 마지막 타임스탬프보다 이전 메시지만
  if (pageParam) {
    query = query.lt('question_created_at', pageParam);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  // 시간순 정렬 (desc로 가져온 것을 asc로 뒤집기)
  return (data as ChatMessage[]).reverse();
};

/**
 * 무한 스크롤 페이지네이션을 지원하는 Supabase 메시지 fetch 훅
 *
 * @example
 * const { data, fetchNextPage, hasNextPage, isLoading, refetch } = useGetPaginatedMessages({
 *   roomId: 'room-123',
 *   pageSize: 20,
 * });
 */
export const useGetPaginatedMessages = ({
  roomId,
  pageSize = PAGE_SIZE_DEFAULT,
  startAfter,
  infiniteQueryOptions,
}: {
  roomId: string;
  pageSize?: number;
  startAfter?: number;
  infiniteQueryOptions?: Partial<
    UndefinedInitialDataInfiniteOptions<
      ChatMessage[],
      Error,
      InfiniteData<ChatMessage[], unknown>
    >
  >;
}) => {
  return useInfiniteQuery({
    queryKey: ['paginatedMessages', roomId, pageSize, startAfter],
    queryFn: ({ pageParam }) =>
      fetchMessages({
        roomId,
        pageSize,
        pageParam: pageParam as number,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.length < pageSize) {
        return undefined;
      }
      // 가장 오래된 메시지의 타임스탬프를 다음 페이지의 시작점으로 사용
      const oldestMessage = lastPage[0];
      return oldestMessage?.question_created_at;
    },
    initialPageParam: startAfter,
    staleTime: 5 * 60 * 1000, // 5분
    ...infiniteQueryOptions,
  });
};
