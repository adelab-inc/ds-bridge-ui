/**
 * Storybook Extractor
 *
 * Public Storybook URL에서 컴포넌트 메타데이터를 추출하는 서비스
 * @see docs/specs/ds-hub-storybook-extraction.md
 */

import * as cheerio from 'cheerio';
import type {
  DSJson,
  DSComponent,
  PropInfo,
  StorybookIndex,
  StoryEntry,
  ComponentInfo,
  ExtractWarning,
} from '@/types/ds-extraction';

// =============================================================================
// Constants
// =============================================================================

/**
 * HTML 파싱을 위한 CSS 선택자 (Storybook 버전별 fallback 포함)
 */
const SELECTORS = {
  // ArgTypes 테이블
  table: '.docblock-argstable, [class*="argstable"], table[class*="args"]',
  // Prop 이름
  propName: 'td:first-child span, td:first-child code, td:first-child',
  // 설명
  description: 'td:nth-child(2) > div:first-child, td:nth-child(2) > span:first-child',
  // 타입 옵션 (union/enum 값들)
  typeOptions:
    'td:nth-child(2) span.css-o1d7ko, td:nth-child(2) span[class*="o1d7ko"], td:nth-child(2) code',
  // 기본값
  defaultValue: 'td:nth-child(3) span, td:nth-child(3) code',
  // Control (select, input 등)
  controlSelect: 'td:nth-child(4) select, td:last-child select',
  controlInput: 'td:nth-child(4) input, td:last-child input',
};

/**
 * 문서 전용 카테고리/이름 패턴 (props가 없는 문서 페이지)
 * 이 패턴에 매칭되는 docs-only 엔트리는 추출에서 제외됨
 */
const DOC_ONLY_PATTERNS = [
  'Welcome',
  'Guides',
  'Getting Started',
  'Contributing',
  'Overview',
  'Introduction',
  'Documentation',
  'Docs',
  'About',
  'Changelog',
  'Migration',
  'Roadmap',
];

/**
 * 병렬 처리 동시 실행 수 제한
 * 너무 높으면 서버에 부하, 너무 낮으면 속도 저하
 */
const CONCURRENCY_LIMIT = 5;

// =============================================================================
// Main Export Functions
// =============================================================================

/**
 * 추출 옵션
 */
export interface ExtractOptions {
  /** Playwright 사용 여부 (CSR Storybook 대응) - 기본: true */
  usePlaywright?: boolean;
  /** Playwright 타임아웃 (ms) - 기본: 15000 */
  playwrightTimeout?: number;
  /** 병렬 처리 동시 실행 수 - 기본: 5 */
  concurrency?: number;
  /** 진행상황 콜백 (스트리밍 응답용) */
  onProgress?: (component: string, current: number, total: number) => void;
}

/**
 * 추출 결과
 */
export interface ExtractResult {
  ds: DSJson;
  warnings: ExtractWarning[];
}

/**
 * Storybook URL에서 DS 메타데이터 추출
 *
 * @param storybookUrl - Storybook URL
 * @param options - 추출 옵션
 * @returns 추출된 DS와 경고 목록
 */
