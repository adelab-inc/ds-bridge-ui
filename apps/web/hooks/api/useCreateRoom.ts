import {
  useMutation,
  UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';

type CreateRoomRequest =
  paths['/rooms']['post']['requestBody']['content']['application/json'];
type CreateRoomResponse =
  paths['/rooms']['post']['responses']['201']['content']['application/json'];

export const roomKeys = {
  all: ['rooms'] as const,
  detail: (id: string) => [...roomKeys.all, id] as const,
};

type UseCreateRoomOptions = Omit<
  UseMutationOptions<CreateRoomResponse, Error, CreateRoomRequest, unknown>,
  'mutationFn'
>;

/**
 * POST /api/rooms - 채팅방 생성
 */
export function useCreateRoom(mutationOptions?: UseCreateRoomOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: CreateRoomRequest
    ): Promise<CreateRoomResponse> => {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to create room: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // 생성된 룸을 캐시에 추가
      queryClient.setQueryData(roomKeys.detail(data.id), data);
    },
    ...mutationOptions,
  });
}
