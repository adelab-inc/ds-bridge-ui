# DS-Bridge UI — Web (`@ds-hub/web`)

Next.js 16 App Router 기반 디자인 시스템 런타임 허브 프론트엔드. BFF 레이어로 ai-service + Supabase 연동.

---

## Quick Reference

### 기술 스택 (main HEAD 기준)

| 항목 | 버전 | 비고 |
| --- | --- | --- |
| Node | `^24.0.0` | `engine-strict=true` |
| pnpm | `10.15.0` | workspace manager |
| Next.js | **16.2.4** | App Router, Turbopack 빌드 |
| React | `19.2.3` | `useId()` SSR 주의 → ClientOnly |
| TypeScript | `5.9.x` | strict, target ES2017 |
| Tailwind CSS | `4.2.x` | `@tailwindcss/postcss` |
| Base UI | `^1.4.1` | `@base-ui/react` — Headless |
| shadcn/ui | `^3.8.5` | 스타일 프리셋 |
| Hugeicons | `^1.1.6` | 아이콘 |
| react-resizable-panels | `^4.10.0` | minSize/maxSize는 `"280px"` 문자열 |
| TanStack Query | `^5.99.2` | 서버 상태 |
| Zustand | `^5.0.12` | 클라이언트 상태 |
| @supabase/ssr | `^0.8.0` | Browser/Server client |
| @supabase/supabase-js | `^2.104.0` | Auth, DB, Realtime |

### 개발 명령어

```bash
pnpm dev          # next dev --port 5555
pnpm build        # next build (TS 체크 포함)
pnpm lint         # eslint
pnpm lint:fix     # eslint --fix
pnpm format:fix   # prettier --write .
```

루트에서는 `pnpm --filter @ds-hub/web <script>` 또는 루트 스크립트 `pnpm dev`/`pnpm build` 사용.
**`typecheck` 스크립트는 없음** — `next build`가 TS 검증을 포함한다.

### 경로 alias (`tsconfig.json`)

```
@/*                          → apps/web/*
@packages/*                  → packages/*
@ds-hub/shared-types/*       → packages/shared-types/*
```

---

## ⚠️ 절대 규칙

| 규칙 | 이유 |
| --- | --- |
| ❌ `storybook-standalone/packages/ui/src/` 내부 파일 **수정/생성 금지** | @aplus/ui는 외부 디자인 시스템. `index.ts` re-export 추가만 허용 |
| ✅ API Route에서는 **반드시** `verifySupabaseToken(req.headers.get('authorization'))` 선행 | BFF 패턴 유지, service_role 누출 방지 |
| ✅ Base UI / shadcn 컴포넌트는 **`ClientOnly` 래핑** 필수 | React 19 `useId()` SSR Hydration mismatch 방지 |
| ❌ `eslint-plugin-react-hooks`를 7.1.x 이상으로 올리지 말 것 | 루트 `pnpm.overrides`에 `7.0.1` 핀. 7.1.x `react-hooks/set-state-in-effect` 룰이 의도적 SSR/URL-sync 패턴을 오탐 |
| ❌ `apps/web/lib/auth/verify-token.ts`의 `service_role` 키를 브라우저에 노출 금지 | 서버 전용 |
| ❌ 루트 `.omc/**`, `.claude/**` 외 파일을 "정리" 목적으로 삭제 금지 | 사용자 작업 중인 파일일 수 있음 |

---

## 도구 활용

### Context7 MCP (공식 문서 확인 필수)

아래 라이브러리 작업 전 반드시 최신 문서 조회:

| 라이브러리 | Library ID | 확인 포인트 |
| --- | --- | --- |
| Base UI | `/mui/base-ui` | SSR/Hydration, 컴포넌트 API |
| react-resizable-panels | `/bvaughn/react-resizable-panels` | Panel props, CSS 단위 |

### Serena MCP (활성화 시 우선 사용)

파일 탐색·편집 시 Serena의 `find_symbol` / `replace_symbol_body` / `find_referencing_symbols`가 있으면 전체 파일 재작성 대신 심볼 단위로 처리.

---

## 디렉토리 심볼 맵

### `app/` — App Router

