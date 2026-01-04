# Storybook Validator MCP Extension

> **AI 에이전트 필수 선행 읽기**
>
> 1. `docs/plans/plan-storybook-validator-mcp-v5.md` - 전체 계획서
> 2. `packages/ui/src/design-tokens/` - 디자인 토큰 구조 이해

> **🧪 TDD 개발 원칙**
>
> 이 프로젝트는 **테스트 주도 개발(TDD)** 방식으로 진행합니다.
> 모든 기능 구현 전에 반드시 테스트 코드를 먼저 작성하세요.
>
> ```
> RED → GREEN → REFACTOR
> ```

> **🚨 manifest.json / mcp-entry.ts 수정 시 필수 규칙**
>
> **수정 전 반드시 Context7으로 Claude Desktop Extension 공식 문서를 확인하세요!**
>
> ```bash
> # Context7 MCP 사용법
> mcp__context7__resolve-library-id libraryName="anthropic" query="DXT manifest schema"
> mcp__context7__query-docs libraryId="/websites/anthropic-api-developer-docs" query="manifest.json tools schema"
> ```
>
> **🔴 DXT manifest vs MCP SDK 스키마 차이 (치명적 오류 방지)**
>
> | 키                    | manifest.json (DXT 패키징) | mcp-entry.ts (MCP 런타임) |
> | --------------------- | -------------------------- | ------------------------- |
> | `tools[].inputSchema` | ❌ **사용 불가**           | ✅ 필수                   |
> | `tools[].name`        | ✅ 필수                    | ✅ 필수                   |
> | `tools[].description` | ✅ 필수                    | ✅ 필수                   |
> | `system_prompt`       | ❌ **사용 불가**           | N/A                       |
>
> - **manifest.json** = 패키징 메타데이터만 (`name`, `description`)
> - **mcp-entry.ts** = 런타임 Tool 정의 (`inputSchema` 포함)
>
> ⚠️ **과거 오류 사례**:
>
> ```
> Failed to preview extension: Invalid manifest: tools: Unrecognized key(s) in object: 'inputSchema'
> ```

---

## 프로젝트 개요

Claude Desktop MCP Extension으로 Storybook 컴포넌트 스타일을 자연어로 질의하고, Figma 스펙을 추출합니다.

### 목표 (우선순위 순)

| 순위      | 기능            | 설명                                       | Phase    |
| --------- | --------------- | ------------------------------------------ | -------- |
| **1순위** | Storybook 질의  | 자연어로 구현된 컴포넌트 스타일 조회       | MVP      |
| **2순위** | Figma 스펙 추출 | Figma 디자인을 자연어로 변환 (수동 검증용) | optional |

### 제외 범위

- ~~Figma vs Storybook 자동 비교~~ (사람이 직접 비교)
- ~~완전 자동화~~ (중간에 사람 개입)

### 아키텍처

```
┌─────────────────────────────────────────┐
│            Claude Desktop               │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         storybook-validator MCP         │
│                                         │
│  ┌─────────────┐    ┌─────────────┐    │
│  │ Storybook   │    │ Figma 스펙  │    │
│  │ 질의 (1순위)│    │ 추출 (2순위)│    │
│  └──────┬──────┘    └──────┬──────┘    │
│         │                  │            │
│         ▼                  ▼            │
│  ┌─────────────┐    ┌─────────────┐    │
│  │ 로컬 JSON   │    │ Figma API   │    │
│  └─────────────┘    └─────────────┘    │
└─────────────────────────────────────────┘
```

---

## Tool 설계

### Tool 목록

| Tool                    | 용도                        | 우선순위 | 응답 크기 |
| ----------------------- | --------------------------- | -------- | --------- |
| `list_components`       | 구현된 컴포넌트 목록        | 1순위    | ~200 토큰 |
| `get_implemented_style` | 구현 스타일 조회 **(메인)** | 1순위    | ~150 토큰 |
| `get_figma_spec`        | Figma 스펙 자연어 추출      | 2순위    | ~150 토큰 |

