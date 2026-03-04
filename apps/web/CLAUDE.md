# DS-Bridge UI - Web Frontend

> Next.js 16 기반 디자인 시스템 런타임 허브 프론트엔드

## 도구 우선순위: Serena MCP 플러그인

Serena MCP 플러그인이 활성화되어 있는 경우, 코드베이스 탐색 및 편집 시 **Serena 도구를 우선 활용**할 것.

| 작업 | Serena 도구 | 비고 |
| --- | --- | --- |
| 심볼 탐색 | `get_symbols_overview`, `find_symbol` | 파일 전체를 읽기 전에 심볼 단위로 탐색 |
| 심볼 관계 파악 | `find_referencing_symbols` | 참조/의존 관계 추적 |
| 코드 편집 | `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol` | 심볼 단위 정밀 편집 |
| 텍스트 치환 | `replace_content` | 부분 수정 시 regex 기반 치환 |
| 파일/패턴 검색 | `find_file`, `search_for_pattern`, `list_dir` | 파일 시스템 탐색 |

### 원칙

- **심볼 우선 접근**: 파일 전체를 읽기보다 `get_symbols_overview` → `find_symbol(include_body=True)`로 필요한 부분만 읽을 것
- **정밀 편집**: 전체 파일 재작성 대신 `replace_symbol_body`나 `replace_content`로 최소 범위만 수정
- **참조 안전성**: 심볼 수정 전 `find_referencing_symbols`로 영향 범위를 확인하고, 하위 호환이 깨지면 참조도 함께 수정

## 기술 스택

| 기술                   | 버전    | 용도                            |
| ---------------------- | ------- | ------------------------------- |
| Next.js                | 16.1.1  | App Router, SSR                 |
| React                  | 19.2.3  | UI 컴포넌트                     |
| TypeScript             | 5.x     | strict 모드                     |
| Tailwind CSS           | 4.x     | 유틸리티 스타일링               |
| Base UI                | 1.0.0   | Headless 컴포넌트               |
| shadcn/ui              | 3.6.3   | 스타일 프리셋                   |
| Hugeicons              | 1.1.4   | 아이콘 라이브러리               |
| react-resizable-panels | 4.3.0   | 리사이즈 패널 레이아웃          |
| TanStack Query         | 5.90.16 | 서버 상태 관리, 데이터 fetching |
| Supabase               | @supabase/ssr 0.8.0 | Auth, DB, Realtime          |

## 중요: 공식 문서 확인 필수

> **Context7 MCP를 통해 공식 문서를 반드시 확인 후 작업할 것**

아래 라이브러리 작업 시 API가 자주 변경되므로 Context7로 최신 문서 확인 필수:

| 라이브러리             | Context7 Library ID               | 확인 사항                   |
| ---------------------- | --------------------------------- | --------------------------- |
| Base UI                | `/mui/base-ui`                    | SSR/Hydration, 컴포넌트 API |
| react-resizable-panels | `/bvaughn/react-resizable-panels` | Panel props, CSS 단위 지원  |

### 주의사항

- **react-resizable-panels**: `minSize`/`maxSize`는 CSS 단위 문자열(`"280px"`) 사용 권장
- **Base UI**: `useId()` 사용으로 SSR Hydration 이슈 발생 가능 → `ClientOnly` 래퍼 필요
- **shadcn/ui**: Base UI 기반이므로 동일한 주의사항 적용

### Base UI Hydration 에러 방지

Base UI v1.0.0은 React 19의 `useId()` 훅을 내부적으로 사용하여 SSR/클라이언트 간 ID 불일치 발생 가능.

**작업 전 필수 확인:**

1. Context7 MCP로 `/mui/base-ui` 공식 문서에서 SSR 관련 내용 확인
2. 해당 컴포넌트의 hydration 이슈 여부 파악

**해결 패턴:**

- Base UI 컴포넌트 사용 영역을 `ClientOnly` 래퍼로 감싸기
- Skeleton fallback 제공하여 SSR 시 레이아웃 유지

**예시** (header.tsx 참고):

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

## 중요: @aplus/ui 디자인 시스템 사용 규칙

> ⚠️ **절대 금지**: `storybook-standalone/packages/ui/src/` 내부 파일 수정 또는 생성

### 금지 사항

| 금지                  | 설명                                                  |
| --------------------- | ----------------------------------------------------- |
| 컴포넌트 내부 수정 ❌ | Badge.tsx, Button.tsx 등 기존 컴포넌트 로직 변경 금지 |
| 새 컴포넌트 생성 ❌   | src/components/ 폴더에 새 파일 생성 금지              |
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

## 디렉토리 구조

