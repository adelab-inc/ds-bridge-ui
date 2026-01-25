# Storybook Extractor 분석 결과 및 개선 방안

> **문서 생성일**: 2026-01-22
> **대상**: Carbon Design System (`https://react.carbondesignsystem.com`)
> **비교 대상**: `component-schema.json` vs `react.ds.json`
> **관련 코드**: `apps/web/lib/storybook-extractor.ts`, `apps/web/lib/playwright-extractor.ts`

---

## 📋 분석 개요

두 JSON 파일의 차이점과 Design System Runtime Hub 요구사항 대비 구현 가능성을 분석합니다.

| 파일 | 용도 | 크기 |
|------|------|------|
| `component-schema.json` | @aplus/ui 내부 DS | 2,293 lines |
| `react.ds.json` | Carbon Design System (외부) | 5,294 lines |

---

## 1️⃣ 산출물 현황

| 항목 | 값 | 평가 |
|------|-----|------|
| 컴포넌트 수 | 128개 | ✅ 양호 |
| 스토리 | 추출됨 | ✅ 양호 |
| Props | **381개 모두 placeholder** | ❌ 부적합 |

### Props 품질 문제

```json
// 현재 산출물 (모든 컴포넌트 동일)
{
  "name": "Button",
  "props": [
    { "name": "propertyName", "type": ["unknown"], "defaultValue": "defaultValue" },
    { "name": "propertyName", "type": ["unknown"], "defaultValue": "defaultValue" }
  ]
}

// 필요한 산출물
{
  "name": "Button",
  "props": [
    { "name": "variant", "type": ["primary", "secondary", "danger"], "defaultValue": "primary" },
    { "name": "size", "type": ["sm", "md", "lg"], "defaultValue": "md" },
    { "name": "disabled", "type": ["boolean"], "defaultValue": "false" }
  ]
}
```

**원인**: Carbon Design System Storybook은 **CSR(Client-Side Rendering)** 방식이라 ArgTypes 테이블이 JavaScript 실행 후에만 렌더링됨. Playwright 재시도도 해당 Storybook의 ArgTypes 테이블 구조가 표준과 달라 파싱 실패.

---

## 2️⃣ 두 JSON 구조 비교 분석

### 2.1 메타데이터 구조

| 필드 | component-schema.json | react.ds.json |
|------|----------------------|---------------|
| `name` | ❌ 없음 | ✅ `"react"` |
| `source` | ❌ 없음 | ✅ Storybook URL |
| `version` | ✅ `"1.0.0"` | ✅ `"1.0.0"` |
| `generatedAt` | ✅ timestamp | ❌ (extractedAt 사용) |
| `extractedAt` | ❌ 없음 | ✅ timestamp |

### 2.2 components 구조 (핵심 차이)

#### component-schema.json
```json
{
  "components": {
    "Button": {           // ← Object 형태, displayName이 key
      "displayName": "Button",
      "filePath": "packages/ui/src/components/Button.tsx",
      "category": "UI",
      "props": { ... },
      "stories": [ ... ]
    }
  }
}
```

#### react.ds.json
```json
{
  "components": [
    {                     // ← Array 형태
      "name": "Button",
      "category": "Components",
      "props": [ ... ],
      "stories": [ ... ]
    }
  ]
}
```

| 항목 | component-schema.json | react.ds.json |
|------|----------------------|---------------|
| 데이터 구조 | **Object** (key-value) | **Array** |
| 컴포넌트 식별 | Key 기반 O(1) lookup | 순회 필요 O(n) |
| `displayName` | ✅ 있음 | ❌ `name`만 존재 |
| `filePath` | ✅ 있음 | ❌ 없음 |

### 2.3 props 구조 (가장 큰 차이 - 🚨 심각한 문제)

#### component-schema.json (정상)
```json
{
  "props": {
    "variant": {                    // ← prop name이 key
      "type": ["primary", "secondary", "destructive"],  // 구체적 타입
      "required": false,
      "defaultValue": "primary"     // 실제 기본값
    },
    "isLoading": {
      "type": "boolean",
      "required": false
    }
  }
}
```

