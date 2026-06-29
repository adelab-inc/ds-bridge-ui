import {
  useMutation,
  UseMutationOptions,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { transferErrorMessage } from '@/lib/utils';
import type { ChatRoom } from '@packages/shared-types/typescript/database/types';

export interface CopyRoomVariables {
  roomId: string;
  /**
   * 복제 대상 유저. **생략하면 자기복제** — 본인(방 소유자) 소유의 사본을 만든다.
   * (서버가 owner_id로 폴백. PR #171)
   */
  targetUserId?: string;
}

type UseCopyRoomOptions = Omit<
  UseMutationOptions<ChatRoom, Error, CopyRoomVariables, unknown>,
  'mutationFn'
>;

/**
 * POST /api/rooms/{id}/copy — 방을 대상 유저에게 복제.
 *
 * `targetUserId` 생략 시 자기복제(본인 소유 사본). `JSON.stringify`가 undefined
 * 키를 떨어뜨려 본문이 `{}`가 되고, 서버는 owner_id로 폴백한다(PR #171).
 *
 * copy-to-other(대상 지정)는 새 방이 **대상 유저 소유**라 내 목록이 변하지 않아
 * roomKeys 무효화가 불필요하다. 반면 자기복제는 내 목록에 사본이 생기므로
 * **호출부에서** `roomKeys.all`을 무효화해야 한다(여기서는 하지 않는다 —
 * `...mutationOptions` 스프레드가 caller의 onSuccess를 덮어쓰는 구조이기 때문).
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
