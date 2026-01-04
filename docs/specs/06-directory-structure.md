# 06. 디렉토리 구조

> **대상 독자**: FE 개발자, AI 개발자 (필수), PM (참고)

## TL;DR

- **단일 Next.js 앱**: 모노레포 없이 단순한 프로젝트 구조
- **명확한 소유권**: 각 디렉토리별 담당자 지정
- **공유 타입**: FE/AI 계약 관리를 위한 `types/`

---

## 프로젝트 구조 개요

```
ds-runtime-hub/
│
├── 📁 app/                       # Next.js App Router
│   ├── 📁 api/                   # API Routes
│   └── 📁 (main)/                # 메인 페이지
│
├── 📁 components/                # React 컴포넌트
│   ├── 📁 chat/                  # 🟩 AI Dev - Chat UI
│   ├── 📁 composition/           # 🟦 FE Dev - Composition
│   ├── 📁 layout/                # 🟦 FE Dev - 레이아웃
│   ├── 📁 preview/               # 🟦 FE Dev - 미리보기
│   └── 📁 ui/                    # 🟦 FE Dev - 기본 UI
│
├── 📁 lib/                       # 유틸리티 & 헬퍼
│   ├── 📁 storybook/             # 🟦 FE Dev - Parser
│   ├── 📁 ai/                    # 🟩 AI Dev - Claude 연동
│   └── 📁 utils/                 # 🟩 공유 유틸리티
│
├── 📁 types/                     # 🟩 공유 - 타입 정의
│
├── 📁 stores/                    # 🟦 FE Dev - Zustand stores
│
├── 📁 hooks/                     # 🟦 FE Dev - 커스텀 훅
│
├── 📁 docs/                      # 📚 문서
│
├── 📄 next.config.js
├── 📄 tailwind.config.js
├── 📄 tsconfig.json
├── 📄 package.json
└── 📄 README.md
```

**범례**
- 🟦 FE 개발자 담당
- 🟨 AI 개발자 담당
- 🟩 공동 담당

---

## app/ - Next.js App Router

### app/api/ - API Routes

```
app/api/
├── 📁 storybook/
│   └── 📁 parse/
│       └── 📄 route.ts           # POST /api/storybook/parse
│
├── 📁 chat/
│   └── 📄 route.ts               # POST /api/chat (SSE)
│
├── 📁 composition/
│   └── 📄 route.ts               # POST /api/composition
│
├── 📁 export/
│   └── 📁 copy-for-ai/
│       └── 📄 route.ts           # POST /api/export/copy-for-ai
│
└── 📁 tokens/
    └── 📁 extract/
        └── 📄 route.ts           # POST /api/tokens/extract
```

### app/(main)/ - 메인 페이지

```
app/
├── 📄 layout.tsx                 # 루트 레이아웃
├── 📄 globals.css                # 전역 스타일
│
└── 📁 (main)/
    ├── 📄 layout.tsx             # 패널이 있는 메인 레이아웃
    ├── 📄 page.tsx               # 홈 페이지 (/)
    └── 📄 loading.tsx            # 로딩 상태
```

---

## components/ - React 컴포넌트

### components/layout/ 🟦

메인 레이아웃 컴포넌트.

```
components/layout/
├── 📄 Header.tsx                 # 로고, URL 입력, Upload JSON
├── 📄 LeftPanel.tsx              # Chat + Component 목록 + Actions
├── 📄 RightPanel.tsx             # Storybook iframe / Preview
├── 📄 PanelResizer.tsx           # 리사이즈 가능한 패널 구분선
└── 📄 index.ts
```

### components/chat/ 🟨🟦

채팅 인터페이스 컴포넌트.

```
components/chat/
├── 📄 ChatPanel.tsx              # 메인 채팅 컨테이너
├── 📄 ChatMessages.tsx           # 스트리밍이 있는 메시지 목록
├── 📄 ChatInput.tsx              # 메시지 입력 필드
├── 📄 ChatMessage.tsx            # 단일 메시지 버블
├── 📄 ActionButton.tsx           # AI의 클릭 가능한 액션
└── 📄 index.ts
```

### components/composition/ 🟦

페이지 composition 관리.

```
components/composition/
├── 📄 CompositionPanel.tsx       # Composition 관리자
├── 📄 CompositionNode.tsx        # Composition 내 단일 컴포넌트
├── 📄 CompositionPreview.tsx     # 렌더링된 미리보기
├── 📄 PropsEditor.tsx            # 동적 props 폼
└── 📄 index.ts
```

### components/preview/ 🟦

Storybook 미리보기 및 iframe 처리.

