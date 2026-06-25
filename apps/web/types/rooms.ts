/**
 * 방 복제(copy)/이관(move) 및 멤버 목록 관련 타입.
 *
 * BE 엔드포인트: GET /users, POST /rooms/{id}/copy, POST /rooms/{id}/move
 * (handoff-room-copy-move.md 참조)
 */

/** 멤버(조직 유저) 목록 항목. `id`를 copy/move의 target_user_id로 사용. */
export interface OrgUser {
  /** = user_id. copy/move의 target_user_id로 그대로 사용. */
  id: string;
  email: string;
  /** Google 로그인 유저만 보통 채워짐. 없으면 null. */
  name: string | null;
  avatar_url: string | null;
}

/** GET /users 응답 */
export interface UsersListResponse {
  users: OrgUser[];
  total: number;
}

/** POST /rooms/{id}/copy|move 요청 바디 */
export interface TransferRoomRequest {
  target_user_id: string;
}

/** copy/move 동작 구분 */
export type TransferAction = 'copy' | 'move';