### Tool 1: list_components

```typescript
// 입력
interface ListComponentsInput {
  category?: string; // 필터 (예: "button", "form")
}

// 출력
interface ListComponentsOutput {
  components: Array<{
    name: string;
    variants: string[];
    sizes: string[];
  }>;
  total: number;
}
```

**응답 포맷:**

```
📦 컴포넌트 목록 (15개)

• button: primary, secondary, outline | sm, md, lg
• badge: solid, subtle | sm, md
• input: default, error | sm, md, lg
```

### Tool 2: get_implemented_style (메인)

```typescript
// 입력
interface GetImplementedStyleInput {
  component: string; // 필수: 컴포넌트명
  variant?: string; // variant
  size?: string; // size
  property?: string; // 특정 속성만 조회
}

// 출력
interface GetImplementedStyleOutput {
  component: string;
  variant: string;
  size: string;
  styles: Record<string, string>;
}
```

**응답 포맷:**

```
📐 Button primary md

backgroundColor: #0033A0
color: #FFFFFF
padding: 8px 16px
borderRadius: 8px
fontSize: 16px
fontWeight: 500
```

### Tool 3: get_figma_spec (optional)

```typescript
// 입력
interface GetFigmaSpecInput {
  figmaUrl: string; // 필수: Figma URL
  depth?: number; // 하위 노드 탐색 깊이 (기본: 2)
}

// 출력
interface GetFigmaSpecOutput {
  nodeName: string;
  nodeType: string;
  styles: Record<string, string>;
  typography?: Record<string, string>;
}
```

**응답 포맷:**

```
📐 Figma: Button/Primary/Medium

fill: #0033A0
cornerRadius: 8px
padding: 8px 16px

typography:
  fontSize: 16px
  fontWeight: 500
```

---

## 프로젝트 구조

```
apps/tools/storybook-validator/
├── manifest.json           # MCP Extension 설정
├── package.json
├── tsconfig.json
├── vitest.config.ts        # 테스트 설정
├── esbuild.config.js       # 번들링 설정
├── create-mcpb.sh          # .mcpb 패키징 스크립트
├── src/
│   ├── index.ts            # 진입점 (McpServer 초기화)
│   ├── tools/
│   │   ├── index.ts        # Tool 등록
│   │   ├── list.ts         # list_components
│   │   ├── styles.ts       # get_implemented_style (메인)
│   │   └── figma.ts        # get_figma_spec (optional)
│   ├── utils/
│   │   ├── token-reader.ts # 로컬 JSON 읽기
│   │   ├── class-resolver.ts # TailwindCSS → 값 변환
│   │   ├── formatter.ts    # 출력 포맷팅
│   │   ├── url-parser.ts   # Figma URL 파싱
│   │   ├── figma-client.ts # Figma API (Phase 2)
│   │   └── cache.ts        # 캐싱
│   └── types/
│       └── index.ts        # 타입 정의
├── tests/
│   ├── unit/               # 단위 테스트 (60%, 커버리지 90%+)
│   │   ├── utils/
│   │   │   ├── class-resolver.test.ts  # ⭐ 핵심
│   │   │   ├── token-reader.test.ts
│   │   │   ├── formatter.test.ts
│   │   │   ├── url-parser.test.ts
│   │   │   └── cache.test.ts
│   │   └── fixtures/       # 테스트 픽스처
│   │       ├── component-definitions.json
│   │       └── tokens.json
│   ├── integration/        # 통합 테스트 (30%, 커버리지 70%+)
│   │   ├── tools/
│   │   │   ├── list.test.ts
│   │   │   ├── styles.test.ts
│   │   │   └── figma.test.ts
│   │   └── mcp-server.test.ts
│   └── e2e/                # E2E 테스트 (10%)
│       └── mcp-inspector.test.ts
└── dist/
    └── bundle.js           # 빌드 산출물
```

---

## 개발 명령어