```
components/preview/
├── 📄 PreviewFrame.tsx           # Storybook iframe 래퍼
├── 📄 ComponentList.tsx          # 접히는 컴포넌트 트리
├── 📄 ComponentItem.tsx          # 목록 내 단일 컴포넌트
├── 📄 StoryList.tsx              # Story variants
└── 📄 index.ts
```

### components/ui/ 🟦

기본 UI 컴포넌트 (Radix primitives).

```
components/ui/
├── 📄 Button.tsx
├── 📄 Input.tsx
├── 📄 Card.tsx
├── 📄 Dialog.tsx
├── 📄 Tabs.tsx
├── 📄 Collapsible.tsx
├── 📄 Tooltip.tsx
├── 📄 Toast.tsx
└── 📄 index.ts
```

---

## lib/ - 유틸리티 & 헬퍼

### lib/storybook/ 🟦

Storybook 파싱 유틸리티.

```
lib/storybook/
├── 📄 parser.ts                  # stories.json / index.json 파싱
├── 📄 transformer.ts             # ds.json으로 변환
├── 📄 validators.ts              # URL 및 데이터 유효성 검사
└── 📄 index.ts
```

**주요 함수**:
```typescript
// lib/storybook/parser.ts
export async function parseStorybookUrl(url: string): Promise<RawStorybookData>;

// lib/storybook/transformer.ts
export function transformToDsJson(raw: RawStorybookData, sourceUrl: string): DSJson;
```

### lib/ai/ 🟨

Claude API 연동 및 프롬프트 관리.

```
lib/ai/
├── 📄 client.ts                  # Claude API 클라이언트
├── 📄 prompts.ts                 # System prompt 템플릿
├── 📄 actions.ts                 # Action 파싱 로직
├── 📄 streaming.ts               # SSE 스트리밍 유틸리티
└── 📄 index.ts
```

**주요 함수**:
```typescript
// lib/ai/client.ts
export async function streamChatResponse(
  dsJson: DSJson,
  messages: ChatMessage[],
  composition?: Composition
): AsyncGenerator<ChatChunk>;

// lib/ai/prompts.ts
export function buildSystemPrompt(
  dsJson: DSJson,
  composition?: Composition
): string;

// lib/ai/actions.ts
export function parseActions(content: string): ChatAction[];
```

### lib/utils/ 🟩

공유 유틸리티 함수.

```
lib/utils/
├── 📄 cn.ts                      # classnames 유틸리티
├── 📄 clipboard.ts               # Clipboard API 헬퍼
├── 📄 format.ts                  # 포맷팅 유틸리티
└── 📄 index.ts
```

---

## types/ - 공유 타입 정의 🟩

**FE ↔ AI 협업에 핵심적**. 양 팀 모두 변경 사항 리뷰 필수.

```
types/
├── 📄 ds-json.ts                 # DSJson, Component, Story, Tokens
├── 📄 composition.ts             # Composition, CompositionNode
├── 📄 chat.ts                    # ChatMessage, ChatAction, ChatResponse
├── 📄 api.ts                     # Request/Response 타입
└── 📄 index.ts                   # 모든 타입 re-export
```

### ds-json.ts

```typescript
// 핵심 DS 구조
export interface DSJson { ... }
export interface Component { ... }
export interface PropDefinition { ... }
export interface Story { ... }
export interface DesignTokens { ... }
```

### composition.ts

```typescript
// 페이지 composition
export interface Composition { ... }
export interface CompositionNode { ... }
```

### chat.ts

```typescript
// 채팅 타입
export interface ChatMessage { ... }
export interface ChatAction { ... }
export interface ChatResponse { ... }
export type ChatActionType =
  | 'show_component'
  | 'show_props'
  | 'add_to_composition'
  | 'navigate';
```

### api.ts

```typescript
// API 타입
export interface StorybookParseRequest { ... }
export interface StorybookParseResponse { ... }
export interface ChatRequest { ... }
export interface CopyForAIRequest { ... }
export interface ErrorResponse { ... }
```

---

## stores/ - 상태 관리 🟦

애플리케이션 상태를 위한 Zustand stores.

```
stores/
├── 📄 dsStore.ts                 # DS 데이터 상태
├── 📄 compositionStore.ts        # Composition 상태
├── 📄 chatStore.ts               # 채팅 메시지 상태
├── 📄 uiStore.ts                 # UI 상태 (패널, 탭)
└── 📄 index.ts
```

### Store Slices

