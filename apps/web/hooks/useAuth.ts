import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Auth 편의 훅
 * 컴포넌트에서 인증 상태와 액션에 접근
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);
  const getIdToken = useAuthStore((s) => s.getIdToken);

  return {
    user,
    isLoading,
    isAuthenticated,
    signOut,
    getIdToken,
  };
}
