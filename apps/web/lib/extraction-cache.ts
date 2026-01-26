/**
 * Extraction Cache
 *
 * DS 추출 결과를 메모리에 캐싱하여 동일 URL 재요청 시 빠르게 응답
 *
 * @see docs/hub/storybook-extractor-improvements.md
 */

import type { DSJson, ExtractWarning } from '@/types/ds-extraction';

// =============================================================================
// Types
// =============================================================================

interface CacheEntry {
  /** 추출된 DS 데이터 */
  ds: DSJson;
  /** 추출 시 발생한 경고 */
  warnings: ExtractWarning[];
  /** 캐시 저장 시간 (ms timestamp) */
  cachedAt: number;
  /** TTL (ms) */
  ttl: number;
}

interface CacheStats {
  /** 총 캐시 엔트리 수 */
  size: number;
  /** 캐시 히트 수 */
  hits: number;
  /** 캐시 미스 수 */
  misses: number;
  /** 히트율 (%) */
  hitRate: number;
}

// =============================================================================
// Cache Implementation
// =============================================================================

/** 기본 TTL: 1시간 */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/** 캐시 저장소 */
const cache = new Map<string, CacheEntry>();

/** 통계 */
let stats = {
  hits: 0,
  misses: 0,
};

/**
 * URL 정규화 (캐시 키 생성용)
 */
function normalizeUrlForCache(url: string): string {
  try {
    const parsed = new URL(url);
    // 프로토콜, 호스트, 경로만 사용 (쿼리 파라미터 제외)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(
      /\/+$/,
      ''
    );
  } catch {
    return url.trim().replace(/\/+$/, '');
  }
}

/**
 * 캐시에서 DS 가져오기
 *
 * @param url - Storybook URL
 * @returns 캐시된 데이터 또는 null (만료 시 자동 삭제)
 */
export function getCachedDS(
  url: string
): { ds: DSJson; warnings: ExtractWarning[] } | null {
  const key = normalizeUrlForCache(url);
  const entry = cache.get(key);

  if (!entry) {
    stats.misses++;
    return null;
  }

  // TTL 확인
  const isExpired = Date.now() - entry.cachedAt > entry.ttl;
  if (isExpired) {
    cache.delete(key);
    stats.misses++;
    console.log(`[Cache] Expired: ${key}`);
    return null;
  }

  stats.hits++;
  console.log(`[Cache] Hit: ${key}`);
  return { ds: entry.ds, warnings: entry.warnings };
}

/**
 * DS를 캐시에 저장
 *
 * @param url - Storybook URL
 * @param ds - 추출된 DS 데이터
 * @param warnings - 추출 시 발생한 경고
 * @param ttlMs - TTL (기본: 1시간)
 */
export function setCachedDS(
  url: string,
  ds: DSJson,
  warnings: ExtractWarning[],
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const key = normalizeUrlForCache(url);

  cache.set(key, {
    ds,
    warnings,
    cachedAt: Date.now(),
    ttl: ttlMs,
  });

  console.log(`[Cache] Set: ${key} (TTL: ${ttlMs / 1000}s)`);
}

/**
 * 특정 URL의 캐시 삭제
 */
export function invalidateCache(url: string): boolean {
  const key = normalizeUrlForCache(url);
  const deleted = cache.delete(key);
  if (deleted) {
    console.log(`[Cache] Invalidated: ${key}`);
  }
  return deleted;
}

/**
 * 전체 캐시 삭제
 */
export function clearCache(): void {
  const size = cache.size;
  cache.clear();
  stats = { hits: 0, misses: 0 };
  console.log(`[Cache] Cleared (${size} entries)`);
}

/**
 * 만료된 캐시 엔트리 정리
 */
export function cleanupExpiredCache(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of cache.entries()) {
    if (now - entry.cachedAt > entry.ttl) {
      cache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Cache] Cleanup: ${cleaned} expired entries removed`);
  }

  return cleaned;
}

/**
 * 캐시 통계 조회
 */
export function getCacheStats(): CacheStats {
  const total = stats.hits + stats.misses;
  return {
    size: cache.size,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: total > 0 ? Math.round((stats.hits / total) * 100) : 0,
  };
}

/**
 * 캐시된 URL 목록 조회
 */
export function getCachedUrls(): string[] {
  return Array.from(cache.keys());
}
