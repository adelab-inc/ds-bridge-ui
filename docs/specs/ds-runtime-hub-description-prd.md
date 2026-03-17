# Runtime Hub Description 기능 PRD

> **UX 기준 문서**: `docs/specs/description-extraction-ux.html`

## 1. 개요

### 1.1 배경

DS-Bridge Runtime Hub는 현재 Storybook 기반 디자인 시스템 컴포넌트를 활용하여 AI가 React UI 코드를 생성하는 플랫폼이다. 채팅 기반 프롬프트 입력 → AI 코드 생성 → Preview 렌더링의 단방향 워크플로우만 존재하며, 생성된 UI에 대한 **구조적 설명(Description)**을 체계적으로 추출 / 편집 / 버전 관리하는 기능이 부재한 상태다.

### 1.2 목적

1. 채팅 영역에 **[디자인 모드] / [디스크립션 모드]** 탭 UI 추가
2. 디자인 모드에서 **[디스크립션 추출]** 버튼 + 액션바로 LLM 기반 설명 자동 생성
3. 디스크립션 모드에서 **읽기 전용 조회 / 직접 편집 / 편집 이력 추적**
4. **재추출 시 편집 이력을 AI 컨텍스트에 자동 포함** (LLM 자동 병합)
5. **생성 이력**(v1, v2, v3...) 버전별 조회 패널 (읽기 전용)
6. Backend: 디스크립션 추출 API, 편집 이력 저장, 버전 관리

### 1.3 용어 정의

| 용어 | 설명 |
|------|------|
| 디자인 모드 | 기존 프롬프트 입력 + AI 코드 생성 탭 (현재 ChatSection 전체 기능) |
| 디스크립션 모드 | 디스크립션 조회/편집 전용 탭 (넓은 전용 뷰) |
| Extraction | LLM이 대화 히스토리 + 화면 정보 기반으로 디스크립션을 자동 생성하는 행위 |
| 버전 | AI Extraction 시 부여되는 정수 버전 (v1, v2, v3...). 수동 편집은 버전을 생성하지 않음 |
| 편집 이력 | AI 원본 대비 사용자가 직접 수정한 내용. 재추출 시 AI 컨텍스트로 자동 전달됨 |
| 자동 병합 | 재추출 시 편집 이력 + 대화 히스토리를 AI에 전달하여 통합된 새 디스크립션을 생성하는 방식 |

### 1.4 핵심 가치

| 문제 | 해결 |
|------|------|
| 재추출 시 사용자가 직접 수정한 내용이 사라짐 | 편집 이력을 AI 컨텍스트에 자동 전달하여 새 디스크립션에 반영 |
| 이전 버전을 확인할 수 없음 | 생성 이력(v1, v2, v3...) 버전별 조회 기능 제공 |

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
- ❌ [디자인 모드] / [디스크립션 모드] 탭 UI
- ❌ 디자인 모드 액션바 (추출 버튼 + 이력 버튼)
- ❌ 디스크립션 모드 읽기/편집/이력 UI
- ❌ 편집 이력 추적 및 LLM 자동 병합 로직
- ❌ 생성 이력 버전 관리 (정수 버전)
- ❌ 디스크립션 추출 API 엔드포인트

---

## 3. 기능 명세

### 3.1 프로세스 흐름

재추출 시 이전 편집 이력을 자동으로 AI 컨텍스트에 포함하여 새 디스크립션을 생성하고, 생성 이력을 버전별로 관리하는 프로세스.

```
[디자인 모드: 프롬프트] ── [디스크립션 추출] 클릭 ──→ [디스크립션 모드: v1 읽기 전용]
                                                              │
                                                         [수정하기] 클릭
                                                              ↓
                                                    [디스크립션 모드: 직접 편집]
                                                              │
                                                       [저장 후 닫기]
                                                              ↓
                                                  [디자인 모드: 추가 요청 대기]
                                                              │
                                                    [디스크립션 추출] 재클릭
                                                              ↓
                                            [디스크립션 모드: v2 읽기 전용]
                                            (대화 + 편집 이력 자동 병합)
                                                              │
                                                   ┌─── 반복 사이클 ───┐
                                                   │ 편집 → 추가요청 → 재추출 │
                                                   │  v3, v4... 누적    │
                                                   └──────────────────┘
```

### 3.2 UI 상태 전이 모델

총 **5개 UI 상태**를 관리하며, 각 상태별 탭 활성화와 UI 요소 동작이 달라진다.

#### 상태 전이표

