import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import type { OrgUser, UsersListResponse } from '@/types/rooms';

/**
 * GET /api/users — 멤버(조직 유저) 목록 (copy/move 대상 선택용).
 *
 * - 우리 BFF가 verifySupabaseToken을 선행하므로 토큰 없이 호출하면 401.
 *   따라서 Authorization: Bearer 토큰을 반드시 함께 보낸다.
 * - 목록에는 본인도 포함되므로(handoff §4) 현재 유저(uid)를 제외해 반환한다.
 * - `enabled`로 호출 시점을 제어한다(다이얼로그가 열릴 때만 조회 — 매 페이지
 *   로드마다 GET /users가 나가지 않도록).
 */
export function useUsers(enabled = true) {
  const uid = useAuthStore((s) => s.user?.uid);

  return useQuery<OrgUser[]>({
    queryKey: ['users', uid],
    enabled,
    queryFn: async (): Promise<OrgUser[]> => {
      const token = await useAuthStore.getState().getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load users: ${response.status}`);
      }

      const data: UsersListResponse = await response.json();
      // 본인 제외
      return data.users.filter((u) => u.id !== uid);
    },
    staleTime: 60 * 1000,
  });
}
