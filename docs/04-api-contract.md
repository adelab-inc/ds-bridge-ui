# 04. API Contract

> **대상 독자**: FE 개발자, AI 개발자 (필수), PM (참고)
> **중요도**: 핵심 - 팀 간 협업 인터페이스

## TL;DR

- **6개 API 엔드포인트**: Parse, Chat, Composition, Export, Tokens, CLI
- **SSE Streaming**: 실시간 채팅 응답
- **Contract-First**: 스키마 먼저 정의, 병렬 개발 가능

---

## API 엔드포인트 개요

| # | 엔드포인트 | Method | 목적 |
|---|------------|--------|------|
| 1 | `/api/storybook/parse` | POST | Storybook URL을 ds.json으로 파싱 |
| 2 | `/api/chat` | POST | 가이드형 AI 채팅 |
| 3 | `/api/composition` | POST | 페이지 composition 관리 |
| 4 | `/api/export/copy-for-ai` | POST | Copy for AI 출력 생성 |
| 5 | `/api/tokens/extract` | POST | computed styles에서 토큰 추출 |
| 6 | CLI: `npx ds-hub extract` | - | 로컬 DS 추출 |

---

## 1. Storybook Parse API

**엔드포인트**: `POST /api/storybook/parse`

**목적**: Storybook URL을 ds.json 형식으로 변환

### Request

```typescript
interface StorybookParseRequest {
  url: string;  // 예: "https://storybook.example.com"
}
```

### Response

```typescript
interface StorybookParseResponse {
  success: boolean;
  data?: DSJson;
  error?: string;
}
```

### 구현 참고

```typescript
// 서버 사이드 (CORS 회피)
export async function POST(req: Request) {
  const { url } = await req.json();

  // v7 먼저 시도, 그 다음 v6
  const endpoints = ['/index.json', '/stories.json'];

  for (const endpoint of endpoints) {
    const response = await fetch(`${url}${endpoint}`);
    if (response.ok) {
      const data = await response.json();
      const dsJson = transformToDsJson(data, url);
      return Response.json({ success: true, data: dsJson });
    }
  }

  return Response.json({ success: false, error: 'Failed to parse' });
}
```

---

## 2. Chat API

**엔드포인트**: `POST /api/chat`

**목적**: AI 기반 가이드 네비게이션 (코드 생성 아님)

### Request

```typescript
interface ChatRequest {
  dsJson: DSJson;
  messages: ChatMessage[];
  currentComposition?: Composition;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

### Response (SSE Streaming)

```typescript
interface ChatResponse {
  message: string;
  actions?: ChatAction[];
}

interface ChatAction {
  type: 'show_component' | 'show_props' | 'show_stories' |
        'add_to_composition' | 'update_composition' | 'navigate';
  payload: any;
}
```

### SSE (Server-Sent Events) 설명

**SSE란?**

서버가 HTTP를 통해 클라이언트에 실시간으로 데이터를 푸시합니다.

```
일반 HTTP:
User ──request──> Server
User <──────────── Server (전체 응답 대기)
     [대기 중...]

SSE Streaming:
User ──request──> Server
User <──chunk1── Server (즉시 표시)
User <──chunk2── Server (즉시 표시)
User <──chunk3── Server (즉시 표시)
     ...
```

**사용자 경험**: AI 응답이 한 글자씩 나타남

**채팅에 SSE를 사용하는 이유**:

| 방식 | 방향 | 복잡도 | 적합성 |
|------|------|--------|--------|
| **SSE** | 서버 → 클라이언트 | 낮음 | 최적 |
| WebSocket | 양방향 | 높음 | 과함 |
| Long Polling | 서버 → 클라이언트 | 중간 | 비효율적 |

### System Prompt 설계

```typescript
const SYSTEM_PROMPT = `
You are a Design System Navigator for DS-Runtime Hub.

핵심 규칙:
1. 제공된 ds.json에 있는 컴포넌트만 참조
2. 절대 컴포넌트 이름을 생성하거나 추측하지 않음
3. "어떤 컴포넌트가 있나요"라고 물으면 ds.json의 목록만 제공
4. 항상 실행 가능한 제안으로 응답

사용 가능한 컴포넌트:
${JSON.stringify(dsJson.components.map(c => c.name))}

현재 COMPOSITION:
${JSON.stringify(currentComposition)}

액션 제안 형식:
[ACTION:show_component:Button]
[ACTION:add_composition:Button:Primary]
[ACTION:show_props:Card]
`;
```

### 구현

```typescript
export async function POST(req: Request) {
  const { dsJson, messages, currentComposition } = await req.json();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      stream: true,
      system: buildSystemPrompt(dsJson, currentComposition),
      messages
    })
  });

  // 스트림 응답
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

---

## 3. Composition API

**엔드포인트**: `POST /api/composition`

**목적**: 페이지 composition 생성, 업데이트, 관리

### Request

```typescript
interface CompositionRequest {
  action: 'create' | 'update' | 'add_component' | 'remove_component';
  compositionId?: string;
  data: Partial<Composition> | CompositionNode;
}
```

### Response

```typescript
interface CompositionResponse {
  success: boolean;
  composition?: Composition;
  error?: string;
}
```

### Composition Schema

```typescript
interface Composition {
  id: string;
  name: string;
  description?: string;
  structure: CompositionNode[];
  usedTokens?: string[];
  createdAt: string;
  updatedAt: string;
}

interface CompositionNode {
  componentId: string;
  storyId?: string;
  props?: Record<string, any>;
  children?: CompositionNode[];
  layout?: {
    position?: 'header' | 'sidebar' | 'main' | 'footer';
    order?: number;
  };
}
```

