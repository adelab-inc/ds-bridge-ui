# Runtime Hub Description 기능 PRD

## 1. 개요

### 1.1 배경

DS-Bridge Runtime Hub는 현재 Storybook 기반 디자인 시스템 컴포넌트를 활용하여 AI가 React UI 코드를 생성하는 플랫폼이다. 채팅 기반 프롬프트 입력 → AI 코드 생성 → Preview 렌더링의 단방향 워크플로우만 존재하며, 생성된 UI에 대한 **구조적 설명(Description)**을 체계적으로 추출 / 편집 / 버전 관리하는 기능이 부재한 상태다.

### 1.2 목적

1. 채팅 영역 상단에 **[디자인 모드] / [디스크립션 모드]** 탭 UI 추가
2. 디자인 모드에서 **[디스크립션 추출]** 버튼으로 LLM 기반 설명 자동 생성
3. 디스크립션 모드에서 **인라인 텍스트 편집** + **버전 관리** (저장/복사)
4. **버전 히스토리** 조회 UI (정수 버전: AI 추출, 소수점 버전: 수동 편집)
5. Backend: 디스크립션 추출 API, 버전 관리, Diff 처리 검토

### 1.3 용어 정의

| 용어 | 설명 |
|------|------|
| 디자인 모드 | 기존 프롬프트 입력 + AI 코드 생성 탭 (현재 ChatSection 전체 기능) |
| 디스크립션 모드 | 디스크립션 조회/편집 전용 탭 (넓은 전용 뷰) |
| Extraction | LLM이 대화 히스토리 + 화면 정보 기반으로 디스크립션을 자동 생성하는 행위 |
| Major Version | AI Extraction 시 부여되는 정수 버전 (v1, v2, v3...) |
| Minor Version | 사용자 수동 편집 시 부여되는 소수점 버전 (v1.01, v1.02...) |

---

## 2. 레포지토리 현황

### 2.1 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.1 | App Router, SSR, BFF |
| React | 19.2.3 | UI 컴포넌트 |
| TypeScript | 5.x | strict 모드 |
| Tailwind CSS | 4.x | 유틸리티 스타일링 |
| Base UI | 1.0.0 | Headless 컴포넌트 (Tabs 등) |
| Zustand | - | 클라이언트 상태 관리 |
| TanStack Query | 5.90.16 | 서버 상태 관리, 데이터 fetching |
| Supabase | - | Auth, DB(PostgreSQL), Realtime Broadcast |
| FastAPI | 0.115+ | AI 서비스 (Python) |
| Multi-LLM | - | OpenAI gpt-4.1 / Anthropic claude-sonnet-4-5 / Gemini |

### 2.2 현재 아키텍처

```
Browser
  ├─ Left Panel (35%, 280px~600px) ── react-resizable-panels v4.3.0
  │   └─ ChatSection
  │       ├─ ChatInput (프롬프트 입력, 이미지 첨부)
  │       ├─ ChatMessageList (무한 스크롤, 메시지 선택)
  │       ├─ useChatStream → POST /api/chat/stream (Next.js BFF)
  │       └─ useRoomChannel → Supabase Broadcast (room:{roomId})
  │
  └─ Right Panel (65%)
      └─ PreviewSection
          └─ Tabs: AI Generated / Storybook / Composition
```

### 2.3 핵심 파일 맵

