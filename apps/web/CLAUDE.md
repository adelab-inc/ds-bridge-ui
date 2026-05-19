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

#### Base UI Hydration 에러 방지

Base UI `^1.4.x`는 React 19의 `useId()` 훅을 내부적으로 사용하여 SSR/클라이언트 간 ID 불일치 발생 가능.

**작업 전 필수 확인:**

1. Context7 MCP로 `/mui/base-ui` 공식 문서에서 SSR 관련 내용 확인
2. 해당 컴포넌트의 hydration 이슈 여부 파악

**해결 패턴:**

- Base UI 컴포넌트 사용 영역을 `ClientOnly` 래퍼로 감싸기
- Skeleton fallback 제공하여 SSR 시 레이아웃 유지

**예시** (`components/layout/header.tsx` 참고):

```tsx
<header>
  <HeaderLogo /> {/* SSR 렌더링 */}
  <ClientOnly fallback={<Skeleton />}>
    <TooltipProvider>
      <InputGroup>...</InputGroup> {/* Base UI 사용 */}
    </TooltipProvider>
  </ClientOnly>
</header>
```

### Serena MCP (활성화 시 우선 사용)

Serena MCP 플러그인이 활성화되어 있는 경우, 코드베이스 탐색 및 편집 시 **Serena 도구를 우선 활용**할 것.

| 작업 | Serena 도구 | 비고 |
| --- | --- | --- |
| 심볼 탐색 | `get_symbols_overview`, `find_symbol` | 파일 전체를 읽기 전에 심볼 단위로 탐색 |
| 심볼 관계 파악 | `find_referencing_symbols` | 참조/의존 관계 추적 |
| 코드 편집 | `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol` | 심볼 단위 정밀 편집 |
| 텍스트 치환 | `replace_content` | 부분 수정 시 regex 기반 치환 |
| 파일/패턴 검색 | `find_file`, `search_for_pattern`, `list_dir` | 파일 시스템 탐색 |

#### 원칙

- **심볼 우선 접근**: 파일 전체를 읽기보다 `get_symbols_overview` → `find_symbol(include_body=True)`로 필요한 부분만 읽을 것
- **정밀 편집**: 전체 파일 재작성 대신 `replace_symbol_body`나 `replace_content`로 최소 범위만 수정
- **참조 안전성**: 심볼 수정 전 `find_referencing_symbols`로 영향 범위를 확인하고, 하위 호환이 깨지면 참조도 함께 수정

---

## @aplus/ui 디자인 시스템 사용 규칙

> ⚠️ **절대 금지**: `storybook-standalone/packages/ui/src/` 내부 파일 수정 또는 생성

### 금지 사항

| 금지                  | 설명                                                  |
| --------------------- | ----------------------------------------------------- |
| 컴포넌트 내부 수정 ❌ | Badge.tsx, Button.tsx 등 기존 컴포넌트 로직 변경 금지 |
| 새 컴포넌트 생성 ❌   | `src/components/` 폴더에 새 파일 생성 금지            |
| 스타일 수정 ❌        | variants, CVA 설정 등 스타일 관련 코드 변경 금지      |

### 허용 사항

| 허용             | 설명                                            |
| ---------------- | ----------------------------------------------- |
| Read Only ✅     | 컴포넌트 구조, props, 사용법 파악을 위한 읽기   |
| Export 추가 ✅   | `index.ts`에서 기존 컴포넌트 re-export 추가     |
| Import & 사용 ✅ | apps/web에서 @aplus/ui 컴포넌트 import하여 사용 |

### 컴포넌트 부족 시 해결 방법

1. **기존 컴포넌트 조합**: 필요한 UI를 기존 컴포넌트 조합으로 구현
2. **Re-export 추가**: 하위 컴포넌트가 필요하면 `index.ts`에 export 추가
   ```typescript
   // storybook-standalone/packages/ui/src/components/index.ts
   export { Heading } from './Menu/Heading'; // 하위 컴포넌트 re-export
   ```
3. **UMD 번들 재빌드**: export 추가 후 반드시 재빌드
   ```bash
   cd storybook-standalone/packages/ui && pnpm build:umd
   ```

### AI 컴포넌트 사용 가이드

AI가 컴포넌트를 올바르게 사용하도록 참고:

- 가이드: `docs/web/aplus-ui-props-guide.md`
- Badge: `statusVariant` prop 필수
- Chip: `children`으로 텍스트 전달
- Heading: div 기반, 커스텀 스타일 필요

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

Next.js 16 App Router 사용 시 Server/Client 컴포넌트 경계를 명확히 구분해야 함.

### 기본 원칙

| 구분   | Server Component (기본)          | Client Component (`"use client"`) |
| ------ | -------------------------------- | --------------------------------- |
| 지시어 | 없음 (기본값)                    | `"use client"` 필수               |
| 용도   | 정적 마크업, 데이터 fetch        | 인터랙션, 상태, 브라우저 API      |
| 예시   | `HeaderLogo`, `RightPanel`, page | `Header`, `DesktopLayout`, chat/* |

### 설계 패턴

**1. 정적/동적 분리** (9a15908 커밋 참고)

- 정적 마크업(`<div>`, `<main>`)은 Server Component (`page.tsx`)
- 인터랙티브 영역만 Client Component로 분리

**2. Base UI 사용 시 ClientOnly 래핑**

- Base UI 컴포넌트는 `useId()` 사용으로 hydration 이슈 발생
- `ClientOnly` 래퍼로 감싸고 Skeleton fallback 제공

**3. 컴포넌트 분리 기준**

- 정적 부분: Server Component로 분리 (예: `HeaderLogo`)
- 상태/이벤트 필요: Client Component 유지

### 참고 커밋

- `9a15908`: RSC 최적화를 위한 레이아웃 구조 개선
- `DesktopLayout`, `MobileLayout` 분리 및 `ClientOnly` 적용 패턴

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
| 세션 갱신 | `lib/supabase/middleware.ts#updateSession` (루트 `proxy.ts`에서 호출) |
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
