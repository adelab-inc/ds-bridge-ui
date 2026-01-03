# 04. API 계약 (Contract)

> **대상 독자**: FE 개발자, AI 개발자 (필수), PM (참고)
> **중요도**: 🔴 매우 중요 - 양 팀의 협업 인터페이스

## TL;DR (핵심 요약)

- **API 계약**: FE와 AI 서버 간 통신 규격 정의
- **Contract-First**: 계약을 먼저 정의하면 양 팀이 병렬로 개발 가능
- **Mock 서버**: FE는 AI 서버 완성 전에 Mock으로 개발 시작

---

## 왜 API 계약이 중요한가요?

### 문제: 순차적 개발의 비효율

```
❌ 잘못된 방식

AI 개발자: [───────── API 개발 ─────────]
FE 개발자:                              [── 대기 ──][─ 개발 시작 ─]
                                        ↑
                                     시간 낭비
```

### 해결: Contract-First 개발

```
✅ 올바른 방식

1일차:     [API 계약 합의] ← 양 팀 함께
              │
    ┌─────────┴─────────┐
    ▼                   ▼
AI 개발자: [── 실제 API 개발 ──]
FE 개발자: [── Mock으로 개발 ──]
    │                   │
    └─────────┬─────────┘
              ▼
         [통합 테스트]
```

---

## API 엔드포인트 정의

### 코드 생성 API

**엔드포인트**: `POST /api/generate`

**용도**: 사용자 프롬프트를 받아 코드를 생성합니다.

#### 요청 (Request)

```typescript
// packages/types/src/api.ts

interface CodeGenerationRequest {
  /** 사용자가 입력한 프롬프트 */
  prompt: string;

  /** 현재 에디터에 있는 코드 (수정 요청 시) */
  currentCode?: string;

  /** 생성 옵션 */
  options?: {
    /** 사용할 프레임워크 */
    framework: 'react' | 'vue' | 'html';

    /** TypeScript 사용 여부 */
    typescript: boolean;

    /** 스타일링 방식 */
    styling: 'tailwind' | 'css' | 'styled-components';
  };
}
```

**예시**:
```json
{
  "prompt": "이메일과 비밀번호 입력 필드가 있는 로그인 폼을 만들어줘",
  "options": {
    "framework": "react",
    "typescript": true,
    "styling": "tailwind"
  }
}
```

#### 응답 (Response) - 스트리밍

**Content-Type**: `text/event-stream`

스트리밍 방식으로 응답하며, 각 청크는 다음 형식을 따릅니다:

```typescript
interface CodeChunk {
  /** 청크 타입 */
  type: 'code' | 'file_start' | 'file_end' | 'error' | 'done';

  /** 코드 조각 (type이 'code'일 때) */
  content?: string;

  /** 파일 정보 (type이 'file_start'일 때) */
  file?: {
    path: string;      // 예: "components/LoginForm.tsx"
    language: string;  // 예: "typescript"
  };

  /** 에러 정보 (type이 'error'일 때) */
  error?: {
    message: string;
    code: string;
  };
}
```

**스트리밍 예시**:
```
data: {"type":"file_start","file":{"path":"LoginForm.tsx","language":"typescript"}}

data: {"type":"code","content":"import React from 'react';"}

data: {"type":"code","content":"\n\nexport function LoginForm() {"}

data: {"type":"code","content":"\n  return ("}

... (계속)

data: {"type":"file_end"}

data: {"type":"done"}
```

#### 에러 응답

```typescript
interface ErrorResponse {
  error: {
    /** 에러 코드 */
    code: 'INVALID_PROMPT' | 'GENERATION_FAILED' | 'RATE_LIMITED' | 'SERVER_ERROR';

    /** 사람이 읽을 수 있는 메시지 */
    message: string;

    /** 디버깅용 상세 정보 (개발 환경만) */
    details?: string;
  };
}
```

**HTTP 상태 코드**:
| 코드 | 의미 | 대응 |
|------|------|------|
| 200 | 성공 | 정상 처리 |
| 400 | 잘못된 요청 | 프롬프트 확인 |
| 429 | 요청 과다 | 잠시 후 재시도 |
| 500 | 서버 오류 | 관리자 확인 |

---

## 공유 타입 정의

### packages/types 구조

```
packages/types/
├── src/
│   ├── index.ts           # 모든 타입 export
│   ├── api.ts             # API 요청/응답 타입
│   ├── editor.ts          # 에디터 관련 타입
│   └── preview.ts         # 프리뷰 관련 타입
├── package.json
└── tsconfig.json
```

### 주요 타입 파일

```typescript
// packages/types/src/api.ts

// ===== 요청 타입 =====
export interface CodeGenerationRequest {
  prompt: string;
  currentCode?: string;
  options?: GenerationOptions;
}

export interface GenerationOptions {
  framework: 'react' | 'vue' | 'html';
  typescript: boolean;
  styling: 'tailwind' | 'css' | 'styled-components';
}

// ===== 응답 타입 =====
export interface CodeChunk {
  type: 'code' | 'file_start' | 'file_end' | 'error' | 'done';
  content?: string;
  file?: FileInfo;
  error?: ErrorInfo;
}

export interface FileInfo {
  path: string;
  language: string;
}

export interface ErrorInfo {
  code: string;
  message: string;
}

// ===== 생성 결과 =====
export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export interface GenerationResult {
  files: GeneratedFile[];
  totalTokens?: number;
  generationTime?: number;
}
```

