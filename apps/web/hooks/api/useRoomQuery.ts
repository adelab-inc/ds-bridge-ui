import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';
import { useAuthStore } from '@/stores/useAuthStore';

type GetRoomResponse =
  paths['/rooms/{room_id}']['get']['responses']['200']['content']['application/json'];

export const roomKeys = {
  all: ['rooms'] as const,
  detail: (id: string) => [...roomKeys.all, id] as const,
};

type GetRoomOptions<T = GetRoomResponse> = Omit<
  UseQueryOptions<
    GetRoomResponse,
    Error,
    T,
    ReturnType<typeof roomKeys.detail>
  >,
  'queryKey' | 'queryFn'
>;

/**
 * GET /api/rooms/{room_id} - 채팅방 조회
 */
export const useGetRoom = <T = GetRoomResponse>(
  roomId: string | null,
  queryOptions: GetRoomOptions<T>
) => {
  return useQuery({
    queryKey: roomKeys.detail(roomId || ''),
    queryFn: async (): Promise<GetRoomResponse> => {
      if (!roomId) {
        throw new Error('Room ID is required');
      }

      const token = await useAuthStore.getState().getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/rooms/${roomId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Room not found');
        }
        throw new Error(`Failed to fetch room: ${response.statusText}`);
      }

      return response.json();
    },
    retry: false, // 404는 재시도하지 않음
    staleTime: 5 * 60 * 1000, // 5분
    ...queryOptions,
  });
};