| 상태 | 활성 탭 | 디자인 모드 | 디스크립션 모드 |
|------|--------|-----------|--------------|
| `idle` | 디자인 | 기본 채팅 | 빈 상태 안내 + [추출하기] 바로가기 |
| `viewing` | 디스크립션 (자동 전환) | 액션바: [추출] + [이력] | 읽기 전용 + 버전 배너 + [수정하기] |
| `editing` | 디스크립션 | 액션바: [편집 중] (주황) + [이력] | 편집 가능 + [저장 후 닫기] / [수정 취소] |
| `waiting` | 디자인 | 액션바: [추출] + [이력] | 최신 버전 읽기 전용 |
| `history` | 디스크립션 | - | 이력 패널 (버전 목록 + 미리보기) |

#### 상태 전이 규칙

```
idle ──[추출 클릭]──→ viewing (v1, 디스크립션 탭 자동 전환)
viewing ──[수정하기]──→ editing
editing ──[저장 후 닫기]──→ waiting (편집 이력 저장, 디자인 탭 전환)
editing ──[수정 취소]──→ viewing (편집 이력 폐기)
waiting ──[추출 클릭]──→ viewing (v2+, 편집 이력 자동 반영)
viewing ──[디자인 모드 탭]──→ waiting
waiting ──[디스크립션 모드 탭]──→ viewing
viewing/waiting ──[이력 클릭]──→ history
history ──[닫기]──→ viewing
```

---

### 3.3 FE 기능

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
|   ChatMessageList                        |
|   DescriptionActionBar (액션바)           |  ← 신규 컴포넌트
|   ChatInput                              |
|                                           |
| (디스크립션 모드 활성 시)                    |
|   DescriptionTab (전용 뷰)                |  ← 신규 컴포넌트
+------------------------------------------+
```

**동작 조건**:
- 기존 `apps/web/components/ui/tabs.tsx`의 Tabs 컴포넌트 재사용 (variant="line")
- 탭 전환 시 각 탭의 상태 독립 유지 (`data-[state=inactive]:hidden` CSS로 DOM 유지)
- 디자인 모드의 스트리밍은 디스크립션 모드에서도 백그라운드 진행
- 기본 활성 탭: 디자인 모드
- 추출 완료 시 디스크립션 모드 탭으로 자동 전환
- 편집 모드(editing)에서 디자인 모드 탭 클릭 → 미저장 확인 AlertDialog

**예외 처리**:
- roomId 없는 상태: 탭 미렌더링 (기존 로딩/에러 처리 유지)
- 디스크립션 미추출 상태에서 디스크립션 모드 진입: 빈 상태 안내 + [추출하기] 바로가기

---

#### FE-2. 디스크립션 추출 + 액션바

**목적**: 현재 대화 내용 + 생성된 코드를 기반으로 AI가 구조적 디스크립션을 자동 생성한다.

**배치 위치**: 디자인 모드 탭 내 ChatInput 바로 위 **액션바** (DescriptionActionBar 컴포넌트)

**액션바 구성**:

| 상태 | 좌측 버튼 | 우측 버튼 | 스타일 |
|------|---------|---------|--------|
| `idle` (추출 전) | `📄 디스크립션 추출` | - | 기본 |
| `viewing` / `waiting` (추출 후) | `📄 디스크립션 추출` | `📋 생성 이력` | 기본 |
| `editing` | `📄 편집 중` (주황 활성) | `📋 생성 이력` | 주황 상단 보더 |

**동작**:
1. [디스크립션 추출] 버튼 클릭
2. 편집 이력 존재 여부 확인 → 있으면 API에 자동 포함 (별도 확인 다이얼로그 불필요)
3. roomId + 최신 generatedCode + 편집 이력을 payload로 BE API 호출
4. 로딩 상태 표시 (버튼 비활성화 + 스피너)
5. 응답 수신 → 새 버전 생성 → 디스크립션 모드 탭으로 자동 전환

**예외 처리**:
- 대화 내역 0건: 버튼 비활성화
- 스트리밍 진행 중 (`isGeneratingCode === true`): 버튼 비활성화
- 추출 실패: 에러 토스트 표시, 기존 디스크립션 유지

---

#### FE-3. 디스크립션 조회/편집

**목적**: 디스크립션 모드에서 AI 생성 디스크립션을 조회하고 직접 수정/보완한다.

**위치**: 디스크립션 모드 탭 내부 (DescriptionTab 컴포넌트)

**UI 구성**:
```
+------------------------------------------+
| [v2] [최신 뱃지]       버전 배너           |  ← DescriptionVersionBanner
+------------------------------------------+
| [수정하기] or [저장 후 닫기][수정 취소]      |
|                              [복사][이력]  |  ← DescriptionToolbar
+------------------------------------------+
|                                           |
| (읽기 전용 or 편집 가능한 텍스트 영역)      |  ← DescriptionViewer / DescriptionEditor
|                                           |
+------------------------------------------+
```

**버전 배너 (DescriptionVersionBanner)**:
- 읽기 전용: 파란/초록 배경, `v{n}` + `최신` 뱃지 + 생성 사유
- 편집 중: 주황 배경, `편집 중` + `v{n} 기반 수정` 텍스트

**읽기 전용 모드 (viewing)**:
- 디스크립션 내용 표시 (Textarea, readOnly)
- 툴바: [수정하기], [복사], [생성 이력]

**편집 모드 (editing)**:
- 디스크립션 내용 편집 가능 (Textarea)
- 편집 전 원본(AI 생성 버전)을 내부적으로 보관
- 툴바: [저장 후 닫기], [수정 취소], [복사], [생성 이력]

**편집 이력 추적 (핵심)**:
- 수동 편집 시 **별도 버전을 생성하지 않음**
- 대신 `{원본 AI 생성본, 사용자 수정본}` 쌍으로 "편집 이력" 추적
- [저장 후 닫기] → 편집 이력 확정 (BE에 저장) → 디자인 모드 탭으로 전환
- [수정 취소] → 편집 이력 폐기 → 읽기 전용 복귀
- 다음 재추출 시 편집 이력을 AI 컨텍스트에 자동 포함

**[복사] 버튼**:
- 전체 텍스트 클립보드 복사
- 기존 PreviewSection의 Copy 패턴 재사용 (아이콘 변경 → 2초 후 복귀)

**빈 상태** (`idle`):
- "디스크립션을 먼저 추출해 주세요" 안내 + [추출하기] 바로가기

**예외 처리**:
- 빈 내용: [저장 후 닫기] 비활성화
- 편집 중 디자인 모드 탭 전환: 미저장 확인 AlertDialog
- 네트워크 에러: 로컬 변경 유지, 재시도 안내

---

#### FE-4. 재추출 자동 병합

**목적**: 재추출 시 사용자의 직접 편집 내용이 유실되지 않도록 AI 컨텍스트에 자동 포함한다.

**핵심 로직**: [디스크립션 추출] 버튼 클릭 시, 편집 이력이 존재하면 AI 컨텍스트에 함께 전달

**AI 컨텍스트 전달 구조**:

| 컨텍스트 | 내용 | 전달 조건 |
|----------|------|---------|
| ① 대화 히스토리 | 최초 요청 ~ 최신 추가 요청까지 전체 프롬프트 + 결과 | 항상 |
| ② 편집 이력 | AI 원본 대비 사용자가 직접 수정/추가/삭제한 변경 사항 | 편집 이력 있을 때만 |
| ③ 생성 지시 | ①+②를 종합하여 하나의 통합된 디스크립션을 생성하라는 프롬프트 | 항상 |

**분기 처리**:
- **최초 추출** (편집 이력 없음): 대화 히스토리만 전달 → v1 생성
- **재추출** (편집 이력 있음): 대화 히스토리 + 편집 이력 전달 → v{n} 생성

**결과**: 편집 내용이 자연스럽게 통합된 새 디스크립션 (별도 하이라이트 없이 통합 문서)

**AI 프롬프트 구성**:

최초 추출:
```
[시스템] 아래 대화 히스토리를 분석하여 화면 디스크립션을 생성하세요.
[대화 히스토리] ...
```

재추출 (편집 이력 있음):
```
[시스템] 아래 대화 히스토리와 사용자의 이전 편집 이력을 종합하여
        하나의 통합된 화면 디스크립션을 생성하세요.
        편집 이력의 내용을 자연스럽게 반영하되, 별도 표시 없이 통합된 문서로 작성하세요.
