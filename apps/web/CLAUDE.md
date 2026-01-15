# DS-Bridge UI - Web Frontend

> Next.js 16 기반 디자인 시스템 런타임 허브 프론트엔드

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16.1.1 | App Router, SSR |
| React | 19.2.3 | UI 컴포넌트 |
| TypeScript | 5.x | strict 모드 |
| Tailwind CSS | 4.x | 유틸리티 스타일링 |
| Base UI | 1.0.0 | Headless 컴포넌트 |
| shadcn/ui | 3.6.3 | 스타일 프리셋 |
| Hugeicons | 1.1.4 | 아이콘 라이브러리 |
| react-resizable-panels | 4.3.0 | 리사이즈 패널 레이아웃 |
| TanStack Query | 5.90.16 | 서버 상태 관리, 데이터 fetching |
| Firebase | 12.7.0 | Auth, Firestore, Storage |

## 중요: 공식 문서 확인 필수

> **Context7 MCP를 통해 공식 문서를 반드시 확인 후 작업할 것**

아래 라이브러리 작업 시 API가 자주 변경되므로 Context7로 최신 문서 확인 필수:

| 라이브러리 | Context7 Library ID | 확인 사항 |
|-----------|---------------------|----------|
| Base UI | `/mui/base-ui` | SSR/Hydration, 컴포넌트 API |
| react-resizable-panels | `/bvaughn/react-resizable-panels` | Panel props, CSS 단위 지원 |

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
  <HeaderLogo />  {/* SSR 렌더링 */}
  <ClientOnly fallback={<Skeleton />}>
    <TooltipProvider>
      <InputGroup>...</InputGroup>  {/* Base UI 사용 */}
    </TooltipProvider>
  </ClientOnly>
</header>
```

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
│   └── firebase/           # Firebase 관련 훅
│       ├── messageUtils.ts # 메시지 타입 & 유틸
│       ├── useGetPaginatedFbMessages.ts # 페이지네이션
│       └── useRealtimeMessages.ts # 실시간 구독
│
├── lib/
│   ├── utils.ts            # cn() 유틸리티
│   ├── constants.ts        # 상수 정의
│   └── firebase.ts         # Firebase 초기화
│
└── package.json            # @ds-hub/web
```

## RSC (React Server Components) 설계 가이드라인

Next.js 16 App Router 사용 시 Server/Client 컴포넌트 경계를 명확히 구분해야 함.

### 기본 원칙

| 구분 | Server Component | Client Component |
|------|-----------------|------------------|
| 지시어 | 없음 (기본값) | `"use client"` 필수 |
| 용도 | 정적 마크업, 데이터 fetch | 인터랙션, 상태, 브라우저 API |
| 예시 | HeaderLogo, RightPanel | Header, DesktopLayout |

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

| 타입 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `ChatPanel.tsx` |
| 훅 | use + camelCase | `useChat.ts` |
| 유틸 | camelCase | `parser.ts` |
| 스토어 | camelCase + Store | `chatStore.ts` |

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

## Firebase 연동

### Quick Reference

| 항목 | 값 |
|------|-----|
| SDK | firebase 12.7.0 |
| 초기화 | `lib/firebase.ts` |
| 훅 위치 | `hooks/firebase/` |
| 타입 소스 | `@packages/shared-types/typescript/firebase/` |
| 컬렉션 | `chat_messages`, `chat_rooms` |

### 서비스 인스턴스

```typescript
// lib/firebase.ts에서 export됨
import { firebaseFirestore } from "@/lib/firebase";

// Firestore 사용 (주로 사용)
import { collection, query, where, onSnapshot } from "firebase/firestore";
```

### 컬렉션 & 타입

```typescript
// 컬렉션 이름은 반드시 상수 사용
import { COLLECTIONS } from '@packages/shared-types/typescript/firebase/collections';
import type { ChatMessage } from '@packages/shared-types/typescript/firebase/types';

// 또는 훅에서 re-export된 것 사용
import { MESSAGES_COLLECTION, type ChatMessage } from "@/hooks/firebase/messageUtils";

const messagesRef = collection(db, COLLECTIONS.CHAT_MESSAGES);  // 'chat_messages'
```

**ChatMessage 타입**:
```typescript
interface ChatMessage {
  id: string;
  room_id: string;
  question: string;           // 사용자 질문
  text: string;               // AI 텍스트 응답
  content: string;            // React 코드
  path: string;               // 파일 경로
  question_created_at: number; // ms timestamp
  answer_created_at: number;
  status: 'GENERATING' | 'DONE' | 'ERROR';
}
```

### Firebase 훅

#### useRealtimeMessages - 실시간 구독

```typescript
import { useRealtimeMessages } from "@/hooks/firebase/useRealtimeMessages";

const { messages, isLoading, error } = useRealtimeMessages({
  sessionId: roomId,      // 필수
  pageSize: 50,           // 선택
  callbacks: {            // 선택
    onAdded: (msg) => playSound(),
    onInitial: (msgs) => console.log('loaded', msgs.length),
  }
});
```

- `onSnapshot` 사용 → 자동 실시간 동기화
- 언마운트 시 자동 구독 해제
- `question_created_at` 기준 내림차순 정렬

#### useGetPaginatedFbMessages - 무한 스크롤

```typescript
import { useGetPaginatedFbMessages } from "@/hooks/firebase/useGetPaginatedFbMessages";

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetPaginatedFbMessages({
  roomId,
  pageSize: 20,
  infiniteQueryOptions: { enabled: !!roomId }
});

const allMessages = data?.pages.flat() ?? [];
```

- TanStack Query `useInfiniteQuery` 기반
- timestamp 기준 역순 페이지네이션
- 5분 staleTime 캐싱

### 환경 변수

```bash
# .env.local (필수)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

### 규칙

1. **컬렉션 이름**: `COLLECTIONS` 상수 필수 (하드코딩 금지)
2. **타입**: `@packages/shared-types` 타입 사용
3. **쿼리**: `room_id` 필터 + `question_created_at` 정렬
4. **인덱스**: 복합 쿼리 시 Firestore 인덱스 생성 필요

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
   NEXT_PUBLIC_FIREBASE_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   NEXT_PUBLIC_FIREBASE_APP_ID
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
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

| 문서 | 내용 |
|------|------|
| [03-tech-stack.md](/docs/specs/03-tech-stack.md) | 기술 스택 상세 |
| [06-directory-structure.md](/docs/specs/06-directory-structure.md) | 디렉토리 구조 |
| [04-api-contract.md](/docs/specs/04-api-contract.md) | API 스펙 |

## 현재 상태

**Phase 1 완료** - UI 레이아웃 및 기본 컴포넌트 구현 완료

### 다음 구현 예정

1. Zustand 상태 관리 스토어
2. API 라우트 (BFF 패턴)
3. Storybook Parser 로직
4. AI Chat 연동
