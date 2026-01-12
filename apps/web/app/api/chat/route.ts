import { NextRequest, NextResponse } from 'next/server';
import { ChatSendRequest, ChatSendResponse } from '@/types/chat';

export async function POST(request: NextRequest) {
  try {
    // 요청 body 파싱
    const body: ChatSendRequest = await request.json();

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
    const aiResponse = await fetch(`${aiServerUrl}/chat/send`, {
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
        { status: 500 }
      );
    }

    // AI 서버 응답을 클라이언트에게 전달
    const data: ChatSendResponse = await aiResponse.json();
    return NextResponse.json(data);
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
