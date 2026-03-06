import { createClient } from '@supabase/supabase-js';

// 모듈 레벨 싱글턴: 매 요청마다 클라이언트를 생성하지 않음
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) return null;

    return { uid: user.id, email: user.email };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}