```bash
# 의존성 설치
pnpm install

# 개발 빌드 (watch 모드)
pnpm run dev

# 프로덕션 빌드
pnpm run build

# 타입 체크
pnpm run typecheck

# MCP Inspector 테스트
npx @anthropic-ai/mcp-inspector dist/bundle.js

# .mcpb 패키징
./create-mcpb.sh
```

### 테스트 명령어

```bash
# 전체 테스트 실행
pnpm test

# 단위 테스트만
pnpm test:unit

# 통합 테스트만
pnpm test:integration

# 커버리지 리포트
pnpm test:coverage

# Watch 모드 (TDD 개발 시 필수!)
pnpm test:watch
```

### MCP Inspector 테스트 예시

```bash
# list_components 테스트
{ "tool": "list_components", "input": {} }

# get_implemented_style 테스트
{ "tool": "get_implemented_style", "input": { "component": "button", "variant": "primary", "size": "md" } }

# get_figma_spec 테스트 (Phase 2)
{ "tool": "get_figma_spec", "input": { "figmaUrl": "https://www.figma.com/file/xxx?node-id=123:456" } }
```

---

## TDD 워크플로우

### 개발 사이클

```
1. RED: 실패하는 테스트 작성
   └── pnpm test:watch 실행 상태 유지

2. GREEN: 테스트 통과하는 최소 코드 작성
   └── 테스트 통과 확인

3. REFACTOR: 코드 개선
   └── 테스트 계속 통과 확인
```

### TDD 예시: class-resolver.ts

```typescript
// tests/unit/utils/class-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveClasses } from '../../../src/utils/class-resolver';

describe('resolveClasses', () => {
  describe('배경색 변환', () => {
    it('bg-bg-accent → backgroundColor: #0033A0', () => {
      const result = resolveClasses(['bg-bg-accent']);
      expect(result).toEqual({ backgroundColor: '#0033A0' });
    });
  });

  describe('패딩 변환', () => {
    it('px-4 → paddingLeft/Right: 16px', () => {
      const result = resolveClasses(['px-4']);
      expect(result).toEqual({
        paddingLeft: '16px',
        paddingRight: '16px',
      });
    });
  });

  describe('border-radius 변환', () => {
    it('rounded-lg → borderRadius: 8px', () => {
      const result = resolveClasses(['rounded-lg']);
      expect(result).toEqual({ borderRadius: '8px' });
    });
  });

  describe('복합 클래스', () => {
    it('여러 클래스를 병합', () => {
      const result = resolveClasses(['bg-bg-accent', 'px-4', 'rounded-lg']);
      expect(result).toEqual({
        backgroundColor: '#0033A0',
        paddingLeft: '16px',
        paddingRight: '16px',
        borderRadius: '8px',
      });
    });
  });
});
```

### 테스트 커버리지 목표

| 테스트 유형 | 대상        | 커버리지 목표 |
| ----------- | ----------- | ------------- |
| 단위 테스트 | utils/\*.ts | **90%+**      |
| 통합 테스트 | tools/\*.ts | **70%+**      |
| E2E 테스트  | MCP 흐름    | 수동 검증     |

---

## 핵심 유틸리티

### token-reader.ts

```typescript
import fs from 'fs/promises';
import path from 'path';

export async function readComponentDefinitions(uiPackagePath: string) {
  const filePath = path.join(uiPackagePath, 'src/design-tokens/component-definitions.json');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}
```

### class-resolver.ts

```typescript
// TailwindCSS 클래스를 실제 값으로 변환
export function resolveClasses(classes: string[]): Record<string, string> {
  // "bg-bg-accent" → { backgroundColor: "#0033A0" }
  // "px-4" → { paddingLeft: "16px", paddingRight: "16px" }
  // "rounded-lg" → { borderRadius: "8px" }
}
```

### formatter.ts

```typescript
export function formatComponentStyle(data: ComponentStyle): string {
  const lines = [`📐 ${data.component} ${data.variant} ${data.size}`, ''];

  for (const [key, value] of Object.entries(data.styles)) {
    lines.push(`${key}: ${value}`);
  }

  return lines.join('\n');
}
```

---

