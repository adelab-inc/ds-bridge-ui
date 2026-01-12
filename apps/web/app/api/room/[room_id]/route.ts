import { NextRequest, NextResponse } from 'next/server';
import { GetRoomResponse } from '@/types/room';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
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

    // AI 서버 URL 가져오기
    const aiServerUrl = process.env.AI_SERVER_URL;
    const aiServerApiKey = process.env.AI_SERVER_API_KEY;

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

    if (!aiServerApiKey) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['server'],
              msg: 'AI_SERVER_API_KEY is not configured',
              type: 'configuration_error',
            },
          ],
        },
        { status: 500 }
      );
    }

    // AI 서버로 요청
    const aiResponse = await fetch(`${aiServerUrl}/rooms/${room_id}`, {
      method: 'GET',
      headers: {
        'X-API-Key': aiServerApiKey,
      },
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 404) {
        return NextResponse.json(
          { error: 'Room not found' },
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

    // AI 서버 응답을 클라이언트에게 전달
    const data: GetRoomResponse = await aiResponse.json();
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
