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
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { extractDSFromUrl, validateStorybookUrl } from '@/lib/storybook-extractor';
import { convertDSToLegacy } from '@/lib/schema-converter';
import type {
  ExtractRequest,
  ExtractResponse,
  ExtractErrorCode,
  DSJson,
  ComponentSchemaJson,
} from '@/types/ds-extraction';

/** 추출된 스키마 저장 디렉토리 */
const DS_SCHEMAS_DIR = path.join(process.cwd(), 'public', 'ds-schemas');

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
 * POST /api/ds/extract
 *
 * Request Body:
 * - url: Storybook URL (required)
 *
 * Query Parameters:
 * - format: 'ds' (default) | 'legacy'
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse>> {
  try {
    // 1. Request body 파싱
    let body: ExtractRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 'PARSE_ERROR');
    }

    const { url } = body;

    // 2. URL 필수값 검증
    if (!url || typeof url !== 'string') {
      return errorResponse('url is required', 'INVALID_URL');
    }

    // 3. URL 형식 검증
    if (!isValidUrl(url)) {
      return errorResponse('Invalid URL format', 'INVALID_URL');
    }

    // 4. Storybook URL 접근성 검증
    const validation = await validateStorybookUrl(url);
    if (!validation.valid) {
      return errorResponse(
        `Cannot access Storybook: ${validation.error}`,
        'INDEX_NOT_FOUND'
      );
    }

    // 5. DS 추출 (warnings 포함)
    const { ds: dsJson, warnings } = await extractDSFromUrl(url);

    // 6. 형식에 따라 변환
    const format = (request.nextUrl.searchParams.get('format') || 'ds') as 'ds' | 'legacy';

    let outputData: DSJson | ComponentSchemaJson;
    if (format === 'legacy') {
      outputData = convertDSToLegacy(dsJson);
    } else {
      outputData = dsJson;
    }

    // 7. 정적 파일로 저장
    const savedPath = await saveSchemaToFile(outputData, dsJson.name, format);
    console.log(`[DS Extract] Schema saved to: ${savedPath}`);

    // 8. 경고 로깅
    if (warnings.length > 0) {
      console.warn(`[DS Extract] Warnings:`, warnings);
    }

    // 9. 응답 반환 (warnings 포함)
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
