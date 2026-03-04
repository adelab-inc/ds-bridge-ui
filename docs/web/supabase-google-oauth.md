# Supabase Google OAuth 소셜 로그인 추가 계획

## Context

**목적**: Magic Link의 SMTP 의존성과 UX 제약을 해소하기 위해 Google OAuth를 메인 로그인으로 추가.
기존 Magic Link는 폴백으로 유지하여 Google 계정이 없는 유저도 커버.

**전제**: Supabase Auth 마이그레이션(Phase 1)이 완료된 상태에서 진행.
기존 인증 인프라(미들웨어, 토큰 검증, 스토어, API Routes)는 변경 없음.

**장점**:
- SMTP 설정 불필요 (Google OAuth는 이메일 발송 없음)
- Rate Limit 없음
- 로그인 UX 대폭 개선 (클릭 2번, 2초 완료)
- Google 2FA에 의존하므로 보안 수준 향상

---

## 사전 준비: Google Cloud Console 설정

- [ ] [Google Cloud Console](https://console.cloud.google.com/) 접속
- [ ] 프로젝트 생성 또는 기존 프로젝트 선택
- [ ] **APIs & Services** → **OAuth consent screen** 설정
  - User Type: External
  - App name: `DS-Runtime Hub`
  - Authorized domains: Supabase 프로젝트 도메인 추가
- [ ] **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
  - Application type: Web application
  - Authorized redirect URIs 추가:
    - `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
- [ ] Client ID, Client Secret 복사

---

## 사전 준비: Supabase Dashboard 설정

- [ ] Supabase Dashboard → **Authentication** → **Providers** → **Google**
- [ ] Enable Google provider 토글 ON
- [ ] Client ID 입력 (Google Cloud Console에서 복사)
- [ ] Client Secret 입력
- [ ] Save

---

## TODO 체크리스트

### Step 1: OAuth 콜백 API Route 생성

- [ ] `apps/web/app/auth/callback/route.ts` 신규 생성 (서버사이드 code exchange)
  ```typescript
  import { NextResponse } from 'next/server';
  import { createClient } from '@/lib/supabase/server';

  export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }
  ```
- [ ] 기존 `app/auth/callback/page.tsx` (Magic Link용)와 공존 확인
  - `route.ts`가 GET 요청 처리 (OAuth code exchange)
  - `page.tsx`가 페이지 렌더링 (Magic Link PKCE)
  - OAuth는 `?code=` 파라미터로 GET 요청 → `route.ts`에서 처리 후 리다이렉트
  - Magic Link도 `?code=` 파라미터 사용 → **충돌 가능성 확인 필요**
  - 해결: `route.ts` 하나로 통합하거나, Magic Link도 서버사이드 exchange로 전환

### Step 2: 인증 액션 함수 추가

- [ ] `apps/web/lib/auth/actions.ts`에 `signInWithGoogle()` 추가
  ```typescript
  export async function signInWithGoogle(): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }
  ```

### Step 3: 로그인 UI 수정

- [ ] `apps/web/components/features/auth/login-form.tsx` 수정
  - Google 로그인 버튼 추가 (메인, 상단 배치)
  - 구분선 ("또는") 추가
  - 기존 이메일 입력 폼 유지 (하단 폴백)
  ```
  ┌─────────────────────────────┐
  │     DS-Runtime Hub          │
  │                             │
  │  [G  구글로 로그인]          │ ← 메인
  │                             │
  │  ─────── 또는 ───────       │
  │                             │
  │  이메일: [____________]     │ ← 폴백
  │  [로그인 링크 보내기]        │
  └─────────────────────────────┘
  ```

### Step 4: 콜백 핸들러 통합 검토

- [ ] OAuth와 Magic Link 콜백 경로 충돌 여부 확인
  - 둘 다 `/auth/callback?code=...` 사용
  - Next.js App Router에서 `route.ts`와 `page.tsx` 동시 존재 시 `route.ts`가 우선
  - **권장**: `route.ts` 하나로 통합 (code exchange 후 리다이렉트)
  - `auth-callback-handler.tsx` (클라이언트 PKCE)는 삭제하거나 `route.ts`로 이관
- [ ] 통합 후 Magic Link 플로우 정상 동작 확인

### Step 5: types/auth.ts 확인

- [ ] `toAuthUser()` 함수가 Google OAuth user_metadata를 올바르게 매핑하는지 확인
  - `user_metadata.full_name` → `displayName` (이미 대응됨)
  - `user_metadata.avatar_url` → `photoURL` (이미 대응됨)
- [ ] user-menu에서 프로필 사진 표시 여부 결정 (선택적)

---

## 변경 불필요 확인 (기존 인프라)

| 파일 | 이유 |
|------|------|
| `lib/supabase/client.ts` | 동일 클라이언트 |
| `lib/supabase/server.ts` | 동일 |
| `lib/supabase/middleware.ts` | 세션 갱신 동일 |
| `lib/auth/verify-token.ts` | JWT 검증 동일 |
| `stores/useAuthStore.ts` | `onAuthStateChange`가 OAuth도 처리 |
| `auth-initializer.tsx` | 동일 |
| `middleware.ts` | 동일 |
| API Routes 6개 | `verifySupabaseToken` 동일 |
| `hooks/api/*` | Bearer token 주입 동일 |
| DB 테이블 / RLS | `auth.uid()` 인증 방식 무관 |

---

## 파일 변경 요약

| 작업 | 파일 | 규모 |
|------|------|------|
| 신규 | `app/auth/callback/route.ts` | ~25줄 |
| 수정 | `lib/auth/actions.ts` (`signInWithGoogle` 추가) | +10줄 |
| 수정 | `components/features/auth/login-form.tsx` (Google 버튼 추가) | +20줄 |
| 삭제/이관 | `components/features/auth/auth-callback-handler.tsx` (통합 시) | 선택적 |
| 확인 | `types/auth.ts` | 변경 없음 예상 |

---

## DB 테이블 영향

### 변경 없음

Google OAuth 유저도 `auth.users`에 동일 구조로 저장됩니다.

| 필드 | Magic Link 유저 | Google OAuth 유저 |
|------|----------------|-------------------|
| `id` | UUID | UUID |
| `email` | `user@example.com` | `user@gmail.com` |
| `email_confirmed_at` | 링크 클릭 시 설정 | **즉시 설정** |
| `raw_app_meta_data.provider` | `email` | `google` |
| `raw_app_meta_data.providers` | `["email"]` | `["google"]` |
| `raw_user_meta_data.full_name` | null | `"홍길동"` (Google 프로필) |
| `raw_user_meta_data.avatar_url` | null | `"https://lh3..."` (Google 사진) |

동일 이메일로 Magic Link + Google OAuth 모두 사용 시:
- `providers`: `["email", "google"]` (자동 병합)
- `auth.identities` 테이블에 2개 레코드 생성
- `auth.users`는 1개 레코드 유지 (동일 UUID)

### chat_rooms, chat_messages

```sql
-- 인증 방식과 무관. 기존 스키마 + RLS 그대로 동작
chat_rooms.user_id = auth.uid()  -- Google이든 Magic Link이든 동일 UUID
```

---

## 검증 체크리스트

- [ ] Google 로그인 버튼 클릭 → Google 동의 화면 → 로그인 완료 → 홈 리다이렉트
- [ ] 로그인 후 `useAuth` 훅에서 `user.email`, `user.displayName` 정상 반환
- [ ] 채팅방 생성 → `user_id`가 Google OAuth UUID로 저장
- [ ] 채팅방 목록에서 본인 채팅방만 표시 (RLS 동작 확인)
- [ ] Magic Link 폴백 로그인 정상 동작 확인
- [ ] 동일 이메일로 Google + Magic Link 로그인 시 계정 병합 확인
- [ ] 로그아웃 → 미들웨어 리다이렉트 정상 동작
