# 04. API Contract

> **대상 독자**: FE 개발자, AI 개발자 (필수), PM (참고)
> **중요도**: 핵심 - 팀 간 협업 인터페이스

## TL;DR

- **모노레포 API 구조**: Next.js (BFF) + FastAPI (AI 서비스)
- **SSE Streaming**: 실시간 채팅 응답
- **Contract-First**: 스키마 먼저 정의, 병렬 개발 가능

---

## API 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────────┐
│                         클라이언트 (Browser)                      │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js BFF (apps/web)                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  직접 처리 API                                              │  │
│  │  • /api/storybook/parse     Storybook 파싱                 │  │
│  │  • /api/composition         Composition 관리               │  │
│  │  • /api/export/copy-for-ai  Export 생성                    │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  프록시 API (FastAPI 전달)                                  │  │
│  │  • /api/ai/chat             → FastAPI /chat                │  │
│  │  • /api/ai/tokens/extract   → FastAPI /tokens/extract      │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                FastAPI AI Service (apps/ai-service)              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  • POST /chat               Claude API SSE 스트리밍         │  │
│  │  • POST /tokens/extract     Playwright 토큰 추출           │  │
│  │  • GET /health              헬스체크                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## API 엔드포인트 개요

### Next.js 직접 처리 API (apps/web)

| # | 엔드포인트 | Method | 담당 | 목적 |
|---|------------|--------|------|------|
| 1 | `/api/storybook/parse` | POST | FE | Storybook URL을 ds.json으로 파싱 |
| 2 | `/api/composition` | POST | FE | 페이지 composition 관리 |
| 3 | `/api/export/copy-for-ai` | POST | FE | Copy for AI 출력 생성 |

### Next.js 프록시 API (→ FastAPI)

| # | 엔드포인트 | Method | 전달 대상 | 목적 |
|---|------------|--------|----------|------|
| 4 | `/api/ai/chat` | POST | FastAPI /chat | 가이드형 AI 채팅 |
| 5 | `/api/ai/tokens/extract` | POST | FastAPI /tokens/extract | 토큰 추출 |

### FastAPI 내부 API (apps/ai-service)

| # | 엔드포인트 | Method | 담당 | 목적 |
|---|------------|--------|------|------|
| 1 | `POST /chat` | POST | AI | Claude API 채팅 (SSE) |
| 2 | `POST /tokens/extract` | POST | AI | Playwright 토큰 추출 |
| 3 | `GET /health` | GET | AI | 헬스체크 |

### CLI (별도 패키지)

| # | 명령어 | 목적 |
|---|--------|------|
| 1 | `npx ds-hub extract` | 로컬 DS 추출 |

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

### Next.js 프록시 (apps/web)

**엔드포인트**: `POST /api/ai/chat`

**목적**: FastAPI로 요청 전달 및 SSE 스트림 프록시

