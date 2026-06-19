import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth/verify-token';

/**
 * 외부 조회 API(`/external/*`) 프록시 공통 핸들러.
 *
 * - `verifySupabaseToken` 선행: 런타임허브 사용자 인증(BFF 패턴 유지)
 * - ai-service 호출 시 **별도 키 `X_EXTERNAL_KEY`** 사용 → 브라우저에 노출 금지
 * - ai-service 의 상태/본문(401·403·404·422·200)을 그대로 전파
 *
 * @param externalPath `/external/` 뒤에 붙는 경로. 예: `code/hash/<crid>`
 */
export async function proxyExternalGet(
  request: NextRequest,
  externalPath: string
): Promise<NextResponse> {
  const decodedToken = await verifySupabaseToken(
    request.headers.get('authorization')
  );
  if (!decodedToken) {
    return NextResponse.json(
      {
        detail: [{ loc: ['header'], msg: 'Unauthorized', type: 'auth_error' }],
      },
      { status: 401 }
    );
  }

  const aiServerUrl = process.env.AI_SERVER_URL;
  const xExternalKey = process.env.X_EXTERNAL_KEY;

  if (!aiServerUrl) {
    return NextResponse.json(
      {
        detail: [
          {
            loc: ['server'],
            msg: 'AI_SERVER_URL is not configured',
            type: 'configuration_error',
          },
        ],
      },
      { status: 500 }
    );
  }

  if (!xExternalKey) {
    return NextResponse.json(
      {
        detail: [
          {
            loc: ['server'],
            msg: 'X_EXTERNAL_KEY is not configured',
            type: 'configuration_error',
          },
        ],
      },
      { status: 500 }
    );
  }

  try {
    const aiResponse = await fetch(`${aiServerUrl}/external/${externalPath}`, {
      method: 'GET',
      headers: {
        'X-API-Key': xExternalKey,
      },
    });

    // 상태/본문을 그대로 전파 (401·403·404·422·200 + 해시 JSON)
    const body = await aiResponse.text();
    const headers: Record<string, string> = {
      'content-type':
        aiResponse.headers.get('content-type') ?? 'application/json',
    };
    // 성공(2xx) 응답만 짧게 캐시 — 멀티탭 중복·잔여 버스트 흡수용.
    // 사용자별 인증 응답이므로 private(공유/CDN 캐시 금지). 4xx 등 전이 상태는 캐시하지 않음.
    if (aiResponse.ok) {
      headers['Cache-Control'] = 'private, max-age=10';
    }
    return new NextResponse(body, {
      status: aiResponse.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: [
          {
            loc: ['server'],
            msg:
              error instanceof Error ? error.message : 'Internal server error',
            type: 'server_error',
          },
        ],
      },
      { status: 500 }
    );
  }
}
