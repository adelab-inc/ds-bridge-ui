import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGetRoom } from '@/hooks/api/useRoomQuery';
import type { components } from '@ds-hub/shared-types/typescript/api/schema';
import { useCreateRoom } from './api/useCreateRoom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRoomsList } from './supabase/useRoomsList';

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
  const hasRedirectedToExisting = useRef(false);
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
    enabled: !!crid && !isAuthLoading,
  });

  // 3. 프로젝트 목록 조회 (crid가 없을 때 최근 프로젝트 확인용)
  const { rooms, isLoading: isRoomsListLoading } = useRoomsList();

  // 4. 채팅방 생성 mutation
  const createRoomMutation = useCreateRoom();

  // 5. crid 없을 때: 기존 프로젝트가 있으면 최근 프로젝트로 리다이렉트, 없으면 새로 생성
  useEffect(() => {
    // Auth 상태 초기화 대기
    if (isAuthLoading) {
      return;
    }

    // 이미 생성 시도했거나, 생성 중이거나, 이미 생성된 경우 스킵
    if (
      hasTriedCreate.current ||
      hasRedirectedToExisting.current ||
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

    // crid가 없거나 조회 실패 시
    if (!crid || fetchError) {
      if (fetchError) {
        console.warn(`Failed to fetch room ${crid}, creating new room...`);
      }

      // 프로젝트 목록 로딩 중이면 대기
      if (!crid && isRoomsListLoading) {
        return;
      }

      // 기존 프로젝트가 있으면 가장 최근 프로젝트로 리다이렉트
      if (!crid && rooms.length > 0) {
        hasRedirectedToExisting.current = true;
        const params = new URLSearchParams(searchParams.toString());
        params.set('crid', rooms[0].id);
        router.replace(`?${params.toString()}`);
        return;
      }

      // 프로젝트가 없으면 새로 생성
      hasTriedCreate.current = true;

      createRoomMutation.mutate(
        {
          storybook_url: options.storybookUrl,
          user_id: options.userId || authUser?.uid || 'anonymous',
        },
        {
          onSuccess: (newRoom) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('crid', newRoom.id);
            router.replace(`?${params.toString()}`);
          },
          onError: (error) => {
            console.error('Failed to create room:', error);
            hasTriedCreate.current = false;
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
    isRoomsListLoading,
    rooms,
    createRoomMutation,
    options.storybookUrl,
    options.userId,
    authUser?.uid,
    searchParams,
    router,
  ]);

  // 6. 통합 상태 계산
  const isLoading =
    isAuthLoading ||
    isFetching ||
    isRoomsListLoading ||
    createRoomMutation.isPending;
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