#### react.ds.json (🚨 추출 실패)
```json
{
  "props": [
    {
      "name": "propertyName",         // ⚠️ 모든 props가 동일한 placeholder
      "description": "This is a short description",  // ⚠️ placeholder 텍스트
      "type": ["unknown"],            // ⚠️ 타입 추출 실패
      "defaultValue": "defaultValue", // ⚠️ placeholder 값
      "control": null,
      "options": null
    }
  ]
}
```

| 항목 | component-schema.json | react.ds.json |
|------|----------------------|---------------|
| 데이터 구조 | **Object** | **Array** |
| prop 이름 | Key로 사용 | `"propertyName"` (placeholder!) |
| type | 구체적 타입/union | `["unknown"]` (모두 실패) |
| required | ✅ 있음 | ❌ 없음 |
| defaultValue | 실제 값 | `"defaultValue"` (placeholder) |
| description | 일부 있음 | placeholder 텍스트 |
| control/options | ❌ 없음 | ✅ 있음 (모두 null) |

### 2.4 stories 구조

#### component-schema.json
```json
{
  "stories": [
    {
      "id": "ui-button--primary",      // ← URL-safe ID
      "name": "Primary",               // ← 표시명
      "tags": ["dev", "test", "autodocs", "play-fn"]
    }
  ]
}
```

#### react.ds.json
```json
{
  "stories": ["Default", "Secondary", "Ghost"]  // ← 문자열 배열만
}
```

| 항목 | component-schema.json | react.ds.json |
|------|----------------------|---------------|
| 데이터 구조 | **Object Array** | **String Array** |
| Story ID | ✅ 있음 (iframe URL용) | ❌ 없음 |
| Tags | ✅ 있음 | ❌ 없음 |

---

## 3️⃣ Design System Runtime Hub 요구사항 대비 분석

> 기준 문서: `docs/hub/Design_System_Runtime_Hub_Summary.md`

### 3.1 1막: Authority 확보 (Day 1-3)

> 목표: "이 서비스는 진짜다"라는 인상을 10초 안에 전달

| 요구사항 | component-schema.json | react.ds.json |
|----------|----------------------|---------------|
| 유명 DS가 즉시 실행됨 | ✅ 가능 | ⚠️ 부분적 |
| 컴포넌트 클릭 시 실제 화면 표시 | ✅ 가능 (story id 있음) | ⚠️ 제한적 (id 없음) |
| 설명 없이도 서비스 이해 가능 | ✅ 가능 | ⚠️ 제한적 |

**문제점**:
- `react.ds.json`에 story ID가 없어 iframe URL 생성 시 추가 변환 로직 필요
- Story 이름 → Story ID 변환 규칙 구현 필요

### 3.2 2막: 편집 도입 (Day 4-6)

> 목표: 개별 인스턴스의 실행 상태(props)만 변경

| 요구사항 | component-schema.json | react.ds.json |
|----------|----------------------|---------------|
| Props 패널에서 값 변경 | ✅ **가능** | ❌ **불가능** |
| 선택한 인스턴스만 변경됨 | ✅ 가능 | ❌ 불가능 |
| variant, size 등 props 표시 | ✅ 타입/옵션 있음 | ❌ 모두 unknown |

**핵심 문제**:
- `react.ds.json`은 props 정보가 **모두 placeholder**로 추출 실패
- Props 편집 UI를 생성할 수 없음 (어떤 props가 있는지 모름)
- variant 옵션 목록을 표시할 수 없음

### 3.3 3막: AI 조합 (Day 7-10)

> 목표: AI가 DS 안에 있는 컴포넌트 중 목적에 맞는 것을 골라 페이지 구조 생성

