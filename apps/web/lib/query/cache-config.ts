/**
 * TanStack Query 캐시 정책 SSOT.
 *
 * - `staleTime`: 재요청 없이 데이터를 신뢰하는 구간.
 * - `gcTime`: 비활성(구독 0) 캐시를 메모리에 보관하는 시간.
 * - 불변식: 항상 `gcTime >= staleTime`.
 *
 * 정책 방향: 신선도 우선(공격적). 서버(특히 AI 백그라운드)가 데이터를
 * 바꿔도 사용자가 stale 값을 오래 보지 않도록 staleTime을 짧게 두고,
 * 전역 refetchOnWindowFocus/Reconnect로 복귀 시 자동 갱신한다.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const STALE_TIME = {
  /** 룸 상세(BFF→AI). AI가 status 등을 바꿀 수 있어 짧게. */
  ROOM_DETAIL: 10 * SECOND,
  /** 룸 목록(Supabase, 헤더 드롭다운). 상세와 동일 tier로 divergence 제거. */
  ROOM_LIST: 10 * SECOND,
  /** 채팅 메시지(Supabase). realtime broadcast로도 동기화되므로 여유 있게. */
  MESSAGES: 1 * MINUTE,
  /** 디스크립션(BFF→AI). 편집/추출 직후 정확성이 중요해 항상 fresh. */
  DESCRIPTION: 0,
  /** 미지정 쿼리 전역 기본값. */
  DEFAULT: 30 * SECOND,
} as const;

export const GC_TIME = {
  DEFAULT: 5 * MINUTE,
  /** 무한쿼리(메시지) 페이지 재구축 비용을 줄이기 위해 길게. */
  MESSAGES: 10 * MINUTE,
} as const;