```
apps/web/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 홈페이지
│   └── globals.css         # 전역 스타일
│
├── components/             # React 컴포넌트
│   ├── ui/                 # shadcn 기본 컴포넌트
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...             # 총 13개 컴포넌트
│   ├── layout/             # 레이아웃 컴포넌트
│   └── features/           # 기능별 컴포넌트
│       └── chat/           # 채팅 기능
│
├── hooks/                  # 커스텀 훅
│   ├── api/                # API 연동 훅
│   │   ├── useCreateRoom.ts # 채팅방 생성
│   │   ├── useRoomQuery.ts  # 채팅방 조회
│   │   └── useChatQuery.ts  # 채팅 쿼리
│   └── supabase/           # Supabase 관련 훅
│       ├── useRoomsList.ts  # 채팅방 목록 조회
│       ├── useRoomChannel.ts # Broadcast 채널
│       └── useGetPaginatedMessages.ts # 페이지네이션
│
├── lib/
│   ├── utils.ts            # cn() 유틸리티
│   ├── constants.ts        # 상수 정의
│   ├── auth/               # 인증 관련
│   │   ├── actions.ts      # signIn, signOut, getIdToken
│   │   ├── config.ts       # PUBLIC_ROUTES, EMAIL_STORAGE_KEY
│   │   └── verify-token.ts # JWT 검증 (service_role)
│   └── supabase/           # Supabase 클라이언트
│       ├── client.ts       # Browser client
│       ├── server.ts       # Server client
│       └── middleware.ts   # 세션 갱신
│
└── package.json            # @ds-hub/web
```

## RSC (React Server Components) 설계 가이드라인

Next.js 16 App Router 사용 시 Server/Client 컴포넌트 경계를 명확히 구분해야 함.

### 기본 원칙

| 구분   | Server Component          | Client Component             |
| ------ | ------------------------- | ---------------------------- |
| 지시어 | 없음 (기본값)             | `"use client"` 필수          |
| 용도   | 정적 마크업, 데이터 fetch | 인터랙션, 상태, 브라우저 API |
| 예시   | HeaderLogo, RightPanel    | Header, DesktopLayout        |

### 설계 패턴

**1. 정적/동적 분리** (9a15908 커밋 참고)

- 정적 마크업(`<div>`, `<main>`)은 Server Component (page.tsx)
- 인터랙티브 영역만 Client Component로 분리

**2. Base UI 사용 시 ClientOnly 래핑**

- Base UI 컴포넌트는 `useId()` 사용으로 hydration 이슈 발생
- `ClientOnly` 래퍼로 감싸고 Skeleton fallback 제공

**3. 컴포넌트 분리 기준**

- 정적 부분: Server Component로 분리 (예: HeaderLogo)
- 상태/이벤트 필요: Client Component 유지

### 참고 커밋

- `9a15908`: RSC 최적화를 위한 레이아웃 구조 개선
- DesktopLayout, MobileLayout 분리 및 ClientOnly 적용 패턴

## 코드 컨벤션

### 파일 명명

| 타입     | 규칙              | 예시            |
| -------- | ----------------- | --------------- |
| 컴포넌트 | PascalCase        | `ChatPanel.tsx` |
| 훅       | use + camelCase   | `useChat.ts`    |
| 유틸     | camelCase         | `parser.ts`     |
| 스토어   | camelCase + Store | `chatStore.ts`  |

### TypeScript

```typescript
// Props 인터페이스 정의
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

// forwardRef 패턴
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />
  )
);
```

### 스타일링 (CVA + cn)

```typescript
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// variants 정의
const buttonVariants = cva("px-4 py-2 rounded-md", {
  variants: {
    variant: {
      primary: "bg-blue-500 text-white",
      secondary: "bg-gray-200 text-gray-900"
    }
  },
  defaultVariants: {
    variant: "primary"
  }
});

// 사용
<Button className={cn("custom-class")} variant="primary" />
```

## UI 컴포넌트 현황

### 구현됨 (components/ui/)

- AlertDialog, Badge, Button, Card
- Collapsible, Combobox, DropdownMenu
- Field, Input, InputGroup, Label
- Resizable, ScrollArea, Select
- Separator, Tabs, Textarea, Tooltip
- ClientOnly (SSR Hydration 래퍼)

### 구현됨 (components/layout/)

- Header, LeftPanel, RightPanel
- MainLayout (리사이즈 패널)
- MobileSheet (모바일 바텀시트)

### 구현됨 (components/features/)

- Chat: ChatSection, ChatInput, ChatMessage, ChatMessageList
- ComponentList: ComponentListSection, ComponentItem, ComponentTree
- Actions: ActionsSection
- Preview: PreviewSection, StorybookIframe, CompositionPreview

## 개발 명령어

```bash
# 개발 서버 (localhost:3000)
pnpm dev

# 프로덕션 빌드
pnpm build

# 린트
pnpm lint

# 타입 체크
pnpm typecheck
```

## 경로 Alias

```json
// tsconfig.json
{
  "paths": {
    "@/*": ["./*"]
  }
}
```

사용: `import { Button } from "@/components/ui/button"`

## Supabase 연동

### Quick Reference

