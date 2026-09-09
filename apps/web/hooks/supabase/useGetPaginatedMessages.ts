'use client';

import {
  InfiniteData,
  QueryKey,
  UndefinedInitialDataInfiniteOptions,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { TABLES } from '@packages/shared-types/typescript/database/collections';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';
import { messageKeys, type MessageCursor } from '@/hooks/api/messageKeys';
import { STALE_TIME, GC_TIME } from '@/lib/query/cache-config';

const PAGE_SIZE_DEFAULT = 20;

/** 무한쿼리 한 페이지 */
export interface MessagesPage {
  /** 시간 오름차순 (위=오래됨, 아래=최신) */
  messages: ChatMessage[];
  /** 더 오래된 페이지가 있으면 그 시작 커서, 없으면 null */
  nextCursor: MessageCursor | null;
}

/**
 * Supabase에서 페이지네이션된 메시지를 가져오는 함수
 *
 * - `pageSize + 1`개를 조회해 다음 페이지 존재 여부를 판정한다 (총 건수가 pageSize의
 *   배수일 때 빈 요청이 한 번 더 나가는 것을 방지).
 * - 커서는 (question_created_at, id) keyset — 같은 ms 메시지 누락 방지.
 */
const fetchMessages = async ({
  roomId,
  pageSize,
  cursor,
}: {
  roomId: string;
  pageSize: number;
  cursor?: MessageCursor;
}): Promise<MessagesPage> => {
  const supabase = createClient();

  let query = supabase
    .from(TABLES.CHAT_MESSAGES)
    .select('*')
    .eq('room_id', roomId)
    .order('question_created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  // 커서 기반 페이지네이션: 이전 페이지의 가장 오래된 메시지보다 이전 메시지만.
  // 같은 타임스탬프면 id로 2차 비교 (uuid 문자열 순 = 정렬 순).
  if (cursor) {
    query = query.or(
      `question_created_at.lt.${cursor.ts},and(question_created_at.eq.${cursor.ts},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  const rows = (data ?? []) as ChatMessage[];
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  // desc 조회 기준 마지막 = 가장 오래된 메시지
  const oldest = pageRows[pageRows.length - 1];

  return {
    // 시간순 정렬 (desc로 가져온 것을 asc로 뒤집기)
    messages: [...pageRows].reverse(),
    nextCursor:
      hasMore && oldest
        ? { ts: oldest.question_created_at, id: oldest.id }
        : null,
  };
};

/**
 * 무한 스크롤 페이지네이션을 지원하는 Supabase 메시지 fetch 훅
 *
 * @example
 * const { data, fetchNextPage, hasNextPage, isLoading, refetch } = useGetPaginatedMessages({
 *   roomId: 'room-123',
 *   pageSize: 20,
 * });
 * const messages = [...data.pages].reverse().flatMap((p) => p.messages);
 */
export const useGetPaginatedMessages = ({
  roomId,
  pageSize = PAGE_SIZE_DEFAULT,
  startAfter,
  infiniteQueryOptions,
}: {
  roomId: string;
  pageSize?: number;
  startAfter?: MessageCursor;
  infiniteQueryOptions?: Partial<
    UndefinedInitialDataInfiniteOptions<
      MessagesPage,
      Error,
      InfiniteData<MessagesPage, MessageCursor | undefined>,
      QueryKey,
      MessageCursor | undefined
    >
  >;
}) => {
  return useInfiniteQuery({
    queryKey: messageKeys.list(roomId, pageSize, startAfter),
    queryFn: ({ pageParam }) =>
      fetchMessages({
        roomId,
        pageSize,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: startAfter,
    staleTime: STALE_TIME.MESSAGES,
    gcTime: GC_TIME.MESSAGES,
    ...infiniteQueryOptions,
  });
};
