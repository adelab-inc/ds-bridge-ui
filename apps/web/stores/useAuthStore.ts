import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';
import {
  signOut as authSignOut,
  getIdToken as authGetIdToken,
} from '@/lib/auth/actions';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user: AuthUser | null) => {
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  signOut: async () => {
    await authSignOut();
    set({ user: null, isAuthenticated: false });
  },

  getIdToken: authGetIdToken,
}));
