import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth/verify-token';

/**
 * GET /api/users — 멤버(조직 유저) 목록 (copy/move 대상 선택용)
 *
 * - BFF는 로그인 유저만 목록을 조회하도록 verifySupabaseToken을 선행한다(절대 규칙).
 * - 백엔드(`GET /users`)는 유저 JWT가 불필요하므로 X-API-Key만 전달한다
 *   (Authorization은 forward하지 않음).
 */
export async function GET(request: NextRequest) {
  try {
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

    const aiResponse = await fetch(`${aiServerUrl}/users`, {
      method: 'GET',
      headers: {
        'X-API-Key': xApiKey,
      },
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
        { status: aiResponse.status }
      );
    }

    const data = await aiResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        detail: [
          {
            loc: ['server'],
            msg: error instanceof Error ? error.message : 'Internal server error',
            type: 'server_error',
          },
        ],
      },
      { status: 500 }
    );
  }
}
