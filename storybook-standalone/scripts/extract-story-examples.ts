#!/usr/bin/env tsx
/**
 * Story Example Extractor
 *
 * Storybook story 파일에서 컴포넌트별 사용 예시를 추출하여
 * AI 시스템 프롬프트용 JSON을 생성합니다.
 *
 * 사용법: pnpm story:extract
 * 출력: exports/story-examples.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  ButtonType,
  CheckboxValue,
  FieldInteraction,
  Interaction,
  LinkTone,
  LinkUnderline,
  Mode,
  RadioValue,
  SelectInteraction,
  Size,
  TagColor,
  TagType,
  ToggleSwitchSelected,
} from '../packages/ui/src/types';

// ============================================================================
// Configuration
// ============================================================================

const ROOT_DIR = path.resolve(__dirname, '..');
const STORIES_DIR = path.join(ROOT_DIR, 'packages/ui/src/stories');
const OUTPUT_PATH = path.join(ROOT_DIR, 'exports/story-examples.json');

// AI 서비스에서 사용 가능한 컴포넌트 (components.py AVAILABLE_COMPONENTS_WHITELIST 동기화)
const WHITELIST = new Set([
  'Button', 'Link',
  'Alert', 'Badge', 'Chip', 'Dialog', 'Drawer', 'Divider', 'Tag', 'Tooltip',
  'Checkbox', 'Field', 'Radio', 'Select', 'ToggleSwitch',
  'Pagination', 'DataGrid',
]);

// ============================================================================
// Enum Reverse Map
// ============================================================================

const ALL_ENUMS: Record<string, Record<string, string>> = {
  ButtonType, Interaction, Size, Mode,
  SelectInteraction, FieldInteraction,
  CheckboxValue, RadioValue, ToggleSwitchSelected,
  LinkUnderline, LinkTone,
  TagType, TagColor,
};

/** "ButtonType.PRIMARY" → "primary" 역매핑 */
function buildEnumMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [enumName, enumObj] of Object.entries(ALL_ENUMS)) {
    for (const [key, value] of Object.entries(enumObj)) {
      map.set(`${enumName}.${key}`, value);
    }
  }
  return map;
}

const ENUM_MAP = buildEnumMap();

// ============================================================================
// Types
// ============================================================================

interface StoryExample {
  defaultProps: Record<string, unknown>;
  variants?: string[];
  compoundPattern?: string;
  usageExample: string;
}

interface OutputSchema {
  _meta: {
    generatedAt: string;
    sourceCount: number;
  };
  [componentName: string]: StoryExample | OutputSchema['_meta'];
}

// ============================================================================
// Compound Component Templates (story render에서 파생한 미니멀 예시)
// ============================================================================

const COMPOUND_TEMPLATES: Record<string, { pattern: string; example: string }> = {
  Dialog: {
    pattern: 'Dialog.Header, Dialog.Body, Dialog.Footer',
    example: `<Dialog size="md" open={isOpen} onClose={() => setIsOpen(false)}>
  <Dialog.Header title="제목" subtitle="부제목" />
  <Dialog.Body>내용</Dialog.Body>
  <Dialog.Footer>
    <Button buttonType="outline" label="취소" showStartIcon={false} showEndIcon={false} />
    <Button buttonType="primary" label="확인" showStartIcon={false} showEndIcon={false} />
  </Dialog.Footer>
</Dialog>`,
  },
  Drawer: {
    pattern: 'Drawer.Header, Drawer.Body, Drawer.Footer',
    example: `<Drawer size="md" open={isOpen} onClose={() => setIsOpen(false)}>
  <Drawer.Header title="제목" showSubtitle={false} />
  <Drawer.Body>내용</Drawer.Body>
  <Drawer.Footer>
    <Button buttonType="outline" label="닫기" showStartIcon={false} showEndIcon={false} />
    <Button buttonType="primary" label="확인" showStartIcon={false} showEndIcon={false} />
  </Drawer.Footer>
</Drawer>`,
  },
};

// ============================================================================
// Extraction Logic
// ============================================================================

