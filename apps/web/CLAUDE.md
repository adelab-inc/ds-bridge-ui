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
│   └── utils.ts            # cn() 유틸리티
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
- Combobox, DropdownMenu, Field
- Input, InputGroup, Label
- Select, Separator, Textarea

### 미구현 (계획)

- Chat UI 컴포넌트
- Composition 관리 컴포넌트
- Preview 렌더러

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

## 참조 문서

| 문서 | 내용 |
|------|------|
| [03-tech-stack.md](/docs/specs/03-tech-stack.md) | 기술 스택 상세 |
| [06-directory-structure.md](/docs/specs/06-directory-structure.md) | 디렉토리 구조 |
| [04-api-contract.md](/docs/specs/04-api-contract.md) | API 스펙 |

## 현재 상태

**MVP 단계** - 기본 UI 컴포넌트 구현 완료

### 다음 구현 예정

1. Zustand 상태 관리 스토어
2. Chat 인터페이스 컴포넌트
3. API 라우트 (BFF 패턴)
4. Storybook Parser 로직
