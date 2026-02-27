# Firebase Auth → Supabase Auth 마이그레이션 작업 계획

## Context

**목적**: Firebase Email Link 인증을 폐기하고 Supabase Magic Link 인증으로 전면 전환.
유저별 데이터(채팅방, 메시지, 이미지 등)를 Supabase 인증 기반으로 완전히 커버.

**현재 상태**: `feat/supabase-migration` 브랜치에 Phase 1(인증) + Phase 2(스트리밍) 코드가 이미 작성됨.
Firebase 잔여 코드 미삭제, `useRoomsList` Supabase 훅 누락, 전체 검증 미완료.

**작업 브랜치**: `feat/supabase-migration` → 서브 브랜치 `feat/supabase-auth-cleanup` 생성 → 작업 후 merge

**아키텍처**:
```
Browser → BFF (Next.js API Routes, Supabase Auth 검증) → ai-service (X-API-Key + X-User-Id)
                                                        → Supabase DB (service_role)
```

---

## 현재 브랜치 상태

### 구현 완료 (Phase 1 - 인증)

| 파일 | 내용 |
|------|------|
| `lib/supabase/client.ts` | createBrowserClient + realtime 설정 |
| `lib/supabase/server.ts` | createServerClient + cookie 핸들링 |
| `lib/supabase/middleware.ts` | updateSession (토큰 갱신) |
| `lib/auth/actions.ts` | signInWithOtp, signOut, getIdToken |
| `lib/auth/config.ts` | PUBLIC_ROUTES, EMAIL_STORAGE_KEY |
| `lib/auth/verify-token.ts` | verifySupabaseToken (service_role) |
| `types/auth.ts` | Supabase User → AuthUser 변환 |
| `stores/useAuthStore.ts` | 수동 cookie 로직 제거 |
| `auth-initializer.tsx` | onAuthStateChange 구독 |
| `auth-callback-handler.tsx` | PKCE code exchange |
| `login-form.tsx` | 기존 UI 유지, sendSignInLink 연동 |
| `middleware.ts` | Supabase SSR 세션 갱신 |
| API Routes 6개 | verifyFirebaseToken → verifySupabaseToken |

### 구현 완료 (Phase 2 - 스트리밍/데이터)

| 파일 | 내용 |
|------|------|
| `hooks/supabase/useRoomChannel.ts` | Broadcast 채널 관리 |
| `hooks/supabase/useGetPaginatedMessages.ts` | cursor 페이지네이션 |
| `stores/useStreamingStore.ts` | 스트리밍 상태 |
| `types/chat.ts` | Broadcast 이벤트 타입 |
| `app/api/chat/stream/route.ts` | SSE→Broadcast 중계 패턴 |

---

## 유저별 구분 기능 커버리지