```
app/
├── layout.tsx             # RootLayout (QueryProvider + AuthInitializer)
├── page.tsx               # 홈 (채팅 세션 진입)
├── login/page.tsx         # Magic Link / Google OAuth 로그인
├── auth/callback/route.ts # Supabase OAuth 콜백
└── api/                   # BFF — 전부 verifySupabaseToken 필수
    ├── chat, chat/stream
    ├── description/extract
    ├── description/[room_id]
    ├── description/[room_id]/edit
    ├── description/[room_id]/versions
    ├── description/[room_id]/versions/[id]
    ├── ds/extract, figma/extract
    ├── health
    ├── ui-bundle, ui-bundle/css
    └── rooms, rooms/[room_id],
        rooms/[room_id]/images,
        rooms/[room_id]/messages/[message_id],
        rooms/[room_id]/schemas
```

### `components/`

| 경로 | 구성 |
| --- | --- |
| `ui/` (20) | shadcn + custom: alert-dialog, badge, button, card, **client-only**, collapsible, combobox, dropdown-menu, field, input, input-group, label, markdown, resizable, scroll-area, select, separator, tabs, textarea, tooltip, typed-markdown |
| `layout/` (7) | desktop-layout, mobile-layout, mobile-sheet, header, header-logo, left-panel, right-panel |
| `providers/` (3) | auth-initializer, query-provider, room-provider — RootLayout에서 조립 |
| `features/auth/` | login-form, user-menu |
| `features/chat/` | chat-section(메인), chat-header, chat-input, chat-message, chat-message-list, bookmark-dropdown, image-preview |
| `features/chat/dialogs/` | bookmark-label, delete-message, figma-rate-limit, unsaved-edit |
| `features/chat/hooks/` | use-chat-stream-lifecycle, use-message-bookmarks, use-message-delete, use-selected-message |
| `features/description/` (8) | description-tab, -editor, -viewer, -history-panel, -history-item, -action-bar, -toolbar, -version-banner |
| `features/preview/` (5) | preview-section, storybook-iframe, composition-preview, code-preview-iframe, code-preview-loading |
| `features/component-list/` | component-list-section, component-tree, component-item |
| `features/actions/` | actions-section |

### `hooks/`

- 루트: `useAuth`, `useBookmarks`, `useChatStream`, `useImageUpload`, `useRoom`
- `api/`: `useChatQuery`, `useCreateRoom`, `useDeleteMessage`, `useDeleteRoom`, `useDescriptionQuery`, `useRoomQuery`, `useUpdateRoom`
- `supabase/`: `useGetPaginatedMessages`, `useRoomChannel`, `useRoomsList`

### `lib/`

| 경로 | 역할 |
| --- | --- |
| `auth/actions.ts` | Magic Link · Google OAuth · `getIdToken()` |
| `auth/config.ts` | `PUBLIC_ROUTES`, `EMAIL_STORAGE_KEY` |
| `auth/verify-token.ts` | API Route JWT 검증 (service_role) |
| `supabase/client.ts` | Browser client (`createBrowserClient`) |
| `supabase/server.ts` | Server client (API Routes) |
| `supabase/middleware.ts` | 세션 쿠키 갱신 (`updateSession`) |
| `figma/` | `api.ts` · `extract-layout.ts` · `parse-url.ts` · `index.ts` — Figma 노드 추출 |
| `constants.ts`, `extraction-cache.ts`, `playwright-extractor.ts`, `schema-converter.ts`, `storybook-extractor.ts`, `utils.ts` (`cn`) |

### `stores/` (Zustand)

- `useAuthStore`, `useCodeGenerationStore`, `useDescriptionStore`, `useStreamingStore`

### `types/`

- `auth.ts`, `chat.ts`, `ds-extraction.ts`, `layout-schema.ts` — **DB 스키마 타입은 `@ds-hub/shared-types/typescript/database/`** 참조

---

## RSC 설계 가이드

