'use client';

import * as React from 'react';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';

interface UseChatScrollParams {
  /** 표시 중인 메시지 목록 (시간 오름차순: 위=오래됨, 아래=최신) */
  messages: ChatMessage[];
  /** 더 오래된 페이지가 남아 있는지 (TanStack hasNextPage) */
  hasMore: boolean;
  /** 이전 페이지 로드가 진행 중인지 (TanStack isFetchingNextPage) */
  isLoadingMore: boolean;
  /** 더 오래된 메시지 페이지를 불러오는 함수 (TanStack fetchNextPage) */
  onLoadMore: () => void;
}

/**
 * 채팅 메시지 목록의 스크롤 동작을 한 곳에서 관리하는 훅.
 *
 * 세 가지 동작이 공유 ref로 긴밀히 얽혀 있어 단일 훅으로 묶었다:
 *  1. 하단 자동 추적 — 초기 진입 / 하단에 새 메시지·스트리밍 추가 시 맨 아래로 스크롤
 *  2. 상단 무한 스크롤 — 최상단 sentinel이 보이면 더 오래된 페이지 로드
 *  3. 스크롤 위치 보존(anchoring) — 위쪽에 메시지를 prepend해도 보던 위치가 점프하지 않게 복원
 *
 * 반환된 ref들을 ScrollArea의 viewport / 목록 상단 / 목록 하단에 각각 연결한다.
 */
export function useChatScroll({
  messages,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: UseChatScrollParams) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const topSentinelRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // 초기 하단 스크롤이 끝났는지 — 끝나기 전에는 상단 옵저버가 동작하지 않음
  // (20+ 룸 진입 시 sentinel이 잠깐 상단에 보여 page2를 자동 당기는 것 방지)
  const didInitialScrollRef = React.useRef(false);
  // prepend(이전 메시지 로드)가 진행 중인지 — anchoring 복원 대상 표시
  const isPrependingRef = React.useRef(false);
  // prepend 직전 viewport.scrollHeight (복원 기준값)
  const prevScrollHeightRef = React.useRef(0);

  // 직전 렌더의 첫 메시지 id / 길이 — prepend(위에 추가) 판별용
  const prevFirstIdRef = React.useRef<string | undefined>(undefined);
  const prevLenRef = React.useRef(0);

  // onLoadMore를 ref로 안정화 (옵저버를 매번 재생성하지 않기 위함)
  const onLoadMoreRef = React.useRef(onLoadMore);
  React.useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  const firstId = messages[0]?.id;
  const len = messages.length;

  // 스크롤 위치 제어: prepend 진행 중이면 anchoring, 그 외 모든 변경은 하단 추적
  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (isPrependingRef.current) {
      // 위쪽에 더 오래된 메시지가 실제로 추가됐으면(첫 id 변경 + 길이 증가)
      // 늘어난 높이만큼 scrollTop을 더해 보던 위치를 유지(점프 방지).
      if (
        viewport &&
        firstId !== prevFirstIdRef.current &&
        len > prevLenRef.current
      ) {
        viewport.scrollTop +=
          viewport.scrollHeight - prevScrollHeightRef.current;
      }
      // 로드가 끝나면 플래그 해제. 빈 페이지(더 이상 없음)가 와도 잠기지 않도록
      // prepend 감지 여부와 무관하게 isLoadingMore가 false면 해제한다.
      if (!isLoadingMore) {
        isPrependingRef.current = false;
      }
    } else if (len > 0) {
      // 초기 로드 / 하단 새 메시지 / 스트리밍 청크(내용만 증가) 모두 하단으로.
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'instant' });
      didInitialScrollRef.current = true;
    }

    prevFirstIdRef.current = firstId;
    prevLenRef.current = len;
  }, [messages, firstId, len, isLoadingMore]);

  // 상단 sentinel 교차 감지 → 더 오래된 페이지 로드
  React.useEffect(() => {
    const viewport = viewportRef.current;
    const sentinel = topSentinelRef.current;
    if (!viewport || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!didInitialScrollRef.current) return; // 마운트 직후 자동 fetch 방지
        if (!hasMore || isLoadingMore) return;
        if (isPrependingRef.current) return; // 이미 진행 중

        // anchoring 기준 높이 저장 후 로드 시작
        prevScrollHeightRef.current = viewport.scrollHeight;
        isPrependingRef.current = true;
        onLoadMoreRef.current();
      },
      // 최상단에 닿기 약간 전에 미리 로드
      { root: viewport, rootMargin: '200px 0px 0px 0px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  return { viewportRef, topSentinelRef, bottomRef };
}
