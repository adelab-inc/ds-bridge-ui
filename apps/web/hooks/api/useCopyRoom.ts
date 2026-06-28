import {
  useMutation,
  UseMutationOptions,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { transferErrorMessage } from '@/lib/utils';
import type { ChatRoom } from '@packages/shared-types/typescript/database/types';

export interface CopyRoomVariables {
  roomId: string;
  targetUserId: string;
}

type UseCopyRoomOptions = Omit<
  UseMutationOptions<ChatRoom, Error, CopyRoomVariables, unknown>,
  'mutationFn'
>;

/**
 * POST /api/rooms/{id}/copy — 방을 대상 유저에게 복제.
 *
 * 새 방은 대상 유저 소유로 생성되므로 **내 방 목록은 변하지 않는다** →
 * roomKeys 무효화 불필요.
 * 실패 시 status를 한글 메시지로 변환해 throw (transferErrorMessage).
 */
export function useCopyRoom(mutationOptions?: UseCopyRoomOptions) {
  return useMutation<ChatRoom, Error, CopyRoomVariables>({
    mutationFn: async ({ roomId, targetUserId }): Promise<ChatRoom> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) {
        throw new Error(transferErrorMessage(401, 'copy'));
      }

      const response = await fetch(`/api/rooms/${roomId}/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });

      if (!response.ok) {
        throw new Error(transferErrorMessage(response.status, 'copy'));
      }

      return response.json();
    },
    ...mutationOptions,
  });
}
