import { NextRequest, NextResponse } from 'next/server';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';
import { verifyFirebaseToken } from '@/lib/auth/verify-token';

type ChatSendRequest =
  paths['/chat']['post']['requestBody']['content']['application/json'];
type ChatSendResponse =
  paths['/chat']['post']['responses']['200']['content']['application/json'];

export async function POST(request: NextRequest) {
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
    const xApiKey = process.env.X_API_KEY;
    console.log(xApiKey);

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
    const aiResponse = await fetch(`${aiServerUrl}/chat`, {
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
