/**
 * DS Extract API
 *
 * POST /api/ds/extract
 *
 * Public Storybook URL에서 디자인 시스템 메타데이터를 추출하여 JSON으로 반환
 *
 * @example
 * ```bash
 * # ds.json 형식 (기본)
 * curl -X POST http://localhost:3000/api/ds/extract \
 *   -H "Content-Type: application/json" \
 *   -d '{"url": "https://68c8c3461f9760785b557ed9-ablubrqksi.chromatic.com"}'
 *
 * # component-schema.json 호환 형식
 * curl -X POST http://localhost:3000/api/ds/extract?format=legacy \
 *   -H "Content-Type: application/json" \
 *   -d '{"url": "https://68c8c3461f9760785b557ed9-ablubrqksi.chromatic.com"}'
 *
 * # 스트리밍 응답 (진행상황 실시간 확인)
 * curl -X POST "http://localhost:3000/api/ds/extract?stream=true" \
 *   -H "Content-Type: application/json" \
 *   -d '{"url": "https://workday.github.io/canvas-kit"}'
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel 서버리스 함수 타임아웃 설정 (Vercel Pro: 최대 300초)
 * 대규모 Storybook (140+ 컴포넌트) 추출 시 필요
 */
export const maxDuration = 300;
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { extractDSFromUrl, validateStorybookUrl } from '@/lib/storybook-extractor';
import { convertDSToLegacy } from '@/lib/schema-converter';
import type {
  ExtractRequest,
  ExtractResponse,
  ExtractErrorCode,
  ExtractWarning,
  DSJson,
  ComponentSchemaJson,
} from '@/types/ds-extraction';

/** 추출된 스키마 저장 디렉토리 */
const DS_SCHEMAS_DIR = path.join(process.cwd(), 'public', 'ds-schemas');

// =============================================================================
// Streaming Response Types (NDJSON)
// =============================================================================

/** 스트리밍 진행상황 메시지 */
interface StreamProgressMessage {
  type: 'progress';
  component: string;
  current: number;
  total: number;
}

/** 스트리밍 완료 메시지 */
interface StreamCompleteMessage {
  type: 'complete';
  data: DSJson | ComponentSchemaJson;
  format: 'ds' | 'legacy';
  savedPath: string;
  warnings?: ExtractWarning[];
}

/** 스트리밍 에러 메시지 */
interface StreamErrorMessage {
  type: 'error';
  message: string;
  code: ExtractErrorCode;
}

type StreamMessage = StreamProgressMessage | StreamCompleteMessage | StreamErrorMessage;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * URL 유효성 검증
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 에러 응답 생성
 */
function errorResponse(
  message: string,
  code: ExtractErrorCode,
  status: number = 400
): NextResponse<ExtractResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
    },
    { status }
  );
}

/**
 * 파일명에 사용할 수 없는 문자 제거
 */
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 스키마를 정적 JSON 파일로 저장
 */
async function saveSchemaToFile(
  data: DSJson | ComponentSchemaJson,
  dsName: string,
  format: 'ds' | 'legacy'
): Promise<string> {
  // 디렉토리 생성
  if (!existsSync(DS_SCHEMAS_DIR)) {
    await mkdir(DS_SCHEMAS_DIR, { recursive: true });
  }

  // 파일명 생성
  const safeName = sanitizeFileName(dsName);
  const extension = format === 'ds' ? 'ds.json' : 'schema.json';
  const fileName = `${safeName}.${extension}`;
  const filePath = path.join(DS_SCHEMAS_DIR, fileName);

  // JSON 파일 저장
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

  // 정적 파일 URL 반환
  return `/ds-schemas/${fileName}`;
}

/**
 * NDJSON 메시지 전송 헬퍼
 */
function writeStreamMessage(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  message: StreamMessage
): Promise<void> {
  return writer.write(encoder.encode(JSON.stringify(message) + '\n'));
}