[대화 히스토리] ...
[이전 편집 이력]
  - 원본: ...
  - 사용자 수정본: ...
```

---

#### FE-5. 생성 이력 UI

**목적**: 모든 AI 생성 디스크립션 버전을 시간순으로 조회한다.

**진입점**: 디자인 모드 액션바 및 디스크립션 모드 툴바의 `[생성 이력]` 버튼 (디스크립션 1회 이상 생성 후부터 노출)

**위치**: 디스크립션 모드 탭 내 패널 (기존 내용 영역을 대체하는 슬라이드 전환)

**패널 구성**:

| 영역 | 내용 |
|------|------|
| 헤더 | "생성 이력" 제목 + 닫기(✕) |
| 이력 목록 | 버전별 항목 리스트 (최신 순 정렬), 클릭 시 하이라이트 |
| 미리보기 | 선택한 버전의 디스크립션 미리보기 (하단) |

**이력 항목 표시 정보**:
- 버전 번호 (v1, v2, v3...) + 최신/이전 뱃지
- 생성 시각 (상대 시간: "방금 전", "10분 전")
- 생성 사유 (최초 생성 / 편집 이력 반영 재생성 등)


**기능 범위**: **조회(읽기 전용)만** 가능. 이전 버전으로 되돌리기는 제공하지 않음.

**예외 처리**:
- 버전 0개: 빈 상태 메시지

---

### 3.4 BE 기능

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
3. **편집 이력 존재 시** → 시스템 프롬프트에 편집 이력(원본+수정본) 포함
4. 디스크립션 추출 전용 시스템 프롬프트 구성 (최초/재추출 분기)
5. LLM 호출 (기존 `ai_provider` 추상화 재사용)
6. `descriptions` 테이블에 새 버전으로 저장 (version +1)
7. 결과 반환

**예외 처리**:
- room 미존재: 404
- 대화 히스토리 0건: 422
- LLM 호출 실패: 500

---

#### BE-2. 버전 관리 및 편집 이력 API

**버전 번호 체계**:
- 정수만 사용 (v1, v2, v3...) — AI Extraction 시에만 +1
- 수동 편집은 버전을 생성하지 않고, 현재 버전의 `edited_content` 필드 업데이트

**API 엔드포인트**:

| Method | BFF Path | FastAPI Path | 설명 |
|--------|----------|-------------|------|
| POST | `/api/description/extract` | `/description/extract` | AI 추출 (편집 이력 자동 포함) |
| PUT | `/api/description/[room_id]/edit` | `/description/{room_id}/edit` | 편집 이력 저장 |
| GET | `/api/description/[room_id]` | `/description/{room_id}` | 최신 디스크립션 조회 |
| GET | `/api/description/[room_id]/versions` | `/description/{room_id}/versions` | 버전 목록 |
| GET | `/api/description/[room_id]/versions/[id]` | `/description/{room_id}/versions/{id}` | 특정 버전 조회 |

---

#### BE-3. Diff 처리 — LLM 자동 병합 (확정)

**방식**: 편집 이력(원본+수정본)을 AI 컨텍스트로 전달하여 자연어 수준에서 통합

편집 이력이 있는 상태에서 [디스크립션 추출] 시:
1. 현재 버전의 `edited_content`와 `content`(원본)를 읽음
2. 대화 히스토리 + 편집 이력(원본/수정본)을 AI에 전달
3. AI가 편집 내용을 자연스럽게 반영한 새 디스크립션 생성
4. 새 버전(version +1)으로 저장, 이전 편집 이력은 리셋

---

## 4. 데이터 구조

### 4.1 신규 Supabase 테이블: `descriptions`

```sql
CREATE TABLE descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('initial', 'regenerated_with_edits', 'regenerated')),
  edited_content TEXT,
  base_message_id UUID REFERENCES chat_messages(id),
  created_by TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,

  UNIQUE (room_id, version)
);