| 영역 | 파일 경로 | 역할 |
|------|----------|------|
| 레이아웃 | `apps/web/components/layout/desktop-layout.tsx` | 메인 2-패널 레이아웃 |
| 채팅 섹션 | `apps/web/components/features/chat/chat-section.tsx` | 채팅 전체 로직 (스트리밍, 북마크, 메시지 선택) |
| 채팅 입력 | `apps/web/components/features/chat/chat-input.tsx` | 프롬프트 입력 UI |
| 메시지 목록 | `apps/web/components/features/chat/chat-message-list.tsx` | 메시지 렌더링 |
| 프리뷰 섹션 | `apps/web/components/features/preview/preview-section.tsx` | 우측 탭 + 프리뷰 |
| 탭 컴포넌트 | `apps/web/components/ui/tabs.tsx` | Base UI 기반 (default/line variant) |
| 코드 생성 스토어 | `apps/web/stores/useCodeGenerationStore.ts` | Zustand: generatedCode, isGeneratingCode |
| 스트리밍 스토어 | `apps/web/stores/useStreamingStore.ts` | Zustand: 스트리밍 메시지 |
| 채팅 스트림 | `apps/web/hooks/useChatStream.ts` | POST /api/chat/stream 호출 |
| 브로드캐스트 | `apps/web/hooks/supabase/useRoomChannel.ts` | Supabase Realtime 구독 |
| BFF 라우트 | `apps/web/app/api/chat/stream/route.ts` | Next.js → FastAPI 프록시 |
| AI 핸들러 | `apps/ai-service/app/api/chat.py` | FastAPI 채팅 + StreamingParser |
| DB 서비스 | `apps/ai-service/app/services/supabase_db.py` | Supabase CRUD |
| 브로드캐스트 | `apps/ai-service/app/services/broadcast.py` | Supabase Realtime REST |
| 상수 | `apps/web/lib/constants.ts` | LAYOUT, BREAKPOINTS, Z_INDEX |
| 채팅 타입 | `apps/web/types/chat.ts` | Message/Broadcast 이벤트 타입 |
| DB 타입 | `packages/shared-types/typescript/database/types.ts` | ChatRoom, ChatMessage |
| 컬렉션 스키마 | `packages/shared-types/database/collections.json` | SSOT JSON 스키마 |

### 2.4 현재 DB 테이블

```sql
chat_rooms (id, user_id, storybook_url, schema_key, created_at)
chat_messages (id, room_id, user_id, question, text, content, path, status, image_urls, timestamps)
```

### 2.5 현재 상태 관리

- **Zustand 스토어 3개**: CodeGenerationStore (코드 생성), StreamingStore (스트리밍 메시지), AuthStore (인증)
- **TanStack Query**: `useGetPaginatedMessages` (커서 기반 무한 스크롤, staleTime 5분)
- **URL 기반 상태**: 메시지 선택 `?mid={messageId}` 쿼리 파라미터
- **localStorage**: 북마크 저장 (서버 미동기화)

### 2.6 LLM 호출 방식

```
POST /api/chat/stream (Next.js BFF)
  → Supabase JWT 검증
  → POST ${AI_SERVER_URL}/chat/stream (FastAPI, X-API-Key 인증)
  → 202 Accepted + message_id 즉시 반환
  → Background: LLM 스트리밍 → StreamingParser → Broadcast 이벤트
  → Client: useRoomChannel로 Broadcast 구독 (start/chunk/done/error)
```

### 2.7 존재하지 않는 것 (신규 구현 필요)

- ❌ 디스크립션 전용 데이터 모델 / 테이블
- ❌ 버전 히스토리 관리
- ❌ [디자인 모드] / [디스크립션 모드] 탭 UI
- ❌ 디스크립션 추출 API 엔드포인트
- ❌ 디스크립션 편집/저장/복사 UI
- ❌ Diff 처리 로직

---

## 3. 기능 명세

### 3.1 FE 기능

#### FE-1. 탭 UI 분리 (디자인 모드 / 디스크립션 모드)

**목적**: 채팅 영역 상단에 두 개의 독립 탭을 추가하여, 코드 생성 작업과 디스크립션 관리 작업을 분리한다.

**수정 대상**: `apps/web/components/features/chat/chat-section.tsx`

**UI 구조**:
```
+------------------------------------------+
| [AI Navigator 아이콘] AI Navigator  [북마크] |  ← 기존 헤더 유지
+------------------------------------------+
| [디자인 모드]  [디스크립션 모드]              |  ← 신규 TabsList (line variant)
+------------------------------------------+
| (디자인 모드 활성 시)                       |
|   ChatMessageList + ChatInput             |  ← 기존 그대로
|                                           |
| (디스크립션 모드 활성 시)                    |
|   DescriptionEditor (넓은 전용 뷰)         |  ← 신규 컴포넌트
+------------------------------------------+
```

**동작 조건**:
- 기존 `apps/web/components/ui/tabs.tsx`의 Tabs 컴포넌트 재사용 (variant="line")
- 탭 전환 시 각 탭의 상태 독립 유지 (`data-[state=inactive]:hidden` CSS로 DOM 유지)
- 디자인 모드의 스트리밍은 디스크립션 모드에서도 백그라운드 진행
- 기본 활성 탭: 디자인 모드

