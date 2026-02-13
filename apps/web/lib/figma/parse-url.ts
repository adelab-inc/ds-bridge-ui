/**
 * Figma URL Parser
 *
 * Figma 디자인 URL에서 fileKey와 nodeId를 추출
 */

import type { FigmaUrlInfo } from '@/types/layout-schema';

/**
 * Figma URL을 파싱하여 fileKey와 nodeId 추출
 *
 * @param url - Figma 디자인 URL (예: https://www.figma.com/design/{fileKey}/...?node-id=123-456)
 * @returns 파싱된 Figma 파일 정보
 * @throws {Error} URL이 유효하지 않거나 필수 정보가 누락된 경우
 *
 * @example
 * ```ts
 * const info = parseFigmaUrl('https://www.figma.com/design/abc123/MyFile?node-id=1-2');
 * // { fileKey: 'abc123', nodeId: '1:2', originalUrl: '...' }
 * ```
 */
export function parseFigmaUrl(url: string): FigmaUrlInfo {
  let parsedUrl: URL;

  // 1. URL 파싱
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`유효하지 않은 URL 형식: ${url}`);
  }

  // 2. Figma 도메인 확인
  if (!parsedUrl.hostname.includes('figma.com')) {
    throw new Error(`Figma URL이 아닙니다: ${parsedUrl.hostname}`);
  }

  // 3. fileKey 추출
  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  let fileKey: string | undefined;

  // /design/{fileKey}/..., /file/{fileKey}/..., /proto/{fileKey}/... 패턴 매칭
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    if (segment === 'design' || segment === 'file' || segment === 'proto') {
      fileKey = pathSegments[i + 1];
      break;
    }
  }

  if (!fileKey) {
    throw new Error(
      `fileKey를 찾을 수 없습니다. URL 경로: ${parsedUrl.pathname}`
    );
  }

  // 4. nodeId 추출
  const rawNodeId = parsedUrl.searchParams.get('node-id');

  if (!rawNodeId) {
    throw new Error(`node-id 쿼리 파라미터가 없습니다: ${url}`);
  }

  // 5. nodeId 디코딩 (URL 형식 → API 형식)
  const nodeId = decodeNodeId(rawNodeId);

  if (!nodeId) {
    throw new Error(`nodeId가 비어있습니다: ${rawNodeId}`);
  }

  return {
    fileKey,
    nodeId,
    originalUrl: url,
  };
}

/**
 * URL 인코딩된 node-id를 Figma API 형식으로 변환
 *
 * @param rawNodeId - URL에서 추출한 node-id (예: "123-456")
 * @returns Figma API 형식 node-id (예: "123:456")
 *
 * @example
 * ```ts
 * decodeNodeId('123-456') // '123:456'
 * decodeNodeId('1-2-3')   // '1:2:3'
 * ```
 */
function decodeNodeId(rawNodeId: string): string {
  return rawNodeId.replace(/-/g, ':');
}
