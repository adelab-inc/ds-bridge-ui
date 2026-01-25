/**
 * Playwright Extractor
 *
 * CSR Storybook 대응을 위한 Playwright 기반 HTML 추출기
 * JavaScript 렌더링 후 ArgTypes 테이블을 파싱합니다.
 *
 * 추출 우선순위:
 * 1. Storybook JavaScript API (__STORYBOOK_PREVIEW__)
 * 2. HTML 파싱 (fallback)
 */

import type { Browser, Page } from 'playwright';
import type { PropInfo } from '@/types/ds-extraction';

// Browser 인스턴스 (싱글톤)
let browser: Browser | null = null;

/**
 * Browser 인스턴스 가져오기 (지연 로딩)
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    // 동적 import로 playwright 로드 (서버사이드에서만 사용)
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

/**
 * Playwright로 Docs HTML 가져오기
 *
 * CSR Storybook에서 JavaScript 렌더링 후 ArgTypes 테이블이 포함된 HTML 반환
 */
export async function fetchDocsHtmlWithPlaywright(
  docsUrl: string,
  timeout: number = 15000
): Promise<string> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // 페이지 로드
    await page.goto(docsUrl, {
      waitUntil: 'networkidle',
      timeout,
    });

    // ArgTypes 테이블 대기 (여러 셀렉터 시도)
    const selectors = [
      '.docblock-argstable',
      '[class*="argstable"]',
      'table[class*="args"]',
      '.docs-story',
    ];

    let found = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        found = true;
        break;
      } catch {
        // 다음 셀렉터 시도
      }
    }

    if (!found) {
      console.warn(`[Playwright] ArgTypes 테이블을 찾을 수 없습니다: ${docsUrl}`);
    }

    // 추가 렌더링 대기 (동적 컨텐츠)
    await page.waitForTimeout(1000);

    // HTML 반환
    return await page.content();
  } finally {
    await page.close();
  }
}

/**
 * Browser 인스턴스 종료
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Playwright 사용 가능 여부 확인
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    await import('playwright');
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Storybook JavaScript API 추출
// =============================================================================

/**
 * Storybook 내부 API에서 argTypes 추출 시도
 *
 * Storybook 7+: window.__STORYBOOK_PREVIEW__
 * Storybook 6: window.__STORYBOOK_STORY_STORE__
 */
interface StorybookArgType {
  name?: string;
  description?: string;
  type?: { name?: string; value?: unknown };
  control?: { type?: string };
  options?: string[];
  defaultValue?: unknown;
  table?: {
    type?: { summary?: string };
    defaultValue?: { summary?: string };
    category?: string;
  };
}

interface StorybookAPIResult {
  argTypes: Record<string, StorybookArgType> | null;
  parameters: Record<string, unknown> | null;
}

/**
 * Storybook JavaScript API를 통해 Props 추출
 *
 * @param page - Playwright Page 인스턴스
 * @returns PropInfo[] 또는 null (API 접근 실패 시)
 */
export async function extractPropsViaStorybookAPI(
  page: Page
): Promise<PropInfo[] | null> {
  try {
    const storyData = await page.evaluate((): StorybookAPIResult | null => {
      // Storybook 7+ API
      const preview = (window as unknown as Record<string, unknown>).__STORYBOOK_PREVIEW__ as {
        storyStore?: {
          getStoryContext: (selection: unknown) => { argTypes?: Record<string, StorybookArgType> };
          getSelection: () => unknown;
        };
      } | undefined;

      if (preview?.storyStore) {
        try {
          const store = preview.storyStore;
          const selection = store.getSelection();
          const context = store.getStoryContext(selection);
          return {
            argTypes: context?.argTypes || null,
            parameters: null,
          };
        } catch {
          // Storybook API 호출 실패
        }
      }

      // Storybook 6 API (Legacy)
      const legacyStore = (window as unknown as Record<string, unknown>).__STORYBOOK_STORY_STORE__ as {
        getSelection: () => { storyId?: string };
        fromId: (id: string) => { argTypes?: Record<string, StorybookArgType> };
      } | undefined;

      if (legacyStore) {
        try {
          const selection = legacyStore.getSelection();
          if (selection?.storyId) {
            const story = legacyStore.fromId(selection.storyId);
            return {
              argTypes: story?.argTypes || null,
              parameters: null,
            };
          }
        } catch {
          // Legacy API 호출 실패
        }
      }

      return null;
    });

    if (storyData?.argTypes) {
      return convertArgTypesToPropInfo(storyData.argTypes);
    }

    return null;
  } catch (error) {
    console.warn('[Playwright] Storybook API 접근 실패:', error);
    return null;
  }
}

