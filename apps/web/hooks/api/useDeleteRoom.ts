import {
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { roomKeys } from './useRoomQuery';

type UseDeleteRoomOptions = Omit<
  UseMutationOptions<void, Error, string, unknown>,
  'mutationFn'
>;

/**
 * DELETE /api/rooms/{roomId} - 채팅방 삭제
 */
export function useDeleteRoom(mutationOptions?: UseDeleteRoomOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string): Promise<void> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete room: ${response.statusText}`);
      }
    },
    onSuccess: (_data, roomId) => {
      queryClient.removeQueries({ queryKey: roomKeys.detail(roomId) });
      queryClient.removeQueries({
        queryKey: ['paginatedMessages', roomId],
      });
    },
    ...mutationOptions,
  });
}
