# 06. 디렉토리 구조

> **대상 독자**: FE 개발자, AI 개발자 (필수), PM (참고)

## TL;DR

- **모노레포 구조**: Next.js 웹앱 + Python FastAPI AI 서비스 분리
- **pnpm workspace**: Turborepo 없이 단순한 워크스페이스 관리
- **명확한 소유권**: 각 앱/패키지별 담당자 지정
- **공유 스키마**: FE/AI 계약 관리를 위한 `packages/shared-types/`

---

## 프로젝트 구조 개요

```
ds-bridge-ui/                          # 모노레포 루트
│
├── 📁 apps/
│   ├── 📁 web/                        # 🟦 FE Dev - Next.js 프론트엔드
│   │   ├── 📁 app/                    # Next.js App Router
│   │   ├── 📁 components/             # React 컴포넌트
│   │   ├── 📁 lib/                    # 유틸리티 & 헬퍼
│   │   ├── 📁 stores/                 # Zustand stores
│   │   ├── 📁 hooks/                  # 커스텀 훅
│   │   ├── 📁 types/                  # 웹앱 전용 타입
│   │   └── 📄 package.json
│   │
│   └── 📁 ai-service/                 # 🟨 AI Dev - Python FastAPI
│       ├── 📁 src/
│       │   ├── 📁 api/                # FastAPI 라우터
│       │   ├── 📁 core/               # LLM 연동 (Claude)
│       │   ├── 📁 prompts/            # System Prompt 관리
│       │   ├── 📁 services/           # 비즈니스 로직
│       │   └── 📁 schemas/            # Pydantic 스키마
│       ├── 📁 tests/                  # 테스트
│       ├── 📄 pyproject.toml          # Python 의존성
│       ├── 📄 Dockerfile
│       └── 📄 README.md
│
├── 📁 packages/
│   └── 📁 shared-types/               # 🟩 공동 - 공유 스키마
│       ├── 📁 typescript/             # TypeScript 타입 정의
│       ├── 📁 python/                 # Python Pydantic 스키마
│       └── 📁 json-schema/            # JSON Schema (원본)
│
├── 📁 docs/                           # 📚 문서
│   ├── 📁 specs/                      # 기술 스펙 문서
│   └── 📁 hub/                        # 프로젝트 관련 문서
│
├── 📄 pnpm-workspace.yaml             # pnpm 워크스페이스 설정
└── 📄 README.md
```

**범례**
- 🟦 FE 개발자 담당
- 🟨 AI 개발자 담당
- 🟩 공동 담당

---

## apps/web/ - Next.js 웹 애플리케이션

### app/ - Next.js App Router

```
apps/web/app/
├── 📁 api/                            # BFF API Routes
│   ├── 📁 storybook/
│   │   └── 📁 parse/
│   │       └── 📄 route.ts            # POST /api/storybook/parse
│   │
│   ├── 📁 ai/                         # AI 서비스 프록시
│   │   ├── 📁 chat/
│   │   │   └── 📄 route.ts            # POST /api/ai/chat → FastAPI
│   │   └── 📁 tokens/
│   │       └── 📄 route.ts            # POST /api/ai/tokens → FastAPI
│   │
│   ├── 📁 composition/
│   │   └── 📄 route.ts                # POST /api/composition
│   │
│   └── 📁 export/
│       └── 📁 copy-for-ai/
│           └── 📄 route.ts            # POST /api/export/copy-for-ai
│
├── 📄 layout.tsx                      # 루트 레이아웃
├── 📄 globals.css                     # 전역 스타일
│
└── 📁 (main)/
    ├── 📄 layout.tsx                  # 메인 레이아웃
    ├── 📄 page.tsx                    # 홈 페이지 (/)
    └── 📄 loading.tsx                 # 로딩 상태
```

### components/ - React 컴포넌트 🟦

