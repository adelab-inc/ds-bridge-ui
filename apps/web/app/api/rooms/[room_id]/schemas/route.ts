import { NextRequest, NextResponse } from 'next/server';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';
import { verifyFirebaseToken } from '@/lib/auth/verify-token';

type SchemaResponse =
  paths['/rooms/{room_id}/schemas']['get']['responses']['200']['content']['application/json'];
type CreateSchemaResponse =
  paths['/rooms/{room_id}/schemas']['post']['responses']['201']['content']['application/json'];

interface RouteContext {
  params: Promise<{ room_id: string }>;
}

// GET /api/rooms/[room_id]/schemas - 채팅방 스키마 조회
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Firebase Auth 토큰 검증
    const decodedToken = await verifyFirebaseToken(
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

    const { room_id } = await context.params;

    const aiServerUrl = process.env.AI_SERVER_URL;
    const aiServerApiKey = process.env.AI_SERVER_API_KEY;

    if (!aiServerUrl || !aiServerApiKey) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['server'],
              msg: 'AI server configuration missing',
              type: 'configuration_error',
            },
          ],
        },
        { status: 500 }
      );
    }

    const aiResponse = await fetch(`${aiServerUrl}/rooms/${room_id}/schemas`, {
      method: 'GET',
      headers: {
        'X-API-Key': aiServerApiKey,
      },
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 404) {
        return NextResponse.json(
          { error: 'Schema not found' },
          { status: 404 }
        );
      }

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

    const data: SchemaResponse = await aiResponse.json();
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

// POST /api/rooms/[room_id]/schemas - 컴포넌트 스키마 생성
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Firebase Auth 토큰 검증
    const decodedToken = await verifyFirebaseToken(
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

    const { room_id } = await context.params;

    const aiServerUrl = process.env.AI_SERVER_URL;
    const aiServerApiKey = process.env.AI_SERVER_API_KEY;

    if (!aiServerUrl || !aiServerApiKey) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['server'],
              msg: 'AI server configuration missing',
              type: 'configuration_error',
            },
          ],
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const aiResponse = await fetch(`${aiServerUrl}/rooms/${room_id}/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': aiServerApiKey,
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

    const data: CreateSchemaResponse = await aiResponse.json();
    return NextResponse.json(data, { status: 201 });
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
