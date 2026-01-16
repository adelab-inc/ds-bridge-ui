# AI 생성 코드 렌더링 구현

> AI 응답으로 받은 React 코드를 Preview 영역에 실시간 렌더링하는 기능

---

## 개요

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-01-16 |
| 목적 | AI 생성 React 코드를 iframe 내에서 렌더링 |
| 선택 방식 | iframe + UMD 번들 |
| 대상 파일 | `code-preview-iframe.tsx` 신규 생성 |
| MVP 범위 | `@aplus/ui` 하드코딩, 동적 경로는 4막에서 추가 |

---

## 1. AI 응답 형식

### 1.1 Response 구조

```json
{
  "type": "code",
  "path": "src/pages/BeerLandingPage.tsx",
  "content": "import { useState } from 'react';\nimport { Heading, Chip, Button } from '@/components';\n\nexport default function BeerLandingPage() { ... }"
}
```

### 1.2 TypeScript 타입 정의

```typescript
// types/ai-response.ts
interface AICodeResponse {
  type: 'code';
  path: string;      // 파일 경로 (MVP: 표시용, 미래: 파일 생성용)
  content: string;   // React 컴포넌트 코드
}

interface AITextResponse {
  type: 'text';
  content: string;   // 일반 텍스트 응답
}

type AIResponse = AICodeResponse | AITextResponse;
```

### 1.3 필드 설명

| 필드 | 타입 | MVP 사용 | 설명 |
|------|------|----------|------|
| `type` | `'code' \| 'text'` | ✅ 분기용 | 렌더링 모드 결정 |
| `path` | `string` | 🔶 표시용 | 파일 경로 (나중에 Export 기능에서 사용) |
| `content` | `string` | ✅ 렌더링 | JSX/TSX 코드 문자열 |

### 1.4 코드 특징

- JSX/TSX 문법
- `@/components`에서 디자인 시스템 컴포넌트 import
- React hooks 사용 (`useState`, `useEffect`)

---

## 2. 기술 선택지 비교

| 방식 | 번들 크기 | @/components 지원 | CSS 격리 | 동적 DS 로딩 | 구현 복잡도 |
|------|----------|------------------|---------|-------------|------------|
| **react-live** | ~88KB | scope 주입 | ❌ 없음 | ❌ 불가 | 낮음 |
| **Sandpack** | ~150-200KB | 가상 node_modules | ✅ iframe | 🔶 복잡 | 중간 |
| **iframe + UMD** | ~30KB (Sucrase) | script 로드 | ✅ iframe | ✅ 경로만 변경 | 중간 |

---

## 3. 선택: iframe + UMD 번들

### 3.1 선택 이유

**1. 플랫폼 철학과 일치**

> "설명 말고, 실행하세요" - Design System Runtime Hub

- 에디터 없이 순수 실행 화면만 제공
- Sandpack은 에디터 중심 → 플랫폼 정체성과 충돌

**2. 4막 (사용자 DS 연동) 지원**

```tsx
// 경로만 바꾸면 다른 DS 로드 가능
<script src={`/api/bundle?path=${userDsPath}`}></script>
```

**3. 워크플로우와 일치**

```
실행 화면 확인 → Copy for AI → IDE에서 vibe coding
──────────────────────────────────────────────────
플랫폼에서 편집 ❌ (Sandpack)
IDE에서 편집 ⭕ (iframe + UMD)
```

**4. Storybook과 UX 일관성**

- 현재 Storybook도 iframe으로 표시
- AI 생성 코드도 동일한 방식(iframe) → 일관된 UX

**5. 완전한 CSS/JS 격리**

- react-live는 부모 앱과 스타일 충돌 가능
- iframe은 완전히 독립된 환경

### 3.2 용어 설명

**UMD (Universal Module Definition)**
- `<script>` 태그로 브라우저에서 바로 사용할 수 있는 번들 형식
- 전역 변수로 노출: `window.AplusUI.Button`

**Sucrase**
- JSX/TypeScript를 JavaScript로 변환하는 초고속 트랜스파일러
- Babel 대비 4-10배 빠름, 번들 크기 ~30KB (Babel ~400KB)

---