```typescript
// packages/types/src/editor.ts

export interface EditorState {
  /** 현재 열린 파일들 */
  files: EditorFile[];

  /** 활성 파일 인덱스 */
  activeFileIndex: number;

  /** 저장되지 않은 변경 여부 */
  isDirty: boolean;
}

export interface EditorFile {
  path: string;
  content: string;
  language: string;
}
```

```typescript
// packages/types/src/preview.ts

export interface PreviewState {
  /** 프리뷰 상태 */
  status: 'idle' | 'loading' | 'ready' | 'error';

  /** 에러 메시지 */
  errorMessage?: string;

  /** 마지막 업데이트 시간 */
  lastUpdated?: Date;
}
```

---

## Mock 서버 구현 (FE 개발자용)

AI 서버가 완성되기 전에 FE 개발을 시작할 수 있도록 Mock 서버를 구현합니다.

### Next.js API Route로 구현

```typescript
// apps/web/app/api/generate/route.ts

import { type CodeGenerationRequest, type CodeChunk } from '@ds-bridge/types';

export async function POST(request: Request) {
  const body: CodeGenerationRequest = await request.json();

  // Mock 코드 생성
  const mockCode = generateMockCode(body.prompt);

  // 스트리밍 응답 생성
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 파일 시작 청크
      const startChunk: CodeChunk = {
        type: 'file_start',
        file: { path: 'Component.tsx', language: 'typescript' }
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(startChunk)}\n\n`));

      // 코드를 조금씩 전송 (타이핑 효과)
      for (let i = 0; i < mockCode.length; i += 10) {
        const chunk: CodeChunk = {
          type: 'code',
          content: mockCode.slice(i, i + 10)
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        await new Promise(r => setTimeout(r, 50)); // 50ms 딜레이
      }

      // 파일 종료 청크
      const endChunk: CodeChunk = { type: 'file_end' };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(endChunk)}\n\n`));

      // 완료 청크
      const doneChunk: CodeChunk = { type: 'done' };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function generateMockCode(prompt: string): string {
  // 프롬프트에 따른 간단한 Mock 코드 반환
  return `
import React from 'react';

export function GeneratedComponent() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Generated from: ${prompt}</h1>
      <p className="text-gray-600">This is a mock response.</p>
    </div>
  );
}
`.trim();
}
```

### 환경 변수로 전환

```typescript
// packages/ai-client/src/config.ts

export const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || '/api/generate';
```

```bash
# .env.development (Mock 사용)
NEXT_PUBLIC_AI_API_URL=/api/generate

# .env.production (실제 AI 서버)
NEXT_PUBLIC_AI_API_URL=https://ai.example.com/api/generate
```

---

## AI 서버 구현 가이드 (AI 개발자용)

### Python FastAPI 예시

```python
# ai-service/src/api/routes.py

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Literal
import json
import asyncio

app = FastAPI()

class GenerationOptions(BaseModel):
    framework: Literal['react', 'vue', 'html'] = 'react'
    typescript: bool = True
    styling: Literal['tailwind', 'css', 'styled-components'] = 'tailwind'

class CodeGenerationRequest(BaseModel):
    prompt: str
    currentCode: Optional[str] = None
    options: Optional[GenerationOptions] = None

@app.post("/api/generate")
async def generate_code(request: CodeGenerationRequest):
    async def generate():
        # 파일 시작
        yield f"data: {json.dumps({'type': 'file_start', 'file': {'path': 'Component.tsx', 'language': 'typescript'}})}\n\n"

        # LLM 호출 및 스트리밍
        async for chunk in call_llm(request.prompt):
            yield f"data: {json.dumps({'type': 'code', 'content': chunk})}\n\n"

        # 완료
        yield f"data: {json.dumps({'type': 'file_end'})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )

async def call_llm(prompt: str):
    """실제 LLM 호출 로직"""
    # 여기에 Claude/GPT API 호출 구현
    pass
```

---

## 계약 변경 프로세스

### 변경이 필요할 때

1. **이슈 생성**: `packages/types` 관련 변경 요청
2. **양 팀 논의**: FE, AI 개발자 모두 리뷰
3. **타입 수정**: `packages/types` 업데이트
4. **PR 생성**: 양 팀 approve 필수
5. **동시 배포**: FE와 AI 서버 동시에 업데이트

### 하위 호환성 규칙

| 변경 유형 | 허용 여부 | 예시 |
|----------|----------|------|
| 필드 추가 (optional) | ✅ 허용 | `metadata?: object` 추가 |
| 필드 추가 (required) | ❌ 금지 | `userId: string` 추가 |
| 필드 제거 | ❌ 금지 | `options` 제거 |
| 필드 타입 변경 | ❌ 금지 | `string` → `number` |
| 새 타입 값 추가 | ⚠️ 주의 | `framework: 'svelte'` 추가 |

---

## 다음 문서

- [05. 개발 워크플로우](./05-development-workflow.md) - 협업 방식과 일정
- [06. 디렉토리 구조](./06-directory-structure.md) - 코드베이스 구조
