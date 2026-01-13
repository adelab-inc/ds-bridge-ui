import { NextRequest, NextResponse } from 'next/server';
import { CreateRoomRequest, CreateRoomResponse } from '@/types/room';

export async function POST(request: NextRequest) {
  try {
    // 요청 body 파싱
    const body: CreateRoomRequest = await request.json();

    if (!body.storybook_url || !body.user_id) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body'],
              msg: 'storybook_url and user_id are required',
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

    // AI 서버로 요청
    const aiResponse = await fetch(`${aiServerUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': xApiKey,
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

    // AI 서버 응답을 클라이언트에게 전달
    const data: CreateRoomResponse = await aiResponse.json();
    return NextResponse.json(data, { status: 201 });
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