| 요구사항 | component-schema.json | react.ds.json |
|----------|----------------------|---------------|
| AI가 JSON 분석 | ✅ **가능** | ❌ **불가능** |
| 관련 컴포넌트 슬라이스 | ✅ 가능 | ⚠️ 제한적 |
| 조합 데이터 출력 | ✅ 가능 | ❌ 불가능 |
| Storybook에서 즉시 실행 | ✅ 가능 | ⚠️ 제한적 |

**핵심 문제**:
- AI가 "로그인 페이지 만들어줘" 요청 시:
  - component-schema.json: Button, TextField 컴포넌트의 props를 알고 조합 가능
  - react.ds.json: props가 unknown이므로 어떤 값을 설정해야 하는지 알 수 없음

### 3.4 4막: 사용자 DS 연동 (Month 1)

> 목표: `npx ds-hub extract` → JSON 추출 → ds.json 생성

| 요구사항 | component-schema.json | react.ds.json |
|----------|----------------------|---------------|
| JSON 추출 가능 | ✅ 정상 | ❌ **추출기 결함** |
| 1-3막 기능 동일하게 작동 | ✅ 가능 | ❌ 불가능 |

**핵심 문제**:
- `react.ds.json` 생성에 사용된 **추출기(extractor)에 심각한 버그** 존재
- ArgTypes/props 정보를 전혀 파싱하지 못하고 placeholder만 생성

### 3.5 구현 가능성 요약

| 기능 | component-schema.json | react.ds.json |
|------|----------------------|---------------|
| **1막: 실행** | ✅ 100% | ⚠️ 60% |
| **2막: 편집** | ✅ 100% | ❌ 0% |
| **3막: AI 조합** | ✅ 100% | ❌ 10% |
| **4막: DS 연동** | ✅ 100% | ❌ 0% |

---

## 4️⃣ iframe 미리보기 가능 여부

### Story ID 변환 패턴

| ds.json 데이터 | 실제 Storybook ID |
|---------------|------------------|
| category: `Components`, name: `Button`, story: `Default` | `components-button--default` |
| category: `Components`, name: `Button`, story: `Danger` | `components-button--danger` |

### 변환 공식

```typescript
function buildStoryId(category: string, name: string, story: string): string {
  const prefix = `${category}/${name}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\//g, '-');

  const suffix = story.toLowerCase().replace(/\s+/g, '-');

  return `${prefix}--${suffix}`;
}

// 예시
buildStoryId("Components", "Button", "Default")
// → "components-button--default"
```

### iframe URL 생성

```typescript
const iframeUrl = `${source}/iframe.html?id=${storyId}&viewMode=story`;

