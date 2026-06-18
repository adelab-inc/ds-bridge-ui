import { useGetRoom } from '@/hooks/api/useRoomQuery';
import { useAuthStore } from '@/stores/useAuthStore';
import type { components } from '@ds-hub/shared-types/typescript/api/schema';

type RoomResponse = components['schemas']['RoomResponse'];

/**
 * room 소유권 판별 순수 유틸.
 * room·uid가 모두 존재하고 생성자(user_id)가 현재 사용자(uid)와 일치할 때만 true.
 */
export function isRoomOwner(
  room: Pick<RoomResponse, 'user_id'> | null | undefined,
  uid: string | null | undefined
): boolean {
  return !!room && !!uid && room.user_id === uid;
}

interface UseIsRoomOwnerReturn {
  /** 조회된 room (소유 여부와 무관, 로딩 전엔 undefined) */
  room: RoomResponse | undefined;
  /** 현재 사용자가 생성한 room인지 */
  isOwner: boolean;
  /** 남이 만든 room(공유 링크)인지 — room·uid 확정 후에만 true */
  isShared: boolean;
  /** room 조회 로딩 상태 */
  isLoading: boolean;
}

/**
 * URL의 crid 등으로 지정한 room이 현재 로그인 사용자 소유인지 판별한다.
 *
 * GET /api/rooms/{id} 는 인증만 검사하고 소유권 필터가 없어 어떤 room이든
 * user_id를 포함해 반환하므로, 남이 공유한 링크(`isShared`)도 식별할 수 있다.
 * 비교 기반은 `RoomResponse.user_id === useAuthStore.user.uid` —
 * useRoomsList의 `.eq('user_id', uid)` 필터와 동일한 ID 공간이다.
 *
 * 주의: 이 판별은 UX 표시용이며 보안 경계가 아니다. 실제 권한 차단은
 * 백엔드(삭제/수정 시 Authorization 검증)가 담당한다.
 */
export function useIsRoomOwner(
  roomId: string | null | undefined
): UseIsRoomOwnerReturn {
  const uid = useAuthStore((s) => s.user?.uid);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const { data: room, isLoading } = useGetRoom(roomId ?? null, {
    enabled: !!roomId && !isAuthLoading,
  });

  const isOwner = isRoomOwner(room, uid);
  const isShared = !!room && !!uid && room.user_id !== uid;

  return { room, isOwner, isShared, isLoading };
}