```typescript
// stores/dsStore.ts
interface DSStore {
  dsJson: DSJson | null;
  loadingState: 'idle' | 'parsing' | 'ready' | 'error';
  error: string | null;
  selectedComponent: string | null;
  selectedStory: string | null;
  setDsJson: (ds: DSJson) => void;
  selectComponent: (id: string) => void;
}

// stores/compositionStore.ts
interface CompositionStore {
  composition: Composition | null;
  addNode: (node: CompositionNode) => void;
  removeNode: (nodeId: string) => void;
  updateProps: (nodeId: string, props: Record<string, any>) => void;
}

// stores/chatStore.ts
interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  addMessage: (msg: ChatMessage) => void;
  setStreaming: (val: boolean) => void;
}
```

---

## hooks/ - 커스텀 훅 🟦

공통 기능을 위한 React 훅.

```
hooks/
├── 📄 useStorybookParser.ts      # Storybook URL 파싱
├── 📄 useChat.ts                 # 스트리밍 채팅
├── 📄 useComposition.ts          # Composition 작업
├── 📄 useCopyForAI.ts            # 프롬프트 생성 및 복사
├── 📄 useLocalStorage.ts         # 로컬 데이터 유지
└── 📄 index.ts
```

### 훅 예시

```typescript
// hooks/useStorybookParser.ts
export function useStorybookParser() {
  const setDsJson = useDSStore((s) => s.setDsJson);

  async function parse(url: string) {
    const response = await fetch('/api/storybook/parse', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    const data = await response.json();
    if (data.success) setDsJson(data.data);
  }

  return { parse };
}

// hooks/useChat.ts
export function useChat() {
  const { messages, addMessage, setStreaming } = useChatStore();
  const dsJson = useDSStore((s) => s.dsJson);

  async function send(content: string) {
    addMessage({ role: 'user', content });
    setStreaming(true);

    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ dsJson, messages })
    });

    // SSE 스트리밍 처리...
  }

  return { messages, send };
}
```

---

## CLI 패키지 (별도) 🟨

로컬 DS 추출을 위한 별도 npm 패키지.

```
ds-hub-cli/                       # 별도 저장소
├── 📁 src/
│   ├── 📄 index.ts               # CLI 엔트리 포인트
│   ├── 📄 extractor.ts           # Storybook 추출
│   ├── 📄 tokenParser.ts         # 토큰 파일 파싱
│   └── 📄 output.ts              # ds.json 생성
│
├── 📄 package.json               # "ds-hub-cli"
├── 📄 tsconfig.json
└── 📄 README.md
```

**사용법**:
```bash
npx ds-hub extract --output ./ds.json --include-tokens
```

---

## 설정 파일

### package.json

```json
{
  "name": "ds-runtime-hub",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "zustand": "^4.0.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-tabs": "^1.0.0",
    "@radix-ui/react-collapsible": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tailwindcss": "^3.0.0",
    "@types/react": "^18.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

---

## 디렉토리 소유권 요약

| 디렉토리 | 담당 | 책임 |
|----------|------|------|
| `app/api/storybook` | FE | Storybook URL 파싱 |
| `app/api/chat` | AI | Claude API 스트리밍 |
| `app/api/tokens` | AI | 토큰 추출 |
| `components/chat` | 공동 | Chat UI + 액션 처리 |
| `components/composition` | FE | Composition 관리 |
| `components/preview` | FE | Storybook iframe |
| `lib/storybook` | FE | 파싱 로직 |
| `lib/ai` | AI | Claude 연동 |
| `types/` | 공동 | 계약 타입 (PR 승인 필요) |
| `stores/` | FE | 상태 관리 |
| `hooks/` | FE | React 훅 |

---

## 파일 명명 규칙

### 컴포넌트

| 유형 | 규칙 | 예시 |
|------|------|------|
| React Component | PascalCase | `ChatPanel.tsx` |
| Hook | camelCase + use | `useChat.ts` |
| Utility | camelCase | `parser.ts` |
| Type Definition | camelCase | `ds-json.ts` |
| Store | camelCase + Store | `chatStore.ts` |

### Import 패턴

```typescript
// 절대 경로 import (권장)
import { DSJson } from '@/types';
import { useChat } from '@/hooks';
import { ChatPanel } from '@/components/chat';

// Barrel exports
// components/chat/index.ts
export { ChatPanel } from './ChatPanel';
export { ChatInput } from './ChatInput';
```

---

## 다음 단계

이 문서를 읽은 후:

1. **FE 개발자**: `app/` 구조와 `components/layout`으로 시작
2. **AI 개발자**: `lib/ai/`와 `types/chat.ts`에 집중
3. **공동**: 구현 전에 `types/` 함께 정의

---

## 관련 문서

- [02. 아키텍처](./02-architecture.md) - 시스템 개요
- [03. 기술 스택](./03-tech-stack.md) - 기술 선택
- [04. API Contract](./04-api-contract.md) - API 스펙