## 4. 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Preview Area                                               │
├─────────────────────────────────────────────────────────────┤
│  mode === 'storybook'     →  <StorybookIframe url={...} /> │
│  mode === 'ai-generated'  →  <CodePreviewIframe code={...}/>│
└─────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│  iframe (srcDoc)                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  <script> React 19 UMD </script>                       │  │
│  │  <script> ReactDOM 19 UMD </script>                    │  │
│  │  <script> @aplus/ui UMD 번들 </script>                 │  │
│  │  <link> 디자인 시스템 CSS </link>                      │  │
│  │  ────────────────────────────────────────────────────  │  │
│  │  <script>                                              │  │
│  │    // Sucrase로 트랜스파일된 코드                       │  │
│  │    const { Button, Chip } = window.AplusUI;            │  │
│  │    function Component() { ... }                        │  │
│  │    ReactDOM.createRoot(...).render(<Component />);     │  │
│  │  </script>                                             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. MVP 런타임 흐름

### 5.1 전체 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│  빌드 시점 (1회)                                                 │
├─────────────────────────────────────────────────────────────────┤
│  storybook-standalone/packages/ui                               │
│  └── pnpm build:umd                                             │
│      ├── dist/ui.umd.js   (하드코딩된 @aplus/ui 번들)            │
│      └── dist/ui.css      (디자인 시스템 스타일)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  런타임                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AI 응답 수신 (Firebase Realtime)                           ││
│  │  {                                                          ││
│  │    "type": "code",        ← 렌더링 모드 분기                 ││
│  │    "path": "...",         ← MVP: 파일명 표시용               ││
│  │    "content": "import..." ← CodePreviewIframe에 전달        ││
│  │  }                                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PreviewSection 분기 로직                                   ││
│  │                                                             ││
│  │  response.type === 'code'                                   ││
│  │    ? <CodePreviewIframe code={response.content} />          ││
│  │    : <StorybookIframe url={storybookUrl} />                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  CodePreviewIframe                                          ││
│  │  1. import 문 제거 (정규식)                                  ││
│  │  2. Sucrase로 JSX → JS 트랜스파일                           ││
│  │  3. srcDoc HTML 생성                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  iframe (srcDoc)                                            ││
│  │  - React 19 UMD (CDN)                                       ││
│  │  - @aplus/ui UMD (/api/ui-bundle)                           ││
│  │  - 트랜스파일된 컴포넌트 실행                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 DS 경로 설정

| 단계 | 경로 처리 방식 | 설명 |
|------|--------------|------|
| **MVP** | 하드코딩 | `storybook-standalone/packages/ui` 고정 |
| **4막** | 동적 입력 | 사용자가 경로 입력 → API Route에서 동적 서빙 |

**MVP 경로 (하드코딩):**
```
/Users/finelab-mini/Desktop/workspace/ds-bridge-ui/storybook-standalone/packages/ui
├── src/components/     # 소스 코드
└── dist/
    ├── ui.umd.js       # UMD 번들 (빌드 결과)
    └── ui.css          # CSS 번들
```

---

## 6. 구현 계획

### Phase 1: UMD 번들 생성 ✅ 완료

**작업 내용:**
1. `@aplus/ui`에 esbuild 빌드 스크립트 추가
2. UMD 번들 출력: `dist/ui.umd.js`
3. CSS 번들 출력: `dist/ui.css`
4. `@ds-hub/web` prebuild에서 자동 빌드 설정

**생성/수정 파일:**
- `storybook-standalone/packages/ui/esbuild.config.mjs` - 신규 생성
- `storybook-standalone/packages/ui/package.json` - build:umd, build:css 스크립트 추가
- `apps/web/package.json` - prebuild 스크립트 추가

**빌드 결과물:**
| 파일 | 크기 | 설명 |
|------|------|------|
| `dist/ui.umd.js` | 89KB | UMD 번들 (minified) |
| `dist/ui.umd.js.map` | 372KB | 소스맵 |
| `dist/ui.css` | 35KB | Tailwind CSS 번들 |

**팀원 동기화:**
- `dist/`는 gitignore 처리됨
- `apps/web`의 `pnpm build` 실행 시 `prebuild`가 자동으로 UMD 번들 생성
- 모든 팀원이 동일한 빌드 결과물을 얻음

**prebuild 설정:**
```json
// apps/web/package.json
{
  "scripts": {
    "prebuild": "cd ../../storybook-standalone/packages/ui && pnpm build:umd",
    "build": "next build"
  }
}
```

> **Note**: `storybook-standalone`은 pnpm workspace에 포함되어 있지 않아 `--filter` 대신 직접 경로 이동 사용

**esbuild 설정:**
```js
// storybook-standalone/packages/ui/esbuild.config.mjs
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'AplusUI',
  outfile: 'dist/ui.umd.js',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  banner: {
    js: `const React = window.React;\nconst ReactDOM = window.ReactDOM;`,
  },
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  jsx: 'automatic',
  plugins: [/* ag-grid, ag-charts, lottie-react stub plugin */],
});
```

**Heavy Dependencies Stub 처리:**

