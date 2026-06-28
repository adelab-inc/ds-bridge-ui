import {
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { transferErrorMessage } from '@/lib/utils';
import { roomKeys } from './roomKeys';
import { messageKeys } from './messageKeys';
import type { ChatRoom } from '@packages/shared-types/typescript/database/types';

export interface MoveRoomVariables {
  roomId: string;
  targetUserId: string;
}

type UseMoveRoomOptions = Omit<
  UseMutationOptions<ChatRoom, Error, MoveRoomVariables, unknown>,
  'mutationFn'
>;

/**
 * POST /api/rooms/{id}/move — 방 소유권을 대상 유저에게 이관.
 *
 * 이관 후 방은 **내 목록에서 사라진다** → roomKeys.all 무효화 + 상세/메시지
 * 캐시 제거 필수. 현재 보던 방을 이관한 경우의 네비게이션은 호출부(header)에서
 * onMoved 콜백으로 처리한다.
 * 실패 시 status를 한글 메시지로 변환해 throw (transferErrorMessage).
 */
export function useMoveRoom(mutationOptions?: UseMoveRoomOptions) {
  const queryClient = useQueryClient();

  return useMutation<ChatRoom, Error, MoveRoomVariables>({
    mutationFn: async ({ roomId, targetUserId }): Promise<ChatRoom> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) {
        throw new Error(transferErrorMessage(401, 'move'));
      }

      const response = await fetch(`/api/rooms/${roomId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });

      if (!response.ok) {
        throw new Error(transferErrorMessage(response.status, 'move'));
      }

      return response.json();
    },
    onSuccess: (_data, { roomId }) => {
      // 이관된 방은 더 이상 내 것이 아니므로 상세/메시지 캐시 제거 + 목록 재조회
      queryClient.removeQueries({ queryKey: roomKeys.detail(roomId) });
      queryClient.removeQueries({ queryKey: messageKeys.byRoom(roomId) });
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
    },
    ...mutationOptions,
  });
}
