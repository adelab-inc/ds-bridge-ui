/**
 * Playwright Extractor
 *
 * CSR Storybook 대응을 위한 Playwright 기반 HTML 추출기
 * JavaScript 렌더링 후 ArgTypes 테이블을 파싱합니다.
 */

import type { Browser, Page } from 'playwright';

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
