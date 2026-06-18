/**
 * 룸(채팅방) 관련 TanStack Query 키의 단일 진실 원천(SSOT).
 *
 * - all:    ['rooms'] — 전체 무효화/목록 prefix
 * - detail: ['rooms', id] — 특정 룸 상세
 *
 * 룸 목록 쿼리는 `['rooms', 'list', uid]` 형태로 uid 스코핑됨(useRoomsList).
 */
export const roomKeys = {
  all: ['rooms'] as const,
  detail: (id: string) => [...roomKeys.all, id] as const,
};
