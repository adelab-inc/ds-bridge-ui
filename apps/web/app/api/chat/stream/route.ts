import { NextRequest, NextResponse } from 'next/server';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';
import { verifySupabaseToken } from '@/lib/auth/verify-token';

// Vercel Production CDN 캐싱/정적 최적화 방지
export const dynamic = 'force-dynamic';

type ChatStreamRequest =
  paths['/chat/stream']['post']['requestBody']['content']['application/json'];

export async function POST(request: NextRequest) {
  try {
    // Supabase Auth 토큰 검증
    const decodedToken = await verifySupabaseToken(
      request.headers.get('authorization')
    );
    if (!decodedToken) {
      return NextResponse.json(
        {
          detail: [
            { loc: ['header'], msg: 'Unauthorized', type: 'auth_error' },
          ],
        },
        { status: 401 }
      );
    }

    // 요청 body 파싱
    const body: ChatStreamRequest = await request.json();

    if (!body.message) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body', 'message'],
              msg: 'message is required',
              type: 'value_error.missing',
            },
          ],
        },
        { status: 422 }
      );
    }

    // AI 서버 URL 가져오기
    const aiServerUrl = process.env.AI_SERVER_URL;
    const xApiKey = process.env.X_API_KEY;

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

    if (!xApiKey) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['server'],
              msg: 'X_API_KEY is not configured',
              type: 'configuration_error',
            },
          ],
        },
        { status: 500 }
      );
    }

    // AI 서버로 POST 요청 (JSON 응답, 202 + { message_id })
    // AI 서버가 백그라운드에서 Broadcast + DB 처리
    const aiResponse = await fetch(`${aiServerUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': xApiKey,
      },
      body: JSON.stringify({
        ...body,
        user_id: decodedToken.uid,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['ai_server'],
              msg: `AI server error: ${aiResponse.status} - ${errorText}`,
              type: 'ai_server_error',
            },
          ],
        },
        { status: 500 }
      );
    }

    // AI 서버 응답 그대로 프록시 (202 { message_id })
    const data = await aiResponse.json();
    return NextResponse.json(data, { status: aiResponse.status });
  } catch (error) {
    return NextResponse.json(
      {
        detail: [
          {
            loc: ['body'],
            msg:
              error instanceof Error ? error.message : 'Invalid request body',
            type: 'value_error',
          },
        ],
      },
      { status: 422 }
    );
  }
}
