import {
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { deleteErrorMessage } from '@/lib/utils';
import { messageKeys } from './messageKeys';

interface DeleteMessageParams {
  roomId: string;
  messageId: string;
}

type UseDeleteMessageOptions = Omit<
  UseMutationOptions<void, Error, DeleteMessageParams, unknown>,
  'mutationFn'
>;

/**
 * DELETE /api/rooms/{roomId}/messages/{messageId} - 메시지 삭제
 */
export function useDeleteMessage(mutationOptions?: UseDeleteMessageOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomId,
      messageId,
    }: DeleteMessageParams): Promise<void> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `/api/rooms/${roomId}/messages/${messageId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        // 401(미인증)·403(타인 메시지) 등은 사용자용 한글 메시지로 변환
        throw new Error(deleteErrorMessage(response.status, 'message'));
      }
    },
    onSuccess: (_data, { roomId }) => {
      queryClient.invalidateQueries({
        queryKey: messageKeys.byRoom(roomId),
      });
    },
    ...mutationOptions,
  });
}