CREATE INDEX idx_descriptions_room_version ON descriptions(room_id, version DESC);
```

**컬럼 설명**:

| 컬럼 | 설명 |
|------|------|
| `content` | AI가 생성한 원본 디스크립션 텍스트 |
| `version` | 정수 버전 (1, 2, 3...). AI 추출 시에만 증가 |
| `reason` | 생성 사유: `initial`(최초), `regenerated_with_edits`(편집 이력 반영 재생성), `regenerated`(대화 추가만) |
| `edited_content` | 사용자 편집본 (null이면 편집 없음). 재추출 시 AI 컨텍스트로 사용 |
| `base_message_id` | 추출 시점의 최신 메시지 ID (컨텍스트 범위 추적) |

### 4.2 TypeScript 타입 (`packages/shared-types`)

```typescript
export interface Description {
  id: string;
  room_id: string;
  content: string;
  version: number;
  reason: DescriptionReason;
  edited_content: string | null;
  base_message_id: string | null;
  created_by: string | null;
  created_at: number;
}

export type DescriptionReason = 'initial' | 'regenerated_with_edits' | 'regenerated';

export interface DescriptionVersionSummary {
  id: string;
  version: number;
  reason: DescriptionReason;
  created_at: number;
}

export interface EditHistory {
  original_content: string;
  edited_content: string;
  base_version: number;
}
```

### 4.3 Zustand Store

```typescript
interface DescriptionState {
  // UI 상태
  uiState: 'idle' | 'viewing' | 'editing' | 'waiting' | 'history';

  // 버전 관리
  versions: DescriptionVersionSummary[];
  currentVersion: number | null;
  currentContent: string | null;

  // 편집
  editDraft: string | null;
  editHistory: EditHistory | null;

  // 로딩
  isExtracting: boolean;

  // Actions
  extractDescription: () => Promise<void>;
  startEditing: () => void;
  saveEdit: (editedContent: string) => void;
  cancelEdit: () => void;
  openHistory: () => void;
  closeHistory: () => void;
}
```

### 4.4 API Request/Response

#### 디스크립션 추출 (POST `/api/description/extract`)

**Request**:
```json
{
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "current_code": "const App = () => (<div className='grid grid-cols-12'>...</div>)",
  "current_code_path": "src/pages/Dashboard.tsx",
  "edit_history": {
    "original": "원본 AI 생성 디스크립션",
    "edited": "사용자가 수정한 디스크립션"
  }
}
```

**Response** (200):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "version": 2,
  "content": "## Dashboard 페이지 구조\n\n...",
  "reason": "regenerated_with_edits"
}
```

