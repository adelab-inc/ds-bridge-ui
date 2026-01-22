# Storybook Extractor 개선 계획

> **목적**: Public Storybook URL에서 고품질 DS 메타데이터 추출
> **현재 상태**: P0 + P1 구현 완료 (Placeholder 감지 + Playwright 통합)
> **관련 파일**:
> - `apps/web/lib/storybook-extractor.ts` - 메인 추출 로직
> - `apps/web/lib/playwright-extractor.ts` - CSR Storybook 대응
> - `apps/web/app/api/ds/extract/route.ts` - API 엔드포인트
> - `apps/web/types/ds-extraction.ts` - 타입 정의

---

## 현재 구현 요약

### 추출 흐름

```
POST /api/ds/extract { url }
  ↓
index.json 파싱 → 컴포넌트 목록 추출
  ↓
각 컴포넌트별 docs iframe HTML fetch (Cheerio)
  ↓
ArgTypes 테이블 파싱 → props 추출
  ↓
Placeholder 감지? → YES → Playwright 재시도
  ↓
결과 저장 (public/ds-schemas/*.ds.json)
  ↓
응답 반환 { data, warnings, savedPath }
```

### 구현된 기능

| 기능 | 파일 | 함수 |
|------|------|------|
| index.json 파싱 | `storybook-extractor.ts` | `fetchStorybookIndex()` |
| 컴포넌트 구조 파싱 | `storybook-extractor.ts` | `parseComponentsFromIndex()` |
| ArgTypes HTML 파싱 | `storybook-extractor.ts` | `parseArgTypesFromHtml()` |
| Placeholder 감지 | `storybook-extractor.ts` | `isPlaceholderProp()` |
| Playwright 추출 | `playwright-extractor.ts` | `fetchDocsHtmlWithPlaywright()` |
| 경고 생성 | `storybook-extractor.ts` | `generateWarnings()` |

---

## 개선 필요 항목

### P0: 문서 페이지 필터링 (Critical)

**문제**: Welcome, Getting Started, Guides 등 props가 없는 문서 페이지도 처리

**현상**:
```
[Extractor] Welcome: Placeholder 감지 → Playwright로 재시도
[Playwright] ArgTypes 테이블을 찾을 수 없습니다
```

**원인**: `parseComponentsFromIndex()`에서 모든 `type: 'docs'` 엔트리 처리

**해결 방안**:
```typescript
// apps/web/lib/storybook-extractor.ts

// 문서 전용 카테고리 필터
const DOC_ONLY_CATEGORIES = [
  'Welcome',
  'Guides',
  'Getting Started',
  'Contributing',
  'Overview',
];

export function parseComponentsFromIndex(entries: Record<string, StoryEntry>): ComponentInfo[] {
  // ... 기존 로직 ...

  // 필터링 추가: story가 없는 docs-only 엔트리 제외
  return Array.from(componentMap.values()).filter(comp => {
    // story가 하나라도 있으면 실제 컴포넌트
    if (comp.stories.length > 0) return true;

    // docs만 있는 경우, 문서 전용 카테고리인지 확인
    const isDocOnly = DOC_ONLY_CATEGORIES.some(cat =>
      comp.category.includes(cat) || comp.name.includes(cat)
    );
    return !isDocOnly;
  });
}
```

**예상 효과**: 불필요한 처리 70%+ 감소

---

### P0: API 타임아웃 및 진행상황 피드백

**문제**: 대량 컴포넌트 추출 시 클라이언트 타임아웃 발생

**현상**: Canvas Kit (140+ 컴포넌트) 추출 시 10분+ 소요

**해결 방안 A: 타임아웃 설정**
```typescript
// apps/web/app/api/ds/extract/route.ts

export const maxDuration = 300; // Vercel: 최대 5분 (Pro 플랜)

// 또는 Next.js config
export const config = {
  api: {
    responseLimit: false,
    bodyParser: { sizeLimit: '10mb' },
  },
};
```

**해결 방안 B: 스트리밍 응답 (권장)**
```typescript
// apps/web/app/api/ds/extract/route.ts

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // 비동기로 추출 진행하며 진행상황 전송
  (async () => {
    for (const info of componentInfos) {
      // 추출 로직...
      await writer.write(encoder.encode(
        JSON.stringify({ type: 'progress', component: info.name }) + '\n'
      ));
    }
    await writer.write(encoder.encode(
      JSON.stringify({ type: 'complete', data: ds }) + '\n'
    ));
    await writer.close();
  })();

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
```

---

### P1: 병렬 처리

**문제**: 140+ 컴포넌트를 순차 처리

**현재 코드**:
```typescript
// apps/web/lib/storybook-extractor.ts:106

for (const info of componentInfos) {
  // 하나씩 순차 처리
  const html = await fetchDocsHtml(baseUrl, info.docsId);
  // ...
}
```