/**
 * Storybook argTypes를 PropInfo 배열로 변환
 */
function convertArgTypesToPropInfo(
  argTypes: Record<string, StorybookArgType>
): PropInfo[] {
  const props: PropInfo[] = [];

  for (const [name, argType] of Object.entries(argTypes)) {
    // 내부 props 필터링 (ref, key 등)
    if (name.startsWith('_') || name === 'ref' || name === 'key') {
      continue;
    }

    // 타입 추출
    const type = extractTypeFromArgType(argType);

    // Control 타입 추출
    const control = extractControlFromArgType(argType);

    // 옵션 추출 (enum/select의 경우)
    const options = argType.options || null;

    // 기본값 추출
    const defaultValue = extractDefaultValue(argType);

    props.push({
      name,
      description: argType.description || null,
      type,
      defaultValue,
      required: false, // Storybook API에서는 required 정보가 명확하지 않음
      control,
      options,
    });
  }

  return props;
}

/**
 * argType에서 타입 정보 추출
 */
function extractTypeFromArgType(argType: StorybookArgType): string[] {
  // table.type.summary 우선 (가장 명확한 정보)
  if (argType.table?.type?.summary) {
    const summary = argType.table.type.summary;
    // union 타입 파싱 (예: "primary" | "secondary" | "danger")
    if (summary.includes('|')) {
      return summary
        .split('|')
        .map((t) => t.trim().replace(/['"]/g, ''))
        .filter(Boolean);
    }
    return [summary];
  }

  // type.name 사용
  if (argType.type?.name) {
    return [argType.type.name];
  }

  // control.type에서 추론
  if (argType.control?.type) {
    const controlType = argType.control.type;
    if (controlType === 'boolean') return ['boolean'];
    if (controlType === 'number' || controlType === 'range') return ['number'];
    if (controlType === 'text') return ['string'];
    if (controlType === 'select' || controlType === 'radio') {
      return argType.options || ['string'];
    }
  }

  return ['unknown'];
}

/**
 * argType에서 control 타입 추출
 */
function extractControlFromArgType(
  argType: StorybookArgType
): PropInfo['control'] {
  const controlType = argType.control?.type;

  if (!controlType) return null;

  switch (controlType) {
    case 'boolean':
      return 'boolean';
    case 'number':
    case 'range':
      return 'number';
    case 'text':
    case 'color':
    case 'date':
      return 'text';
    case 'select':
    case 'radio':
    case 'inline-radio':
    case 'check':
    case 'inline-check':
    case 'multi-select':
      return 'select';
    case 'object':
    case 'file':
      return 'object';
    default:
      return null;
  }
}

/**
 * argType에서 기본값 추출
 */
function extractDefaultValue(argType: StorybookArgType): string | null {
  // table.defaultValue.summary 우선
  if (argType.table?.defaultValue?.summary) {
    const summary = argType.table.defaultValue.summary;
    if (summary !== '-' && summary !== 'undefined') {
      return summary;
    }
  }

  // defaultValue 직접 사용
  if (argType.defaultValue !== undefined && argType.defaultValue !== null) {
    if (typeof argType.defaultValue === 'string') {
      return argType.defaultValue;
    }
    try {
      return JSON.stringify(argType.defaultValue);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Storybook API를 통해 Props 추출 시도 후 HTML fallback
 *
 * @param docsUrl - Storybook docs URL
 * @param timeout - 타임아웃 (ms)
 * @returns HTML 문자열 및 API 추출 결과
 */
export async function fetchDocsWithAPIFallback(
  docsUrl: string,
  timeout: number = 15000
): Promise<{ html: string; apiProps: PropInfo[] | null }> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // 페이지 로드
    await page.goto(docsUrl, {
      waitUntil: 'networkidle',
      timeout,
    });

    // 추가 렌더링 대기
    await page.waitForTimeout(1000);

    // 1. Storybook API 추출 시도
    const apiProps = await extractPropsViaStorybookAPI(page);

    if (apiProps && apiProps.length > 0) {
      console.log(`[Playwright] Storybook API로 ${apiProps.length}개 props 추출 성공`);
    }

    // 2. HTML도 반환 (fallback용)
    const html = await page.content();

    return { html, apiProps };
  } finally {
    await page.close();
  }
}