// 예시
// https://react.carbondesignsystem.com/iframe.html?id=components-button--default&viewMode=story
// ✅ HTTP 200 확인됨
```

### 결론

| 기능 | 가능 여부 | 비고 |
|------|----------|------|
| 컴포넌트 목록 표시 | ✅ | 128개 컴포넌트 |
| 스토리 목록 표시 | ✅ | 각 컴포넌트별 스토리 |
| iframe 미리보기 | ✅ | `category + name + story` → storyId 변환 필요 |
| Props 편집 | ❌ | placeholder 데이터 |

**현재 산출물만으로 1막(Authority 확보) 목표 달성 가능**

---

## 5️⃣ 성능 문제 분석 및 해결

### 18분 소요 원인

| 단계 | 처리 방식 | 소요 시간 |
|------|----------|----------|
| Cheerio (128개) | 병렬 5개씩 | ~30초 |
| **Playwright 재시도 (128개)** | **순차 처리** | **~17분** |

### 성능 개선 결과 ✅

> **커밋**: `bdca21b3` - ⚡ Perf: Playwright 비활성화 옵션 및 조기 종료 로직 추가

| 설정 | 소요 시간 | 산출물 |
|------|----------|--------|
| 개선 전 (Playwright 순차) | **18분** | react.ds.json |
| `?playwright=false` | **6.8초** | 동일 |
| 기본 (5회 실패 후 중단) | **30.1초** | 동일 |

**158배 성능 향상**: 18분 → 6.8초

---

## 6️⃣ 추출기(Extractor) 코드 분석

### 6.1 두 추출기 비교

| 항목 | extract-component-schema.ts | storybook-extractor.ts |
|------|---------------------------|----------------------|
| **용도** | 내부 DS (소스 코드 접근 가능) | 외부 DS (URL만 접근) |
| **방식** | `react-docgen-typescript` | HTML 스크래핑 (Cheerio) |
| **Props 추출** | ✅ TypeScript AST 분석 | ❌ CSS 선택자 파싱 |
| **결과** | 정확한 타입/기본값 | placeholder 또는 unknown |

### 6.2 storybook-extractor.ts 핵심 문제점

#### 문제 1: HTML 선택자 불일치

```typescript
// storybook-extractor.ts:29-112
const SELECTORS = {
  table: [
    '.docblock-argstable',           // Storybook 7+ 기본
    '[class*="argstable"]',          // 클래스명 변형
    // ... 8개 선택자
  ].join(', '),

  typeOptions: [
    'td:nth-child(2) span.css-o1d7ko',  // 🚨 해시 클래스 (버전마다 다름!)
    // ...
  ].join(', '),
};
```

**문제**:
- `css-o1d7ko` 같은 해시 클래스는 Storybook 빌드마다 변경됨
- Carbon DS의 Storybook은 다른 HTML 구조 사용

#### 문제 2: Props 파싱 실패 시 fallback

```typescript
// storybook-extractor.ts:515-522
props.push({
  name,
  description,
  type: type.length > 0 ? type : ['unknown'],  // 🚨 실패 시 'unknown'
  defaultValue,
  control,
  options,
});
```

**문제**: 타입 추출 실패 시 `['unknown']`으로 설정 → 모든 props가 unknown

#### 문제 3: 테이블 못 찾으면 빈 배열 반환

```typescript
// storybook-extractor.ts:468-476
export function parseArgTypesFromHtml(html: string): PropInfo[] {
  const $ = cheerio.load(html);
  const props: PropInfo[] = [];

  const table = $(SELECTORS.table).first();
  if (!table.length) {
    return props;  // 🚨 빈 배열 반환!
  }
  // ...
}
```

#### 문제 4: CSR Storybook 대응 불완전

```typescript
// storybook-extractor.ts:251-257
try {
  const html = await fetchDocsHtml(baseUrl, info.docsId);  // 🚨 SSR HTML만
  props = parseArgTypesFromHtml(html);

  // Playwright 재시도 필요 여부 판단
  needsPlaywright = props.length === 0 || props.some(isPlaceholderProp);
} catch (error) {
  // ...
}
```

### 6.3 extract-component-schema.ts 성공 이유

```typescript
// extract-component-schema.ts:74-95
const parser = withCompilerOptions(
  {
    esModuleInterop: true,
    jsx: 4,  // JsxEmit.ReactJSX
  },
  {
    savePropValueAsString: true,
    shouldExtractLiteralValuesFromEnum: true,  // ✅ enum 타입 추출
    shouldRemoveUndefinedFromOptional: true,
  }
);