**예외 처리**:
- roomId 없는 상태: 탭 미렌더링 (기존 로딩/에러 처리 유지)
- 디스크립션 미추출 상태에서 디스크립션 모드 진입: 빈 상태 안내 + [추출하기] 바로가기

---

#### FE-2. 디스크립션 추출

**목적**: 현재 대화 내용 + 생성된 코드를 기반으로 AI가 구조적 디스크립션을 자동 생성한다.

**배치 위치**: 디자인 모드 탭의 ChatInput 영역 근처에 액션 버튼 배치

**동작**:
1. [디스크립션 추출] 버튼 클릭
2. 기존 디스크립션 존재 시 덮어쓰기 확인 AlertDialog 표시
3. roomId + 최신 generatedCode를 payload로 BE API 호출
4. 로딩 상태 표시 (버튼 비활성화 + 스피너)
5. 응답 수신 → 디스크립션 모드 탭에 반영 (Major Version 자동 증가)

**예외 처리**:
- 대화 내역 0건: 버튼 비활성화
- 스트리밍 진행 중 (`isGeneratingCode === true`): 버튼 비활성화
- 추출 실패: 에러 토스트 표시, 기존 디스크립션 유지

---

#### FE-3. 디스크립션 편집

**목적**: 디스크립션 모드에서 AI 생성 디스크립션을 직접 수정/보완한다.

**UI 구성**:
```
+------------------------------------------+
| [버전: v2.03 ▼]           [저장] [복사]   |  ← 상단 툴바
+------------------------------------------+
|                                           |
| (편집 가능한 Textarea / Markdown)          |
| ## 컴포넌트 구조                           |
| - Header: 상단 네비게이션 바               |
|   - 로고 + 메뉴                           |
|   - 검색 + 프로필                          |
|                                           |
+------------------------------------------+
```

**[저장] 버튼**:
- 변경 사항 있을 때만 활성화
- 클릭 → Minor Version 자동 증가 (v1.01 → v1.02) → BE API 저장

**[복사] 버튼**:
- 전체 텍스트 클립보드 복사
- 기존 PreviewSection의 Copy 패턴 재사용 (아이콘 변경 → 2초 후 복귀)

**예외 처리**:
- 빈 내용: 저장 버튼 비활성화
- 미저장 상태에서 탭 전환: 확인 AlertDialog
- 네트워크 에러: 로컬 변경 유지, 재시도 안내
- 디스크립션 없음: "디스크립션을 먼저 추출해 주세요" + [추출하기] 바로가기

---

#### FE-4. 버전 히스토리 UI

**목적**: 모든 디스크립션 버전을 시간순으로 조회하고, 특정 버전 내용을 확인한다.

**버전 표기 규칙**:
| 유형 | 표기 | 예시 | 트리거 |
|------|------|------|--------|
| AI Extraction | 정수 (Major) | v1, v2, v3 | [디스크립션 추출] 클릭 |
| 수동 편집 | 소수점 (Minor) | v1.01, v1.02, v2.01 | [저장] 클릭 |

**동작**:
- 디스크립션 모드 하단 또는 접이식 패널로 버전 목록 표시
- 각 항목: 버전 번호, 시각, 유형 배지(AI 추출/수동 편집), 요약(첫 100자)
- 특정 버전 클릭 → 해당 내용 읽기 전용 로드
- 최신 버전 선택 시 편집 모드 활성화
- 최신순 정렬, TanStack Query 관리 (queryKey: `['descriptions', roomId]`)

**예외 처리**:
- 버전 0개: 빈 상태 메시지

---

### 3.2 BE 기능

#### BE-1. 디스크립션 추출 API

**엔드포인트 설계 (BFF 패턴)**:
```
Browser → POST /api/description/extract (Next.js BFF)
       → POST /description/extract (FastAPI)
       → LLM 호출 → descriptions 테이블 저장 → 응답 반환
```

**Next.js BFF**: `apps/web/app/api/description/extract/route.ts`
**FastAPI**: `apps/ai-service/app/api/description.py` (신규)