```
apps/web/components/
├── 📁 layout/                         # 레이아웃 컴포넌트
│   ├── 📄 Header.tsx                  # 로고, URL 입력, Upload JSON
│   ├── 📄 LeftPanel.tsx               # Chat + Component 목록 + Actions
│   ├── 📄 RightPanel.tsx              # Storybook iframe / Preview
│   ├── 📄 PanelResizer.tsx            # 리사이즈 가능한 패널 구분선
│   └── 📄 index.ts
│
├── 📁 chat/                           # 채팅 인터페이스
│   ├── 📄 ChatPanel.tsx               # 메인 채팅 컨테이너
│   ├── 📄 ChatMessages.tsx            # 스트리밍이 있는 메시지 목록
│   ├── 📄 ChatInput.tsx               # 메시지 입력 필드
│   ├── 📄 ChatMessage.tsx             # 단일 메시지 버블
│   ├── 📄 ActionButton.tsx            # AI의 클릭 가능한 액션
│   └── 📄 index.ts
│
├── 📁 composition/                    # 페이지 composition 관리
│   ├── 📄 CompositionPanel.tsx        # Composition 관리자
│   ├── 📄 CompositionNode.tsx         # Composition 내 단일 컴포넌트
│   ├── 📄 CompositionPreview.tsx      # 렌더링된 미리보기
│   ├── 📄 PropsEditor.tsx             # 동적 props 폼
│   └── 📄 index.ts
│
├── 📁 preview/                        # Storybook 미리보기
│   ├── 📄 PreviewFrame.tsx            # Storybook iframe 래퍼
│   ├── 📄 ComponentList.tsx           # 접히는 컴포넌트 트리
│   ├── 📄 ComponentItem.tsx           # 목록 내 단일 컴포넌트
│   ├── 📄 StoryList.tsx               # Story variants
│   └── 📄 index.ts
│
└── 📁 ui/                             # 기본 UI 컴포넌트
    ├── 📄 Button.tsx
    ├── 📄 Input.tsx
    ├── 📄 Card.tsx
    ├── 📄 Dialog.tsx
    ├── 📄 Tabs.tsx
    ├── 📄 Collapsible.tsx
    ├── 📄 Tooltip.tsx
    ├── 📄 Toast.tsx
    └── 📄 index.ts
```

### lib/ - 유틸리티 & 헬퍼 🟦

```
apps/web/lib/
├── 📁 storybook/                      # Storybook 파싱 유틸리티
│   ├── 📄 parser.ts                   # stories.json / index.json 파싱
│   ├── 📄 transformer.ts              # ds.json으로 변환
│   ├── 📄 validators.ts               # URL 및 데이터 유효성 검사
│   └── 📄 index.ts
│
├── 📁 api/                            # API 클라이언트
│   ├── 📄 ai-client.ts                # AI 서비스 호출 클라이언트
│   └── 📄 index.ts
│
└── 📁 utils/                          # 공유 유틸리티
    ├── 📄 cn.ts                       # classnames 유틸리티
    ├── 📄 clipboard.ts                # Clipboard API 헬퍼
    ├── 📄 format.ts                   # 포맷팅 유틸리티
    └── 📄 index.ts
```

### stores/, hooks/, types/ 🟦

```
apps/web/stores/
├── 📄 dsStore.ts                      # DS 데이터 상태
├── 📄 compositionStore.ts             # Composition 상태
├── 📄 chatStore.ts                    # 채팅 메시지 상태
├── 📄 uiStore.ts                      # UI 상태 (패널, 탭)
└── 📄 index.ts

apps/web/hooks/
├── 📄 useStorybookParser.ts           # Storybook URL 파싱
├── 📄 useChat.ts                      # 스트리밍 채팅
├── 📄 useComposition.ts               # Composition 작업
├── 📄 useCopyForAI.ts                 # 프롬프트 생성 및 복사
├── 📄 useLocalStorage.ts              # 로컬 데이터 유지
└── 📄 index.ts

apps/web/types/
├── 📄 api.ts                          # 웹앱 전용 API 타입
└── 📄 index.ts
```

---

## apps/ai-service/ - Python FastAPI AI 서비스

### 디렉토리 구조 🟨

```
apps/ai-service/
├── 📁 src/
│   ├── 📄 main.py                     # FastAPI 앱 엔트리포인트
│   │
│   ├── 📁 api/                        # API 라우터
│   │   ├── 📄 __init__.py
│   │   ├── 📄 chat.py                 # POST /chat (SSE 스트리밍)
│   │   ├── 📄 tokens.py               # POST /tokens/extract
│   │   └── 📄 health.py               # GET /health
│   │
│   ├── 📁 core/                       # 핵심 LLM 연동
│   │   ├── 📄 __init__.py
│   │   ├── 📄 claude.py               # Claude API 클라이언트
│   │   ├── 📄 streaming.py            # SSE 스트리밍 유틸리티
│   │   └── 📄 config.py               # 설정 관리
│   │
│   ├── 📁 prompts/                    # System Prompt 관리
│   │   ├── 📄 __init__.py
│   │   ├── 📄 navigator.py            # 가이드형 네비게이터 프롬프트
│   │   ├── 📄 templates.py            # 프롬프트 템플릿
│   │   └── 📄 actions.py              # Action 파싱 로직
│   │
│   ├── 📁 services/                   # 비즈니스 로직
│   │   ├── 📄 __init__.py
│   │   ├── 📄 chat_service.py         # 채팅 서비스
│   │   ├── 📄 token_extractor.py      # 토큰 추출 서비스
│   │   └── 📄 validation.py           # 입력 검증
│   │
│   └── 📁 schemas/                    # Pydantic 스키마
│       ├── 📄 __init__.py
│       ├── 📄 chat.py                 # 채팅 요청/응답 스키마
│       ├── 📄 tokens.py               # 토큰 관련 스키마
│       └── 📄 ds_json.py              # ds.json 스키마
│
├── 📁 tests/                          # 테스트
│   ├── 📄 __init__.py
│   ├── 📄 test_chat.py
│   ├── 📄 test_tokens.py
│   └── 📄 conftest.py                 # pytest 설정
│
├── 📄 pyproject.toml                  # 의존성 및 프로젝트 설정
├── 📄 Dockerfile                      # 컨테이너 빌드
├── 📄 .env.example                    # 환경변수 예시
└── 📄 README.md                       # AI 서비스 문서
```