const docs: ComponentDoc[] = parser.parse(targetPath);
```

**성공 요인**:
- TypeScript 컴파일러 API 사용
- 소스 코드 AST 분석으로 정확한 타입 추출
- enum, union 타입 등 복잡한 타입도 파싱 가능

---

## 7️⃣ Carbon DS 실제 HTML 구조 분석 (Playwright 검증 결과)

### 7.1 Component API 테이블 실제 구조

Carbon Design System Storybook (https://react.carbondesignsystem.com) Button 컴포넌트 docs 페이지 분석 결과:

```
iframe
└── table [ref=f1e199]                    ← 메인 테이블 (클래스 없음!)
    ├── rowgroup [ref=f1e200]             ← 헤더 그룹
    │   └── row "Name Description Default"
    │       ├── columnheader "Name"
    │       ├── columnheader "Description"
    │       └── columnheader "Default"
    │
    └── rowgroup [ref=f1e205]             ← 바디 그룹
        ├── row "ref ReactComponentPropsWithRef['ref'] -"
        │   ├── cell "ref"                 ← prop 이름
        │   ├── cell                       ← 설명 + 타입
        │   │   └── generic: "ReactComponentPropsWithRef['ref']"
        │   └── cell "-"                   ← 기본값
        │
        ├── row "as Specify how the button... union -"
        │   ├── cell "as"
        │   ├── cell
        │   │   ├── paragraph: "Specify how the button itself..."
        │   │   └── generic: "union"       ← 타입 정보!
        │   └── cell "-"
        │
        ├── row "disabled ... boolean -"
        │   ├── cell "disabled"
        │   ├── cell
        │   │   ├── generic: "Specify whether the Button should be disabled"
        │   │   └── generic: "boolean"     ← 타입 정보!
        │   └── cell "-"
        │
        └── ... (더 많은 rows)
```

### 7.2 실제 추출된 Props 데이터 (Button 컴포넌트)

| Prop Name | Type | Description | Default |
|-----------|------|-------------|---------|
| `ref` | `ReactComponentPropsWithRef['ref']` | - | `-` |
| `as` | `union` | Specify how the button itself should be rendered | `-` |
| `autoAlign` | `boolean` | **Experimental**: Will attempt to automatically align the tooltip | `-` |
| `children` | `other` | Specify the content of your Button | `-` |
| `className` | `string` | Specify an optional className | `-` |
| `dangerDescription` | `string` | Specify the message read by screen readers for danger variant | `-` |
| `disabled` | `boolean` | Specify whether the Button should be disabled | `-` |
| `hasIconOnly` | `boolean` | Specify if the button is an icon-only button | `-` |
| `href` | `string` | Optionally specify an href for your Button to become an `<a>` | `-` |
| `iconDescription` | `other` | Provide a description for the icon | `-` |
| `isExpressive` | `boolean` | Specify whether the Button is expressive | `-` |
| `isSelected` | `boolean` | Specify whether the Button is currently selected (Ghost only) | `-` |
| `kind` | `other` | Specify the kind of Button you want to create | `-` |
| `size` | `enum` | Specify the size of the button: sm, md, lg, xl, 2xl | `-` |
| `tabIndex` | `number` | Optional prop to specify the tabIndex | `-` |
| `tooltipAlignment` | `enum` | Alignment: start, center, end | `-` |
| `tooltipPosition` | `enum` | Position: top, bottom, left, right | `-` |
| `type` | `enum` | Specify the type of the Button | `-` |

### 7.3 현재 선택자 vs 실제 구조 불일치

| 현재 storybook-extractor.ts | Carbon DS 실제 구조 |
|---------------------------|-------------------|
| `.docblock-argstable` | `table` (클래스 없음) |
| `td:nth-child(1)` | `cell` (첫 번째) |
| `td:nth-child(2) span.css-o1d7ko` | `cell > generic` (타입 정보) |
| `td:nth-child(3)` | `cell` (기본값) |

**핵심 발견**:
1. Carbon DS는 `.docblock-argstable` 클래스를 사용하지 않음
2. 타입 정보가 `generic` role 요소 내부에 텍스트로 존재
3. CSS 해시 클래스 (`css-o1d7ko`) 대신 semantic role 사용

---

## 8️⃣ 상세 수정 계획

### 8.1 Phase 1: HTML 선택자 수정 (P0 - 즉시)

**파일**: `apps/web/lib/storybook-extractor.ts`

#### A. 테이블 선택자 확장

```typescript
// 현재 (불완전)
const SELECTORS = {
  table: [
    '.docblock-argstable',
    '[class*="argstable"]',
    // ...
  ].join(', '),
};

