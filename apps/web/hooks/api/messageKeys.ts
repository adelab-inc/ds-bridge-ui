/**
 * 페이지네이션 메시지 쿼리 키 SSOT.
 *
 * - `byRoom`: invalidate/remove용 prefix (pageSize/startAfter 변형 전부 매칭).
 * - `list`: 무한쿼리 full key (페이징 파라미터 포함).
 * - `count`: 룸 총 메시지 수.
 * - `detail`: 단건 조회 (딥링크 `?mid=`가 로드된 페이지에 없을 때).
 *
 * prefix와 full을 분리 유지한다 — invalidate는 prefix 매칭으로
 * 모든 pageSize/startAfter 변형을 한 번에 잡아야 하므로 collapse 금지.
 * `count`/`detail`도 `byRoom` 하위에 두어 기존 invalidate/remove가 함께 갱신한다.
 */

/**
 * keyset 커서: (question_created_at, id).
 * 타임스탬프만 쓰면 같은 ms에 생성된 메시지가 `lt` 조건에서 건너뛰어질 수 있어
 * id를 2차 키로 함께 비교한다.
 */
export interface MessageCursor {
  /** question_created_at (ms) */
  ts: number;
  /** 메시지 id (UUID) */
  id: string;
}

export const messageKeys = {
  all: ['paginatedMessages'] as const,
  byRoom: (roomId: string) => [...messageKeys.all, roomId] as const,
  list: (roomId: string, pageSize: number, startAfter?: MessageCursor) =>
    [...messageKeys.byRoom(roomId), pageSize, startAfter] as const,
  count: (roomId: string) => [...messageKeys.byRoom(roomId), 'count'] as const,
  detail: (roomId: string, messageId: string) =>
    [...messageKeys.byRoom(roomId), 'detail', messageId] as const,
};