export async function extractDSFromUrl(
  storybookUrl: string,
  options: ExtractOptions = {}
): Promise<ExtractResult> {
  const {
    usePlaywright = true,
    playwrightTimeout = 15000,
    concurrency = CONCURRENCY_LIMIT,
    onProgress,
  } = options;

  // URL 정규화
  const baseUrl = normalizeUrl(storybookUrl);

  // 1. index.json 가져오기
  const index = await fetchStorybookIndex(baseUrl);

  // 2. 컴포넌트 구조 파싱
  const componentInfos = parseComponentsFromIndex(index.entries);
  const totalComponents = componentInfos.length;

  console.log(`[Extractor] ${totalComponents}개 컴포넌트 추출 시작 (동시 처리: ${concurrency}개)`);

  // Playwright 사용 가능 여부 확인
  let playwrightAvailable = false;
  let fetchDocsHtmlWithPlaywright: ((url: string, timeout?: number) => Promise<string>) | null = null;

  if (usePlaywright) {
    try {
      const playwrightModule = await import('./playwright-extractor');
      playwrightAvailable = await playwrightModule.isPlaywrightAvailable();
      if (playwrightAvailable) {
        fetchDocsHtmlWithPlaywright = playwrightModule.fetchDocsHtmlWithPlaywright;
      }
    } catch {
      console.warn('[Extractor] Playwright를 로드할 수 없습니다. Cheerio만 사용합니다.');
    }
  }

  // 3. 각 컴포넌트의 props 추출 (병렬 처리)
  let processedCount = 0;

  const processComponent = async (info: ComponentInfo): Promise<DSComponent> => {
    let props: PropInfo[] = [];

    if (info.docsId) {
      try {
        // Step 1: Cheerio로 먼저 시도 (빠름)
        const html = await fetchDocsHtml(baseUrl, info.docsId);
        props = parseArgTypesFromHtml(html);

        // Step 2: props가 없거나 placeholder 감지 시 Playwright로 재시도
        const shouldRetryWithPlaywright =
          props.length === 0 || props.some(isPlaceholderProp);

        if (
          usePlaywright &&
          playwrightAvailable &&
          fetchDocsHtmlWithPlaywright &&
          shouldRetryWithPlaywright
        ) {
          const reason = props.length === 0 ? 'props 없음' : 'Placeholder 감지';
          console.log(`[Extractor] ${info.name}: ${reason} → Playwright로 재시도`);
          try {
            const docsUrl = `${baseUrl}/iframe.html?id=${info.docsId}&viewMode=docs`;
            const playwrightHtml = await fetchDocsHtmlWithPlaywright(docsUrl, playwrightTimeout);
            const playwrightProps = parseArgTypesFromHtml(playwrightHtml);

            if (
              playwrightProps.length > 0 &&
              !playwrightProps.every(isPlaceholderProp)
            ) {
              props = playwrightProps;
              console.log(`[Extractor] ${info.name}: Playwright 성공 (${props.length} props)`);
            }
          } catch (playwrightError) {
            console.warn(`[Extractor] ${info.name}: Playwright 실패:`, playwrightError);
          }
        }
      } catch (error) {
        console.warn(`Failed to extract props for ${info.name}:`, error);
      }
    }

    // 진행상황 콜백 호출
    processedCount++;
    onProgress?.(info.name, processedCount, totalComponents);

    return {
      name: info.name,
      category: info.category,
      stories: info.stories,
      props,
    };
  };

  // 배치 병렬 처리
  const components = await processInBatches(componentInfos, processComponent, concurrency);
  console.log(`[Extractor] ${components.length}개 컴포넌트 추출 완료`);

  // Browser 정리 (Playwright 사용 시)
  if (playwrightAvailable) {
    try {
      const playwrightModule = await import('./playwright-extractor');
      await playwrightModule.closeBrowser();
    } catch {
      // 무시
    }
  }

  // 4. ds.json 생성
  const ds: DSJson = {
    name: extractDSName(baseUrl),
    source: baseUrl,
    version: '1.0.0',
    extractedAt: new Date().toISOString(),
    components,
  };

  // 5. 경고 생성
  const warnings = generateWarnings(components);

  return { ds, warnings };
}

/**
 * Storybook index.json 가져오기
 */
