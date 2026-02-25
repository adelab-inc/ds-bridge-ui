import {
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';
import { useAuthStore } from '@/stores/useAuthStore';
import { roomKeys } from './useRoomQuery';

type UpdateRoomRequest =
  paths['/rooms/{room_id}']['patch']['requestBody']['content']['application/json'];
type UpdateRoomResponse =
  paths['/rooms/{room_id}']['patch']['responses']['200']['content']['application/json'];

interface UpdateRoomParams extends UpdateRoomRequest {
  roomId: string;
}

type UseUpdateRoomOptions = Omit<
  UseMutationOptions<UpdateRoomResponse, Error, UpdateRoomParams, unknown>,
  'mutationFn'
>;

/**
 * PATCH /api/rooms/{roomId} - 채팅방 정보 수정
 */
export function useUpdateRoom(mutationOptions?: UseUpdateRoomOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomId,
      ...body
    }: UpdateRoomParams): Promise<UpdateRoomResponse> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Failed to update room: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data, { roomId }) => {
      // 업데이트된 룸 캐시 갱신
      queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
    },
    ...mutationOptions,
  });
}
