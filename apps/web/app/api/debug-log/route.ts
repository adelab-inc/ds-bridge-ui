import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth/verify-token';

export const dynamic = 'force-dynamic';

// 프로덕션 스트리밍 버그 관측 전용 엔드포인트.
// 클라이언트에서 drop/이상 이벤트 발생 시 POST하면 Vercel Functions Logs에 구조화 로그로 남는다.
// 관련 문서: docs/bug-issue/답변중복발행.md
interface DebugLogPayload {
  event: string;
  context?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const decoded = await verifySupabaseToken(
    request.headers.get('authorization')
  );
  if (!decoded) {
    return new NextResponse(null, { status: 401 });
  }

  let body: DebugLogPayload | null = null;
  try {
    body = (await request.json()) as DebugLogPayload;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (!body?.event || typeof body.event !== 'string') {
    return new NextResponse(null, { status: 400 });
  }

  // Vercel Functions Logs에서 `[debug-log]` 로 grep 가능.
  console.log(
    '[debug-log]',
    JSON.stringify({
      event: body.event,
      context: body.context ?? {},
      user_id: decoded.uid,
      ts: Date.now(),
      ua: request.headers.get('user-agent')?.slice(0, 120) ?? null,
    })
  );

  return new NextResponse(null, { status: 204 });
}