```typescript
// apps/web/app/api/ai/chat/route.ts
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  const body = await req.json();

  const response = await fetch(`${AI_SERVICE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // SSE 스트림 전달
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### FastAPI 구현 (apps/ai-service)

**엔드포인트**: `POST /chat`

**목적**: Claude API 호출 및 SSE 스트리밍

### Request Schema (Pydantic)

```python
# apps/ai-service/src/schemas/chat.py
from pydantic import BaseModel
from typing import Literal

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    ds_json: dict
    messages: list[ChatMessage]
    current_composition: dict | None = None
```

### Response (SSE Streaming)

```python
# SSE 이벤트 형식
data: {"type": "text", "content": "안녕하세요"}

data: {"type": "action", "action": {"type": "show_component", "payload": "Button"}}

data: [DONE]
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

### FastAPI 구현

```python
# apps/ai-service/src/api/chat.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from src.schemas.chat import ChatRequest
from src.services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()

@router.post("")
async def chat(request: ChatRequest):
    return StreamingResponse(
        chat_service.stream_response(request),
        media_type="text/event-stream"
    )
```

```python
# apps/ai-service/src/services/chat_service.py
import anthropic
from src.prompts.navigator import build_system_prompt

class ChatService:
    def __init__(self):
        self.client = anthropic.Anthropic()

    async def stream_response(self, request: ChatRequest):
        system_prompt = build_system_prompt(
            request.ds_json,
            request.current_composition
        )

        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        async with self.client.messages.stream(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            system=system_prompt,
            messages=messages
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"

        yield "data: [DONE]\n\n"
```

### System Prompt 설계

```python
# apps/ai-service/src/prompts/navigator.py
def build_system_prompt(ds_json: dict, composition: dict = None) -> str:
    component_names = [c["name"] for c in ds_json.get("components", [])]

    return f"""
You are a Design System Navigator for DS-Runtime Hub.

핵심 규칙:
1. 제공된 ds.json에 있는 컴포넌트만 참조
2. 절대 컴포넌트 이름을 생성하거나 추측하지 않음
3. "어떤 컴포넌트가 있나요"라고 물으면 ds.json의 목록만 제공
4. 항상 실행 가능한 제안으로 응답

사용 가능한 컴포넌트:
{component_names}

현재 COMPOSITION:
{composition}

액션 제안 형식:
[ACTION:show_component:Button]
[ACTION:add_composition:Button:Primary]
[ACTION:show_props:Card]
"""
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

### Next.js 프록시 (apps/web)

**엔드포인트**: `POST /api/ai/tokens/extract`

**목적**: FastAPI로 요청 전달

```typescript
// apps/web/app/api/ai/tokens/route.ts
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  const body = await req.json();

  const response = await fetch(`${AI_SERVICE_URL}/tokens/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return Response.json(await response.json());
}
```

### FastAPI 구현 (apps/ai-service)

**엔드포인트**: `POST /tokens/extract`

**목적**: Playwright로 Storybook computed styles에서 디자인 토큰 추출

### Request Schema (Pydantic)

```python
# apps/ai-service/src/schemas/tokens.py
from pydantic import BaseModel

class TokenExtractionRequest(BaseModel):
    storybook_url: str
    sample_stories: list[str]  # 샘플링할 스토리 ID들
```

### Response Schema

```python
class DesignTokens(BaseModel):
    colors: dict[str, str] | None = None
    spacing: dict[str, str] | None = None
    typography: dict | None = None
    border_radius: dict[str, str] | None = None
    shadows: dict[str, str] | None = None

class TokenExtractionResponse(BaseModel):
    tokens: DesignTokens
    source: str = "computed"
```

### FastAPI 구현 (Playwright)

```python
# apps/ai-service/src/api/tokens.py
from fastapi import APIRouter
from src.schemas.tokens import TokenExtractionRequest, TokenExtractionResponse
from src.services.token_extractor import TokenExtractor

router = APIRouter()
extractor = TokenExtractor()

@router.post("/extract", response_model=TokenExtractionResponse)
async def extract_tokens(request: TokenExtractionRequest):
    tokens = await extractor.extract(
        request.storybook_url,
        request.sample_stories
    )
    return TokenExtractionResponse(tokens=tokens, source="computed")
```

```python
# apps/ai-service/src/services/token_extractor.py
from playwright.async_api import async_playwright
from src.schemas.tokens import DesignTokens

class TokenExtractor:
    async def extract(self, storybook_url: str, sample_stories: list[str]) -> DesignTokens:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            colors = {}
            spacing = {}

            for story_id in sample_stories:
                await page.goto(f"{storybook_url}/iframe.html?id={story_id}")

                # computed styles 추출
                styles = await page.evaluate("""
                    () => {
                        const button = document.querySelector('button');
                        if (!button) return null;
                        const computed = window.getComputedStyle(button);
                        return {
                            backgroundColor: computed.backgroundColor,
                            color: computed.color,
                            padding: computed.padding,
                            borderRadius: computed.borderRadius
                        };
                    }
                """)

                if styles:
                    if styles.get("backgroundColor"):
                        colors[styles["backgroundColor"]] = styles["backgroundColor"]
                    # ... 더 많은 추출

            await browser.close()

            return DesignTokens(colors=colors, spacing=spacing)
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
