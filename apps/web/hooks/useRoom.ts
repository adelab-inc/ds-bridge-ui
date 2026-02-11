import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGetRoom } from '@/hooks/api/useRoomQuery';
import type { components } from '@ds-hub/shared-types/typescript/api/schema';
import { useCreateRoom } from './api/useCreateRoom';
import { useAuthStore } from '@/stores/useAuthStore';

type RoomResponse = components['schemas']['RoomResponse'];

interface UseRoomOptions {
  storybookUrl?: string;
  userId?: string;
}

interface UseRoomReturn {
  roomId: string | null;
  room: RoomResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useRoom(options: UseRoomOptions = {}): UseRoomReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasTriedCreate = useRef(false);
  const authUser = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  // 1. 쿼리 파라미터에서 crid 확인
  const crid = searchParams.get('crid');

  // 2. crid가 있으면 채팅방 조회
  const {
    data: existingRoom,
    isLoading: isFetching,
    error: fetchError,
  } = useGetRoom(crid, {
    enabled: !!crid,
  });

  // 3. 채팅방 생성 mutation
  const createRoomMutation = useCreateRoom();

  // 4. 룸 생성 로직
  useEffect(() => {
    // Auth 상태 초기화 대기 (onAuthStateChanged 완료 전까지 스킵)
    if (isAuthLoading) {
      return;
    }

    // 이미 생성 시도했거나, 생성 중이거나, 이미 생성된 경우 스킵
    if (
      hasTriedCreate.current ||
      createRoomMutation.isPending ||
      createRoomMutation.data ||
      createRoomMutation.error
    ) {
      return;
    }

    // crid가 있고 아직 로딩 중이면 대기
    if (crid && isFetching) {
      return;
    }

    // crid가 있고 성공적으로 조회되면 스킵
    if (crid && existingRoom) {
      return;
    }

    // crid가 없거나 조회 실패 시 새 룸 생성
    if (!crid || fetchError) {
      if (fetchError) {
        console.warn(`Failed to fetch room ${crid}, creating new room...`);
      }

      hasTriedCreate.current = true;

      createRoomMutation.mutate(
        {
          storybook_url:
            options.storybookUrl || 'https://storybook.example.com',
          user_id: options.userId || authUser?.uid || 'anonymous',
        },
        {
          onSuccess: (newRoom) => {
            // 쿼리 파라미터 업데이트
            const params = new URLSearchParams(searchParams.toString());
            params.set('crid', newRoom.id);
            router.replace(`?${params.toString()}`);
          },
          onError: (error) => {
            console.error('Failed to create room:', error);
            hasTriedCreate.current = false; // 실패 시 재시도 가능하도록
          },
        }
      );
    }
  }, [
    isAuthLoading,
    crid,
    isFetching,
    existingRoom,
    fetchError,
    createRoomMutation,
    options.storybookUrl,
    options.userId,
    authUser?.uid,
    searchParams,
    router,
  ]);

  // 5. 통합 상태 계산
  const isLoading = isAuthLoading || isFetching || createRoomMutation.isPending;
  const error =
    fetchError?.message || createRoomMutation.error?.message || null;
  const room = existingRoom || createRoomMutation.data || null;
  const roomId = room?.id || crid || null;

  return {
    roomId,
    room,
    isLoading,
    error,
  };
}
