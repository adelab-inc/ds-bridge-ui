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

## Firebase 설정

### 초기화

Firebase는 `lib/firebase.ts`에서 초기화됩니다. 필요한 서비스를 import하여 사용:

```typescript
import { auth, db, storage } from "@/lib/firebase";

// Authentication
import { signInWithEmailAndPassword } from "firebase/auth";

// Firestore
import { collection, addDoc } from "firebase/firestore";

// Storage
import { ref, uploadBytes } from "firebase/storage";
```

### 환경 변수

`.env.local` 파일에 Firebase 설정을 추가하세요:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Firebase 훅

`hooks/firebase/` 디렉토리에 Firebase 관련 커스텀 훅이 있습니다:

#### useRealtimeMessages

Firestore 메시지를 실시간으로 구독하는 훅입니다. `onSnapshot`을 사용하여 자동으로 동기화됩니다.

```typescript
import { useRealtimeMessages } from "@/hooks/firebase/useRealtimeMessages";

function ChatComponent({ sessionId }: { sessionId: string }) {
  const { messages, isLoading, error } = useRealtimeMessages({
    sessionId,
    pageSize: 50, // optional
    callbacks: {
      onAdded: (msg) => {
        console.log('새 메시지:', msg);
        // 알림음 재생 등
      },
      onInitial: (msgs) => {
        console.log('초기 메시지 로드:', msgs.length);
      }
    }
  });

  if (isLoading) return <div>로딩 중...</div>;
  if (error) return <div>에러: {error}</div>;

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  );
}
```

**주요 기능:**
- Firestore `onSnapshot`을 사용한 실시간 동기화
- 메시지 추가/수정/삭제 자동 반영
- `sessionId`로 필터링
- 타임스탬프 기준 오름차순 정렬
- 선택적 콜백 지원 (onInitial, onAdded, onModified, onRemoved)

**주의:** 실시간 리스너는 컴포넌트 언마운트 시 자동으로 해제됩니다.

#### useGetPaginatedFbMessages

무한 스크롤 페이지네이션을 지원하는 메시지 fetch 훅입니다. TanStack Query의 `useInfiniteQuery`를 기반으로 합니다.

```typescript
import { useGetPaginatedFbMessages } from "@/hooks/firebase/useGetPaginatedFbMessages";

function ChatComponent({ sessionId }: { sessionId: string }) {
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isLoading,
    isFetchingNextPage 
  } = useGetPaginatedFbMessages({
    sessionId,
    pageSize: 20,
  });

  // data.pages는 ClientMessage[]의 배열
  const allMessages = data?.pages.flat() ?? [];

  return (
    <div>
      {allMessages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>
          {isFetchingNextPage ? '로딩 중...' : '더보기'}
        </button>
      )}
    </div>
  );
}
```

**주요 기능:**
- Firestore에서 `sessionId`로 필터링된 메시지 fetch
- `timestamp` 기준 역순 정렬 (최신 메시지가 먼저)
- 페이지당 `pageSize`만큼 로드
- TanStack Query의 캐싱 및 자동 리페치 활용

**타입:**
- `FirestoreMessage`: Firestore에 저장되는 메시지 타입
- `ClientMessage`: 클라이언트에서 사용하는 메시지 타입 (ChatMessage 호환)

#### messageUtils

메시지 타입 변환 및 유틸리티 함수:

```typescript
import { 
  firestoreToClientMessage,
  clientToFirestoreMessage,
  MESSAGES_COLLECTION 
} from "@/hooks/firebase/messageUtils";

// Firestore 문서 → 클라이언트 메시지
const clientMsg = firestoreToClientMessage(firestoreDoc);

// 클라이언트 메시지 → Firestore 문서 (저장용)
const firestoreData = clientToFirestoreMessage(clientMsg, sessionId, userId);

// 컬렉션 이름 사용 (shared-types에서 자동 생성됨)
import { collection } from 'firebase/firestore';
const messagesRef = collection(db, MESSAGES_COLLECTION); // 'chat_messages'
```

**중요:** 컬렉션 이름은 `@packages/shared-types/typescript/firebase/collections.ts`에서 관리되며, `COLLECTIONS.CHAT_MESSAGES`를 통해 타입 안전하게 사용됩니다.

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