/** story 파일에서 args 블록 추출 (meta.args 또는 Default story args) */
function extractArgs(content: string): Record<string, unknown> | null {
  // 1순위: meta 정의 내부의 args (Select, Tooltip 등이 이 패턴 사용)
  const metaArgsMatch = content.match(
    /const\s+meta\s*[:=][\s\S]*?\n\s{2}args:\s*\{([\s\S]*?)\n\s{2}\}/
  );

  // 2순위: Default story의 args
  const defaultArgsMatch = content.match(
    /export\s+const\s+Default\s*:\s*Story[\s\S]*?args:\s*\{([\s\S]*?)\n\s{2}\}/
  );

  // 3순위: defaultArgs 변수 (Drawer 패턴: args: { ...defaultArgs })
  const defaultArgsVarMatch = content.match(
    /const\s+defaultArgs[^=]*=\s*\{([\s\S]*?)\n\};/
  );

  // 순서대로 시도하되, 빈 결과면 다음 패턴으로 폴백
  const candidates = [metaArgsMatch?.[1], defaultArgsMatch?.[1], defaultArgsVarMatch?.[1]];
  for (const body of candidates) {
    if (!body) continue;
    const parsed = parseArgsBody(body);
    if (Object.keys(parsed).length > 0) return parsed;
  }

  return null;
}

/** args 블록 문자열을 key-value 객체로 파싱 */
function parseArgsBody(body: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // 각 줄에서 key: value 패턴 추출
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // 주석, 빈 줄, 스프레드 연산자 스킵
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('...')) continue;

    // key: value 매칭 (trailing comma 허용)
    const match = trimmed.match(/^(\w+)\s*:\s*(.+?)(?:,\s*)?$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = resolveValue(rawValue.trim());
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

/** 값 문자열을 실제 타입으로 변환 */
function resolveValue(raw: string): unknown {
  // 함수/콜백은 스킵
  if (raw.startsWith('()') || raw.startsWith('(e)') || raw.includes('=>') || raw.startsWith('console.')) {
    return undefined;
  }

  // JSX 요소 스킵 (<Icon ... /> 등)
  if (raw.startsWith('<')) return undefined;

  // 배열 (옵션 등) — 간략화를 위해 스킵하고 별도 처리
  if (raw.startsWith('[')) return undefined;

  // enum 참조 해결
  const enumValue = ENUM_MAP.get(raw);
  if (enumValue !== undefined) return enumValue;

  // boolean
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // number
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;

  // 문자열 (따옴표 제거)
  const strMatch = raw.match(/^['"`](.*)['"`]$/);
  if (strMatch) return strMatch[1];

  // as Record 캐스팅 등 스킵
  if (raw.includes(' as ')) return undefined;

  return undefined;
}

/** story export 이름에서 variant 목록 추출 */
function extractVariants(content: string, componentName: string): string[] {
  const variants: string[] = [];
  const exportPattern = /export\s+const\s+(\w+)\s*:\s*Story/g;
  let match: RegExpExecArray | null;

  while ((match = exportPattern.exec(content)) !== null) {
    const name = match[1];
    // Default, AlwaysVisible 같은 유틸리티 스토리는 제외
    if (name === 'Default') continue;
    variants.push(name);
  }

  return variants;
}

// ============================================================================
// Props Filtering (프롬프트에 불필요한 props 제거)
// ============================================================================

/** 프롬프트에 불필요한 props 필터 */
const EXCLUDED_PROPS = new Set([
  // Storybook 전용
  'onClose', 'onClick', 'onChange', 'onMouseEnter',
  'action1OnClick', 'action2OnClick',
  // 아이콘 관련 (UMD 빌드에서 미지원)
  'icon', 'startIcon', 'endIcon',
  // 내부 상태
  'cursorOffset',
]);

function filterProps(props: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (EXCLUDED_PROPS.has(key)) continue;
    if (value === undefined) continue;
    filtered[key] = value;
  }
  return filtered;
}

// ============================================================================
// JSX Generation
// ============================================================================

function formatPropValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean' || typeof value === 'number') return `{${value}}`;
  return `{${JSON.stringify(value)}}`;
}

function buildUsageExample(componentName: string, props: Record<string, unknown>): string {
  // Compound 컴포넌트는 템플릿 사용
  if (COMPOUND_TEMPLATES[componentName]) {
    return COMPOUND_TEMPLATES[componentName].example;
  }

  // Tooltip은 children이 필요한 래퍼 패턴
  if (componentName === 'Tooltip') {
    const propsStr = buildPropsString(props);
    return `<Tooltip${propsStr}>\n  <Button label="Hover me" showStartIcon={false} showEndIcon={false} />\n</Tooltip>`;
  }

  // Alert은 children 없이 body prop 사용
  const propsStr = buildPropsString(props);

  // 긴 props는 멀티라인
  if (propsStr.length > 60) {
    return buildMultilineJsx(componentName, props);
  }

  return `<${componentName}${propsStr} />`;
}

function buildPropsString(props: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    parts.push(` ${key}=${formatPropValue(value)}`);
  }
  return parts.join('');
}