#### 편집 이력 저장 (PUT `/api/description/{room_id}/edit`)

**Request**:
```json
{
  "edited_content": "사용자가 수정한 디스크립션 텍스트"
}
```

**Response** (200):
```json
{
  "id": "a1b2c3d4-...",
  "version": 1,
  "edited_content": "사용자가 수정한 디스크립션 텍스트"
}
```

#### 버전 목록 (GET `/api/description/{room_id}/versions`)

**Response** (200):
```json
{
  "versions": [
    {
      "id": "a1b2...",
      "version": 2,
      "reason": "regenerated_with_edits",
      "created_at": 1709568000000
    },
    {
      "id": "1122...",
      "version": 1,
      "reason": "initial",
      "created_at": 1709500000000
    }
  ]
}
```

---

## 5. FE 컴포넌트 구조

### 5.1 신규 컴포넌트

```
apps/web/components/features/
├── chat/
│   ├── chat-section.tsx                    (수정: 탭 UI + 액션바 삽입)
│   ├── chat-input.tsx                      (수정: disabled 연동)
│   └── ... (기존 유지)
├── description/                             (신규 디렉토리)
│   ├── description-tab.tsx                 ★ 디스크립션 모드 탭 루트 (상태 분기)
│   ├── description-viewer.tsx              ★ 읽기 전용 뷰
│   ├── description-editor.tsx              ★ 편집 모드 뷰
│   ├── description-toolbar.tsx             ★ 상단 툴바 (수정하기/저장/복사/이력)
│   ├── description-version-banner.tsx      ★ 버전 배너
│   ├── description-action-bar.tsx          ★ 디자인 모드 액션바 ([추출] + [이력])
│   ├── description-history-panel.tsx       ★ 생성 이력 패널
│   └── description-history-item.tsx        ★ 이력 항목
```

### 5.2 컴포넌트 트리

```
ChatSection
├── Header (기존)
├── TabsList [디자인 모드] [디스크립션 모드]
├── TabsContent: 디자인 모드
│   ├── ChatMessageList (기존)
│   ├── DescriptionActionBar              ★ 신규
│   └── ChatInput (기존)
└── TabsContent: 디스크립션 모드
    └── DescriptionTab                    ★ 신규
        ├── (idle) Empty State
        ├── (viewing) DescriptionVersionBanner + DescriptionToolbar + DescriptionViewer
        ├── (editing) DescriptionVersionBanner + DescriptionToolbar + DescriptionEditor
        └── (history) DescriptionHistoryPanel
                      ├── HistoryItem[]
                      └── Preview Area
```

### 5.3 신규 Store/Hook

```
apps/web/
├── stores/
│   └── useDescriptionStore.ts              ★ Zustand: 5개 상태, 편집 이력
└── hooks/
    └── api/
        └── useDescriptionQuery.ts          ★ TanStack Query 훅
            ├── useLatestDescription(roomId)
            ├── useDescriptionVersions(roomId)
            ├── useExtractDescription()         mutation
            └── useSaveEditHistory()            mutation
```

---

## 6. 구현 우선순위

### Phase 1: 데이터 기반 (BE)

| 순서 | 항목 | 의존성 | 담당 |
|------|------|--------|------|
| 1-1 | `descriptions` 테이블 Migration | 없음 | BE |
| 1-2 | `packages/shared-types` 타입 추가 | 1-1 | 공통 |
| 1-3 | FastAPI Description CRUD 서비스 | 1-1 | BE |
| 1-4 | FastAPI Description 추출 API (편집 이력 포함) | 1-3 | BE |
| 1-5 | FastAPI 편집 이력 저장/조회/버전 목록 API | 1-3 | BE |
| 1-6 | Next.js BFF 라우트 (`/api/description/*`) | 1-4, 1-5 | FE |

### Phase 2: 핵심 FE

| 순서 | 항목 | 의존성 | 담당 |
|------|------|--------|------|
| 2-1 | `useDescriptionStore` Zustand 스토어 (5개 상태 모델) | 1-2 | FE |
| 2-2 | `useDescriptionQuery` TanStack Query 훅 | 1-6, 2-1 | FE |
| 2-3 | ChatSection 탭 UI 분리 (디자인/디스크립션 모드) | 없음 | FE |
| 2-4 | DescriptionActionBar (디자인 모드 내 액션바) | 2-1, 2-2 | FE |
| 2-5 | DescriptionTab + DescriptionViewer (읽기 전용) | 2-2, 2-3 | FE |
| 2-6 | DescriptionVersionBanner | 2-5 | FE |

### Phase 3: 편집 + 재추출