ag-grid, ag-charts, lottie-react는 각각 200KB+ 크기로 UMD 번들에 포함 시 500KB+가 됩니다.
번들 크기 최적화를 위해 stub(빈 껍데기)으로 대체하여 **해당 컴포넌트는 현재 렌더링되지 않습니다**.

| 컴포넌트 | 의존성 | UMD 번들에서 |
|---------|--------|-------------|
| `<DataGrid />` | ag-grid | ❌ 렌더링 안됨 |
| `<Chart />` | ag-charts | ❌ 렌더링 안됨 |
| `<LottieAnimation />` | lottie-react | ❌ 렌더링 안됨 |
| `<Button />`, `<Chip />` 등 | 없음 | ✅ 정상 작동 |

**향후 해결 방안 (필요시):**
1. **CDN 로드**: iframe 내에서 ag-grid/ag-charts CDN 스크립트를 별도 로드
2. **조건부 번들링**: Chart/DataGrid 전용 별도 UMD 번들 생성 (`ui.charts.umd.js`)

### Phase 2: 번들 서빙 API ✅ 완료

**작업 내용:**
1. Next.js API Route로 UMD 번들 동적 서빙
2. JS 번들과 CSS 번들 각각 별도 엔드포인트 제공

**생성 파일:**
- `apps/web/app/api/ui-bundle/route.ts` - JS 번들 서빙
- `apps/web/app/api/ui-bundle/css/route.ts` - CSS 번들 서빙

**API 엔드포인트:**

| 엔드포인트 | Content-Type | 용도 |
|-----------|--------------|------|
| `GET /api/ui-bundle` | `application/javascript` | UMD 번들 (window.AplusUI) |
| `GET /api/ui-bundle/css` | `text/css` | Tailwind CSS 스타일 |

**iframe에서 사용:**
```html
<script src="/api/ui-bundle"></script>
<link href="/api/ui-bundle/css" rel="stylesheet">
<script>
  const { Button, Chip } = window.AplusUI;
</script>
```

**캐싱 설정:**
- `Cache-Control: public, max-age=31536000, immutable`
- 번들이 변경되면 브라우저 캐시 무효화 필요 (버전 쿼리 파라미터 추가 예정)

### Phase 3: CodePreviewIframe 컴포넌트 ✅ 완료

**작업 내용:**
1. Sucrase로 JSX/TypeScript 트랜스파일
2. import 문 처리 (`@/components` → `window.AplusUI`)
3. 컴포넌트 이름 자동 추출 (`export default function ComponentName`)
4. iframe srcDoc 생성 (React 19 UMD + AplusUI UMD)
5. 에러 처리 (트랜스파일 에러, 렌더링 에러)

**생성 파일:**
- `apps/web/components/features/preview/code-preview-iframe.tsx`

**의존성 추가:**
- `sucrase: ^3.35.1` (apps/web)

**컴포넌트 Props:**

| Prop | 타입 | 설명 |
|------|------|------|
| `code` | `string` | AI가 생성한 React 컴포넌트 코드 |
| `filePath` | `string?` | 파일 경로 (상단에 표시) |

**코드 변환 흐름:**
```
1. 컴포넌트 이름 추출: export default function BeerLandingPage → "BeerLandingPage"
2. import 추출: import { Heading, Chip } from '@/components' → ["Heading", "Chip"]
3. import 문 제거: react, @/components import 모두 제거
4. Sucrase 트랜스파일: JSX → React.createElement 호출로 변환
5. srcDoc 생성: React UMD + AplusUI UMD + 트랜스파일된 코드
```

**SSE 응답 타입 (기존 정의됨):**
```typescript
// types/chat.ts
export interface CodeEvent {
  type: 'code';
  path: string;      // "src/pages/BeerLandingPage.tsx"
  content: string;   // React 컴포넌트 코드
}
```

### Phase 4: PreviewSection 통합

**작업 내용:**
1. 기존 StorybookIframe과 CodePreviewIframe 분기
2. AI 응답 타입에 따른 렌더링 모드 전환

**수정 파일:**
- `apps/web/components/features/preview/preview-section.tsx` - 수정

---

## 7. 핵심 코드

### 7.1 AI Response 타입 정의

```typescript
// apps/web/types/ai-response.ts
export interface AICodeResponse {
  type: 'code';
  path: string;
  content: string;
}

export interface AITextResponse {
  type: 'text';
  content: string;
}

export type AIResponse = AICodeResponse | AITextResponse;
```

### 7.2 PreviewSection 분기 로직