export async function fetchStorybookIndex(baseUrl: string): Promise<StorybookIndex> {
  const indexUrl = `${baseUrl}/index.json`;

  const response = await fetch(indexUrl, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch index.json: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // 버전 검증 (Storybook 7+ 필요)
  if (!data.v || !data.entries) {
    throw new Error('Invalid index.json format. Storybook 7+ required.');
  }

  return data as StorybookIndex;
}

/**
 * Docs iframe HTML 가져오기
 */
export async function fetchDocsHtml(baseUrl: string, docsId: string): Promise<string> {
  const docsUrl = `${baseUrl}/iframe.html?id=${docsId}&viewMode=docs`;

  const response = await fetch(docsUrl, {
    headers: {
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch docs HTML: ${response.status}`);
  }

  return response.text();
}

/**
 * index.json entries에서 컴포넌트 구조 파싱
 * 문서 전용 페이지(Welcome, Guides 등)는 자동으로 필터링됨
 */
export function parseComponentsFromIndex(
  entries: Record<string, StoryEntry>
): ComponentInfo[] {
  const componentMap = new Map<string, ComponentInfo>();

  for (const entry of Object.values(entries)) {
    // title 파싱: "UI/Badge" → { category: "UI", name: "Badge" }
    const parts = entry.title.split('/');
    const componentName = parts[parts.length - 1];
    const category = parts.slice(0, -1).join('/') || 'Components';
    const key = entry.title;

    if (!componentMap.has(key)) {
      componentMap.set(key, {
        category,
        name: componentName,
        stories: [],
        docsId: null,
      });
    }

    const component = componentMap.get(key)!;

    if (entry.type === 'docs') {
      component.docsId = entry.id;
    } else if (entry.type === 'story') {
      component.stories.push(entry.name);
    }
  }

  // 문서 전용 페이지 필터링
  // story가 없는 docs-only 엔트리 중 문서 전용 패턴에 매칭되는 것 제외
  return Array.from(componentMap.values()).filter((comp) => {
    // story가 하나라도 있으면 실제 컴포넌트로 간주
    if (comp.stories.length > 0) return true;

    // docs만 있는 경우, 문서 전용 패턴인지 확인
    const isDocOnlyPage = DOC_ONLY_PATTERNS.some(
      (pattern) =>
        comp.category.toLowerCase().includes(pattern.toLowerCase()) ||
        comp.name.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isDocOnlyPage) {
      console.log(`[Extractor] 문서 페이지 제외: ${comp.category}/${comp.name}`);
      return false;
    }

    return true;
  });
}

/**
 * HTML에서 ArgTypes 테이블 파싱
 */
export function parseArgTypesFromHtml(html: string): PropInfo[] {
  const $ = cheerio.load(html);
  const props: PropInfo[] = [];

  // ArgTypes 테이블 찾기
  const table = $(SELECTORS.table).first();
  if (!table.length) {
    return props;
  }

  // tbody의 각 행 순회
  const rows = table.find('tbody tr');

  rows.each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');

    if (cells.length < 3) return;

    // Prop 이름
    const nameEl = cells.eq(0).find('span, code').first();
    const name = nameEl.text().trim() || cells.eq(0).text().trim();

    if (!name) return;

    // 설명
    const descEl = cells.eq(1).find('> div:first-child, > span:first-child').first();
    const description = descEl.text().trim() || null;

    // 타입 (union 값들)
    const typeSpans = cells.eq(1).find('span.css-o1d7ko, span[class*="o1d7ko"], code');
    const type: string[] = [];
    typeSpans.each((_, span) => {
      const text = $(span).text().replace(/"/g, '').trim();
      if (text && !type.includes(text)) {
        type.push(text);
      }
    });

    // 기본값
    const defaultEl = cells.eq(2).find('span, code').first();
    const defaultText = defaultEl.text().trim();
    const defaultValue = defaultText === '-' || defaultText === '' ? null : defaultText;

    // Control 타입 및 옵션
    const { control, options } = extractControlInfo($, cells);

    props.push({
      name,
      description,
      type: type.length > 0 ? type : ['unknown'],
      defaultValue,
      control,
      options,
    });
  });

  return props;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 배치 병렬 처리 유틸리티
 * 주어진 concurrency 수만큼 동시에 처리하고 결과를 순서대로 반환
 *
 * @param items - 처리할 항목 배열
 * @param processor - 각 항목을 처리하는 비동기 함수
 * @param concurrency - 동시 처리 수
 * @returns 처리 결과 배열 (입력 순서 유지)
 */
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

/**
 * Control 정보 추출 (select, input 등)
 */
function extractControlInfo(
  $: cheerio.CheerioAPI,
  cells: ReturnType<cheerio.CheerioAPI>
): {
  control: PropInfo['control'];
  options: string[] | null;
} {
  // 마지막 또는 4번째 셀에서 control 찾기
  const controlCell = cells.length >= 4 ? cells.eq(3) : cells.last();

  // Select 체크
  const select = controlCell.find('select');
  if (select.length) {
    const options: string[] = [];
    select.find('option').each((_, opt) => {
      const value = $(opt).attr('value') || $(opt).text().trim();
      if (value && value !== 'Choose option...' && value !== '') {
        options.push(value);
      }
    });
    return {
      control: 'select',
      options: options.length > 0 ? options : null,
    };
  }

  // Input 체크
  const input = controlCell.find('input');
  if (input.length) {
    const inputType = input.attr('type');
    if (inputType === 'number') {
      return { control: 'number', options: null };
    }
    if (inputType === 'checkbox') {
      return { control: 'boolean', options: null };
    }
    return { control: 'text', options: null };
  }

  // Textarea 체크
  if (controlCell.find('textarea').length) {
    return { control: 'text', options: null };
  }

  // Object editor 체크
  if (controlCell.find('[class*="object"], [class*="json"]').length) {
    return { control: 'object', options: null };
  }

  return { control: null, options: null };
}

/**
 * URL 정규화 (trailing slash 제거)
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // 프로토콜 확인
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }

  // trailing slash 제거
  return normalized.replace(/\/+$/, '');
}

/**
 * URL에서 DS 이름 추출
 */
function extractDSName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Chromatic 패턴: abc123-xyz.chromatic.com → abc123-xyz
    // GitHub Pages 패턴: org.github.io → org
    const name = hostname.split('.')[0];
    return name || 'unknown-ds';
  } catch {
    return 'unknown-ds';
  }
}

/**
 * Storybook URL 유효성 검증
 */
export async function validateStorybookUrl(
  url: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const baseUrl = normalizeUrl(url);
    const response = await fetch(`${baseUrl}/index.json`, {
      method: 'HEAD',
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `index.json not found (${response.status})`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Placeholder Detection
// =============================================================================

/**
 * Placeholder 패턴 (Storybook 문서 예제 데이터)
 */
const PLACEHOLDER_PATTERNS = {
  names: ['propertyName', 'propName', 'prop'],
  types: ['unknown'],
  descriptions: ['This is a short description', 'Description'],
  defaultValues: ['defaultValue', 'default'],
};

/**
 * Prop이 placeholder인지 확인
 */
export function isPlaceholderProp(prop: PropInfo): boolean {
  // 이름이 placeholder 패턴인 경우
  if (PLACEHOLDER_PATTERNS.names.includes(prop.name)) {
    return true;
  }

  // 타입이 unknown만 있는 경우
  if (prop.type.length === 1 && PLACEHOLDER_PATTERNS.types.includes(prop.type[0])) {
    return true;
  }

  // 설명이 placeholder 패턴인 경우
  if (prop.description && PLACEHOLDER_PATTERNS.descriptions.includes(prop.description)) {
    return true;
  }

  return false;
}

/**
 * 컴포넌트들에서 placeholder props 감지
 */
export function detectPlaceholderProps(components: DSComponent[]): string[] {
  const affected: string[] = [];

  for (const comp of components) {
    // props가 있고, 그 중 하나라도 placeholder인 경우
    if (comp.props.length > 0 && comp.props.some(isPlaceholderProp)) {
      affected.push(comp.name);
    }
  }

  return affected;
}

/**
 * 추출 결과에서 경고 생성
 */
export function generateWarnings(components: DSComponent[]): ExtractWarning[] {
  const warnings: ExtractWarning[] = [];

  const affected = detectPlaceholderProps(components);
  if (affected.length > 0) {
    warnings.push({
      type: 'PLACEHOLDER_PROPS',
      message: `${affected.length}개 컴포넌트에서 props 추출 품질이 낮습니다. CSR Storybook일 수 있습니다.`,
      affectedComponents: affected,
    });
  }

  return warnings;
}