## 환경 변수

### user_config

| 변수              | 설명                                             | 필수 | Phase |
| ----------------- | ------------------------------------------------ | ---- | ----- |
| `ui_package_path` | UI 패키지 경로 (component-definitions.json 위치) | O    | 1     |
| `figma_token`     | Figma Personal Access Token                      | X    | 2     |

### manifest.json 핵심 설정

```json
{
  "manifest_version": "0.3",
  "name": "storybook-validator",
  "display_name": "Storybook Validator",
  "version": "1.0.0",
  "server": {
    "type": "node",
    "entry_point": "dist/bundle.js",
    "mcp_config": {
      "env": {
        "UI_PACKAGE_PATH": "${user_config.ui_package_path}",
        "FIGMA_TOKEN": "${user_config.figma_token}"
      }
    }
  },
  "user_config": {
    "ui_package_path": {
      "type": "string",
      "default": "packages/ui",
      "required": true
    },
    "figma_token": {
      "type": "string",
      "required": false,
      "secret": true
    }
  }
}
```

---

## 체크리스트

### Phase 1 완료 조건 (MVP)

#### 테스트 환경

- [x] Vitest 설정 완료 (`vitest.config.ts`)
- [x] `pnpm test` 동작 확인 (111개 테스트 통과)
- [x] 테스트 픽스처 준비

#### 단위 테스트 (커버리지 90%+)

- [x] `class-resolver.test.ts` 통과
- [x] `token-reader.test.ts` 통과
- [x] `formatter.test.ts` 통과

#### 통합 테스트 (커버리지 70%+)

- [x] `list.test.ts` 통과
- [x] `styles.test.ts` 통과
- [x] `mcp-server.test.ts` 통과

#### 기능 구현

- [x] `pnpm install` 성공
- [x] MCP Inspector에서 서버 시작
- [x] `list_components` Tool 동작
- [x] `get_implemented_style` Tool 동작
- [x] TailwindCSS 클래스 → 실제 값 변환

#### ClassResolver 확장 (v0.2.0 완료)

- [x] Phase 1: 고빈도 클래스 (width/height, flex, border 등) - 30개 테스트
- [x] Phase 2: 중빈도 클래스 (shadow, cursor, opacity 등) - 25개 테스트
- [x] Phase 3: 저빈도/복잡 클래스 (position, overflow, focus 등) - 20개 테스트
- [x] 총 테스트: 190개 통과 (class-resolver) / 255개 (전체)
- [x] 지원 CSS 속성: 30개+ (기존 8개 → 확장)

#### 패키징

- [ ] `.mcpb` 패키지 생성 → `pnpm run package` 또는 `./create-mcpb.sh`
- [ ] Claude Desktop 테스트 성공

### Phase 2 완료 조건 (optional)

#### 단위 테스트

- [ ] `url-parser.test.ts` 통과
- [ ] `cache.test.ts` 통과
- [ ] `figma-client.test.ts` 통과 (Mock)

#### 통합 테스트

- [ ] `figma.test.ts` 통과

#### 기능 구현

- [ ] Figma URL 파싱 동작
- [ ] Figma API 호출 성공
- [ ] `get_figma_spec` Tool 동작
- [ ] 캐싱 동작

---

## 참고 리소스

### 활용할 기존 파일

| 파일                                                       | 용도                          | Phase |
| ---------------------------------------------------------- | ----------------------------- | ----- |
| `packages/ui/src/design-tokens/component-definitions.json` | 컴포넌트별 TailwindCSS 클래스 | 1     |
| `packages/ui/src/design-tokens/color.json`                 | 컬러 토큰                     | 1     |
| `packages/ui/src/design-tokens/typography.json`            | 타이포그래피 토큰             | 1     |
| `packages/ui/src/tokens/design-tokens.ts`                  | TailwindCSS 호환 토큰 값      | 1     |

### 외부 문서

- [MCP SDK 문서](https://modelcontextprotocol.io/docs)
- [Figma REST API](https://www.figma.com/developers/api) (Phase 2)
