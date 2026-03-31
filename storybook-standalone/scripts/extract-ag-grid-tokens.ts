#!/usr/bin/env tsx
/**
 * AG Grid Tokens Extractor
 *
 * ag-grid-theme-builder JS 파일에서 withParams({...}) 객체를 추출하여
 * 경량화된 ag-grid-tokens.json을 생성합니다.
 *
 * 사용법: pnpm ag-grid:extract
 * 출력: apps/storybook/src/stories/ag-grid-tokens.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

const ROOT_DIR = path.resolve(__dirname, '..');
const STORIES_DIR = path.join(ROOT_DIR, 'apps/storybook/src/stories');
const SOURCE_PATH = path.join(STORIES_DIR, 'ag-grid-theme-builder (17).js');
const OUTPUT_PATH = path.join(STORIES_DIR, 'ag-grid-tokens.json');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DIST_OUTPUT_PATH = path.join(DIST_DIR, 'ag-grid-tokens.json');

function extractWithParamsBlock(jsContent: string): string {
  const marker = '.withParams(';
  const markerIdx = jsContent.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error('.withParams( 를 찾을 수 없습니다');
  }

  // withParams( 이후 '(' 위치부터 매칭되는 ')' 까지 추출
  const parenStart = markerIdx + marker.length - 1; // '(' 위치
  let depth = 0;
  let blockEnd = -1;

  for (let i = parenStart; i < jsContent.length; i++) {
    if (jsContent[i] === '(') depth++;
    if (jsContent[i] === ')') {
      depth--;
      if (depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }

  if (blockEnd === -1) {
    throw new Error('withParams() 의 닫는 괄호를 찾을 수 없습니다');
  }

  // '(' 와 ')' 사이의 객체 리터럴
  return jsContent.slice(parenStart + 1, blockEnd);
}

function validateValues(params: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      continue;
    }
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      continue;
    }
    throw new Error(
      `예상치 못한 값 타입: ${key} = ${JSON.stringify(value)} (${typeof value}). ` +
        'string | number | boolean | string[] 만 허용됩니다. vm.runInNewContext 방식 전환을 검토하세요.'
    );
  }
}

function main() {
  console.log('🔍 AG Grid 토큰 추출 중...\n');

  // 1. 소스 파일 확인
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`❌ 소스 파일을 찾을 수 없습니다: ${SOURCE_PATH}`);
    process.exit(1);
  }

  // 2. JS 파일 읽기 및 withParams 블록 추출
  const jsContent = fs.readFileSync(SOURCE_PATH, 'utf-8');
  const objectLiteral = extractWithParamsBlock(jsContent);

  // 3. vm.runInNewContext로 순수 객체 리터럴 평가
  const params = vm.runInNewContext(`(${objectLiteral})`) as Record<string, unknown>;
  const paramCount = Object.keys(params).length;
  console.log(`   ✅ ${paramCount}개 파라미터 추출 완료`);

  // 4. 타입 검증
  validateValues(params);
  console.log('   ✅ 타입 검증 통과');

  // 5. 기존 파일 크기 측정
  let oldSize = 0;
  if (fs.existsSync(OUTPUT_PATH)) {
    oldSize = fs.statSync(OUTPUT_PATH).size;
  }

  // 6. JSON 출력 (pretty → stories, minified → dist)
  const output = { agGrid: params };
  const prettyJson = JSON.stringify(output, null, 2);
  const minifiedJson = JSON.stringify(output);

  fs.writeFileSync(OUTPUT_PATH, prettyJson + '\n', 'utf-8');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  fs.writeFileSync(DIST_OUTPUT_PATH, minifiedJson, 'utf-8');

  const prettySize = Buffer.byteLength(prettyJson + '\n', 'utf-8');
  const minifiedSize = Buffer.byteLength(minifiedJson, 'utf-8');

  // 7. 크기 통계
  console.log(`\n💾 결과 저장:`);
  console.log(`   ✅ ${OUTPUT_PATH} (pretty)`);
  console.log(`   ✅ ${DIST_OUTPUT_PATH} (minified)`);
  if (oldSize > 0) {
    const reduction = ((1 - minifiedSize / oldSize) * 100).toFixed(1);
    console.log(
      `   📊 기존: ${(oldSize / 1024).toFixed(1)}KB → Pretty: ${(prettySize / 1024).toFixed(1)}KB / Minified: ${(minifiedSize / 1024).toFixed(1)}KB (${reduction}% 감소)`
    );
  } else {
    console.log(`   📊 Pretty: ${(prettySize / 1024).toFixed(1)}KB / Minified: ${(minifiedSize / 1024).toFixed(1)}KB`);
  }
  console.log(`   📊 파라미터: ${paramCount}개`);
}

main();