| 항목      | 값                                              |
| --------- | ----------------------------------------------- |
| SDK       | @supabase/ssr 0.8.0, @supabase/supabase-js 2.97.0 |
| 클라이언트 | `lib/supabase/client.ts` (Browser), `lib/supabase/server.ts` (Server) |
| 인증      | `lib/auth/actions.ts` (Magic Link + Google OAuth) |
| 훅 위치   | `hooks/supabase/`                               |
| 타입 소스 | `@packages/shared-types/typescript/database/`   |
| 테이블    | `chat_rooms`, `chat_messages`                   |

### 아키텍처

```
Browser → BFF (Next.js API Routes, Supabase Auth 검증) → ai-service (X-API-Key + X-User-Id)
                                                        → Supabase DB (service_role)
```

### 인증 플로우

```typescript
// Magic Link 로그인
import { sendSignInLink } from '@/lib/auth/actions';
await sendSignInLink(email); // OTP magic link 발송

// Google OAuth 로그인
import { signInWithGoogle } from '@/lib/auth/actions';
await signInWithGoogle(); // Google 동의 화면으로 리다이렉트

// 토큰 가져오기 (API 호출용)
import { getIdToken } from '@/lib/auth/actions';
const token = await getIdToken(); // access_token 반환

// API Route에서 토큰 검증
import { verifySupabaseToken } from '@/lib/auth/verify-token';
const decoded = await verifySupabaseToken(req.headers.get('authorization'));
// → { uid: string, email?: string } | null
```

### 데이터 타입

```typescript
import type { ChatRoom, ChatMessage } from '@packages/shared-types/typescript/database/types';

interface ChatRoom {
  id: string;           // UUID
  storybook_url: string;
  user_id: string;
  created_at: number;   // ms timestamp
}

interface ChatMessage {
  id: string;
  room_id: string;
  question: string;
  text: string;
  content: string;
  path: string;
  question_created_at: number;
  answer_created_at: number;
  status: 'GENERATING' | 'DONE' | 'ERROR';
}
```

### Supabase 훅

#### useRoomsList - 채팅방 목록

```typescript
import { useRoomsList } from '@/hooks/supabase/useRoomsList';
const { rooms, isLoading, error } = useRoomsList();
```

- TanStack Query 기반, `user_id` 필터 + `created_at DESC` 정렬
- 채팅방 생성 시 자동 캐시 무효화

#### useGetPaginatedMessages - 메시지 페이지네이션

```typescript
import { useGetPaginatedMessages } from '@/hooks/supabase/useGetPaginatedMessages';
```

- cursor 기반 페이지네이션

#### useRoomChannel - Broadcast 채널

```typescript
import { useRoomChannel } from '@/hooks/supabase/useRoomChannel';
```

- Supabase Realtime Broadcast 기반 실시간 스트리밍

### 환경 변수

```bash
# .env.local (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # server-only
```

### 규칙

1. **타입**: `@packages/shared-types/typescript/database/types` 사용
2. **쿼리**: `user_id` 필터 필수 (유저 격리)
3. **인증**: API Route에서 `verifySupabaseToken` 사용 필수
4. **미들웨어**: `getUser()` 사용 권장 (`getSession` 아닌)

## Vercel 배포 (모노레포)

### GitHub 연동 배포

1. **Vercel 프로젝트 생성**
   - Vercel 대시보드에서 "Add New Project"
   - GitHub 저장소 선택

2. **모노레포 설정**
   - Root Directory: `apps/web` 설정
   - Framework Preset: Next.js (자동 감지)
   - Build Settings는 `vercel.json`에서 자동 적용됨

3. **환경 변수 설정**

   Vercel 대시보드 → Settings → Environment Variables에 추가:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SERVICE_ROLE_KEY
   AI_SERVER_URL
   X_API_KEY
   ```

4. **배포**
   - `main` 브랜치에 push하면 자동 배포
   - PR 생성 시 Preview 배포 자동 생성

### vercel.json 설정

모노레포 환경에서 빌드 명령어가 루트에서 실행되도록 설정:

```json
{
  "buildCommand": "cd ../.. && pnpm install && pnpm --filter @ds-hub/web build",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

## 참조 문서

| 문서                                                               | 내용           |
| ------------------------------------------------------------------ | -------------- |
| [03-tech-stack.md](/docs/specs/03-tech-stack.md)                   | 기술 스택 상세 |
| [06-directory-structure.md](/docs/specs/06-directory-structure.md) | 디렉토리 구조  |
| [04-api-contract.md](/docs/specs/04-api-contract.md)               | API 스펙       |

## 현재 상태

**Phase 1 완료** - UI 레이아웃, 기본 컴포넌트, Supabase Auth 마이그레이션 완료

- Supabase Auth (Magic Link + Google OAuth)
- Zustand 상태 관리 스토어
- API 라우트 (BFF 패턴, Supabase JWT 검증)
- Supabase Realtime Broadcast 기반 채팅 스트리밍
