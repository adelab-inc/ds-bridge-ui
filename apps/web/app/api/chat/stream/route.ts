import { NextRequest } from 'next/server';
import type { paths } from '@ds-hub/shared-types/typescript/api/schema';
import { verifyFirebaseToken } from '@/lib/auth/verify-token';

// Vercel Production CDN 캐싱/정적 최적화 방지
export const dynamic = 'force-dynamic';

type ChatStreamRequest =
  paths['/chat/stream']['post']['requestBody']['content']['application/json'];

export async function POST(request: NextRequest) {
  try {
    // Firebase Auth 토큰 검증
    const decodedToken = await verifyFirebaseToken(
      request.headers.get('authorization')
    );
    if (!decodedToken) {
      return new Response(
        JSON.stringify({
          detail: [
            { loc: ['header'], msg: 'Unauthorized', type: 'auth_error' },
          ],
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    // AI 서버의 SSE 스트림을 TransformStream으로 재구성하여 전달
    // Vercel Production CDN이 원본 ReadableStream을 버퍼링/압축하는 것을 방지
    const { readable, writable } = new TransformStream();

    (async () => {
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      try {
        // 초기 SSE 코멘트로 CDN 버퍼 flush + 연결 확립
        await writer.write(encoder.encode(': connected\n\n'));

        // AI 서버 응답을 청크 단위로 전달
        const reader = aiResponse.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch {
        // 클라이언트 연결 해제 등 스트림 에러
      } finally {
        try {
          await writer.close();
        } catch {
          /* already closed */
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
        'X-Accel-Buffering': 'no',
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
