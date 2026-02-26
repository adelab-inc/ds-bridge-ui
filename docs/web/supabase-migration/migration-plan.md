# Firebase → Supabase 전체 마이그레이션 플랜

## Context

현재 프로젝트는 Firebase Auth(Email Link) + Firestore(실시간 구독) + SSE 스트리밍을 사용 중.
Firebase 문서 쓰기/읽기 과금 문제와 실시간 스트리밍 동기화 한계로 Supabase로 전면 전환.

**핵심 결정사항:**
- AI 서버(Python FastAPI)는 별도 진행 → **BFF(API Route)가 Supabase 쓰기 전담**
- 스트리밍: SSE → **Supabase Broadcast** 전환
- 기존 데이터: **새로 시작** (마이그레이션 없음)

**아키텍처 변경 핵심:**
```
현재: Client ←SSE→ BFF ←SSE→ AI Server
      Client ←onSnapshot→ Firestore ←write← AI Server

변경: Client ←Broadcast→ Supabase ←Broadcast← BFF ←SSE→ AI Server
      Client ←DB fetch→ Supabase DB ←write← BFF
```
BFF가 AI 서버의 SSE를 읽고, Supabase Broadcast로 중계 + DB에 최종 저장.

---

## Phase 0: Supabase 프로젝트 세팅 (코드 변경 없음)

1. Supabase 프로젝트 생성
2. Auth 설정: Magic Link 활성화, Redirect URL 등록 (`localhost:5555/auth/callback`), PKCE용 이메일 템플릿 설정
3. DB 테이블 생성:

```sql
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storybook_url TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  question TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  question_created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  answer_created_at BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'GENERATING' CHECK (status IN ('GENERATING', 'DONE', 'ERROR')),
  is_bookmarked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_messages_room_created ON chat_messages(room_id, question_created_at DESC);
CREATE INDEX idx_rooms_user_created ON chat_rooms(user_id, created_at DESC);
```

4. RLS 정책 설정:

```sql
-- chat_rooms: 본인 데이터만 접근
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rooms"
  ON chat_rooms FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own rooms"
  ON chat_rooms FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own rooms"
  ON chat_rooms FOR DELETE
  USING (user_id = auth.uid());

-- chat_messages: room 소유자만 접근
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own rooms"
  ON chat_messages FOR SELECT
  USING (room_id IN (SELECT id FROM chat_rooms WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert messages in own rooms"
  ON chat_messages FOR INSERT
  WITH CHECK (room_id IN (SELECT id FROM chat_rooms WHERE user_id = auth.uid()));

CREATE POLICY "Users can update messages in own rooms"
  ON chat_messages FOR UPDATE
  USING (room_id IN (SELECT id FROM chat_rooms WHERE user_id = auth.uid()));
```

> **참고**: BFF의 `service_role` key는 RLS를 bypass하므로, 서버 측 DB 쓰기(Broadcast 후 INSERT)는 RLS 영향 없음.

5. Realtime 활성화 (Database > Replication)

---

## Phase 1: 인증 마이그레이션

### 1.1 패키지 설치
```bash
pnpm add @supabase/supabase-js @supabase/ssr --filter web
```

### 1.2 Supabase 클라이언트 생성 (3개 파일 신규)

| 파일 | 용도 |
|------|------|
| `apps/web/lib/supabase/client.ts` | 브라우저용 `createBrowserClient` |
| `apps/web/lib/supabase/server.ts` | API Route용 `createServerClient` (cookie 기반) |
| `apps/web/lib/supabase/middleware.ts` | Middleware 토큰 갱신 helper |

### 1.3 인증 액션 재작성