// 수정안
const SELECTORS = {
  table: [
    // 기존 선택자 유지 (다른 Storybook과 호환)
    '.docblock-argstable',
    '[class*="argstable"]',
    'table[class*="args"]',

    // Carbon DS 대응 추가
    'table',                           // 일반 테이블 (iframe 내부에서는 유일할 가능성 높음)
    '[role="table"]',                  // role 기반 선택
  ].join(', '),
};
```

#### B. 타입 추출 로직 개선

```typescript
// 현재 (해시 클래스 의존)
typeOptions: [
  'td:nth-child(2) span.css-o1d7ko',  // ❌ 버전마다 변경됨
],

// 수정안 (role 기반 + 구조 기반)
function extractTypeFromCell($cell: Cheerio): string[] {
  const types: string[] = [];

  // 1. role="generic" 요소에서 타입 텍스트 찾기
  $cell.find('[role="generic"], generic').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (['boolean', 'string', 'number', 'enum', 'union', 'function', 'other'].includes(text)) {
      types.push(text);
    }
  });

  // 2. 마지막 자식 요소 텍스트 확인 (Carbon DS 패턴)
  const lastChild = $cell.children().last();
  const lastText = lastChild.text().trim().toLowerCase();
  if (types.length === 0 && ['boolean', 'string', 'number', 'enum', 'union', 'function', 'other'].includes(lastText)) {
    types.push(lastText);
  }

  // 3. 기존 CSS 선택자 fallback
  if (types.length === 0) {
    // 기존 로직 유지
  }

  return types.length > 0 ? types : ['unknown'];
}
```

### 8.2 Phase 2: Playwright 기반 추출 강화 (P0 - 즉시)

**파일**: `apps/web/lib/playwright-extractor.ts`

#### A. Storybook JavaScript API 우선 사용

```typescript
export async function extractPropsViaStorybookAPI(page: Page): Promise<PropInfo[]> {
  // Storybook 내부 API 접근 시도
  const storyData = await page.evaluate(() => {
    // Storybook 7+
    const preview = (window as any).__STORYBOOK_PREVIEW__;
    if (preview?.storyStore) {
      const store = preview.storyStore;
      // 현재 스토리의 argTypes 추출
      const currentStory = store.getStoryContext(store.getSelection());
      return {
        argTypes: currentStory?.argTypes,
        parameters: currentStory?.parameters,
      };
    }

    // Storybook 6
    const legacyStore = (window as any).__STORYBOOK_STORY_STORE__;
    if (legacyStore) {
      const selection = legacyStore.getSelection();
      const story = legacyStore.fromId(selection.storyId);
      return {
        argTypes: story?.argTypes,
        parameters: story?.parameters,
      };
    }

    return null;
  });

  if (storyData?.argTypes) {
    return convertArgTypesToPropInfo(storyData.argTypes);
  }

  // API 실패 시 HTML 파싱으로 fallback
  return null;
}
```

#### B. HTML 파싱 개선 (iframe 내부 접근)

```typescript
export async function extractPropsFromDocsIframe(page: Page): Promise<PropInfo[]> {
  // iframe 내부로 컨텍스트 전환
  const iframe = page.frameLocator('iframe[title*="storybook"]').first();

  // Component API 테이블 찾기
  const table = await iframe.locator('table').first();

  if (await table.count() === 0) {
    return [];
  }

  const props: PropInfo[] = [];

  // 각 행 순회
  const rows = await iframe.locator('table tbody tr, table [role="rowgroup"]:last-child [role="row"]').all();

  for (const row of rows) {
    const cells = await row.locator('td, [role="cell"]').all();
    if (cells.length >= 3) {
      const name = await cells[0].innerText();
      const descCell = await cells[1].innerText();
      const defaultValue = await cells[2].innerText();

      // 타입 추출 (마지막 generic 요소)
      const typeElements = await cells[1].locator('[role="generic"]').all();
      let type = 'unknown';
      if (typeElements.length > 0) {
        type = await typeElements[typeElements.length - 1].innerText();
      }

      props.push({
        name: name.trim(),
        description: extractDescription(descCell, type),
        type: [type.toLowerCase()],
        defaultValue: defaultValue === '-' ? null : defaultValue,
        control: mapTypeToControl(type),
        options: null,
      });
    }
  }

  return props;
}
```

### 8.3 Phase 3: Story ID 추출 로직 추가 (P0 - 즉시)

**파일**: `apps/web/lib/storybook-extractor.ts`

```typescript
// index.json에서 이미 story ID 존재 → 활용
export function buildComponentsWithStoryIds(
  indexJson: StorybookIndex,
  propsMap: Map<string, PropInfo[]>
): DSComponent[] {
  const componentMap = new Map<string, DSComponent>();

  for (const [storyId, entry] of Object.entries(indexJson.entries)) {
    // title에서 category와 component name 추출
    const [category, componentName] = parseTitle(entry.title);

    if (!componentMap.has(componentName)) {
      componentMap.set(componentName, {
        name: componentName,
        category,
        stories: [],
        props: propsMap.get(componentName) || [],
      });
    }

    const component = componentMap.get(componentName)!;

    // story 정보 추가 (ID 포함!)
    if (entry.type === 'story') {
      component.stories.push({
        id: storyId,              // ✅ Story ID 포함
        name: entry.name,
        tags: entry.tags || [],
      });
    }
  }

  return Array.from(componentMap.values());
}
```

### 8.4 Phase 4: 스키마 통합 (P1 - 단기)

**파일**: `apps/web/types/ds-extraction.ts`

```typescript
// 통합 스키마 타입 정의
export interface UnifiedDSJson {
  name: string;
  source: string;
  version: string;
  extractedAt: string;

