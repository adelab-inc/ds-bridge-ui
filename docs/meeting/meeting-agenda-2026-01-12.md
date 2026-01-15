# DS-Bridge-UI 개발 회의 아젠다

**기간**: 355a524b ~ 9a8c41de (총 30개 커밋)
**작성일**: 2026-01-12
**목적**: 팀원 간 변경사항 공유 및 코드 품질 개선 논의

---

## 목차
1. [주요 변경사항 요약](#1-주요-변경사항-요약)
2. [상세 변경 내역](#2-상세-변경-내역)
3. [코드 리뷰 개선점](#3-코드-리뷰-개선점)
4. [논의 필요 사항](#4-논의-필요-사항)
5. [다음 스프린트 제안](#5-다음-스프린트-제안)

---

## 1. 주요 변경사항 요약

| 영역 | 추가된 파일 | 주요 기능 |
|------|-------------|----------|
| **AI Service** | 22개 | FastAPI 백엔드, 멀티 AI 프로바이더 |
| **Web App** | 12개 | Firebase hooks, SSE 스트리밍 |
| **Shared Types** | 12개 | 타입 자동 생성 시스템 |
| **인프라** | 4개 | Vercel 배포, 환경 설정 |

**총 변경**: 70개 파일, +9,492줄, -65줄

---

## 2. 상세 변경 내역

### 2.1 AI Service (Python/FastAPI) 신규 추가

**관련 PR**: #3, #4, #7, #8, #9

**구조**:
```
apps/ai-service/
├── app/
│   ├── api/
│   │   ├── chat.py         # 채팅 API (스트리밍/논스트리밍)
│   │   ├── components.py   # 컴포넌트 스키마 API
│   │   └── rooms.py        # 채팅방 CRUD
│   ├── services/
│   │   ├── ai_provider.py  # OpenAI/Anthropic/Gemini 추상화
│   │   ├── firestore.py    # Firestore CRUD
│   │   └── firebase_storage.py  # 스키마 로딩
│   └── schemas/chat.py     # Pydantic 스키마
├── Dockerfile
└── scripts/deploy.sh       # Cloud Run 배포
```

**핵심 기능**:
- **멀티 AI 프로바이더**: OpenAI, Anthropic(현재 사용), Gemini 지원
- **하이브리드 스트리밍**: 대화는 실시간, 코드는 완성 후 전송
- **이전 대화 기억**: 최근 5개 대화 컨텍스트 유지 (bd691c30)
- **동적 스키마 로딩**: Firebase Storage에서 컴포넌트 스키마 로드

**설정 변경**:
- Claude 모델: Sonnet 4 → Sonnet 4.5 (e94fabac)
- 엔드포인트: `/api/v1/*` → `/api/*` (d2712d9c)

---

### 2.2 Web App Firebase 연동

**관련 PR**: #5, #6

**새로운 Hooks**:

| Hook | 용도 | 파일 |
|------|------|------|
| `useRealtimeMessages` | Firestore 실시간 구독 | hooks/firebase/useRealtimeMessages.ts |
| `useGetPaginatedFbMessages` | 무한 스크롤 페이지네이션 | hooks/firebase/useGetPaginatedFbMessages.ts |
| `useChatStream` | SSE 스트림 처리 | hooks/useChatStream.ts |

**API Routes (BFF 패턴)**:
```
/api/chat/stream    - AI 서버 SSE 프록시
/api/chat           - 채팅 전송
/api/room/create    - 채팅방 생성
/api/room/[room_id] - 채팅방 조회
/api/component      - 컴포넌트 스키마
/api/health         - 헬스체크
```

**의존성 추가**:
- `@tanstack/react-query`: 서버 상태 관리
- `firebase`: Firestore 연동

---

### 2.3 Shared Types 패키지

**목적**: TypeScript/Python 간 타입 일관성 유지 (Single Source of Truth)

**구조**:
```
packages/shared-types/
├── firebase/
│   ├── collections.json    # ← 유일한 원본
│   └── storage.json
├── scripts/
│   ├── generate-typescript.js
│   ├── generate-python.py
│   └── generate-api-types.sh
├── typescript/firebase/    # 자동 생성
└── python/firebase/        # 자동 생성
```

**정의된 스키마**:
- `chat_rooms`: id, storybook_url, user_id, created_at
- `chat_messages`: id, question, text, content, path, room_id, status, timestamps

**사용법**:
```bash
# 타입 생성
pnpm gen:firebase-types
pnpm gen:api-types
```

---

### 2.4 인프라 설정

**Vercel 배포** (4bbe01f0):
- `vercel.json`: 빌드 설정
- `.vercelignore`: 제외 파일 목록
- `VERCEL_DEPLOY.md`: 배포 가이드

**환경 변수**:
```
# AI Service
OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
FIREBASE_STORAGE_BUCKET, AI_SERVICE_API_KEY

# Web App
AI_SERVER_URL, AI_SERVER_API_KEY
NEXT_PUBLIC_FIREBASE_*
```

---

## 3. 코드 리뷰 개선점

### 3.1 즉시 수정 필요 (Critical)

#### A. Firestore 동기/비동기 불일치
**파일**: `apps/ai-service/app/services/firestore.py`
**문제**: 모든 함수가 `async`로 선언되었지만 Firestore Python SDK는 동기 라이브러리

```python
# 현재 (문제)
async def create_chat_room(...):
    db.collection(...).document(...).set(room_data)  # 동기 호출

# 개선안
async def create_chat_room(...):
    await asyncio.get_event_loop().run_in_executor(
        None, lambda: db.collection(...).document(...).set(room_data)
    )
```

**영향**: FastAPI 이벤트 루프 블로킹 → 동시 요청 처리 성능 저하

---

#### B. 에러 메시지 내부 정보 노출
**파일**: `apps/ai-service/app/api/chat.py`
**문제**: `str(e)`를 클라이언트에 직접 전달

```python
# 현재
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

# 개선안
except Exception as e:
    logger.error("Chat failed", exc_info=True)
    raise HTTPException(
        status_code=500,
        detail="An unexpected error occurred. Please try again."
    )
```

**영향**: DB 연결 정보, 파일 경로 등 민감 정보 노출 가능

---

#### C. 타입 불일치 (string vs number)
**파일**: `apps/web/hooks/firebase/messageUtils.ts`
**문제**: `question_created_at`이 코드마다 string/number 혼용

```typescript
// messageUtils.ts
export interface ClientMessage {
  question_created_at: string;  // string
}

// shared-types/firebase/types.ts
export interface ChatMessage {
  question_created_at: number;  // number
}
```

**영향**: 런타임 에러, 페이지네이션 커서 오작동

---

### 3.2 중요 개선 (Important)

#### D. 스트리밍 에러 처리 미흡
**파일**: `apps/ai-service/app/api/chat.py` (chat_stream)
**문제**: 스트림 중 에러 시 클라이언트가 부분 응답 + 에러 혼동

**개선안**: HTTP 상태 코드로 처리 + 클라이언트 재연결 로직

---

#### E. useCallback 의존성 문제
**파일**: `apps/web/hooks/useChatStream.ts`
**문제**: `options` 객체 의존성으로 무한 리렌더링 가능

```typescript
// 현재
const sendMessage = useCallback(async (...) => { ... }, [options]);

// 개선안: options를 ref로 관리하거나 개별 콜백을 useCallback으로 래핑
```

---

#### F. 정규식 성능
**파일**: `apps/ai-service/app/api/chat.py`
**문제**: StreamingParser에서 매번 정규식 재컴파일

```python
# 현재
start_match = re.search(r'<file\s+path="([^"]+)">', self.buffer)

# 개선안: 클래스 수준 상수로 이동
class StreamingParser:
    FILE_START_PATTERN = re.compile(r'<file\s+path="([^"]+)">')
```

---

### 3.3 권장 개선 (Recommended)

| 항목 | 파일 | 개선안 |
|------|------|--------|
| 전역 싱글톤 | firestore.py | 스레드 안전 싱글톤 패턴 |
| 에러 처리 중복 | firestore.py | 데코레이터로 통합 |
| 메모리 버퍼 | chat.py | 대용량 파일 버퍼 제한 |
| 필수 필드 | collections.json | required 속성 추가 |
| Firestore 인덱스 | - | room_id + timestamp 복합 인덱스 필요 |

---

## 4. 논의 필요 사항

### 4.1 아키텍처 결정

**Q1**: 스트리밍 중 실패한 메시지 상태 처리
- 현재: `GENERATING` 상태로 남음
- 옵션 A: 명시적 `FAILED` 상태 추가
- 옵션 B: 타임아웃 후 자동 정리
- 옵션 C: 클라이언트에서 재시도 시 덮어쓰기

**Q2**: 대화 히스토리 제한 (현재 5개)
- 토큰 사용량 vs 컨텍스트 유지
- 동적 조절 필요 여부

**Q3**: 타입 생성 파일 Git 관리
- 현재: 커밋에 포함
- 대안: pre-commit hook + CI 검증

---

### 4.2 보안 검토

**인증/권한**:
- [ ] Firestore Security Rules 검증
- [ ] API 프록시의 사용자 인증 추가
- [ ] room_id 소유권 확인 로직

**환경 변수**:
- [ ] 프로덕션 API 키 분리
- [ ] 비밀 로테이션 계획

---

### 4.3 테스트 전략

**현재 상태**: 테스트 코드 없음

**제안**:
1. AI Service: pytest + httpx (API 테스트)
2. Web App: Jest + React Testing Library (hook 테스트)
3. E2E: Playwright (전체 흐름)

---

## 5. 다음 스프린트 제안

### 5.1 즉시 (P0)
- [ ] Firestore 동기/비동기 분리
- [ ] 에러 메시지 내부 정보 제거
- [ ] 타입 불일치 해결 (string → number)

### 5.2 다음 주 (P1)
- [ ] 스트리밍 에러 처리 개선
- [ ] Firestore 복합 인덱스 생성
- [ ] 기본 테스트 코드 추가

### 5.3 백로그 (P2)
- [ ] 대화 히스토리 동적 조절
- [ ] 타입 생성 CI 자동화
- [ ] 모니터링/로깅 체계화

---

## 부록: 커밋 히스토리

| 커밋 | 설명 | PR |
|------|------|-----|
| 9a8c41de | Merge: Claude 모델 변경 | #9 |
| e94fabac | Chore: Sonnet 4 → 4.5 | - |
| d2712d9c | Fix: 엔드포인트 수정 | - |
| d8ae5125 | Merge: 이전대화 기억 기능 | #8 |
| bd691c30 | Feat: 이전대화 기억 로직 | - |
| 961a0ae7 | Merge: Firebase hooks | #6 |
| 132bd264 | Feat: OpenAPI 타입 생성 | - |
| 42e52acb | Feat: Firebase 타입 스크립트 개선 | - |
| 14ebec84 | Merge: Firestore CRUD | #7 |
| 38841eeb | Feat: SSE 스트리밍 프록시 | - |
| d0d829b1 | Feat: Firebase messages hook | - |
| 1e66b7f0 | Chore: Tanstack query 설치 | - |
| 8b265e35 | Feat: Firebase 문서 타입 생성 | - |
| d180b6db | Feat: Firestore 필드 수정 | - |
| 5d7d46be | Feat: Firestore Room, Chat 추가 | - |
| 92784144 | Feat: FastAPI AI 서비스 추가 | #3 |
| d760dafb | Feat: Firebase 초기 세팅 | - |
| 4bbe01f0 | CI: Vercel 설정 | - |
| f94bd1b5 | Feat: Firebase 타입 자동화 | - |
| 355a524b | Docs: README.md 수정 | - |

---

## 부록 A: AI Service 구현 상세

### A.1 채팅 API 흐름 (`chat.py`)

```
사용자 요청 → 시스템 프롬프트 로드 → 이전 대화 조회 → AI 호출 → 응답 파싱 → Firestore 저장
```

#### 주요 함수 설명

| 함수 | 역할 | 위치 |
|------|------|------|
| `resolve_system_prompt()` | Firebase Storage에서 스키마 로드, 실패 시 로컬 fallback | chat.py:50-80 |
| `build_conversation_history()` | 최근 5개 대화를 Message 리스트로 변환 | chat.py:85-120 |
| `parse_ai_response()` | `<file path="...">...</file>` 태그 파싱 | chat.py:125-160 |
| `StreamingParser` | 청크 단위 실시간 파일 태그 처리 | chat.py:165-250 |

#### 스트리밍 응답 구조

```
이벤트 타입:
├── text   → { type: "text", text: "실시간 대화 텍스트" }
├── code   → { type: "code", path: "파일경로", content: "코드" }
├── done   → { type: "done" }
└── error  → { type: "error", message: "에러 메시지" }
```

**하이브리드 스트리밍 전략**:
- 대화 텍스트: 청크 단위 즉시 전송 (타이핑 효과)
- 코드 파일: `</file>` 태그 감지 후 한 번에 전송 (안정성)

#### 이전 대화 기억 로직 (bd691c30)

```python
# 이전 메시지 조회 (최신 5개)
previous_messages = await get_messages_by_room(
    room_id=request.room_id,
    limit=MAX_HISTORY_COUNT  # 5
)

# 메시지 형식 변환
for msg in previous_messages:
    messages.append(Message(role="user", content=msg["question"]))

    # 코드 파일이 있으면 포함
    if msg.get("content") and msg.get("path"):
        assistant_content += f'\n<file path="{msg["path"]}">{msg["content"]}</file>'

    messages.append(Message(role="assistant", content=assistant_content))
```

### A.2 AI 프로바이더 추상화 (`ai_provider.py`)

```python
class AIProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[Message]) -> tuple[Message, dict | None]:
        """동기 응답"""

    @abstractmethod
    async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
        """스트리밍 응답"""
```

**구현체 비교**:

| 프로바이더 | 클라이언트 | 모델 설정 | 특이사항 |
|-----------|-----------|----------|---------|
| `OpenAIProvider` | `AsyncOpenAI` | `gpt-4o` | 기본값 |
| `AnthropicProvider` | `AsyncAnthropic` | `claude-sonnet-4-5` | 현재 사용 중 |
| `GeminiProvider` | `AsyncGenerativeModel` | `gemini-1.5-pro` | system 메시지 분리 필요 |

**프로바이더 선택** (`config.py`):
```python
AI_PROVIDER = os.getenv("AI_PROVIDER", "anthropic")  # openai | anthropic | gemini
```

### A.3 Firestore 서비스 (`firestore.py`)

**컬렉션 구조**:
```
chat_rooms/
├── {room_id}
│   ├── id: string
│   ├── storybook_url: string
│   ├── user_id: string
│   └── created_at: number (ms)

chat_messages/
├── {message_id}
│   ├── id: string
│   ├── room_id: string (FK → chat_rooms)
│   ├── question: string
│   ├── text: string
│   ├── content: string (생성된 코드)
│   ├── path: string (파일 경로)
│   ├── status: "GENERATING" | "DONE" | "ERROR"
│   ├── question_created_at: number
│   └── answer_created_at: number
```

**CRUD 함수**:
```python
# 채팅방
async def create_chat_room(storybook_url, user_id) -> dict
async def get_chat_room(room_id) -> dict
async def verify_room_exists(room_id) -> bool

# 메시지
async def create_chat_message(room_id, question, ...) -> dict
async def get_messages_by_room(room_id, limit=100) -> list[dict]
async def update_chat_message(message_id, **fields) -> bool
```

---

## 부록 B: Firebase Hooks 상세

### B.1 useRealtimeMessages - 실시간 구독

**용도**: Firestore `onSnapshot`으로 실시간 메시지 동기화

**사용법**:
```typescript
const { messages, loading, error, unsubscribe } = useRealtimeMessages({
  sessionId: 'room-123',
  pageSize: 50,  // 선택 (기본 100)
  callbacks: {
    onInitial: (msgs) => console.log('초기 로드:', msgs.length),
    onAdded: (msg) => console.log('새 메시지:', msg.id),
    onModified: (msg) => console.log('수정됨:', msg.id),
    onRemoved: (msg) => console.log('삭제됨:', msg.id),
  }
});
```

**내부 동작**:
```
1. sessionId 변경 시 새 구독 생성
2. 첫 스냅샷: 모든 변경이 'added' → onInitial 콜백
3. 이후 스냅샷: docChanges() 순회하며 이벤트별 처리
4. 언마운트 시 자동 unsubscribe
```

**주의사항**:
- 정렬: `question_created_at` 오름차순 (오래된 순)
- 메모리: 모든 메시지를 state에 보관 → 대량 메시지 시 성능 고려

### B.2 useGetPaginatedFbMessages - 무한 스크롤

**용도**: TanStack Query로 페이지네이션된 메시지 로드

**사용법**:
```typescript
const {
  data,              // InfiniteData<ClientMessage[][]>
  fetchNextPage,     // 다음 페이지 로드
  hasNextPage,       // 더 있는지
  isFetchingNextPage // 로딩 중
} = useGetPaginatedFbMessages({
  sessionId: 'room-123',
  pageSize: 20
});

// 모든 메시지 flat
const allMessages = data?.pages.flat() ?? [];
```

**페이지네이션 로직**:
```
1. 첫 페이지: orderBy('question_created_at', 'desc').limit(20)
2. 다음 페이지: startAfter(lastTimestamp).limit(20)
3. 종료 조건: 반환된 페이지 크기 < pageSize
```

**캐싱**: `staleTime: 5분` (실시간 동기화는 useRealtimeMessages 담당)

### B.3 useChatStream - SSE 처리

**용도**: AI 서버의 Server-Sent Events 스트림 처리

**사용법**:
```typescript
const {
  sendMessage,
  isLoading,
  accumulatedText,  // 누적된 전체 텍스트
  error
} = useChatStream({
  onText: (text) => { /* 증분 텍스트 */ },
  onCode: (file) => { /* { path, content } */ },
  onDone: () => { /* 완료 */ },
  onError: (err) => { /* 에러 */ }
});

// 메시지 전송
await sendMessage({
  message: '버튼 컴포넌트 만들어줘',
  room_id: 'room-123'
});
```

**SSE 파싱**:
```
data: {"type":"text","text":"안"}
data: {"type":"text","text":"녕"}
data: {"type":"code","path":"Button.tsx","content":"..."}
data: {"type":"done"}
```

### B.4 API Route 프록시 (`/api/chat/stream`)

**역할**: 클라이언트 → Next.js 서버 → AI 서버 중계

```typescript
// 요청
POST /api/chat/stream
{
  message: string,
  room_id?: string,
  schema_key?: string
}

// 응답
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**환경 변수**:
```
AI_SERVER_URL=https://ai-service.example.com
AI_SERVER_API_KEY=sk-xxxxx
```

---

## 부록 C: 타입 생성 시스템 상세

### C.1 Single Source of Truth 구조

```
collections.json (원본)
       │
       ├──→ generate-typescript.js ──→ typescript/firebase/*.ts
       │
       └──→ generate-python.py ──→ python/firebase/*.py
```

### C.2 collections.json 스키마

```json
{
  "$schema": "https://json-schema.org/draft-07/schema",
  "collections": {
    "chat_messages": {
      "description": "채팅 메시지 컬렉션",
      "fields": {
        "id": {
          "type": "string",
          "description": "메시지 고유 ID"
        },
        "status": {
          "type": "string",
          "enum": ["GENERATING", "DONE", "ERROR"],
          "description": "메시지 상태"
        },
        "question_created_at": {
          "type": "number",
          "description": "질문 생성 시간 (밀리초)"
        }
      }
    }
  }
}
```

### C.3 생성 스크립트 실행

```bash
# Firebase 타입 생성
pnpm gen:firebase-types
# → packages/shared-types/typescript/firebase/collections.ts
# → packages/shared-types/typescript/firebase/types.ts
# → packages/shared-types/python/firebase/collections.py
# → packages/shared-types/python/firebase/types.py

# OpenAPI 타입 생성
pnpm gen:api-types
# → packages/shared-types/typescript/api/schema.ts
```

### C.4 생성된 타입 사용법

**TypeScript**:
```typescript
import { COLLECTIONS, ChatMessagesDocument } from '@ds-hub/shared-types/firebase';

const message: ChatMessagesDocument = {
  id: 'msg-123',
  status: 'DONE',  // 타입 체크됨
  // ...
};

// 컬렉션 경로
db.collection(COLLECTIONS.CHAT_MESSAGES);  // 'chat_messages'
```

**Python**:
```python
from packages.shared_types.python.firebase import Collections, ChatMessage

message: ChatMessage = {
    "id": "msg-123",
    "status": "DONE",  # 타입 체크됨 (TypedDict)
    # ...
}

# 컬렉션 경로
db.collection(Collections.CHAT_MESSAGES)  # 'chat_messages'
```

### C.5 새 필드 추가 시 워크플로우

```bash
# 1. collections.json에 필드 추가
# 2. 타입 재생성
pnpm gen:firebase-types

# 3. 생성된 파일 확인
git diff packages/shared-types/typescript/
git diff packages/shared-types/python/

# 4. 커밋
git add .
git commit -m "Feat: Add new field to chat_messages schema"
```

---

## 부록 D: 코드 리뷰 개선점 상세

### D.1 Critical: Firestore 동기/비동기 분리

**현재 코드** (`firestore.py`):
```python
async def create_chat_room(storybook_url: str, user_id: str) -> dict:
    db = get_firestore_client()
    room_id = str(uuid.uuid4())
    room_data = {
        "id": room_id,
        "storybook_url": storybook_url,
        "user_id": user_id,
        "created_at": get_timestamp_ms(),
    }
    # 문제: 동기 호출이 async 함수 내에서 실행
    db.collection(CHAT_ROOMS_COLLECTION).document(room_id).set(room_data)
    return room_data
```

**개선안**:
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=10)

async def create_chat_room(storybook_url: str, user_id: str) -> dict:
    db = get_firestore_client()
    room_id = str(uuid.uuid4())
    room_data = {
        "id": room_id,
        "storybook_url": storybook_url,
        "user_id": user_id,
        "created_at": get_timestamp_ms(),
    }

    # 개선: run_in_executor로 동기 작업을 스레드풀에서 실행
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        _executor,
        lambda: db.collection(CHAT_ROOMS_COLLECTION).document(room_id).set(room_data)
    )
    return room_data
```

---

### D.2 Critical: 에러 메시지 보안

**현재 코드** (`chat.py`):
```python
@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        # ... 로직
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))  # 위험!
```

**개선안**:
```python
import logging
from enum import Enum

logger = logging.getLogger(__name__)

class ErrorCode(str, Enum):
    AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR"
    FIRESTORE_ERROR = "FIRESTORE_ERROR"
    SCHEMA_LOAD_ERROR = "SCHEMA_LOAD_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"

@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        # ... 로직
    except AIProviderError as e:
        logger.error("AI provider failed", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail={
                "code": ErrorCode.AI_PROVIDER_ERROR,
                "message": "AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
            }
        )
    except FirestoreError as e:
        logger.error("Firestore operation failed", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "code": ErrorCode.FIRESTORE_ERROR,
                "message": "데이터 저장에 실패했습니다."
            }
        )
    except Exception as e:
        logger.exception("Unexpected error in chat endpoint")
        raise HTTPException(
            status_code=500,
            detail={
                "code": ErrorCode.UNKNOWN_ERROR,
                "message": "예기치 않은 오류가 발생했습니다."
            }
        )
```

---

### D.3 Critical: 타입 통일 (string → number)

**변경 필요 파일들**:

1. `apps/web/hooks/firebase/messageUtils.ts`:
```typescript
// Before
export interface ClientMessage {
  question_created_at: string;
  answer_created_at?: string;
}

// After
export interface ClientMessage {
  question_created_at: number;  // 밀리초 타임스탬프
  answer_created_at?: number;
}
```

2. `apps/web/hooks/firebase/useGetPaginatedFbMessages.ts`:
```typescript
// Before
if (pageParam) {
  queryConstraints.push(where('question_created_at', '<', pageParam));  // pageParam: string
}

// After
if (pageParam) {
  queryConstraints.push(where('question_created_at', '<', pageParam));  // pageParam: number
}
```

3. `packages/shared-types/firebase/collections.json`:
```json
{
  "question_created_at": {
    "type": "number",  // 이미 number로 정의됨
    "description": "질문 생성 시간 (밀리초)"
  }
}
```

---

### D.4 Important: 스트리밍 에러 처리

**현재 문제**:
```python
async def chat_stream(request: ChatRequest):
    async def generate():
        try:
            # 스트리밍 로직
            for chunk in stream:
                yield f"data: {json.dumps({'type': 'text', 'text': chunk})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            # 문제: 이미 일부 청크를 보낸 후 에러 발생
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

**개선안**:
```python
async def chat_stream(request: ChatRequest):
    # 1. 스트림 시작 전 검증
    try:
        await verify_room_exists(request.room_id)
        system_prompt = await resolve_system_prompt(request.schema_key)
    except Exception as e:
        # 스트림 시작 전이므로 일반 HTTP 에러로 반환
        raise HTTPException(status_code=400, detail=str(e))

    # 2. 메시지 상태 관리
    message_id = None

    async def generate():
        nonlocal message_id
        try:
            # 메시지 생성 (GENERATING 상태)
            message_data = await create_chat_message(
                room_id=request.room_id,
                question=request.message,
                status="GENERATING"
            )
            message_id = message_data["id"]

            # 스트리밍 로직
            # ...

            # 성공 시 DONE 상태로 업데이트
            await update_chat_message(message_id, status="DONE")
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.exception("Streaming error")
            # 에러 시 ERROR 상태로 업데이트
            if message_id:
                await update_chat_message(message_id, status="ERROR")
            yield f"data: {json.dumps({'type': 'error', 'message': '응답 생성 중 오류'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

### D.5 Important: useCallback 의존성 수정

**현재 코드** (`useChatStream.ts`):
```typescript
export function useChatStream(options: UseChatStreamOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [accumulatedText, setAccumulatedText] = useState('');

  // 문제: options 객체가 매 렌더마다 새로 생성되면 무한 루프
  const sendMessage = useCallback(async (request: ChatStreamRequest) => {
    setIsLoading(true);
    // ...
    options.onText?.(text);  // options 참조
    // ...
  }, [options]);  // options 전체가 의존성

  return { sendMessage, isLoading, accumulatedText };
}
```

**개선안**:
```typescript
export function useChatStream(options: UseChatStreamOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [accumulatedText, setAccumulatedText] = useState('');

  // 콜백들을 ref로 저장 (의존성에서 제외)
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sendMessage = useCallback(async (request: ChatStreamRequest) => {
    setIsLoading(true);
    try {
      // ...
      optionsRef.current.onText?.(text);  // ref를 통해 접근
      // ...
    } finally {
      setIsLoading(false);
    }
  }, []);  // 빈 의존성 배열

  return { sendMessage, isLoading, accumulatedText };
}
```

---

### D.6 Recommended: 에러 처리 데코레이터

**현재 코드** (`firestore.py`):
```python
async def create_chat_room(...):
    try:
        # 로직
    except FirestoreError:
        raise
    except Exception as e:
        logger.error("Failed to create chat room: %s", str(e))
        raise FirestoreError(f"채팅방 생성 실패: {str(e)}") from e

async def get_chat_room(...):
    try:
        # 로직
    except FirestoreError:
        raise
    except Exception as e:
        logger.error("Failed to get chat room: %s", str(e))
        raise FirestoreError(f"채팅방 조회 실패: {str(e)}") from e
# 반복...
```

**개선안**:
```python
from functools import wraps

def firestore_operation(operation_name: str):
    """Firestore 작업 에러 처리 데코레이터"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except FirestoreError:
                raise  # 이미 처리된 에러는 그대로 전파
            except Exception as e:
                logger.error("Failed %s: %s", operation_name, str(e))
                raise FirestoreError(f"{operation_name} 실패") from e
        return wrapper
    return decorator

# 사용
@firestore_operation("채팅방 생성")
async def create_chat_room(...):
    # 순수 로직만 작성
    db = get_firestore_client()
    # ...

@firestore_operation("채팅방 조회")
async def get_chat_room(...):
    # ...
```

---

*이 문서는 코드 리뷰 및 팀 회의용으로 작성되었습니다.*