| 구분 | Server Component (기본) | Client Component (`"use client"`) |
| --- | --- | --- |
| 용도 | 정적 마크업, 데이터 fetch | 상태, 이벤트, 브라우저 API |
| 예 | `HeaderLogo`, `RightPanel`, RSC page | `Header`, `DesktopLayout`, chat/* |

원칙: 정적 마크업은 Server, 인터랙티브 영역만 Client로 분리. Base UI 사용 영역은 `ClientOnly` + Skeleton fallback.

---

## 코드 컨벤션

### 파일 명명

| 타입 | 규칙 | 예 |
| --- | --- | --- |
| 컴포넌트 | kebab-case 파일명 · PascalCase export | `chat-header.tsx` → `ChatHeader` |
| 훅 | camelCase, `use` prefix | `useRoom.ts` |
| 유틸 | kebab 또는 camel | `parse-url.ts` |
| 스토어 | `use*Store` | `useAuthStore.ts` |

### 스타일 (CVA + `cn`)

```tsx
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('px-4 py-2 rounded-md', {
  variants: {
    variant: {
      primary: 'bg-blue-500 text-white',
      secondary: 'bg-gray-200 text-gray-900',
    },
  },
  defaultVariants: { variant: 'primary' },
});

<button className={cn(buttonVariants({ variant: 'primary' }), className)} {...props} />;
```

---

## Supabase 연동

| 항목 | 값 |
| --- | --- |
| Browser 클라이언트 | `lib/supabase/client.ts` |
| Server 클라이언트 | `lib/supabase/server.ts` |
| 세션 갱신 | `lib/supabase/middleware.ts#updateSession` (루트 `middleware.ts`에서 호출) |
| 인증 액션 | `lib/auth/actions.ts` (`sendSignInLink`, `signInWithGoogle`, `getIdToken`) |
| JWT 검증 | `lib/auth/verify-token.ts#verifySupabaseToken` |
| DB 타입 | `@ds-hub/shared-types/typescript/database/` (chat_rooms, chat_messages, description_*) |
| 테이블 | `chat_rooms`, `chat_messages`, description 버전 관리 테이블 |

### 아키텍처

```
Browser
  └─→ Next.js BFF (API Routes, verifySupabaseToken)
         ├─→ ai-service (X-API-Key + X-User-Id)
         └─→ Supabase (service_role)
```

### 규칙

1. **쿼리는 반드시 `user_id` 필터** (유저 격리)
2. **API Route는 `verifySupabaseToken` 먼저 호출**
3. **미들웨어는 `getUser()` 사용**, `getSession()` 금지 (신뢰 가능한 사용자 판별)
4. **DB 타입은 `@ds-hub/shared-types`에서만 import**, 로컬 재정의 금지

### 주요 훅 (파일 경로)

- 채팅방 목록: `hooks/supabase/useRoomsList.ts`
- 메시지 페이지네이션: `hooks/supabase/useGetPaginatedMessages.ts` (cursor 기반)
- Realtime Broadcast: `hooks/supabase/useRoomChannel.ts`

---

## 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY       # server-only
AI_SERVER_URL
X_API_KEY
```

---

## 알려진 이슈 / TODO

- **`middleware.ts` deprecated** — Next 16.2.x는 `proxy.ts` 파일 규칙 권장. 현재 그대로 동작하지만 Next 17 대비 이전 필요
- **`react-hooks/set-state-in-effect` 오탐 대상 (4개 파일)** — 수정 시 의도적 패턴임을 이해하고 작업:
  - `components/ui/client-only.tsx` — SSR hydration gate
  - `components/features/chat/hooks/use-selected-message.ts` — URL → state sync
  - `components/features/preview/code-preview-iframe.tsx` — 모듈 캐시 → state 복원
  - `components/features/preview/preview-section.tsx` — AI 코드 생성 시 tab 강제 전환
- **Dependabot** — 루트 워크스페이스 runtime 취약점 0건 (2026-04-23 기준). `storybook-standalone/` 59건(dev-only) 잔존, 별도 PR 예정

---

## 참조 문서

- 배포: [`apps/web/VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md)
- 기술 스택 상세: `docs/specs/03-tech-stack.md`
- API 스펙: `docs/specs/04-api-contract.md`
- AI 컴포넌트 사용 규칙: `docs/web/aplus-ui-props-guide.md`