function buildMultilineJsx(componentName: string, props: Record<string, unknown>): string {
  const lines = [`<${componentName}`];
  for (const [key, value] of Object.entries(props)) {
    lines.push(`  ${key}=${formatPropValue(value)}`);
  }
  lines.push('/>');
  return lines.join('\n');
}

// ============================================================================
// Select 컴포넌트 특수 처리 (options prop 포함)
// ============================================================================

function enrichSelectProps(props: Record<string, unknown>): Record<string, unknown> {
  // options가 없으면 기본 예시 추가
  if (!('options' in props)) {
    return {
      ...props,
      options: [
        { value: 'option1', label: '옵션 1' },
        { value: 'option2', label: '옵션 2' },
      ],
    };
  }
  return props;
}

function buildSelectExample(props: Record<string, unknown>): string {
  const enriched = enrichSelectProps(props);
  const { options, ...restProps } = enriched;

  const lines = ['<Select'];
  for (const [key, value] of Object.entries(restProps)) {
    lines.push(`  ${key}=${formatPropValue(value)}`);
  }
  // options는 축약 표현
  lines.push(`  options={[{ value: 'option1', label: '옵션 1' }, { value: 'option2', label: '옵션 2' }]}`);
  lines.push('/>');
  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

function processStoryFile(filePath: string): StoryExample | null {
  const fileName = path.basename(filePath, '.stories.tsx');
  if (!WHITELIST.has(fileName)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');

  // Compound 컴포넌트
  if (COMPOUND_TEMPLATES[fileName]) {
    const args = extractArgs(content);
    const variants = extractVariants(content, fileName);
    const defaultProps = args ? filterProps(args) : {};

    return {
      defaultProps,
      ...(variants.length > 0 && { variants }),
      compoundPattern: COMPOUND_TEMPLATES[fileName].pattern,
      usageExample: COMPOUND_TEMPLATES[fileName].example,
    };
  }

  // 일반 컴포넌트
  const args = extractArgs(content);
  if (!args) {
    console.warn(`   [WARN] args 추출 실패: ${fileName}`);
    return null;
  }

  const defaultProps = filterProps(args);
  const variants = extractVariants(content, fileName);

  // Select는 options prop 특수 처리
  let usageExample: string;
  if (fileName === 'Select') {
    usageExample = buildSelectExample(defaultProps);
  } else {
    usageExample = buildUsageExample(fileName, defaultProps);
  }

  return {
    defaultProps,
    ...(variants.length > 0 && { variants }),
    usageExample,
  };
}

function main(): void {
  console.log('Story Example Extractor\n');

  // 1. Story 파일 스캔
  if (!fs.existsSync(STORIES_DIR)) {
    console.error(`stories 디렉토리를 찾을 수 없습니다: ${STORIES_DIR}`);
    process.exit(1);
  }

  const storyFiles = fs.readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.stories.tsx'))
    .map((f) => path.join(STORIES_DIR, f));

  console.log(`${storyFiles.length}개 story 파일 발견\n`);

  // 2. 각 파일 처리
  const output: OutputSchema = {
    _meta: {
      generatedAt: new Date().toISOString(),
      sourceCount: 0,
    },
  };

  let count = 0;
  for (const filePath of storyFiles) {
    const fileName = path.basename(filePath, '.stories.tsx');
    const example = processStoryFile(filePath);
    if (example) {
      output[fileName] = example;
      count++;
      console.log(`  [OK] ${fileName}: ${Object.keys(example.defaultProps).length} props, ${example.variants?.length ?? 0} variants`);
    }
  }

  output._meta.sourceCount = count;

  // 3. 출력
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n완료: ${count}개 컴포넌트 → ${OUTPUT_PATH}`);
}

main();