```tsx
// apps/web/components/features/preview/preview-section.tsx
import { StorybookIframe } from './storybook-iframe';
import { CodePreviewIframe } from './code-preview-iframe';
import type { AIResponse } from '@/types/ai-response';

interface PreviewSectionProps {
  storybookUrl?: string;
  aiResponse?: AIResponse;
}

function PreviewSection({ storybookUrl, aiResponse }: PreviewSectionProps) {
  // AI 코드 응답이 있으면 CodePreviewIframe 렌더링
  if (aiResponse?.type === 'code') {
    return (
      <div className="flex-1 flex flex-col">
        {/* 파일 경로 표시 (옵션) */}
        <div className="px-3 py-2 text-sm text-muted-foreground border-b">
          {aiResponse.path}
        </div>
        <CodePreviewIframe
          code={aiResponse.content}
          className="flex-1"
        />
      </div>
    );
  }

  // 기본: Storybook iframe
  return <StorybookIframe url={storybookUrl} />;
}
```

### 7.3 CodePreviewIframe 컴포넌트

```tsx
// apps/web/components/features/preview/code-preview-iframe.tsx
"use client"

import * as React from "react"
import { transform } from "sucrase"

interface CodePreviewIframeProps {
  code: string
  className?: string
}

function CodePreviewIframe({ code, className }: CodePreviewIframeProps) {
  const srcDoc = React.useMemo(() => {
    // 1. import 문 제거
    const codeWithoutImports = code
      .replace(/import\s+\{[^}]+\}\s+from\s+['"]@\/components['"];?\n?/g, '')
      .replace(/import\s+\{[^}]+\}\s+from\s+['"]react['"];?\n?/g, '')
      .replace(/export\s+default\s+/g, '');

    // 2. Sucrase로 트랜스파일
    const { code: transpiledCode } = transform(codeWithoutImports, {
      transforms: ['jsx', 'typescript'],
    });

    // 3. HTML 생성
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script crossorigin src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
  <script src="/api/ui-bundle"></script>
  <link href="/api/ui-bundle/css" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      const { useState, useEffect } = React;
      const { Heading, Chip, Button, Divider, Badge, Tag } = window.AplusUI;

      ${transpiledCode}

      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(BeerLandingPage));
    })();
  </script>
</body>
</html>`;
  }, [code]);

  return (
    <iframe
      srcDoc={srcDoc}
      title="Code Preview"
      className={className}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
}

export { CodePreviewIframe }
```

---

## 8. 미래 확장 (4막: 사용자 DS 연동)

### 8.1 동적 DS 로딩

```tsx
// 사용자가 입력한 DS 경로
const userBundlePath = `/api/user-bundle?path=${encodeURIComponent(userDsPath)}`;

const srcDoc = `
  <script src="${userBundlePath}"></script>
  <script>
    const UI = window.UserDesignSystem;
    ${transpiledCode}
  </script>
`;
```

### 8.2 API Route 확장

```ts
// app/api/user-bundle/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  // 보안: 경로 검증
  // 파일 읽기
  // Content-Type: application/javascript 응답
}
```

---

## 9. 의존성

### 새로 추가

| 패키지 | 용도 | 설치 위치 |
|--------|------|----------|
| `sucrase` | JSX 트랜스파일 | apps/web |
| `esbuild` | UMD 빌드 | storybook-standalone/packages/ui (devDependency) |

### 기존 사용

| 패키지 | 용도 |
|--------|------|
| React 19, ReactDOM 19 | UMD CDN으로 로드 |
| @aplus/ui | UMD 번들로 변환하여 사용 |

---

## 10. 검증 방법

### 10.1 UMD 빌드 확인

```bash
cd storybook-standalone/packages/ui
pnpm build:umd
ls -la dist/ui.umd.js
```

### 10.2 API Route 테스트

```bash
curl http://localhost:5555/api/ui-bundle
```

### 10.3 렌더링 테스트

1. AI 응답 코드를 CodePreviewIframe에 전달
2. iframe 내에서 컴포넌트 정상 렌더링 확인
3. CSS 스타일 적용 확인

### 10.4 에러 케이스

- 잘못된 JSX 문법 → 에러 메시지 표시
- 없는 컴포넌트 import → 에러 처리

---

## 11. 참고 문서

| 문서 | 내용 |
|------|------|
| [Design_System_Runtime_Hub_Summary.md](/docs/hub/Design_System_Runtime_Hub_Summary.md) | 플랫폼 핵심 컨셉 |
| [ds-runtime-hub-summary.md](/docs/hub/ds-runtime-hub-summary.md) | 워크플로우 및 아키텍처 |
| [phase1-analysis.md](/docs/web/phase1-analysis.md) | Phase 1 구현 현황 |
