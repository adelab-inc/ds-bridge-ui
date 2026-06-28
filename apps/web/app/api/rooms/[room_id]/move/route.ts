import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth/verify-token';

/**
 * POST /api/rooms/{room_id}/move — 방 소유권을 대상 유저에게 이관
 *
 * 삭제(DELETE)와 동일한 제로트러스트 소유권 검증 → 브라우저의 Supabase access
 * token을 `Authorization: Bearer`로 백엔드에 forward해야 한다. 이관 후 원
 * 소유자는 해당 방에 접근할 수 없다.
 *
 * 성공 시 백엔드 status(200)와 이관된 방 정보(user_id가 대상으로 변경)를
 * 그대로 패스스루한다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
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

    const { room_id } = await params;
    if (!room_id) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['path', 'room_id'],
              msg: 'room_id is required',
              type: 'value_error.missing',
            },
          ],
        },
        { status: 422 }
      );
    }

    const aiServerUrl = process.env.AI_SERVER_URL;
    const xApiKey = process.env.X_API_KEY;

    if (!aiServerUrl || !xApiKey) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['server'],
              msg: 'Backend configuration missing (AI_SERVER_URL / X_API_KEY)',
              type: 'configuration_error',
            },
          ],
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const aiResponse = await fetch(`${aiServerUrl}/rooms/${room_id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': xApiKey,
        // 소유권 검증을 위해 브라우저 JWT를 그대로 forward
        Authorization: request.headers.get('authorization') ?? '',
      },
      body: JSON.stringify(body),
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
    return NextResponse.json(data, { status: aiResponse.status });
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