| 기능 | 위치 | 유저 구분 방식 | 전환 상태 |
|------|------|---------------|----------|
| 채팅방 목록 | header.tsx → useRoomsList | `user_id == uid` 필터 | ❌ 미전환 |
| 채팅방 생성 | useCreateRoom → API /rooms | `body.user_id = decodedToken.uid` | ✅ |
| 채팅방 조회/수정/삭제 | API /rooms/[id] | 토큰 검증 후 접근 | ✅ |
| 채팅 스트리밍 | API /chat/stream | 토큰 검증 + user_id 전달 | ✅ |
| 이미지 업로드 | API /rooms/[id]/images | 토큰 검증 | ✅ |
| 스키마 관리 | API /rooms/[id]/schemas | 토큰 검증 | ✅ |
| 메시지 삭제 | API /rooms/[id]/messages/[id] | 토큰 검증 | ✅ |
| 로그인 상태 표시 | user-menu.tsx → useAuth | `user.email` 표시 | ✅ |
| 세션 유지 | middleware.ts | 쿠키 기반 세션 갱신 | ✅ |
| API 인증 헤더 | hooks/api/* (6개) | Bearer token 주입 | ✅ |

> **결론**: `useRoomsList`만 전환하면 전체 커버리지 달성

---

## TODO 체크리스트

### Step 1: 서브 브랜치 생성 및 환경 세팅

- [ ] `git fetch origin`
- [ ] `git checkout origin/feat/supabase-migration -b feat/supabase-auth-cleanup`
- [ ] `pnpm install`
- [ ] `.env.local` Supabase 환경변수 확인
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

---

### Step 2: 누락된 useRoomsList Supabase 훅 구현

- [ ] `apps/web/hooks/supabase/useRoomsList.ts` 신규 생성
  - Firestore `onSnapshot` → Supabase DB `select` + TanStack Query
  - `user_id` 필터로 본인 채팅방만 조회
  - `created_at DESC` 정렬
  ```typescript
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  ```
- [ ] `components/layout/header.tsx` import 변경
  - `hooks/firebase/useRoomsList` → `hooks/supabase/useRoomsList`

---

### Step 3: 기존 Auth 구현 코드 검증 및 보완

- [ ] `lib/supabase/client.ts` — 공식 패턴 일치 확인
- [ ] `lib/supabase/server.ts` — cookies().getAll() + setAll() 패턴 확인
- [ ] `lib/supabase/middleware.ts` — request/response 쿠키 동기화 확인
- [ ] `lib/auth/verify-token.ts` — 매 요청 createClient 호출 → 모듈 레벨 싱글턴 개선 검토
  ```typescript
  // 개선 후보
  const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY);
  export async function verifySupabaseToken(authHeader) { ... }
  ```
- [ ] `types/auth.ts` — `uid` 필드 유지 확인 (API routes에서 `decodedToken.uid` 접근)

---

### Step 4: Firebase 잔여 코드 삭제

#### 4-1. 파일 삭제
- [ ] `apps/web/lib/firebase.ts` 삭제
- [ ] `apps/web/hooks/firebase/messageUtils.ts` 삭제
- [ ] `apps/web/hooks/firebase/useGetPaginatedFbMessages.ts` 삭제
- [ ] `apps/web/hooks/firebase/useRealtimeMessages.ts` 삭제
- [ ] `apps/web/hooks/firebase/useRoomsList.ts` 삭제

#### 4-2. 잔여 참조 제거
- [ ] `grep -r "firebase" apps/web/ --include="*.ts" --include="*.tsx"` 로 잔여 import 검색
- [ ] 발견된 모든 Firebase import/참조 제거

#### 4-3. 패키지 제거
- [ ] `pnpm remove firebase firebase-admin --filter @ds-hub/web`

#### 4-4. 환경변수 정리
- [ ] `apps/web/.env.local.example` 수정
  - 제거: `NEXT_PUBLIC_FIREBASE_*` (7개), `FIREBASE_*` (3개)
  - 유지: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

### Step 5: 문서 업데이트

- [ ] `apps/web/CLAUDE.md` 업데이트
  - [ ] "기술 스택" 테이블: `Firebase 12.7.0` → `Supabase (@supabase/ssr 0.8.0)`
  - [ ] "Firebase 연동" 섹션 → "Supabase 연동" 섹션으로 교체
  - [ ] "디렉토리 구조": `hooks/firebase/` → `hooks/supabase/`
  - [ ] "환경 변수": Firebase → Supabase
- [ ] `docs/web/supabase-migration/migration-plan.md` TODO 상태 업데이트

---

### Step 6: 빌드 검증

- [ ] `pnpm typecheck` — TypeScript 컴파일 에러 없음
- [ ] `pnpm lint` — ESLint 통과
- [ ] `pnpm build` — 프로덕션 빌드 성공 (Firebase import 잔여 시 여기서 실패)

---

### Step 7: E2E 인증 플로우 검증

- [ ] Magic Link 발송: `/login` → 이메일 입력 → 링크 전송 → 이메일 수신
- [ ] 콜백 처리: 이메일 링크 클릭 → `/auth/callback?code=...` → PKCE 교환 → 로그인 완료
- [ ] 세션 유지: 페이지 새로고침 → `onAuthStateChange` 세션 복원 → 인증 상태 유지
- [ ] 미들웨어 보호: 로그아웃 → `/` 접근 → `/login?redirect=/` 리다이렉트
- [ ] API 인증: 로그인 → 채팅방 생성 → Bearer 토큰 정상 전달 → `decodedToken.uid` 추출
- [ ] 유저 격리: 유저A 채팅방 생성 → 유저B 로그인 → 유저B에게 안 보임

---

### Step 8: PR 생성 및 Merge

- [ ] `feat/supabase-auth-cleanup` → `feat/supabase-migration` PR 생성
- [ ] 리뷰 후 merge

---

## 파일 변경 요약

| 작업 | 파일 | Step |
|------|------|------|
| 신규 | `hooks/supabase/useRoomsList.ts` | 2 |
| 수정 | `components/layout/header.tsx` (import 변경) | 2 |
| 수정 | `lib/auth/verify-token.ts` (싱글턴 개선, 선택적) | 3 |
| 삭제 | `lib/firebase.ts` | 4 |
| 삭제 | `hooks/firebase/*` (4개 파일) | 4 |
| 수정 | `package.json` (firebase 패키지 제거) | 4 |
| 수정 | `.env.local.example` (Firebase 환경변수 제거) | 4 |
| 수정 | `CLAUDE.md` (Supabase 참조로 교체) | 5 |

---

## 커밋 전략

```
feat/supabase-auth-cleanup (서브 브랜치)
  ├── commit 1: feat: useRoomsList Supabase 훅 구현 + header import 전환
  ├── commit 2: refactor: verify-token 싱글턴 개선 (선택적)
  ├── commit 3: chore: Firebase 잔여 코드 삭제 (lib/firebase.ts, hooks/firebase/)
  ├── commit 4: chore: firebase, firebase-admin 패키지 제거
  ├── commit 5: docs: CLAUDE.md + .env.local.example Supabase 기준으로 업데이트
  └── PR → feat/supabase-migration
```

---

## Supabase 공식 권장 패턴 참조

### Browser Client
```typescript
import { createBrowserClient } from '@supabase/ssr'
createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
```

### Server Client
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
const cookieStore = await cookies()
createServerClient(URL, KEY, {
  cookies: { getAll() { return cookieStore.getAll() }, setAll(cookiesToSet) { ... } }
})
```

### Middleware
```typescript
// request.cookies.getAll() / supabaseResponse.cookies.set() 동기화
// supabase.auth.getUser()로 인증 확인 (getSession 아닌 getUser 사용 권장)
```

### Magic Link Login
```typescript
await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: 'https://app.com/auth/callback' }
})
```

### Auth State Change
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
})
```