**수정**: `apps/web/lib/auth/actions.ts`
- `sendSignInLink()` → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`
- `completeSignInWithEmailLink()` → 삭제 (Supabase PKCE 자동 처리)
- `signOut()` → `supabase.auth.signOut()`
- `getIdToken()` → `supabase.auth.getSession()` → `session.access_token`

### 1.4 인증 설정 수정

**수정**: `apps/web/lib/auth/config.ts`
- `getActionCodeSettings()` 삭제 (Firebase 전용)
- `AUTH_SESSION_COOKIE` 삭제 (Supabase가 자체 cookie 관리)
- `PUBLIC_ROUTES`, `EMAIL_STORAGE_KEY` 유지

### 1.5 Auth 타입 수정

**수정**: `apps/web/types/auth.ts`
- `import { User } from 'firebase/auth'` → `import { User } from '@supabase/supabase-js'`
- `toAuthUser()`: `user.uid` → `user.id`, `user.emailVerified` → `!!user.email_confirmed_at`

### 1.6 Auth Store 수정

**수정**: `apps/web/stores/useAuthStore.ts`
- `setUser()`: 수동 `__session` cookie 설정/삭제 로직 제거 (Supabase SSR이 자동 관리)
- `getIdToken()`: `supabase.auth.getSession()` → `access_token` 반환

### 1.7 AuthInitializer 수정

**수정**: `apps/web/components/providers/auth-initializer.tsx`
- `onAuthStateChanged(firebaseAuth, ...)` → `supabase.auth.onAuthStateChange(callback)`
- 초기 세션: `supabase.auth.getSession()` 호출

### 1.8 Auth Callback 재작성

**수정**: `apps/web/components/features/auth/auth-callback-handler.tsx`
- Firebase Email Link 검증 로직 → Supabase PKCE 코드 교환
- `searchParams.get('code')` → `supabase.auth.exchangeCodeForSession(code)`
- 나머지는 `onAuthStateChange`가 자동 처리

### 1.9 서버 토큰 검증 재작성

**수정**: `apps/web/lib/auth/verify-token.ts`
- `firebase-admin` → `@supabase/ssr` `createServerClient`
- `verifyFirebaseToken()` → `verifySupabaseToken()`
- `admin.auth().verifyIdToken()` → `supabase.auth.getUser(token)`
- 함수 시그니처 동일 유지: `(authHeader) => Promise<{uid, email} | null>`
- **참고 (성능 대안)**: API Route가 6개이므로, 매 요청마다 Auth 서버에 네트워크 호출하는 `getUser(token)` 대신 `jose` 라이브러리의 JWKS 기반 로컬 검증도 고려 가능:
  ```typescript
  import { createRemoteJWKSet, jwtVerify } from 'jose'
  const JWKS = createRemoteJWKSet(
    new URL('https://<project>.supabase.co/auth/v1/.well-known/jwks.json')
  )
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'https://<project>.supabase.co/auth/v1',
    audience: 'authenticated',
  })
  ```

### 1.10 API Route 일괄 수정 (6개 파일)

모든 보호된 API Route에서 import + 함수명만 변경:

| 파일 | 변경 |
|------|------|
| `apps/web/app/api/chat/route.ts` | `verifyFirebaseToken` → `verifySupabaseToken` |
| `apps/web/app/api/chat/stream/route.ts` | 동일 |
| `apps/web/app/api/rooms/route.ts` | 동일 |
| `apps/web/app/api/rooms/[room_id]/route.ts` | 동일 |
| `apps/web/app/api/rooms/[room_id]/images/route.ts` | 동일 |
| `apps/web/app/api/rooms/[room_id]/schemas/route.ts` | 동일 |

### 1.11 Middleware 재작성

**수정**: `apps/web/middleware.ts`
- `__session` cookie 체크 → `updateSession(request)` + `supabase.auth.getClaims()`
- Supabase SSR cookie 자동 갱신 처리
- **주의**: 최신 공식 문서에서 Middleware에는 `getUser()` 대신 `getClaims()` 사용 권장. `getClaims()`는 로컬 JWT 파싱으로 네트워크 왕복 없이 빠르게 처리되며, `getUser()`를 사용하면 유저가 랜덤하게 로그아웃될 수 있음

### 1.12 환경변수

**제거** (10개):
```
NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET,
MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID
FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_SERVICE_ACCOUNT_KEY
```

**추가** (3개):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Phase 2: 스트리밍 + 실시간 데이터 마이그레이션

> 채팅 데이터 흐름, State 관리, Broadcast 이벤트 스펙, 다중 유저 시나리오,
> 페이지네이션, 검색/북마크, 에러 처리 등 상세 구현 로직은 **[chat-logic.md](chat-logic.md)** 참조.

### 2.1 Supabase Broadcast 스트리밍 (핵심 변경)

**수정 파일:**

| 파일 | 현재 | 변경 |
|------|------|------|
| `app/api/chat/stream/route.ts` | SSE 패스스루 | SSE 수신 → Broadcast 중계 + DB INSERT + 채널 닫기 |
| `hooks/useChatStream.ts` | fetch + ReadableStream + SSE 파싱 | POST 트리거만 + Broadcast 구독으로 chunk 수신 |

- 서버: `service_role` key로 Supabase 클라이언트 생성, 채널은 **질문-답변 단위**로 열고 닫음 (정리 시 `supabase.removeChannel(channel)` 사용)
- 클라이언트: **room 단위**로 채널 구독 유지
- ai-done 수신 시 DB fetch로 최신 메시지 동기화 (로컬 변환 없음)

### 2.2 Room 생성 시 Supabase DB 쓰기

**수정**: `app/api/rooms/route.ts`

현재: AI 서버에만 프록시 → 변경: AI 서버 프록시 + **Supabase chat_rooms INSERT**

### 2.3 실시간 Hooks 교체

| 신규 파일 | 대체 대상 | 역할 |
|-----------|-----------|------|
| `hooks/supabase/useGetPaginatedMessages.ts` | `hooks/firebase/useGetPaginatedFbMessages.ts` | cursor 기반 페이지네이션 (20개/페이지) + useInfiniteQuery |
| `hooks/supabase/useRoomsList.ts` | `hooks/firebase/useRoomsList.ts` | DB fetch 기반 방 목록 |
| `hooks/supabase/useRoomChannel.ts` | (신규) | Room 단위 Broadcast 채널 관리 (subscribe/unsubscribe) |

> **참고 (pageSize 변경)**: 현재 `chat-section.tsx`에서 `pageSize: 10`을 사용 중이나, Supabase 전환 시 **20개/페이지**로 변경. Firestore 문서 읽기 과금이 없어지므로 한 번에 더 많이 가져오는 것이 UX에 유리.

### 2.4 Consumer 파일 import 변경

| 파일 | 변경 |
|------|------|
| `components/features/chat/chat-section.tsx` | `useGetPaginatedFbMessages` → `useGetPaginatedMessages` |
| `components/features/chat/chat-message-list.tsx` | `ChatMessage` import 경로 변경 |
| `components/features/chat/chat-message.tsx` | `ChatMessage` type import 경로 변경 |
| `components/layout/header.tsx` | `useRoomsList` import 경로 변경 |

### 2.5 기존 `useBookmarks` 훅 수정

**수정**: `hooks/useBookmarks.ts`
- 현재 로직 → Supabase `chat_messages.is_bookmarked` 컬럼 기반 UPDATE/SELECT로 전환
- 북마크 토글: `supabase.from('chat_messages').update({ is_bookmarked }).eq('id', messageId)`
- 북마크 목록: `supabase.from('chat_messages').select('*').eq('room_id', roomId).eq('is_bookmarked', true)`

---

## Phase 3: Shared Types 정리

### 3.1 디렉토리 리네이밍

```
packages/shared-types/firebase/            → packages/shared-types/database/
packages/shared-types/typescript/firebase/ → packages/shared-types/typescript/database/
packages/shared-types/python/firebase/     → packages/shared-types/python/database/
```

- `COLLECTIONS` → `TABLES`
- 타입 자체(`ChatRoom`, `ChatMessage`)는 변경 없음 (이미 provider-agnostic)
- `STORAGE_PATHS`는 유지 (AI 서버 전용 — 아래 3.4 참조)

### 3.2 코드 생성 스크립트 수정

**수정**: `packages/shared-types/scripts/generate-typescript.js`
- `FIREBASE_DIR` → `DATABASE_DIR`, `OUTPUT_DIR` 경로 `firebase/` → `database/`

**수정**: `packages/shared-types/scripts/generate-python.py`
- 동일하게 입출력 경로 `firebase/` → `database/` 변경

### 3.3 import 경로 일괄 업데이트

`@packages/shared-types/typescript/firebase/` → `@packages/shared-types/typescript/database/`

> **주의**: 실제 코드베이스는 `@packages/shared-types` path alias를 사용 (`tsconfig.json` path mapping). `@ds-hub/shared-types`가 아님.

**대상 파일 전체 목록 (20개):**

| 파일 | import 대상 |
|------|------------|
| `hooks/firebase/messageUtils.ts` | `COLLECTIONS`, `ChatMessage` |
| `hooks/firebase/useRealtimeMessages.ts` | `ChatMessage`, `MESSAGES_COLLECTION` |
| `hooks/firebase/useGetPaginatedFbMessages.ts` | `ChatMessage`, `MESSAGES_COLLECTION` |
| `hooks/firebase/useRoomsList.ts` | `ChatRoom`, `COLLECTIONS` |
| `hooks/useRoom.ts` | shared-types firebase |
| `hooks/api/useRoomQuery.ts` | shared-types firebase |
| `hooks/api/useCreateRoom.ts` | shared-types firebase |
| `hooks/api/useChatQuery.ts` | shared-types firebase |
| `types/chat.ts` | shared-types firebase |
| `components/features/chat/chat-section.tsx` | `ChatMessage` |
| `components/features/chat/chat-message.tsx` | `ChatMessage` |
| `components/features/chat/chat-message-list.tsx` | `ChatMessage` |
| `app/api/chat/route.ts` | shared-types |
| `app/api/chat/stream/route.ts` | shared-types |
| `app/api/rooms/route.ts` | shared-types |
| `app/api/rooms/[room_id]/route.ts` | shared-types |
| `app/api/rooms/[room_id]/schemas/route.ts` | shared-types |
| `app/api/health/route.ts` | shared-types |
| `tsconfig.json` | path alias 정의 |
| `CLAUDE.md` | 문서 참조 |

### 3.4 Firebase Storage 처리

현재 `lib/firebase.ts`에서 `firebaseStorage`를 export하고, `STORAGE_PATHS` (screenshots, assets, user_uploads, exports)가 정의되어 있으나:

- **프론트엔드에서 Firebase Storage를 직접 사용하지 않음** — 이미지 업로드는 `app/api/rooms/[room_id]/images/route.ts`에서 AI 서버로 프록시
- AI 서버가 Storage를 직접 관리하므로 **클라이언트 코드 변경 불필요**
- `STORAGE_PATHS` 상수는 AI 서버(Python) 측에서 Supabase Storage 전환 시 별도 처리
- Phase 4에서 `firebaseStorage` export 삭제 시 import 참조가 없는지 확인 필요

---

## Phase 4: 정리

### 4.1 파일 삭제

| 삭제 대상 | 이유 |
|-----------|------|
| `apps/web/lib/firebase.ts` | `lib/supabase/client.ts`로 대체 (`firebaseStorage` export 포함 — 프론트엔드 미사용 확인됨) |
| `apps/web/hooks/firebase/` (전체 4개 파일) | `hooks/supabase/`로 대체. `messageUtils.ts`, `useGetPaginatedFbMessages.ts`, `useRealtimeMessages.ts`, `useRoomsList.ts` |
| `packages/shared-types/typescript/firebase/` | `database/`로 이동 |
| `packages/shared-types/python/firebase/` | `database/`로 이동 |
| `packages/shared-types/firebase/` | `database/`로 이동 |

> **참고**: `useRealtimeMessages.ts`는 현재 컴포넌트에서 직접 사용되지 않으나, Firestore `onSnapshot` 기반 훅임. Broadcast 채널(`useRoomChannel.ts`)이 이 역할을 대체.

### 4.2 패키지 제거

```bash
pnpm remove firebase firebase-admin --filter web
```

### 4.3 문서 업데이트

- `apps/web/.env.local.example`: Supabase 환경변수로 교체
- `apps/web/CLAUDE.md`: Firebase 참조 → Supabase
- `apps/web/VERCEL_DEPLOY.md`: 배포 환경변수 업데이트

---

## 파일 변경 요약

### 신규 생성 (6개)
| 파일 | Phase |
|------|-------|
| `apps/web/lib/supabase/client.ts` | 1 |
| `apps/web/lib/supabase/server.ts` | 1 |
| `apps/web/lib/supabase/middleware.ts` | 1 |
| `apps/web/hooks/supabase/useGetPaginatedMessages.ts` | 2 |
| `apps/web/hooks/supabase/useRoomsList.ts` | 2 |
| `apps/web/hooks/supabase/useRoomChannel.ts` | 2 |

### 수정 (27개)
| 파일 | Phase | 변경 규모 |
|------|-------|-----------|
| `lib/auth/actions.ts` | 1 | 전면 재작성 |
| `lib/auth/config.ts` | 1 | 부분 삭제 |
| `lib/auth/verify-token.ts` | 1 | 전면 재작성 |
| `types/auth.ts` | 1 | import + 타입 변환 수정 |
| `stores/useAuthStore.ts` | 1 | cookie 로직 제거 |
| `components/providers/auth-initializer.tsx` | 1 | listener 교체 |
| `components/features/auth/auth-callback-handler.tsx` | 1 | PKCE 교환으로 변경 |
| `middleware.ts` | 1 | 전면 재작성 |
| `app/api/chat/route.ts` | 1 | import 변경 |
| `app/api/chat/stream/route.ts` | 1+2 | Phase 1: import 변경, Phase 2: Broadcast 로직 추가 |
| `app/api/rooms/route.ts` | 1+2 | Phase 1: import 변경, Phase 2: Supabase DB 쓰기 추가 |
| `app/api/rooms/[room_id]/route.ts` | 1 | import 변경 |
| `app/api/rooms/[room_id]/images/route.ts` | 1 | import 변경 |
| `app/api/rooms/[room_id]/schemas/route.ts` | 1 | import 변경 |
| `hooks/useChatStream.ts` | 2 | SSE 파싱 → Broadcast 구독으로 변경 |
| `hooks/useBookmarks.ts` | 2 | Supabase DB 기반으로 전환 |
| `components/features/chat/chat-section.tsx` | 2 | hook import 변경 |
| `components/features/chat/chat-message.tsx` | 2+3 | type import 경로 변경 |
| `components/features/chat/chat-message-list.tsx` | 2 | type import 변경 |
| `components/layout/header.tsx` | 2 | hook import 변경 |
| `hooks/useRoom.ts` | 3 | import 경로 변경 |
| `hooks/api/useRoomQuery.ts` | 3 | import 경로 변경 |
| `hooks/api/useCreateRoom.ts` | 3 | import 경로 변경 |
| `hooks/api/useChatQuery.ts` | 3 | import 경로 변경 |
| `types/chat.ts` | 3 | import 경로 변경 |
| `app/api/health/route.ts` | 3 | import 경로 변경 |
| `packages/shared-types/scripts/generate-python.py` | 3 | 입출력 경로 변경 |

### 삭제 (5개 + 디렉토리)
| 파일 | Phase |
|------|-------|
| `apps/web/lib/firebase.ts` | 4 |
| `apps/web/hooks/firebase/` (4개 파일) | 4 |
| `packages/shared-types/typescript/firebase/` | 3 |
| `packages/shared-types/python/firebase/` | 3 |
| `packages/shared-types/firebase/` | 3 |

---

## 검증 방법

### Phase 1 검증
1. Magic Link 이메일 전송 → 수신 → 콜백 → 로그인 완료 확인
2. 로그인 상태에서 API 호출 시 Bearer token 정상 전달 확인
3. 비로그인 상태에서 보호 페이지 접근 시 `/login` 리다이렉트 확인
4. API Route에서 Supabase JWT 검증 성공/실패 확인

### Phase 2 검증
1. Room 생성 → Supabase DB에 저장 확인
2. 질문 전송 → Broadcast로 chunk 수신 → UI 실시간 렌더링 확인
3. ai-done 수신 → DB fetch 동기화 → 최종 메시지 정상 표시 확인
4. 메시지 페이지네이션 (20개 단위 무한 스크롤) 확인
5. 텍스트 검색 → 메시지 점프 → scrollIntoView 확인
6. 북마크 토글 → 북마크 목록 → 점프 확인

### Phase 3-4 검증
1. `pnpm build` 성공 확인 (Firebase import 없음)
2. `pnpm dev` → 전체 플로우 재검증

---

## TODO LIST

### Phase 0: Supabase 프로젝트 세팅
- [x] Supabase 프로젝트 생성
- [x] Magic Link 인증 활성화 + Redirect URL 등록
- [ ] PKCE용 이메일 템플릿 설정 (Magic Link가 `token_hash` 포함하도록 수정)
- [x] `chat_rooms` 테이블 생성
- [x] `chat_messages` 테이블 생성
- [x] 인덱스 생성 (room_id+created_at, user_id+created_at)
- [x] RLS 정책 설정 (`::text` 캐스팅 적용 — user_id가 text 타입)
- [x] Realtime 활성화 (Database > Replication)
- [x] `.env.local` Supabase 환경변수 추가
- [ ] [BE] AI 서버에 Supabase 환경변수 설정 (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)

### Phase 1: 인증 마이그레이션
- [x] [FE] `@supabase/supabase-js`, `@supabase/ssr` 패키지 설치
- [x] [FE] `lib/supabase/client.ts` 생성 (브라우저용)
- [x] [FE] `lib/supabase/server.ts` 생성 (API Route용)
- [x] [FE] `lib/supabase/middleware.ts` 생성 (토큰 갱신 helper)
- [x] [FE] `lib/auth/actions.ts` 재작성 (Firebase → Supabase OTP)
- [x] [FE] `lib/auth/config.ts` 수정 (Firebase 전용 설정 제거)
- [x] [FE] `types/auth.ts` 수정 (User import + toAuthUser 변환)
- [x] [FE] `stores/useAuthStore.ts` 수정 (cookie 로직 제거)
- [x] [FE] `components/providers/auth-initializer.tsx` 수정 (onAuthStateChange)
- [x] [FE] `components/features/auth/auth-callback-handler.tsx` 재작성 (PKCE)
- [x] [FE] `lib/auth/verify-token.ts` 재작성 (Supabase JWT 검증)
- [x] [FE] `app/api/chat/route.ts` import 변경 (토큰 검증 미사용 — 변경 불필요)
- [x] [FE] `app/api/chat/stream/route.ts` import 변경
- [x] [FE] `app/api/rooms/route.ts` import 변경
- [x] [FE] `app/api/rooms/[room_id]/route.ts` import 변경
- [x] [FE] `app/api/rooms/[room_id]/images/route.ts` import 변경
- [x] [FE] `app/api/rooms/[room_id]/schemas/route.ts` import 변경
- [x] [FE] `middleware.ts` 재작성 (Supabase SSR, `updateSession()` 사용)
- [x] [FE] `.env.local` 환경변수 교체 (Firebase 제거, Supabase 추가 — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 사용)
- [ ] Phase 1 검증: Magic Link 로그인 플로우 테스트
- [ ] Phase 1 검증: API Route 토큰 검증 테스트
- [ ] Phase 1 검증: Middleware 리다이렉트 테스트

### Phase 2: 스트리밍 + 실시간 데이터 (상세: [chat-logic.md](chat-logic.md))

#### [FE] 프론트엔드 태스크
- [ ] [FE] `app/api/chat/stream/route.ts` 단순화 (인증 + AI 서버 트리거 + 즉시 `{ ok: true }` 응답, fire-and-forget)
- [ ] [FE] `app/api/rooms/route.ts` 단순화 (인증 + AI 서버 프록시만, Supabase 쓰기 제거)
- [ ] [FE] `hooks/supabase/useRoomChannel.ts` 생성 (Broadcast 채널 구독)
- [ ] [FE] `hooks/useChatStream.ts` 수정 (POST 트리거 + Broadcast 구독으로 chunk 수신)
- [ ] [FE] `hooks/supabase/useGetPaginatedMessages.ts` 생성 (20개/페이지 cursor 기반, 기존 pageSize 10→20 변경)
- [ ] [FE] `hooks/supabase/useRoomsList.ts` 생성 (DB fetch 기반)
- [ ] [FE] `hooks/useBookmarks.ts` 수정 (Supabase DB 기반 `is_bookmarked` 컬럼 활용)
- [ ] [FE] `components/features/chat/chat-section.tsx` import 변경
- [ ] [FE] `components/features/chat/chat-message.tsx` type import 경로 변경
- [ ] [FE] `components/features/chat/chat-message-list.tsx` import 변경
- [ ] [FE] `components/layout/header.tsx` import 변경
- [ ] [FE] ai-done 수신 시 DB fetch 동기화 로직 구현
- [ ] [FE] 메시지 검색 (ILIKE) + 점프 로직 구현
- [ ] [FE] 북마크 기능 구현 (`is_bookmarked` 컬럼)
- [ ] [FE] `SUPABASE_SERVICE_ROLE_KEY` BFF 환경변수에서 제거

#### [BE] 백엔드 태스크 (Python FastAPI)
- [ ] [BE] Supabase Python SDK 설치 (`supabase-py`)
- [ ] [BE] Supabase 클라이언트 초기화 (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] [BE] Broadcast 채널 관리: room 단위 채널 open/close (`supabase.removeChannel()`)
- [ ] [BE] 스트리밍 시 Broadcast 이벤트 전송 (`ai-start`, `ai-chunk`, `ai-done`, `ai-error`)
- [ ] [BE] 스트리밍 완료 후 `chat_messages` INSERT (Supabase DB)
- [ ] [BE] Room 생성 시 `chat_rooms` INSERT (Supabase DB)
- [ ] [BE] 에러 시 `ai-error` Broadcast + DB INSERT 재시도 (최대 3회)

#### Phase 2 검증
- [ ] Room 생성 → AI 서버가 Supabase DB 저장 확인
- [ ] 질문 전송 → BFF 즉시 응답 + Broadcast 스트리밍 수신 확인
- [ ] ai-done → DB fetch 동기화 확인
- [ ] 메시지 페이지네이션 (20개 단위 무한 스크롤) 확인
- [ ] 검색 + 메시지 점프 확인
- [ ] 북마크 토글 + 북마크 목록 + 점프 확인

### Phase 3: Shared Types 정리
- [ ] [FE] `packages/shared-types/firebase/` → `database/` 리네이밍
- [ ] [FE] `packages/shared-types/typescript/firebase/` → `database/` 리네이밍
- [ ] [BE] `packages/shared-types/python/firebase/` → `database/` 리네이밍
- [ ] [FE] `COLLECTIONS` → `TABLES` 상수명 변경
- [ ] [FE] `generate-typescript.js` 경로 수정 (`firebase/` → `database/`)
- [ ] [BE] `generate-python.py` 경로 수정 (`firebase/` → `database/`)
- [ ] [FE] import 경로 일괄 업데이트 (`@packages/shared-types/typescript/firebase/` → `database/`, 대상 20개 파일)
- [ ] [FE] `hooks/useRoom.ts` import 경로 변경
- [ ] [FE] `hooks/api/useRoomQuery.ts` import 경로 변경
- [ ] [FE] `hooks/api/useCreateRoom.ts` import 경로 변경
- [ ] [FE] `hooks/api/useChatQuery.ts` import 경로 변경
- [ ] [FE] `types/chat.ts` import 경로 변경
- [ ] [FE] `app/api/health/route.ts` import 경로 변경
- [ ] [FE] `tsconfig.json` path alias 확인 (필요 시 수정)

### Phase 4: 정리
- [ ] [FE] `apps/web/lib/firebase.ts` 삭제 (`firebaseStorage` export 포함 — 프론트엔드 미사용 확인됨)
- [ ] [FE] `apps/web/hooks/firebase/` 디렉토리 삭제 (messageUtils, useGetPaginatedFbMessages, useRealtimeMessages, useRoomsList)
- [ ] [FE] `packages/shared-types/typescript/firebase/` 삭제 (이동 완료 후)
- [ ] [BE] `packages/shared-types/python/firebase/` 삭제 (이동 완료 후)
- [ ] [FE] `packages/shared-types/firebase/` 삭제 (이동 완료 후)
- [ ] [FE] `firebase`, `firebase-admin` 패키지 제거
- [ ] [FE] `.env.local.example` 업데이트
- [ ] [FE] `CLAUDE.md` 업데이트 (Firebase 참조 → Supabase 전면 교체)
- [ ] [FE] `VERCEL_DEPLOY.md` 업데이트
- [ ] [FE] `pnpm build` 성공 확인 (Firebase import 잔존 여부 grep 검증)
- [ ] `pnpm dev` → 전체 플로우 최종 검증
