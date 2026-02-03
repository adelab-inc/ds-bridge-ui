/**
 * Figma Layout Extract API
 *
 * POST /api/figma/extract
 *
 * Figma 디자인 URL에서 layout-schema.json을 추출하여 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseFigmaUrl, fetchFigmaNodes, extractLayoutSchema, FigmaApiError } from '@/lib/figma';
import type { FigmaExtractRequest } from '@/types/layout-schema';

export async function POST(request: NextRequest) {
  try {
    // 1. body 파싱
    let body: FigmaExtractRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          detail: [{
            loc: ['body'],
            msg: 'Invalid JSON body',
            type: 'value_error',
          }],
        },
        { status: 422 }
      );
    }

    // 2. url 검증
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        {
          detail: [{
            loc: ['body', 'url'],
            msg: 'url is required',
            type: 'value_error.missing',
          }],
        },
        { status: 422 }
      );
    }

    // 3. FIGMA_ACCESS_TOKEN 환경변수 검증
    const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
    if (!figmaToken) {
      return NextResponse.json(
        {
          detail: [{
            loc: ['server'],
            msg: 'FIGMA_ACCESS_TOKEN is not configured',
            type: 'configuration_error',
          }],
        },
        { status: 500 }
      );
    }

    // 4. URL 파싱
    let urlInfo;
    try {
      urlInfo = parseFigmaUrl(body.url);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid Figma URL',
          code: 'INVALID_URL',
        },
        { status: 422 }
      );
    }

    // 5. Figma API 호출
    let figmaResponse;
    try {
      figmaResponse = await fetchFigmaNodes(urlInfo.fileKey, urlInfo.nodeId, figmaToken);
    } catch (error) {
      if (error instanceof FigmaApiError) {
        const statusMap: Record<string, number> = {
          RATE_LIMITED: 429,
          AUTH_ERROR: 401,
          NOT_FOUND: 404,
          SERVER_ERROR: 502,
        };
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: error.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'FIGMA_API_ERROR',
            ...(error.retryAfter !== undefined && { retryAfter: error.retryAfter }),
          },
          { status: statusMap[error.code] || 500 }
        );
      }
      throw error;
    }

    // 6. layout-schema 추출
    let layoutSchema;
    try {
      layoutSchema = extractLayoutSchema(figmaResponse, urlInfo.nodeId, body.url);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to extract layout',
          code: 'PARSE_ERROR',
        },
        { status: 500 }
      );
    }

    // 7. 성공 응답
    return NextResponse.json({
      success: true,
      data: layoutSchema,
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
