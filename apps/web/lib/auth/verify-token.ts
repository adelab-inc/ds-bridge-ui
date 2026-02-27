import { createClient } from '@supabase/supabase-js';

/**
 * Authorization 헤더에서 Supabase JWT를 검증
 * 성공 시 { uid, email } 반환, 실패 시 null
 */
export async function verifySupabaseToken(
  authHeader: string | null
): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    // service_role key로 관리자 클라이언트 생성하여 토큰 검증
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) return null;

    return { uid: user.id, email: user.email };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}
