import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth/verify-token';

// 버전 목록 조회
export async function GET(
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
          detail: [
            { loc: ['header'], msg: 'Unauthorized', type: 'auth_error' },
          ],
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

    const aiResponse = await fetch(
      `${aiServerUrl}/description/${room_id}/versions`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': xApiKey,
        },
      }
    );

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
