/**
 * 페이지네이션 메시지 쿼리 키 SSOT.
 *
 * - `byRoom`: invalidate/remove용 prefix (pageSize/startAfter 변형 전부 매칭).
 * - `list`: 무한쿼리 full key (페이징 파라미터 포함).
 *
 * prefix와 full을 분리 유지한다 — invalidate는 prefix 매칭으로
 * 모든 pageSize/startAfter 변형을 한 번에 잡아야 하므로 collapse 금지.
 */
export const messageKeys = {
  all: ['paginatedMessages'] as const,
  byRoom: (roomId: string) => [...messageKeys.all, roomId] as const,
  list: (roomId: string, pageSize: number, startAfter?: number) =>
    [...messageKeys.byRoom(roomId), pageSize, startAfter] as const,
};