**동작 흐름**:
1. room_id로 최근 대화 히스토리 조회 (기존 `get_messages_by_room` 재사용)
2. 최신 코드 또는 `current_code` 파라미터 사용
3. 디스크립션 추출 전용 시스템 프롬프트 구성
4. LLM 호출 (기존 `ai_provider` 추상화 재사용)
5. `descriptions` 테이블에 Major Version으로 저장
6. 결과 반환

**예외 처리**:
- room 미존재: 404
- 대화 히스토리 0건: 422
- LLM 호출 실패: 500

---

#### BE-2. 버전 관리 API

**버전 번호 체계**:
```
major_version: 정수 (AI Extraction 시 +1)
minor_version: 정수 (수동 편집 시 +1, Extraction 시 0으로 리셋)
display: major만 표시(v1) 또는 "v{major}.{minor:02d}" (v1.01)
```

**API 엔드포인트**:

| Method | BFF Path | FastAPI Path | 설명 |
|--------|----------|-------------|------|
| POST | `/api/description/extract` | `/description/extract` | AI 추출 (Major) |
| PUT | `/api/description/save` | `/description/save` | 수동 저장 (Minor) |
| GET | `/api/description/[room_id]` | `/description/{room_id}` | 최신 조회 |
| GET | `/api/description/[room_id]/versions` | `/description/{room_id}/versions` | 버전 목록 |
| GET | `/api/description/[room_id]/versions/[id]` | `/description/{room_id}/versions/{id}` | 특정 버전 |

---

#### BE-3. Diff 처리 (검토 항목)

**시나리오**: v1(추출) → v1.02(편집) → v2(재추출) 시 수동 편집 보존 여부

**접근 방식 비교**:

| 방식 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 단순 덮어쓰기 | 재추출 시 완전 교체 | 구현 단순 | 수동 편집 유실 |
| B. Three-Way Merge | base + 편집 + 신규추출 병합 | 편집 보존 | 충돌 해결 UI 필요 |
| C. LLM 기반 병합 | AI에게 편집 반영 지시 | 자연어 수준 병합 | 비결정적, 비용 |
| D. Side-by-Side 비교 | 양쪽 나란히 표시, 사용자 선택 | 통제권 보장 | UX 복잡 |

**권장**:
- **Phase 1**: A (단순 덮어쓰기) + 버전 히스토리 보존 → 이전 버전 참조 가능
- **Phase 2+**: D (Side-by-Side 비교) → 재추출 시 이전 편집과 나란히 표시

---

## 4. 데이터 구조 제안

### 4.1 신규 Supabase 테이블: `descriptions`

```sql
CREATE TABLE descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  major_version INTEGER NOT NULL,
  minor_version INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('extraction', 'manual_edit')),
  base_message_id UUID REFERENCES chat_messages(id),
  created_by TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,

  UNIQUE (room_id, major_version, minor_version)
);

CREATE INDEX idx_descriptions_room_id ON descriptions(room_id);
CREATE INDEX idx_descriptions_room_version ON descriptions(room_id, major_version DESC, minor_version DESC);
```

### 4.2 TypeScript 타입 (`packages/shared-types`)

```typescript
export type DescriptionSource = 'extraction' | 'manual_edit';

export interface Description {
  id: string;
  room_id: string;
  content: string;
  major_version: number;
  minor_version: number;
  source: DescriptionSource;
  base_message_id: string | null;
  created_by: string | null;
  created_at: number;
}

export interface DescriptionVersionSummary {
  id: string;
  major_version: number;
  minor_version: number;
  display_version: string;
  source: DescriptionSource;
  summary: string;
  created_at: number;
}
```

### 4.3 API Request/Response 예시

#### 디스크립션 추출 (POST `/api/description/extract`)

**Request**:
```json
{
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "current_code": "const App = () => (<div className='grid grid-cols-12'>...</div>)",
  "current_code_path": "src/pages/Dashboard.tsx"
}
```

