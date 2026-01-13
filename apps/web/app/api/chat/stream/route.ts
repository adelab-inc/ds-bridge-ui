import { NextRequest } from 'next/server';
import { ChatStreamRequest } from '@/types/chat';

export async function POST(request: NextRequest) {
  try {
    // 요청 body 파싱
    const body: ChatStreamRequest = await request.json();

    if (!body.message) {
      return new Response(
        JSON.stringify({
          detail: [
            {
              loc: ['body', 'message'],
              msg: 'message is required',
              type: 'value_error.missing',
            },
          ],
        }),
        {
          status: 422,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // AI 서버 URL 가져오기
    const aiServerUrl = process.env.AI_SERVER_URL;
    const xApiKey = process.env.X_API_KEY;

    if (!aiServerUrl) {
      return new Response(
        JSON.stringify({
          detail: [
            {
              loc: ['server'],
              msg: 'AI_SERVER_URL is not configured',
              type: 'configuration_error',
            },
          ],
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!xApiKey) {
      return new Response(
        JSON.stringify({
          detail: [
            {
              loc: ['server'],
              msg: 'X_API_KEY is not configured',
              type: 'configuration_error',
            },
          ],
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // AI 서버로 SSE 요청
    const aiResponse = await fetch(`${aiServerUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-API-Key': xApiKey, // OpenAPI 스펙에 맞춤
      },
      body: JSON.stringify(body),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return new Response(
        JSON.stringify({
          detail: [
            {
              loc: ['ai_server'],
              msg: `AI server error: ${aiResponse.status} - ${errorText}`,
              type: 'ai_server_error',
            },
          ],
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // AI 서버의 SSE 스트림을 클라이언트에게 전달
    return new Response(aiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        detail: [
          {
            loc: ['body'],
            msg:
              error instanceof Error ? error.message : 'Invalid request body',
            type: 'value_error',
          },
        ],
      }),
      {
        status: 422,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
