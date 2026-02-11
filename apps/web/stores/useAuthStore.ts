import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';
import {
  signOut as authSignOut,
  getIdToken as authGetIdToken,
} from '@/lib/auth/actions';
import { AUTH_SESSION_COOKIE } from '@/lib/auth/config';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set) => ({
  // 초기 상태: onAuthStateChanged가 발동할 때까지 로딩
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user: AuthUser | null) => {
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });

    // 미들웨어 연동용 세션 쿠키 설정/삭제
    if (typeof document !== 'undefined') {
      if (user) {
        document.cookie = `${AUTH_SESSION_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`;
      } else {
        document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; max-age=0`;
      }
    }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  signOut: async () => {
    await authSignOut();
    set({ user: null, isAuthenticated: false });
  },

  getIdToken: authGetIdToken,
}));
