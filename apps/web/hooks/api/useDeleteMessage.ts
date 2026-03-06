import {
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';

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
        throw new Error(`Failed to delete message: ${response.statusText}`);
      }
    },
    onSuccess: (_data, { roomId }) => {
      queryClient.invalidateQueries({
        queryKey: ['paginatedMessages', roomId],
      });
    },
    ...mutationOptions,
  });
}