| 순서 | 항목 | 의존성 | 담당 |
|------|------|--------|------|
| 3-1 | DescriptionEditor (편집 모드) | 2-5 | FE |
| 3-2 | DescriptionToolbar (수정하기/저장 후 닫기/복사) | 3-1 | FE |
| 3-3 | 편집 이력 추적 + 재추출 자동 병합 로직 | 3-1, 2-4 | FE |

### Phase 4: 생성 이력

| 순서 | 항목 | 의존성 | 담당 |
|------|------|--------|------|
| 4-1 | DescriptionHistoryPanel | 2-2 | FE |
| 4-2 | DescriptionHistoryItem | 4-1 | FE |
| 4-3 | [생성 이력] 버튼 연동 (액션바 + 툴바) | 4-1, 2-4 | FE |

### Phase 5: 고급 기능 (후순위)

| 순서 | 항목 | 의존성 | 담당 |
|------|------|--------|------|
| 5-1 | 디스크립션 추출 스트리밍 (Broadcast 방식) | 1-4 | BE+FE |

---

## 7. 미결 검토 항목

### Q1. 디스크립션 추출 방식: 동기 vs 비동기(Broadcast)?
- **동기**: 구현 단순, 디스크립션은 코드보다 짧아 수 초 내 완료 가능
- **비동기 Broadcast**: 기존 채팅 패턴과 일관성, 긴 디스크립션 시 타임아웃 방지
- **현재 권장**: Phase 1~4는 동기, Phase 5에서 스트리밍 전환

### Q2. 디스크립션 편집기: Textarea vs Rich Editor?
- **Textarea**: 구현 단순, 기존 패턴 일관
- **Tiptap / Milkdown**: WYSIWYG Markdown, 의존성 추가
- **현재 권장**: Phase 1~4는 Textarea, 이후 확장 검토

### ~~Q3. Diff 전략~~ → **확정: LLM 자동 병합**
- ~~A. 단순 덮어쓰기 / B. Three-Way Merge / C. LLM 기반 병합 / D. Side-by-Side~~
- **확정**: C. LLM 기반 병합 — 편집 이력(원본+수정본)을 AI 컨텍스트로 전달

### Q3. 낙관적 동시성 제어 수준
- 현재 단일 사용자 환경이므로 낮은 우선순위
- **현재 권장**: Phase 1은 단순 append, 충돌 검증 없음

### Q4. 디스크립션 삭제 정책
- 개별 버전 삭제 허용? 전체 히스토리만 삭제?
- **현재 권장**: 개별 버전 삭제 미지원, room 삭제 시 CASCADE만

---

## 8. 테스트 시나리오

### TS-1. 탭 UI 전환

| # | 시나리오 | 사전 조건 | 동작 | 기대 결과 |
|---|---------|----------|------|----------|
| 1-1 | 기본 탭 상태 | room 로드 완료 | 화면 확인 | 디자인 모드 활성, 상태 `idle` |
| 1-2 | 탭 전환 시 상태 보존 | 디자인 모드에서 입력 중 | 디스크립션 모드 → 디자인 모드 복귀 | 입력 내용 보존 |
| 1-3 | 스트리밍 중 탭 전환 | 스트리밍 진행 중 | 디스크립션 모드 클릭 | 스트리밍 백그라운드 계속, 디스크립션 정상 표시 |
| 1-4 | roomId 없음 | 로딩 중 | 화면 확인 | 탭 UI 미표시 |
| 1-5 | 편집 중 탭 전환 | 상태 `editing`, 변경 있음 | 디자인 모드 탭 클릭 | 미저장 확인 AlertDialog |

### TS-2. 디스크립션 추출

| # | 시나리오 | 사전 조건 | 동작 | 기대 결과 |
|---|---------|----------|------|----------|
| 2-1 | 최초 추출 | 메시지 3건+, 디스크립션 없음 | [추출] 클릭 | 로딩 → v1 생성 → 디스크립션 모드 자동 전환 |
| 2-2 | 재추출 (편집 이력 없음) | v1 존재, 편집 없음 | [추출] 클릭 | v2 생성 (reason: `regenerated`) |
| 2-3 | 재추출 (편집 이력 있음) | v1 존재 + 편집 이력 확정 | [추출] 클릭 | v2 생성 (reason: `regenerated_with_edits`), 편집 내용 반영 |
| 2-4 | 추출 실패 | AI 서버 다운 | [추출] 클릭 | 에러 토스트, 기존 디스크립션 유지 |
| 2-5 | 채팅 없이 추출 | 메시지 0건 | 확인 | 버튼 비활성화 |
| 2-6 | 스트리밍 중 추출 | 코드 생성 중 | 확인 | 버튼 비활성화 |

### TS-3. 편집/저장

