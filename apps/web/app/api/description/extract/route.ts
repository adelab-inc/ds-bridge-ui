import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth/verify-token';

// Vercel Production CDN 캐싱/정적 최적화 방지
export const dynamic = 'force-dynamic';

interface ExtractDescriptionRequest {
  room_id: string;
  current_code?: string;
  current_code_path?: string;
  edit_history?: {
    original: string;
    edited: string;
  };
}

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
    const body: ExtractDescriptionRequest = await request.json();

    if (!body.room_id) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body', 'room_id'],
              msg: 'room_id is required',
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

    // AI 서버로 디스크립션 추출 요청
    const aiResponse = await fetch(`${aiServerUrl}/description/extract`, {
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

    // AI 서버 응답 그대로 프록시
    const data = await aiResponse.json();
    return NextResponse.json(data, { status: 200 });
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
