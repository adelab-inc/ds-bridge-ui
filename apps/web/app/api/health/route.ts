import { NextRequest, NextResponse } from 'next/server';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';

type HealthResponse =
  paths['/health']['get']['responses']['200']['content']['application/json'];

export async function GET(request: NextRequest) {
  try {
    // AI 서버 URL 가져오기
    const aiServerUrl = process.env.AI_SERVER_URL;

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

    // AI 서버로 요청 (인증 불필요)
    const aiResponse = await fetch(`${aiServerUrl}/health`, {
      method: 'GET',
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
    const data: HealthResponse = await aiResponse.json();
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