| # | 시나리오 | 사전 조건 | 동작 | 기대 결과 |
|---|---------|----------|------|----------|
| 3-1 | 편집 후 저장 | v1 읽기 전용 | [수정하기] → 텍스트 수정 → [저장 후 닫기] | 편집 이력 저장, 상태 `waiting`, 디자인 탭 전환 |
| 3-2 | 편집 취소 | 편집 모드 | [수정 취소] | 편집 이력 폐기, 원본 복원, 상태 `viewing` |
| 3-3 | 빈 내용 저장 방지 | 텍스트 전체 삭제 | 확인 | [저장 후 닫기] 비활성화 |
| 3-4 | 복사 | 내용 존재 | [복사] 클릭 | 클립보드 복사 + "복사됨" 피드백 2초 |
| 3-5 | 재추출로 편집 반영 확인 | v1 편집 후 저장 → 추가 요청 | [추출] 재클릭 | v2에 편집 내용 유지 + 새 요청 통합 |

### TS-4. 생성 이력

| # | 시나리오 | 사전 조건 | 동작 | 기대 결과 |
|---|---------|----------|------|----------|
| 4-1 | 이력 버튼 노출 | 디스크립션 미생성 | 확인 | [생성 이력] 버튼 숨김 |
| 4-2 | 이력 목록 표시 | v1, v2 존재 | [생성 이력] 클릭 | 최신순 2개 표시, v2에 '최신' 뱃지 |
| 4-3 | 이전 버전 미리보기 | 이력 패널 열림 | v1 항목 클릭 | 하단에 v1 디스크립션 미리보기 |
| 4-4 | 이력 패널 닫기 | 이력 패널 열림 | ✕ 클릭 | 상태 `viewing` 복귀, 최신 버전 표시 |
| 4-5 | 변경 태그 표시 | v2 = 편집 이력 반영 | 목록 확인 | `편집 이력 반영` 태그 표시 |

### TS-5. 시나리오 통합 검증

**시나리오: 직접 편집 후 기능 추가 요청 → 재추출**

| 단계 | 사용자 행동 | 시스템 동작 | 결과 |
|------|-----------|-----------|------|
| 1 | 대화 후 [디스크립션 추출] 클릭 | 대화 히스토리 기반 생성 | v1 생성: 기능 1~4 |
| 2 | [수정하기] → 2번 보충, 5번 추가 → [저장 후 닫기] | 편집 이력 저장, 디자인 탭 전환 | 편집 이력 확정 |
| 3 | "엑셀 업로드 기능 추가해줘" 추가 요청 | 새 대화 결과 생성 | 대화 히스토리 갱신 |
| 4 | [디스크립션 추출] 재클릭 | 대화 + 편집 이력 AI 전달 | v2 생성: 기능 1~6 (편집 내용 유지 + 신규 통합) |
| 5 | [생성 이력] 클릭 | 이력 패널 표시 | v1, v2 조회 가능 |

---

## 9. 개발 Task 체크리스트

### Phase 1: 데이터 기반 (BE)

- [ ] **1-1. `descriptions` 테이블 Supabase Migration 작성**
  - `descriptions` 테이블 CREATE 쿼리 (정수 version, reason, edited_content)
  - 인덱스 생성 (room_id + version DESC)
  - `collections.json` SSOT 업데이트

- [x] **1-2. `packages/shared-types` 타입 정의 추가**
  - `Description`, `DescriptionVersionSummary`, `EditHistory` 인터페이스
  - `DescriptionReason` 타입

- [ ] **1-3. FastAPI Description CRUD 서비스 구현**
  - `apps/ai-service/app/services/supabase_db.py` 확장
  - `create_description()`, `get_latest_description()`, `get_description_versions()`, `update_edited_content()` 함수

- [ ] **1-4. FastAPI Description 추출 API 구현**
  - `apps/ai-service/app/api/description.py` 신규 생성
  - `apps/ai-service/app/schemas/description.py` Pydantic 모델
  - 디스크립션 추출 전용 시스템 프롬프트 작성 (최초/재추출 분기)
  - `POST /description/extract` 엔드포인트 (edit_history 파라미터 포함)
  - 기존 `ai_provider` 재사용하여 LLM 호출

- [ ] **1-5. FastAPI 편집 이력/조회/버전 목록 API 구현**
  - `PUT /description/{room_id}/edit` (편집 이력 저장 → edited_content 업데이트)
  - `GET /description/{room_id}` (최신 디스크립션 조회)
  - `GET /description/{room_id}/versions` (버전 목록)
  - `GET /description/{room_id}/versions/{id}` (특정 버전 조회)

- [x] **1-6. Next.js BFF 라우트 구현**
  - [x] `apps/web/app/api/description/extract/route.ts`
  - [x] `apps/web/app/api/description/[room_id]/route.ts`
  - [x] `apps/web/app/api/description/[room_id]/edit/route.ts`
  - [x] `apps/web/app/api/description/[room_id]/versions/route.ts`
  - [x] `apps/web/app/api/description/[room_id]/versions/[id]/route.ts`
  - Supabase JWT 인증 적용 (기존 패턴 참고)

