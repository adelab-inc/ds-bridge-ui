import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth/verify-token';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    // Supabase Auth 토큰 검증
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

    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body', 'file'],
              msg: 'file is required',
              type: 'value_error.missing',
            },
          ],
        },
        { status: 422 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body', 'file'],
              msg: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
              type: 'value_error',
            },
          ],
        },
        { status: 422 }
      );
    }

    // 파일 형식 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['body', 'file'],
              msg: `File type '${file.type}' is not allowed. Allowed: ${ALLOWED_TYPES.join(', ')}`,
              type: 'value_error',
            },
          ],
        },
        { status: 422 }
      );
    }

    // AI 서버로 FormData 프록시
    const proxyFormData = new FormData();
    proxyFormData.append('file', file);

    const aiResponse = await fetch(`${aiServerUrl}/rooms/${room_id}/images`, {
      method: 'POST',
      headers: {
        'X-API-Key': xApiKey,
      },
      body: proxyFormData,
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
        {
          status:
            aiResponse.status >= 400 && aiResponse.status < 500
              ? aiResponse.status
              : 500,
        }
      );
    }

    const data = await aiResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        detail: [
          {
            loc: ['body'],
            msg: error instanceof Error ? error.message : 'Invalid request',
            type: 'value_error',
          },
        ],
      },
      { status: 422 }
    );
  }
}
