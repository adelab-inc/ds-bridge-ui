import type { User } from '@supabase/supabase-js';

/** Supabase User의 직렬화 가능한 서브셋 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

/** Supabase User → AuthUser 변환 */
export function toAuthUser(supabaseUser: User): AuthUser {
  return {
    uid: supabaseUser.id,
    email: supabaseUser.email ?? null,
    displayName:
      supabaseUser.user_metadata?.full_name ??
      supabaseUser.user_metadata?.name ??
      null,
    photoURL: supabaseUser.user_metadata?.avatar_url ?? null,
    emailVerified: !!supabaseUser.email_confirmed_at,
  };
}