### Phase 2: 핵심 FE

- [x] **2-1. `useDescriptionStore` Zustand 스토어 생성**
  - `apps/web/stores/useDescriptionStore.ts` 신규
  - 5개 UI 상태: idle, viewing, editing, waiting, history
  - 상태 전이 액션: extractDescription, startEditing, saveEdit, cancelEdit, openHistory, closeHistory
  - 편집 이력 추적: editDraft, editHistory

- [x] **2-2. `useDescriptionQuery` TanStack Query 훅 생성**
  - `apps/web/hooks/api/useDescriptionQuery.ts` 신규
  - `useLatestDescription(roomId)` — 최신 디스크립션 조회
  - `useDescriptionVersions(roomId)` — 버전 목록 조회
  - `useExtractDescription()` — 추출 mutation
  - `useSaveEditHistory()` — 편집 이력 저장 mutation

- [x] **2-3. ChatSection 탭 UI 분리**
  - `apps/web/components/features/chat/chat-section.tsx` 수정
  - 기존 헤더 아래에 `Tabs` (variant="line") 추가
  - TabsContent: 디자인 모드 (기존 ChatMessageList + 액션바 + ChatInput) / 디스크립션 모드
  - `data-[state=inactive]:hidden`으로 비활성 탭 DOM 유지
  - 편집 중 탭 전환 시 미저장 확인 AlertDialog

- [x] **2-4. DescriptionActionBar 구현**
  - `apps/web/components/features/description/description-action-bar.tsx` 신규
  - 디자인 모드 탭 내 ChatInput 위 배치
  - 상태별 버튼 변경 (idle/viewing-waiting/editing)
  - [디스크립션 추출] 클릭 → 편집 이력 자동 포함 → API 호출
  - [생성 이력] 클릭 → 디스크립션 모드 이력 패널

- [x] **2-5. DescriptionTab + DescriptionViewer 구현**
  - `apps/web/components/features/description/description-tab.tsx` — 상태 분기 루트
  - `apps/web/components/features/description/description-viewer.tsx` — 읽기 전용 뷰
  - 빈 상태: "디스크립션을 먼저 추출해 주세요" + [추출하기] 바로가기
  - 추출 완료 시 자동 전환

- [x] **2-6. DescriptionVersionBanner 구현**
  - `apps/web/components/features/description/description-version-banner.tsx` 신규
  - 읽기 전용: `v{n}` + 최신 뱃지 + 생성 사유
  - 편집 중: 주황 스타일 + `편집 중` + `v{n} 기반 수정`

### Phase 3: 편집 + 재추출

- [x] **3-1. DescriptionEditor 구현**
  - `apps/web/components/features/description/description-editor.tsx` 신규
  - Textarea 편집 영역 (최소 높이 180px, line-height 2)
  - 편집 전 원본 보관, 변경 사항 감지

- [x] **3-2. DescriptionToolbar 구현**
  - `apps/web/components/features/description/description-toolbar.tsx` 신규
  - 읽기 전용: [수정하기], [복사], [생성 이력]
  - 편집 모드: [저장 후 닫기], [수정 취소], [복사], [생성 이력]

- [x] **3-3. 편집 이력 추적 + 재추출 자동 병합 로직**
  - [저장 후 닫기] → editHistory 확정 → BE 저장 → 디자인 탭 전환
  - [수정 취소] → editHistory 폐기 → 읽기 전용 복귀
  - [디스크립션 추출] 클릭 시 editHistory 존재하면 자동 포함

### Phase 4: 생성 이력

- [x] **4-1. DescriptionHistoryPanel 구현**
  - `apps/web/components/features/description/description-history-panel.tsx` 신규
  - 이력 목록 (최신 순) + 하단 미리보기
  - 슬라이드 애니메이션 (0.3s ease)

- [x] **4-2. DescriptionHistoryItem 구현**
  - `apps/web/components/features/description/description-history-item.tsx` 신규
  - 버전 번호, 최신/이전 뱃지, 상대 시각, 생성 사유
  - 클릭 시 하이라이트 + 미리보기 표시

- [x] **4-3. [생성 이력] 버튼 연동**
  - 액션바(디자인 모드) + 툴바(디스크립션 모드) 양쪽에서 접근 가능
  - 이력 패널 닫기 → 최신 버전 읽기 전용 복귀

### Phase 5: 고급 기능 (후순위)

- [ ] **5-1. 디스크립션 추출 스트리밍 (Broadcast 방식)**
  - FastAPI에서 Broadcast 이벤트로 디스크립션 청크 전송
  - FE에서 Broadcast 구독하여 실시간 텍스트 표시