/**
 * POST /api/ds/extract
 *
 * Request Body:
 * - url: Storybook URL (required)
 *
 * Query Parameters:
 * - format: 'ds' (default) | 'legacy'
 * - stream: 'true' (optional) - NDJSON 스트리밍 응답 활성화
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse> | Response> {
  const useStreaming = request.nextUrl.searchParams.get('stream') === 'true';
  const format = (request.nextUrl.searchParams.get('format') || 'ds') as 'ds' | 'legacy';

  // 공통 검증 로직
  let body: ExtractRequest;
  try {
    body = await request.json();
  } catch {
    if (useStreaming) {
      return createStreamErrorResponse('Invalid JSON body', 'PARSE_ERROR');
    }
    return errorResponse('Invalid JSON body', 'PARSE_ERROR');
  }

  const { url } = body;

  if (!url || typeof url !== 'string') {
    if (useStreaming) {
      return createStreamErrorResponse('url is required', 'INVALID_URL');
    }
    return errorResponse('url is required', 'INVALID_URL');
  }

  if (!isValidUrl(url)) {
    if (useStreaming) {
      return createStreamErrorResponse('Invalid URL format', 'INVALID_URL');
    }
    return errorResponse('Invalid URL format', 'INVALID_URL');
  }

  const validation = await validateStorybookUrl(url);
  if (!validation.valid) {
    const errorMsg = `Cannot access Storybook: ${validation.error}`;
    if (useStreaming) {
      return createStreamErrorResponse(errorMsg, 'INDEX_NOT_FOUND');
    }
    return errorResponse(errorMsg, 'INDEX_NOT_FOUND');
  }

  // 스트리밍 모드
  if (useStreaming) {
    return handleStreamingExtract(url, format);
  }

  // 기존 JSON 응답 모드
  return handleJsonExtract(url, format);
}

/**
 * 스트리밍 에러 응답 생성
 */
function createStreamErrorResponse(message: string, code: ExtractErrorCode): Response {
  const encoder = new TextEncoder();
  const errorMessage: StreamErrorMessage = { type: 'error', message, code };
  return new Response(encoder.encode(JSON.stringify(errorMessage) + '\n'), {
    status: 400,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

/**
 * 스트리밍 추출 핸들러
 */
function handleStreamingExtract(url: string, format: 'ds' | 'legacy'): Response {
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  // 비동기로 추출 진행
  (async () => {
    try {
      const { ds: dsJson, warnings } = await extractDSFromUrl(url, {
        onProgress: (component, current, total) => {
          const progressMessage: StreamProgressMessage = {
            type: 'progress',
            component,
            current,
            total,
          };
          writeStreamMessage(writer, encoder, progressMessage);
        },
      });

      // 형식 변환
      let outputData: DSJson | ComponentSchemaJson;
      if (format === 'legacy') {
        outputData = convertDSToLegacy(dsJson);
      } else {
        outputData = dsJson;
      }

      // 파일 저장
      const savedPath = await saveSchemaToFile(outputData, dsJson.name, format);
      console.log(`[DS Extract] Schema saved to: ${savedPath}`);

      // 완료 메시지 전송
      const completeMessage: StreamCompleteMessage = {
        type: 'complete',
        data: outputData,
        format,
        savedPath,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
      await writeStreamMessage(writer, encoder, completeMessage);
    } catch (error) {
      console.error('[DS Extract] Streaming error:', error);
      const errorMessage: StreamErrorMessage = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
      await writeStreamMessage(writer, encoder, errorMessage);
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * 기존 JSON 응답 핸들러
 */
async function handleJsonExtract(
  url: string,
  format: 'ds' | 'legacy'
): Promise<NextResponse<ExtractResponse>> {
  try {
    const { ds: dsJson, warnings } = await extractDSFromUrl(url);

    let outputData: DSJson | ComponentSchemaJson;
    if (format === 'legacy') {
      outputData = convertDSToLegacy(dsJson);
    } else {
      outputData = dsJson;
    }

    const savedPath = await saveSchemaToFile(outputData, dsJson.name, format);
    console.log(`[DS Extract] Schema saved to: ${savedPath}`);

    if (warnings.length > 0) {
      console.warn(`[DS Extract] Warnings:`, warnings);
    }

    return NextResponse.json({
      success: true,
      data: outputData,
      format,
      savedPath,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error('[DS Extract] Error:', error);

    // 에러 타입별 처리
    if (error instanceof Error) {
      if (error.message.includes('index.json')) {
        return errorResponse(error.message, 'INDEX_NOT_FOUND');
      }
      if (error.message.includes('Storybook 7+')) {
        return errorResponse(error.message, 'UNSUPPORTED_VERSION');
      }
      if (error.message.includes('fetch')) {
        return errorResponse(error.message, 'FETCH_FAILED');
      }
    }

    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'INTERNAL_ERROR',
      500
    );
  }
}

/**
 * OPTIONS (CORS preflight)
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