**Response** (200):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "major_version": 2,
  "minor_version": 0,
  "content": "## Dashboard 페이지 구조\n\n### 컴포넌트 트리\n- Navigation Sidebar\n  - Logo (variant: compact)\n  - Menu 리스트\n- Header Bar\n- Main Content\n  - MetricCard x 4\n  - DataTable\n"
}
```

#### 수동 저장 (PUT `/api/description/save`)

**Request**:
```json
{
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "content": "(편집된 디스크립션 텍스트)",
  "base_version_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response** (200):
```json
{
  "id": "f9e8d7c6-b5a4-3210-fedc-ba9876543210",
  "major_version": 2,
  "minor_version": 1,
  "display_version": "v2.01",
  "created_at": 1709568000000
}
```

#### 버전 목록 (GET `/api/description/{room_id}/versions`)

**Response** (200):
```json
{
  "versions": [
    {"id": "f9e8...", "major_version": 2, "minor_version": 1, "display_version": "v2.01", "source": "manual_edit", "summary": "## Dashboard (Sidebar 로고 크기 확대)", "created_at": 1709568000000},
    {"id": "a1b2...", "major_version": 2, "minor_version": 0, "display_version": "v2", "source": "extraction", "summary": "## Dashboard 페이지 구조", "created_at": 1709567000000},
    {"id": "1122...", "major_version": 1, "minor_version": 0, "display_version": "v1", "source": "extraction", "summary": "## 초기 Dashboard 설계", "created_at": 1709500000000}
  ],
  "total_count": 3
}
```

---

## 5. 구현 우선순위

### Phase 1: 데이터 기반 (BE 우선)

| 순서 | 항목 | 의존성 | 담당 |
|------|------|--------|------|
| 1-1 | `descriptions` 테이블 Migration | 없음 | BE |
| 1-2 | `packages/shared-types` 타입 추가 | 1-1 | 공통 |
| 1-3 | FastAPI Description CRUD 서비스 | 1-1 | BE |
| 1-4 | FastAPI Description 추출 API | 1-3 | BE |
| 1-5 | FastAPI 저장/조회/버전목록 API | 1-3 | BE |
| 1-6 | Next.js BFF 라우트 (`/api/description/*`) | 1-4, 1-5 | FE |

### Phase 2: FE UI 기본

| 순서 | 항목 | 의존성 | 담당 |
|------|------|--------|------|
| 2-1 | `useDescriptionStore` Zustand 스토어 | 1-2 | FE |
| 2-2 | `useDescription` TanStack Query 훅 | 1-6, 2-1 | FE |
| 2-3 | ChatSection 탭 UI 분리 | 없음 | FE |
| 2-4 | DescriptionEditor 컴포넌트 (편집+저장+복사) | 2-2, 2-3 | FE |
| 2-5 | 디스크립션 추출 버튼 (디자인 모드 내) | 2-2 | FE |
| 2-6 | 버전 히스토리 UI | 2-2, 2-4 | FE |

### Phase 3: 고급 기능

| 순서 | 항목 | 의존성 | 담당 |
|------|------|--------|------|
| 3-1 | 디스크립션 추출 스트리밍 (Broadcast) | 1-4 | BE+FE |
| 3-2 | Side-by-Side 비교 UI | 2-4, 2-6 | FE |

---

## 6. 미결 검토 항목

### Q1. 디스크립션 추출 방식: 동기 vs 비동기(Broadcast)?
- **동기**: 구현 단순, 디스크립션은 코드보다 짧아 수 초 내 완료 가능
- **비동기 Broadcast**: 기존 채팅 패턴과 일관성, 긴 디스크립션 시 타임아웃 방지
- **현재 권장**: Phase 1은 동기, Phase 3에서 스트리밍 전환

### Q2. 디스크립션 편집기: Textarea vs Rich Editor?
- **Textarea + Markdown Preview**: 구현 단순, 기존 패턴 일관
- **Monaco Editor**: Diff 비교 내장, 번들 크기 증가
- **Tiptap / Milkdown**: WYSIWYG Markdown, 의존성 추가
- **현재 권장**: Phase 1은 Textarea, Phase 3에서 확장

### Q3. Description이 AI 채팅 컨텍스트에 자동 포함되어야 하는지?
- 포함 시: AI가 디스크립션과 일관된 코드 생성 가능, 토큰 비용 증가
- 미포함 시: 기존 동작 유지, 디스크립션과 코드 불일치 가능
- **결정 필요**: UI 토글로 선택적 포함? 자동 포함?

### Q4. 낙관적 동시성 제어 수준
- `base_version_id` 전달로 편집 기준 버전 명시 → 중간에 다른 버전 생성 시 409 Conflict?
- 현재 단일 사용자 환경이므로 낮은 우선순위
- **현재 권장**: Phase 1은 단순 append, 충돌 검증 없음

### Q5. 디스크립션 삭제 정책
- 개별 버전 삭제 허용? 전체 히스토리만 삭제?
- **현재 권장**: 개별 버전 삭제 미지원, room 삭제 시 CASCADE만

---

## 7. 테스트 시나리오

### TS-1. 탭 UI 전환

| # | 시나리오 | 사전 조건 | 동작 | 기대 결과 |
|---|---------|----------|------|----------|
| 1-1 | 기본 탭 상태 | room 로드 완료 | 화면 확인 | 디자인 모드 활성 |
| 1-2 | 탭 전환 시 상태 보존 | 디자인 모드에서 입력 중 | 디스크립션 모드 → 디자인 모드 복귀 | 입력 내용 보존 |
| 1-3 | 스트리밍 중 탭 전환 | 스트리밍 진행 중 | 디스크립션 모드 클릭 | 스트리밍 백그라운드 계속, 디스크립션 정상 표시 |
| 1-4 | roomId 없음 | 로딩 중 | 화면 확인 | 탭 UI 미표시 |

### TS-2. 디스크립션 추출

| # | 시나리오 | 사전 조건 | 동작 | 기대 결과 |
|---|---------|----------|------|----------|
| 2-1 | 최초 추출 | 메시지 3건+, 디스크립션 없음 | [추출] 클릭 | 로딩 → v1 생성 → 디스크립션 모드 표시 |
| 2-2 | 재추출 | v1.02 존재 | [추출] 클릭 | 확인 다이얼로그 → v2 생성 |
| 2-3 | 추출 실패 | AI 서버 다운 | [추출] 클릭 | 에러 토스트, 기존 디스크립션 유지 |
| 2-4 | 채팅 없이 추출 | 메시지 0건 | 확인 | 버튼 비활성화 |
| 2-5 | 스트리밍 중 추출 | 코드 생성 중 | 확인 | 버튼 비활성화 |

### TS-3. 편집/저장

| # | 시나리오 | 사전 조건 | 동작 | 기대 결과 |
|---|---------|----------|------|----------|
| 3-1 | 편집 후 저장 | v2 존재 | 텍스트 수정 → [저장] | v2.01 생성, 버전 선택기 갱신 |
| 3-2 | 연속 편집 | v2.01 직후 | 추가 수정 → [저장] | v2.02 생성 |
| 3-3 | 빈 내용 저장 방지 | 텍스트 전체 삭제 | 확인 | [저장] 비활성화 |
| 3-4 | 복사 | 내용 존재 | [복사] 클릭 | 클립보드 복사 + 피드백 2초 |
| 3-5 | 미저장 탭 전환 | 편집 변경 존재 | 디자인 모드 클릭 | 확인 AlertDialog |

### TS-4. 버전 히스토리

| # | 시나리오 | 사전 조건 | 동작 | 기대 결과 |
|---|---------|----------|------|----------|
| 4-1 | 목록 표시 | v1, v1.01, v2 존재 | 히스토리 열기 | 최신순 3개 표시 |
| 4-2 | 과거 버전 조회 | v2가 최신 | v1.01 클릭 | 읽기 전용 표시 |
| 4-3 | 최신 버전 복귀 | 과거 버전 조회 중 | 최신(v2) 클릭 | 편집 모드 활성화 |
| 4-4 | 유형 구분 | 혼합 버전 | 목록 확인 | "AI 추출" / "수동 편집" 배지 |

---

## 8. 개발 Task 체크리스트

### Phase 1: 데이터 기반 (BE)

- [ ] **1-1. `descriptions` 테이블 Supabase Migration 작성**
  - `descriptions` 테이블 CREATE 쿼리
  - 인덱스 생성 (room_id, room_version)
  - `collections.json` SSOT 업데이트

- [ ] **1-2. `packages/shared-types` 타입 정의 추가**
  - `Description`, `DescriptionVersionSummary` 인터페이스
  - `DescriptionSource` 타입
  - `collections.ts`에 `DESCRIPTIONS` 테이블 상수 추가

- [ ] **1-3. FastAPI Description CRUD 서비스 구현**
  - `apps/ai-service/app/services/supabase_db.py` 확장
  - `create_description()`, `get_latest_description()`, `get_description_versions()`, `get_description_by_id()` 함수

- [ ] **1-4. FastAPI Description 추출 API 구현**
  - `apps/ai-service/app/api/description.py` 신규 생성
  - `apps/ai-service/app/schemas/description.py` Pydantic 모델
  - 디스크립션 추출 전용 시스템 프롬프트 작성
  - `POST /description/extract` 엔드포인트
  - 기존 `ai_provider` 재사용하여 LLM 호출

- [ ] **1-5. FastAPI 저장/조회/버전목록 API 구현**
  - `PUT /description/save` (수동 저장, Minor Version 증가)
  - `GET /description/{room_id}` (최신 디스크립션 조회)
  - `GET /description/{room_id}/versions` (버전 목록)
  - `GET /description/{room_id}/versions/{id}` (특정 버전 조회)

- [ ] **1-6. Next.js BFF 라우트 구현**
  - `apps/web/app/api/description/extract/route.ts`
  - `apps/web/app/api/description/save/route.ts`
  - `apps/web/app/api/description/[room_id]/route.ts`
  - `apps/web/app/api/description/[room_id]/versions/route.ts`
  - `apps/web/app/api/description/[room_id]/versions/[id]/route.ts`
  - Supabase JWT 인증 적용 (기존 패턴 참고)

### Phase 2: FE UI 기본

- [ ] **2-1. `useDescriptionStore` Zustand 스토어 생성**
  - `apps/web/stores/useDescriptionStore.ts` 신규
  - 상태: currentDescription, isExtracting, editingContent, isDirty
  - 액션: setDescription, startExtraction, updateEditingContent, resetDirty

- [ ] **2-2. `useDescription` TanStack Query 훅 생성**
  - `apps/web/hooks/api/useDescriptionQuery.ts` 신규
  - `useLatestDescription(roomId)` - 최신 디스크립션 조회
  - `useDescriptionVersions(roomId)` - 버전 목록 조회
  - `useExtractDescription()` - 추출 mutation
  - `useSaveDescription()` - 저장 mutation

- [ ] **2-3. ChatSection 탭 UI 분리**
  - `apps/web/components/features/chat/chat-section.tsx` 수정
  - 기존 헤더 아래에 `Tabs` (variant="line") 추가
  - TabsContent: 디자인 모드 (기존 ChatMessageList + ChatInput) / 디스크립션 모드
  - `data-[state=inactive]:hidden`으로 비활성 탭 DOM 유지

- [ ] **2-4. DescriptionEditor 컴포넌트 구현**
  - `apps/web/components/features/description/description-editor.tsx` 신규
  - 상단 툴바: 버전 선택 드롭다운, [저장] 버튼, [복사] 버튼
  - 편집 영역: Textarea (Markdown 텍스트)
  - 빈 상태: "디스크립션을 먼저 추출해 주세요" + [추출하기] 바로가기
  - 미저장 변경 감지 (isDirty)

- [ ] **2-5. 디스크립션 추출 버튼 구현**
  - 디자인 모드 탭 내 [디스크립션 추출] 버튼 배치
  - 클릭 → 기존 디스크립션 있으면 확인 AlertDialog → API 호출
  - 로딩 스피너, 비활성화 조건 (메시지 0건, 스트리밍 중)
  - 추출 완료 시 디스크립션 모드 탭 데이터 갱신

- [ ] **2-6. 버전 히스토리 UI 구현**
  - `apps/web/components/features/description/version-history.tsx` 신규
  - 접이식 패널 또는 드롭다운 형태
  - 버전 항목: 번호, 시각, 유형 배지, 요약
  - 클릭 시 해당 버전 내용 로드 (과거 버전은 읽기 전용)

### Phase 3: 고급 기능

- [ ] **3-1. 디스크립션 추출 스트리밍 (Broadcast 방식)**
  - FastAPI에서 Broadcast 이벤트로 디스크립션 청크 전송
  - FE에서 Broadcast 구독하여 실시간 텍스트 표시

- [ ] **3-2. Side-by-Side 비교 UI**
  - 재추출 시 이전 편집 버전과 신규 추출 결과 나란히 표시
  - diff-match-patch 또는 유사 라이브러리 활용