**개선 코드**:
```typescript
// apps/web/lib/storybook-extractor.ts

const CONCURRENCY_LIMIT = 5; // 동시 처리 수 제한

async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

// 사용
const components = await processInBatches(
  componentInfos,
  async (info) => {
    // 개별 컴포넌트 처리 로직
  },
  CONCURRENCY_LIMIT
);
```

**예상 효과**: 속도 3-5배 향상

---

### P1: props 없는 경우 Playwright 시도

**문제**: CSR Storybook에서 props가 0개로 나올 수 있음

**현재 코드**:
```typescript
// apps/web/lib/storybook-extractor.ts:116-122

// props가 있고 placeholder면 재시도
if (
  props.length > 0 &&
  props.some(isPlaceholderProp)
) {
  // Playwright 재시도
}
```

**개선 코드**:
```typescript
// apps/web/lib/storybook-extractor.ts

// props가 없거나, 있지만 placeholder인 경우 재시도
const shouldRetryWithPlaywright =
  props.length === 0 ||
  props.some(isPlaceholderProp);

if (usePlaywright && playwrightAvailable && shouldRetryWithPlaywright) {
  // Playwright 재시도
}
```

---

### P2: 결과 캐싱

**문제**: 동일 URL 재요청 시 처음부터 다시 추출

**해결 방안**:
```typescript
// apps/web/lib/extraction-cache.ts (신규)

import { DSJson } from '@/types/ds-extraction';

interface CacheEntry {
  ds: DSJson;
  extractedAt: number;
  ttl: number; // ms
}

const cache = new Map<string, CacheEntry>();

export function getCachedDS(url: string): DSJson | null {
  const entry = cache.get(url);
  if (!entry) return null;

  const isExpired = Date.now() - entry.extractedAt > entry.ttl;
  if (isExpired) {
    cache.delete(url);
    return null;
  }

  return entry.ds;
}

export function setCachedDS(url: string, ds: DSJson, ttlMs = 3600000): void {
  cache.set(url, {
    ds,
    extractedAt: Date.now(),
    ttl: ttlMs,
  });
}
```

**API에서 사용**:
```typescript
// apps/web/app/api/ds/extract/route.ts

import { getCachedDS, setCachedDS } from '@/lib/extraction-cache';

// 캐시 확인
const cached = getCachedDS(url);
if (cached && !request.nextUrl.searchParams.has('force')) {
  return NextResponse.json({
    success: true,
    data: cached,
    format: 'ds',
    savedPath: `/ds-schemas/${cached.name}.ds.json`,
    cached: true,
  });
}

// 추출 후 캐싱
setCachedDS(url, dsJson);
```

---

### P2: ArgTypes 셀렉터 확장

**문제**: Storybook 버전/테마별 클래스명 차이

**현재 셀렉터**:
```typescript
// apps/web/lib/storybook-extractor.ts:26-41

const SELECTORS = {
  table: '.docblock-argstable, [class*="argstable"], table[class*="args"]',
  // ...
};
```

**확장된 셀렉터**:
```typescript
const SELECTORS = {
  // ArgTypes 테이블 (버전별 fallback)
  table: [
    '.docblock-argstable',           // Storybook 7+
    '[class*="argstable"]',          // 클래스명 변형
    'table[class*="args"]',          // 일반 패턴
    '.sbdocs-argtable',              // Storybook 6
    '[data-testid="prop-table"]',    // 테스트 ID 기반
    '.css-1x2jtvf',                  // 특정 해시 클래스 (주의: 불안정)
  ].join(', '),

  // Prop 이름 (다양한 구조 대응)
  propName: [
    'td:first-child span',
    'td:first-child code',
    'td:first-child button span',    // 확장 가능한 row
    '[data-testid="prop-name"]',
  ].join(', '),

  // ... 나머지 셀렉터도 확장
};
```

---

## 테스트 URL 목록

| URL | 특성 | 예상 동작 |
|-----|------|----------|
| `https://workday.github.io/canvas-kit` | CSR, 대규모 (140+) | Playwright 필요 |
| `https://react.carbondesignsystem.com` | CSR | Playwright 필요 |
| `https://storybook.js.org/showcase` | SSR 예시들 | Cheerio만으로 가능 |

---

## 구현 우선순위

| 순서 | 항목 | 난이도 | 효과 |
|------|------|--------|------|
| 1 | P0: 문서 페이지 필터링 | 낮음 | 높음 |
| 2 | P0: API 타임아웃 설정 | 낮음 | 중간 |
| 3 | P1: 병렬 처리 | 중간 | 높음 |
| 4 | P1: props 없는 경우 재시도 | 낮음 | 중간 |
| 5 | P2: 결과 캐싱 | 중간 | 중간 |
| 6 | P2: 셀렉터 확장 | 낮음 | 낮음 |

---

## 관련 문서

- [4막 요구사항](/docs/hub/Design_System_Runtime_Hub_Summary.md)
- [DS 추출 스펙](/docs/specs/ds-hub-storybook-extraction.md)
