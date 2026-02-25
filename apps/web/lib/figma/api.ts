/**
 * Figma API Client
 *
 * Figma REST API 호출 (인증, 에러 처리, rate-limit 보호 포함)
 */

import type { FigmaNodesResponse } from '@/types/layout-schema';

export class FigmaApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'AUTH_ERROR'
      | 'NOT_FOUND'
      | 'RATE_LIMITED'
      | 'SERVER_ERROR',
    public readonly status: number,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'FigmaApiError';
  }
}

// Module-scope rate limiter (private)
const requestTimestamps: number[] = [];
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8; // Figma limit is 10, keep 2 as safety margin

function checkRateLimit(): void {
  const now = Date.now();
  // Evict timestamps older than 60s
  while (
    requestTimestamps.length > 0 &&
    requestTimestamps[0] < now - WINDOW_MS
  ) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new FigmaApiError(
      `Rate limit exceeded: ${MAX_REQUESTS_PER_WINDOW} requests per ${WINDOW_MS / 1000}s window`,
      'RATE_LIMITED',
      429
    );
  }
}

function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

/**
 * Figma API에서 노드 데이터를 가져옴
 *
 * GET /v1/files/{fileKey}/nodes?ids={nodeId}
 *
 * @param fileKey - Figma 파일 키
 * @param nodeId - 노드 ID (예: "123:456")
 * @param token - Figma Personal Access Token
 * @returns Figma API 응답
 * @throws {FigmaApiError} API 호출 실패 시
 */
export async function fetchFigmaNodes(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<FigmaNodesResponse> {
  checkRateLimit();
  recordRequest();

  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;
  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (!response.ok) {
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new FigmaApiError(
        'Figma 인증 실패: 토큰을 확인해주세요',
        'AUTH_ERROR',
        status
      );
    }

    if (status === 404) {
      throw new FigmaApiError(
        '파일 또는 노드를 찾을 수 없습니다',
        'NOT_FOUND',
        404
      );
    }

    if (status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader
        ? parseInt(retryAfterHeader, 10)
        : undefined;
      throw new FigmaApiError(
        'Figma API rate limit 초과',
        'RATE_LIMITED',
        429,
        retryAfter
      );
    }

    if (status >= 500) {
      throw new FigmaApiError('Figma 서버 오류', 'SERVER_ERROR', status);
    }

    throw new FigmaApiError(
      `Figma API 요청 실패: ${status}`,
      'SERVER_ERROR',
      status
    );
  }

  const data = (await response.json()) as FigmaNodesResponse;
  return data;
}
