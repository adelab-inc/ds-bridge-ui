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
│   └── *.tsx               # 기능 컴포넌트
│
├── lib/
│   ├── utils.ts            # cn() 유틸리티
│   ├── constants.ts        # 상수 정의
│   └── firebase.ts         # Firebase 초기화
│
└── package.json            # @ds-hub/web
```

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
