import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/auth/verify-token';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string; message_id: string }> }
) {
  try {
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

    const { room_id, message_id } = await params;

    if (!room_id || !message_id) {
      return NextResponse.json(
        {
          detail: [
            {
              loc: ['path'],
              msg: 'room_id and message_id are required',
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
      `${aiServerUrl}/rooms/${room_id}/messages/${message_id}`,
      {
        method: 'DELETE',
        headers: {
          'X-API-Key': xApiKey,
        },
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 404) {
        return NextResponse.json(
          { error: 'Message not found' },
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

    return new NextResponse(null, { status: 204 });
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