### 주요 파일 설명

**src/main.py** - FastAPI 앱 엔트리포인트
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api import chat, tokens, health
from src.core.config import settings

app = FastAPI(
    title="DS-Runtime Hub AI Service",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(tokens.router, prefix="/tokens", tags=["tokens"])
```

**src/core/claude.py** - Claude API 클라이언트
```python
import anthropic
from src.core.config import settings

class ClaudeClient:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def stream_chat(self, system_prompt: str, messages: list):
        """SSE 스트리밍 응답 생성"""
        async with self.client.messages.stream(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1024,
            system=system_prompt,
            messages=messages
        ) as stream:
            async for text in stream.text_stream:
                yield text
```

**src/prompts/navigator.py** - System Prompt 설계
```python
def build_system_prompt(ds_json: dict, composition: dict = None) -> str:
    """가이드형 네비게이터 System Prompt 생성"""
    component_names = [c["name"] for c in ds_json.get("components", [])]

    return f"""
You are a Design System Navigator for DS-Runtime Hub.

핵심 규칙:
1. 제공된 ds.json에 있는 컴포넌트만 참조
2. 절대 컴포넌트를 생성하거나 추측하지 않음
3. 항상 실행 가능한 제안으로 응답

사용 가능한 컴포넌트:
{component_names}

현재 COMPOSITION:
{composition}

액션 형식:
[ACTION:show_component:Button]
[ACTION:add_composition:Card:Primary]
"""
```

---

## packages/shared-types/ - 공유 스키마 🟩

**FE ↔ AI 협업에 핵심적**. 양 팀 모두 변경 사항 리뷰 필수.

```
packages/shared-types/
├── 📁 json-schema/                    # JSON Schema (원본, Single Source of Truth)
│   ├── 📄 ds-json.schema.json         # ds.json 스키마
│   ├── 📄 composition.schema.json     # Composition 스키마
│   ├── 📄 chat.schema.json            # Chat 메시지 스키마
│   └── 📄 api.schema.json             # API Request/Response 스키마
│
├── 📁 typescript/                     # TypeScript 타입 (자동 생성 또는 수동)
│   ├── 📄 ds-json.ts
│   ├── 📄 composition.ts
│   ├── 📄 chat.ts
│   ├── 📄 api.ts
│   └── 📄 index.ts
│
├── 📁 python/                         # Python Pydantic 스키마 (자동 생성 또는 수동)
│   ├── 📄 __init__.py
│   ├── 📄 ds_json.py
│   ├── 📄 composition.py
│   ├── 📄 chat.py
│   └── 📄 api.py
│
├── 📄 package.json                    # TypeScript 패키지
└── 📄 README.md                       # 스키마 변경 프로세스 문서
```

### 스키마 동기화 전략

**옵션 1: JSON Schema 기반 자동 생성 (권장)**
```bash
# JSON Schema → TypeScript
npx json-schema-to-typescript json-schema/*.json -o typescript/

# JSON Schema → Python Pydantic
datamodel-codegen --input json-schema/ --output python/
```

**옵션 2: 수동 관리**
- 각 언어별로 직접 타입 정의
- PR 시 양쪽 동기화 확인 필수

---

## 통신 아키텍처

### BFF 패턴 (권장)

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js (BFF)                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ /api/storybook/parse  → 직접 처리                    │    │
│  │ /api/composition      → 직접 처리                    │    │
│  │ /api/export/copy-for-ai → 직접 처리                  │    │
│  │ /api/ai/chat          → FastAPI 프록시              │    │
│  │ /api/ai/tokens        → FastAPI 프록시              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI AI Service                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ POST /chat            → Claude API SSE              │    │
│  │ POST /tokens/extract  → Playwright + 토큰 추출       │    │
│  │ GET /health           → 헬스체크                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Next.js AI 프록시 예시

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

---

## 설정 파일

### 루트 pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### apps/web/package.json

```json
{
  "name": "@ds-bridge/web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "zustand": "^4.0.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-tabs": "^1.0.0",
    "@radix-ui/react-collapsible": "^1.0.0",
    "@ds-bridge/shared-types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tailwindcss": "^3.0.0",
    "@types/react": "^18.0.0",
    "eslint": "^8.0.0"
  }
}
```

### apps/ai-service/pyproject.toml

```toml
[project]
name = "ds-bridge-ai-service"
version = "0.1.0"
description = "AI Service for DS-Runtime Hub"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "anthropic>=0.18.0",
    "pydantic>=2.6.0",
    "python-dotenv>=1.0.0",
    "playwright>=1.41.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.26.0",
    "ruff>=0.2.0",
    "mypy>=1.8.0",
]

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "N", "W"]

[tool.mypy]
python_version = "3.11"
strict = true
```

---

## 환경 변수

### apps/web/.env.local

```bash
# AI Service
AI_SERVICE_URL=http://localhost:8000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### apps/ai-service/.env

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Server
HOST=0.0.0.0
PORT=8000

# CORS (쉼표로 구분)
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 디렉토리 소유권 요약

| 디렉토리 | 담당 | 책임 |
|----------|------|------|
| `apps/web/` | FE | Next.js 웹앱 전체 |
| `apps/web/app/api/storybook` | FE | Storybook URL 파싱 |
| `apps/web/app/api/ai` | FE | AI 서비스 프록시 |
| `apps/web/components` | FE | 모든 React 컴포넌트 |
| `apps/web/lib/storybook` | FE | 파싱 로직 |
| `apps/ai-service/` | AI | Python FastAPI 전체 |
| `apps/ai-service/src/core` | AI | Claude 연동 |
| `apps/ai-service/src/prompts` | AI | System Prompt 설계 |
| `packages/shared-types/` | 공동 | 계약 타입 (PR 승인 필요) |

---

## 파일 명명 규칙

### Next.js (TypeScript)

| 유형 | 규칙 | 예시 |
|------|------|------|
| React Component | PascalCase | `ChatPanel.tsx` |
| Hook | camelCase + use | `useChat.ts` |
| Utility | camelCase | `parser.ts` |
| Type Definition | camelCase | `ds-json.ts` |
| Store | camelCase + Store | `chatStore.ts` |

### FastAPI (Python)

| 유형 | 규칙 | 예시 |
|------|------|------|
| 모듈 | snake_case | `chat_service.py` |
| 클래스 | PascalCase | `ClaudeClient` |
| 함수 | snake_case | `build_system_prompt` |
| 상수 | UPPER_SNAKE | `MAX_TOKENS` |
| Pydantic 모델 | PascalCase | `ChatRequest` |

---

## 로컬 개발 환경

### 동시 실행 (권장)

```bash
# 터미널 1: Next.js
cd apps/web
pnpm dev

# 터미널 2: FastAPI
cd apps/ai-service
uvicorn src.main:app --reload --port 8000
```

### Docker Compose (선택)

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    environment:
      - AI_SERVICE_URL=http://ai-service:8000
    depends_on:
      - ai-service

  ai-service:
    build: ./apps/ai-service
    ports:
      - "8000:8000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

---

## CLI 패키지 (별도) 🟨

로컬 DS 추출을 위한 별도 npm 패키지.

```
ds-hub-cli/                            # 별도 저장소
├── 📁 src/
│   ├── 📄 index.ts                    # CLI 엔트리 포인트
│   ├── 📄 extractor.ts                # Storybook 추출
│   ├── 📄 tokenParser.ts              # 토큰 파일 파싱
│   └── 📄 output.ts                   # ds.json 생성
│
├── 📄 package.json                    # "ds-hub-cli"
├── 📄 tsconfig.json
└── 📄 README.md
```

**사용법**:
```bash
npx ds-hub extract --output ./ds.json --include-tokens
```

---

## 다음 단계

이 문서를 읽은 후:

1. **FE 개발자**: `apps/web/` 구조와 `components/layout`으로 시작
2. **AI 개발자**: `apps/ai-service/`와 `src/core/`에 집중
3. **공동**: 구현 전에 `packages/shared-types/` 함께 정의

---

## 관련 문서

- [02. 아키텍처](./02-architecture.md) - 시스템 개요
- [03. 기술 스택](./03-tech-stack.md) - 기술 선택
- [04. API Contract](./04-api-contract.md) - API 스펙
