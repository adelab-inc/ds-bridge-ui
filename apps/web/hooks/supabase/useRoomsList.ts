import { useQuery } from '@tanstack/react-query';
import type { ChatRoom } from '@packages/shared-types/typescript/database/types';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';
import { roomKeys } from '@/hooks/api/useCreateRoom';

interface UseRoomsListReturn {
  rooms: ChatRoom[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Supabase chat_rooms 테이블에서 현재 유저의 룸 목록을 조회
 */
export function useRoomsList(): UseRoomsListReturn {
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid;

  const { data, isLoading, error } = useQuery({
    queryKey: [...roomKeys.all, 'list', uid],
    queryFn: async (): Promise<ChatRoom[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('user_id', uid!)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data as ChatRoom[];
    },
    enabled: !!uid,
    staleTime: 1000 * 60 * 2, // 2분
  });

  return {
    rooms: data ?? [],
    isLoading,
    error: error?.message ?? null,
  };
}
