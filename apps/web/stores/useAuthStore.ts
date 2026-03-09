import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';
import { signOut as authSignOut } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/client';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user: AuthUser | null) => {
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },

  setAccessToken: (accessToken: string | null) => set({ accessToken }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  signOut: async () => {
    await authSignOut();
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  // 캐싱된 토큰 우선 반환하여 Navigator LockManager lock 경합 방지
  getIdToken: async () => {
    const cached = get().accessToken;
    if (cached) return cached;

    // 폴백: store에 아직 없을 때 (초기 로드 직후 등)
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      if (token) set({ accessToken: token });
      return token;
    } catch {
      return null;
    }
  },
}));