---

## 4. Copy for AI API

**엔드포인트**: `POST /api/export/copy-for-ai`

**목적**: AI 코딩용 클립보드 콘텐츠 생성

### Request

```typescript
interface CopyForAIRequest {
  dsJson: DSJson;
  composition: Composition;
  options?: {
    includeTokens: boolean;
    format: 'prompt' | 'json' | 'markdown';
  };
}
```

### Response

```typescript
interface CopyForAIResponse {
  content: string;  // 클립보드에 복사할 준비 완료
}
```

### 출력 템플릿

```
We use ${dsJson.meta.name} Design System.

TOKENS (use these exact values)
- Primary color: #0052cc
- Spacing: 4/8/16/24 px
- Radius: 4/6/10 px
- Font: Inter

CONFIRMED COMPOSITION (already reviewed)
- FilterBar (sticky: true)
- MetricCard x3
- LineChart (variant: primary)
- DataTable (dense: true)
- Pagination

Generate a React page using existing DS components.
Use the tokens above for spacing and colors.
```

---

## 5. Token Extraction API

**엔드포인트**: `POST /api/tokens/extract`

**목적**: Storybook computed styles에서 디자인 토큰 추출

### Request

```typescript
interface TokenExtractionRequest {
  storybookUrl: string;
  sampleStories: string[];  // 샘플링할 스토리 ID들
}
```

### Response

```typescript
interface TokenExtractionResponse {
  tokens: DesignTokens;
  source: 'computed';
}

interface DesignTokens {
  colors?: Record<string, string>;
  spacing?: Record<string, string>;
  typography?: {
    fontFamily?: Record<string, string>;
    fontSize?: Record<string, string>;
    fontWeight?: Record<string, string>;
    lineHeight?: Record<string, string>;
  };
  borderRadius?: Record<string, string>;
  shadows?: Record<string, string>;
}
```

### 구현 (Puppeteer/Playwright)

```typescript
export async function POST(req: Request) {
  const { storybookUrl, sampleStories } = await req.json();

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const tokens: DesignTokens = { colors: {}, spacing: {} };

  for (const storyId of sampleStories) {
    await page.goto(`${storybookUrl}/iframe.html?id=${storyId}`);

    // computed styles 추출
    const styles = await page.evaluate(() => {
      const button = document.querySelector('button');
      if (!button) return null;
      return window.getComputedStyle(button);
    });

    // 토큰 파싱 및 중복 제거
    if (styles) {
      tokens.colors[styles.backgroundColor] = styles.backgroundColor;
      // ... 더 많은 추출
    }
  }

  await browser.close();
  return Response.json({ tokens, source: 'computed' });
}
```

---

## 6. CLI: ds-hub extract

**패키지**: `ds-hub-cli` (별도 npm 패키지)

**사용법**:
```bash
npx ds-hub extract [options]

Options:
  --storybook-dir <path>   Storybook 설정 디렉토리 (default: .storybook)
  --output <path>          출력 경로 (default: ./ds.json)
  --include-tokens         토큰 추출 포함
  --token-source <path>    토큰 파일 경로 (예: tokens.json)
```

**출력**: ds.json 파일

---

## 공유 타입 정의

### ds.json Schema

```typescript
// types/ds-json.ts

interface DSJson {
  meta: {
    name: string;
    version: string;
    source: 'url' | 'extract';
    storybookUrl?: string;
    createdAt: string;
    updatedAt: string;
  };

  components: Component[];
  tokens?: DesignTokens;
}

interface Component {
  id: string;
  name: string;
  category?: string;
  props: PropDefinition[];
  stories: Story[];
  description?: string;
  filePath?: string;
}

interface PropDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'object';
  required: boolean;
  defaultValue?: any;
  options?: string[];  // enum 타입용
  description?: string;
}

interface Story {
  id: string;
  name: string;
  args: Record<string, any>;
}
```

---

## 에러 처리

### 에러 응답 형식

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  };
}
```

### 에러 코드

| 코드 | HTTP 상태 | 설명 |
|------|-----------|------|
| `INVALID_URL` | 400 | 잘못된 Storybook URL |
| `PARSE_FAILED` | 400 | Storybook 파싱 실패 |
| `CORS_ERROR` | 400 | CORS 차단 (서버 사이드에서는 발생 안 함) |
| `RATE_LIMITED` | 429 | 요청 너무 많음 |
| `AI_ERROR` | 500 | Claude API 에러 |
| `SERVER_ERROR` | 500 | 내부 서버 에러 |

---

## Contract 변경 프로세스

### 변경이 필요할 때

1. `types/` 디렉토리에 이슈 생성
2. FE와 AI 개발자 모두 리뷰
3. 공유 타입 업데이트
4. PR은 양 팀 승인 필요
5. 동시 배포

### 하위 호환성 규칙

| 변경 유형 | 허용 | 예시 |
|----------|------|------|
| 선택 필드 추가 | 예 | `metadata?: object` |
| 필수 필드 추가 | 아니오 | `userId: string` |
| 필드 제거 | 아니오 | `options` 제거 |
| 필드 타입 변경 | 아니오 | `string`을 `number`로 |
| enum 값 추가 | 주의 | `framework: 'svelte'` |

---

## 다음 문서

- [05. 개발 워크플로우](./05-development-workflow.md) - MVP 단계와 협업
- [06. 디렉토리 구조](./06-directory-structure.md) - 코드 조직