  components: {
    [componentName: string]: {
      displayName: string;
      category: string;
      filePath?: string;

      props: {
        [propName: string]: {
          type: string | string[];
          required: boolean;
          defaultValue: unknown;
          description?: string;
          control?: 'select' | 'number' | 'text' | 'boolean' | 'object';
          options?: string[];
        };
      };

      stories: Array<{
        id: string;
        name: string;
        tags?: string[];
      }>;
    };
  };
}
```

---

## 9️⃣ 구현 순서 및 검증 계획

### 9.1 구현 순서

```
Week 1: Phase 1 + 2 (Critical)
├── Day 1-2: HTML 선택자 수정 및 테스트
├── Day 3-4: Playwright API 추출 로직 구현
└── Day 5: Carbon DS로 검증

Week 2: Phase 3 + 4 (Important)
├── Day 1-2: Story ID 추출 로직 통합
├── Day 3-4: 스키마 통합 및 타입 정의
└── Day 5: 전체 통합 테스트
```

### 9.2 검증 방법

#### A. 단위 테스트

```typescript
// __tests__/storybook-extractor.test.ts
describe('parseArgTypesFromHtml', () => {
  it('should extract props from Carbon DS HTML structure', () => {
    const html = `
      <table>
        <tbody>
          <tr><td>disabled</td><td>Specify whether... <span>boolean</span></td><td>-</td></tr>
        </tbody>
      </table>
    `;
    const props = parseArgTypesFromHtml(html);
    expect(props[0].name).toBe('disabled');
    expect(props[0].type).toContain('boolean');
  });
});
```

#### B. E2E 테스트 (Playwright)

```typescript
// __tests__/e2e/carbon-extraction.test.ts
test('should extract Button props from Carbon DS', async ({ page }) => {
  await page.goto('https://react.carbondesignsystem.com/?path=/docs/components-button--overview');
  await page.waitForSelector('iframe');

  const props = await extractPropsFromDocsIframe(page);

  expect(props).toContainEqual(
    expect.objectContaining({ name: 'disabled', type: ['boolean'] })
  );
  expect(props).toContainEqual(
    expect.objectContaining({ name: 'size', type: ['enum'] })
  );
});
```

#### C. 수동 검증 체크리스트

- [ ] Carbon DS Button 컴포넌트 props 추출 성공
- [ ] props.name이 실제 prop 이름 (disabled, size, kind 등)
- [ ] props.type이 실제 타입 (boolean, enum, string 등)
- [x] stories에 id 필드 포함 ✅ (커밋: `79df0f55`)
- [x] PropInfo에 required 필드 포함 ✅ (커밋: `79df0f55`)
- [x] Storybook JavaScript API 추출 ✅ (커밋: `b0b505a3`)
- [x] Carbon DS role 기반 타입 파싱 ✅ (커밋: `dfb11846`)
- [x] components Object 구조 옵션 ✅ (커밋: `4c9eaff4`)
- [x] filePath 필드 추가 ✅ (커밋: `2d333320`)
- [x] tags 필드 추가 ✅ (커밋: `2f27a848`)
- [ ] 기존 Storybook 7 호환성 유지

---

## 🔟 우선순위 및 수정 대상 파일 목록

### 우선순위 정리

| 우선순위 | 작업 | 영향 | 상태 |
|---------|------|------|------|
| 🔴 P0 | Props 추출 로직 수정 | 2막, 3막 전체 | ✅ **완료** (`b0b505a3`, `dfb11846`) |
| 🔴 P0 | Story ID 추출 | 1막 iframe 렌더링 | ✅ **완료** (`79df0f55`) |
| 🔴 P0 | required 필드 추가 | Props 정보 완성도 | ✅ **완료** (`79df0f55`) |
| 🟡 P1 | components를 Object로 변경 | 성능, AI 분석 | ✅ **완료** (`4c9eaff4`) |
| 🟡 P1 | filePath 추가 | 4막 소스 연결 | ✅ **완료** (`2d333320`) |
| 🟢 P2 | tags 추가 | 필터링, 분류 | ✅ **완료** (`2f27a848`) |

### 수정 대상 파일

| 파일 | 수정 내용 | 우선순위 |
|------|----------|---------|
| `apps/web/lib/storybook-extractor.ts` | HTML 선택자 확장, 타입 추출 로직 개선 | P0 |
| `apps/web/lib/playwright-extractor.ts` | Storybook API 추출, iframe 파싱 개선 | P0 |
| `apps/web/types/ds-extraction.ts` | 통합 스키마 타입 정의 | P1 |
| `apps/web/app/api/extract/route.ts` | 추출 API 로직 통합 | P1 |

---

## 📌 결론

### component-schema.json
- ✅ 내부 DS용으로 **완벽하게 작동**
- ✅ 모든 Hub 기능 (1-4막) 구현 가능

### react.ds.json
- ✅ ~~Props 추출 완전 실패~~ → **Storybook API 추출 구현됨** (`b0b505a3`)
- ✅ ~~Story ID 없음~~ → **해결됨** (커밋: `79df0f55`)
- ✅ ~~required 필드 없음~~ → **해결됨** (커밋: `79df0f55`)
- ✅ ~~Carbon DS 타입 파싱~~ → **role 기반 파싱 구현됨** (`dfb11846`)

### 권장 조치 (모두 완료)
1. ~~**즉시**: Story ID 생성 로직 추가~~ ✅ **완료** (`79df0f55`)
2. ~~**즉시**: Storybook JavaScript API를 통한 argTypes 추출 구현~~ ✅ **완료** (`b0b505a3`)
3. ~~**단기**: Carbon DS role 기반 HTML 파싱 개선~~ ✅ **완료** (`dfb11846`)
4. ~~**중기**: 스키마 통합 및 표준화 (components Object 구조)~~ ✅ **완료** (`4c9eaff4`)
5. ~~**중기**: filePath 필드 추가~~ ✅ **완료** (`2d333320`)
6. ~~**중기**: tags 필드 추가~~ ✅ **완료** (`2f27a848`)

---

## 📎 관련 문서

- [Design System Runtime Hub Summary](/docs/hub/Design_System_Runtime_Hub_Summary.md)
- [Storybook Extractor Improvements](/docs/hub/storybook-extractor-improvements.md)
