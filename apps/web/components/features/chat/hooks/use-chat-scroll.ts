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
  /** 더 오래된 메시지 페이지를 불러오는 함수 (TanStack fetchNextPage). Promise를 반환하면 완료까지 중복 요청을 막는다 */
  onLoadMore: () => unknown;
}

/**
 * 채팅 메시지 목록의 스크롤 동작을 한 곳에서 관리하는 훅.
 *
 * 세 가지 동작이 공유 ref로 긴밀히 얽혀 있어 단일 훅으로 묶었다:
 *  1. 하단 자동 추적 — 초기 진입 / 하단에 새 메시지·스트리밍 추가 시 맨 아래로 스크롤
 *  2. 상단 무한 스크롤 — 최상단 sentinel이 보이면 더 오래된 페이지 로드
 *  3. 스크롤 위치 보존(anchoring) — 위쪽 내용이 바뀌어도(이전 페이지 prepend, refetch로 상단
 *     트림) 보던 위치가 점프하지 않게 scrollTop을 보정. 목록 viewport는 브라우저 기본
 *     scroll anchoring을 꺼둔 상태(`overflow-anchor: none`)여야 이중 보정이 없다.
 *
 * 반환된 ref들을 ScrollArea의 viewport / 목록 상단 / 목록 하단에 각각 연결한다.
 * `loadMore`는 "이전 메시지 더 보기" 버튼 등 수동 트리거용 — 옵저버와 같은 중복 방지를
 * 거치므로 `onLoadMore`를 직접 호출하지 말고 이것을 쓴다.
 *
 * 목록이 `display:none`(디자인 탭 비활성, 패널 접힘)으로 마운트되면 viewport 크기가 0이라
 * IntersectionObserver가 동작하지 않고 초기 하단 스크롤도 no-op이 된다. 이를 위해
 * ResizeObserver로 가시성을 추적해 보일 때 옵저버를 (재)등록하고 하단 스크롤을 다시 적용한다.
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
  // 사용자가 하단 근처에 있는지 — 하단 추적(scrollIntoView)은 이 경우에만, 위쪽 변화 보정은
  // 이 경우가 아닐 때만 수행한다. 초기값 true(최초 하단 스크롤용).
  const isNearBottomRef = React.useRef(true);
  // 이전 페이지 로드 요청이 진행 중인지 — 중복 요청 방지 전용 (anchoring과 무관)
  const isLoadRequestedRef = React.useRef(false);
  // 직전 커밋의 viewport.scrollHeight — 위쪽 변화 보정 기준값. 매 커밋마다 갱신하므로
  // 요청 시점과 도착 시점 사이에 스트리밍 등으로 높이가 변해도 그만큼은 보정에 섞이지 않는다.
  const prevScrollHeightRef = React.useRef(0);

  // 직전 렌더의 첫 메시지 id / 길이 — 위쪽 변화(prepend·상단 트림) 판별용
  const prevFirstIdRef = React.useRef<string | undefined>(undefined);
  const prevLenRef = React.useRef(0);

  // onLoadMore를 ref로 안정화 (옵저버를 매번 재생성하지 않기 위함)
  const onLoadMoreRef = React.useRef(onLoadMore);
  React.useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // viewport 가시성 — display:none(탭 비활성/패널 접힘)이면 clientHeight가 0
  const [isViewportVisible, setIsViewportVisible] = React.useState(false);

  const firstId = messages[0]?.id;
  const len = messages.length;
  const hasMessages = len > 0;

  // 이전 페이지 로드 요청 (옵저버 콜백 + 수동 버튼 공용).
  // 요청이 끝날 때까지 중복 호출을 막는다. fetchNextPage가 실제로 요청하지 않고 즉시 resolve
  // 되는 경우(hasNextPage가 막 false로 바뀐 직후 등)에도 finally에서 풀리므로 잠기지 않는다.
  const requestLoadMore = React.useCallback(() => {
    if (isLoadRequestedRef.current) return;
    isLoadRequestedRef.current = true;
    Promise.resolve(onLoadMoreRef.current()).finally(() => {
      isLoadRequestedRef.current = false;
    });
  }, []);

  // 스크롤 위치 제어: 위쪽 변화면 anchoring, 그 외에는 하단 추적
  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const firstIdChanged = firstId !== prevFirstIdRef.current;

    if (
      viewport &&
      len > 0 &&
      prevLenRef.current > 0 && // 최초 채움(0→N)은 아래 하단 스크롤로
      firstIdChanged &&
      !isNearBottomRef.current
    ) {
      // 첫 메시지가 바뀌었다 = 위쪽에 prepend(이전 페이지) 또는 상단 트림(refetch로 오래된
      // 페이지가 잘림). 사용자가 히스토리를 읽는 중이면 늘어난/줄어든 높이만큼 scrollTop을
      // 더해 보던 위치를 유지한다.
      viewport.scrollTop += viewport.scrollHeight - prevScrollHeightRef.current;
    } else if (
      len > 0 &&
      (!didInitialScrollRef.current || isNearBottomRef.current)
    ) {
      // 초기 1회는 무조건 하단으로. 이후엔 사용자가 하단 근처일 때만 추적
      // (하단 새 메시지 / 스트리밍 청크). 위로 스크롤해 히스토리를 읽는 중엔
      // 새 메시지가 와도 끌려 내려가지 않는다.
      // 숨김 상태(clientHeight 0)에선 scrollIntoView가 no-op이므로 완료로 기록하지 않고,
      // isViewportVisible 전환으로 이 effect가 다시 돌 때 수행한다.
      if (viewport && viewport.clientHeight > 0) {
        bottomRef.current?.scrollIntoView({
          block: 'end',
          behavior: 'instant',
        });
        didInitialScrollRef.current = true;
      }
    }

    prevFirstIdRef.current = firstId;
    prevLenRef.current = len;
    if (viewport) prevScrollHeightRef.current = viewport.scrollHeight;
  }, [messages, firstId, len, isLoadingMore, isViewportVisible]);

  // viewport 가시성 추적 — 탭 전환/패널 접힘으로 0x0 ↔ 실제 크기 전환을 감지
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = () => setIsViewportVisible(viewport.clientHeight > 0);
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    // ResizeObserver는 0x0 요소에 초기 알림을 주지 않으므로 1회 즉시 계산
    update();
    return () => observer.disconnect();
    // viewport는 메시지가 생긴 뒤에야 마운트되므로(빈 상태에선 ScrollArea 미렌더) hasMessages 전환 시 재실행
  }, [hasMessages]);

  // 상단 sentinel 교차 감지 → 더 오래된 페이지 로드.
  // 숨김 상태에선 옵저버를 만들지 않고, 보이게 되면 새로 등록한다.
  React.useEffect(() => {
    const viewport = viewportRef.current;
    const sentinel = topSentinelRef.current;
    if (!viewport || !sentinel || !isViewportVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!didInitialScrollRef.current) return; // 마운트 직후 자동 fetch 방지
        if (!hasMore || isLoadingMore) return;
        requestLoadMore();
      },
      // 최상단에 닿기 약간 전에 미리 로드
      { root: viewport, rootMargin: '200px 0px 0px 0px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isViewportVisible, requestLoadMore]);

  // 사용자의 하단 근접 여부 추적 — 하단 추적/보정 게이트(isNearBottomRef)에 사용.
  // 하단에서 80px 이내면 "하단 근처"로 본다.
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const NEAR_BOTTOM_THRESHOLD = 80;
    const update = () => {
      isNearBottomRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        NEAR_BOTTOM_THRESHOLD;
    };

    update(); // 초기값 1회 계산
    viewport.addEventListener('scroll', update, { passive: true });
    return () => viewport.removeEventListener('scroll', update);
    // hasMessages 전환 시 재실행 — viewport는 메시지가 생긴 뒤에야 마운트되므로
    // (빈 상태에선 ScrollArea 미렌더) 첫 메시지 도착 시 리스너를 붙인다.
  }, [hasMessages]);

  return { viewportRef, topSentinelRef, bottomRef, loadMore: requestLoadMore };
}
