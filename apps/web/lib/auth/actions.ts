import { createClient } from '@/lib/supabase/client';
import { EMAIL_STORAGE_KEY } from './config';

/**
 * 이메일로 Magic Link 전송
 * localStorage에 email 저장 (같은 브라우저에서 callback 시 자동 완료용)
 */
export async function sendSignInLink(email: string): Promise<void> {
  const supabase = createClient();

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5555';

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) throw error;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
  }
}

/** localStorage에서 저장된 email 조회 */
export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(EMAIL_STORAGE_KEY);
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

/** 현재 세션의 access_token 반환 (미인증 시 null) */
export async function getIdToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
