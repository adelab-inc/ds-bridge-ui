# 03. 기술 스택

> **대상 독자**: 개발자 (필수), PM/디자이너 (참고)
> **기술 수준**: 중급

## TL;DR

| 영역 | 선택 | 이유 |
|------|------|------|
| Framework | Next.js 14+ (App Router) | RSC, API Routes, Streaming |
| Language | TypeScript | 타입 안정성, 향상된 DX |
| Styling | Tailwind CSS | Utility-first, 빠른 프로토타이핑 |
| State | Zustand | 단순함, 가벼움 |
| AI | Anthropic Claude API | 가이드형 채팅 |
| Parsing | Puppeteer/Playwright | 토큰 추출, 런타임 스타일 |

---

## 핵심 스택

### Next.js 14+ (App Router)

**정의**: React 기반 풀스택 프레임워크

**DS-Runtime Hub에서의 활용**:

| 기능 | 사용처 |
|------|--------|
| App Router | 파일 기반 라우팅, 레이아웃 |
| API Routes | Storybook 파싱, chat API, export |
| Server Components | 초기 데이터 패칭 |
| Streaming | 채팅 응답용 SSE |

**버전**: 14.x 또는 15.x

```bash
npx create-next-app@latest ds-runtime-hub --typescript --tailwind --app
```

### TypeScript

**정의**: 타입이 있는 JavaScript

**선택 이유**:
- ds.json 스키마에 대한 타입 안정성
- 향상된 IDE 지원
- 컴파일 타임 에러 감지

**정의해야 할 주요 타입**:
```typescript
// FE/AI 협업에 핵심적인 공유 타입
interface DSJson { ... }
interface Composition { ... }
interface ChatMessage { ... }
interface ChatAction { ... }
```

### Tailwind CSS

**정의**: Utility-first CSS 프레임워크

**선택 이유**:
- 빠른 UI 개발
- 일관된 디자인 토큰
- 쉬운 반응형 디자인
- CSS 파일 관리 불필요

**설정**:
```bash
# create-next-app에서 --tailwind 옵션으로 이미 포함
```

---

## 상태 관리

### Zustand

**정의**: 가벼운 상태 관리 라이브러리

**Redux/Jotai 대비 장점**:
| 기준 | Zustand | Redux | Jotai |
|------|---------|-------|-------|
| 번들 크기 | 1.1kb | 7kb+ | 2.4kb |
| 보일러플레이트 | 최소 | 많음 | 최소 |
| 학습 곡선 | 낮음 | 높음 | 중간 |
| DevTools | 있음 | 있음 | 제한적 |

**Store 구조**:
```typescript
interface AppStore {
  // DS 데이터
  dsJson: DSJson | null;
  setDsJson: (ds: DSJson) => void;

  // UI 상태
  selectedComponent: string | null;
  selectComponent: (id: string) => void;

  // Composition
  composition: Composition | null;
  addToComposition: (node: CompositionNode) => void;

  // 채팅
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
}
```

---

## AI 연동

### Anthropic Claude API

**정의**: 가이드형 채팅을 위한 LLM API

**Claude 선택 이유**:
- 뛰어난 지시 따르기 능력
- 구조화된 출력에 강함
- 스트리밍 지원

**모델 선택**:
| 모델 | 사용 사례 | 비용 |
|------|----------|------|
| claude-3-5-sonnet | 기본, 균형 잡힌 성능 | 중간 |
| claude-3-haiku | 빠른 응답 | 낮음 |
| claude-3-opus | 복잡한 쿼리 | 높음 |

**연동 패턴**:
```typescript
// 직접 API 호출 (Vercel AI SDK 미사용)
// 이유: System Prompt + Action 파싱에 대한 더 많은 제어

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: chatHistory
  })
});
```

**System Prompt 설계**:
```
You are a Design System Navigator.

CRITICAL RULES:
1. 제공된 ds.json에 있는 컴포넌트만 참조
2. 절대 컴포넌트를 생성하거나 추측하지 않음
3. 실행 가능한 제안으로 응답

액션 형식:
[ACTION:show_component:Button]
[ACTION:add_composition:Card:Primary]
```

---

## Storybook 파싱

### Puppeteer / Playwright

**정의**: 헤드리스 브라우저 자동화

**필요한 경우**:
- computed styles에서 토큰 추출
- JavaScript로 렌더링되는 Storybook 컨텐츠
- 스크린샷 캡처

**비교**:
| 기능 | Puppeteer | Playwright |
|------|-----------|------------|
| 브라우저 지원 | Chrome | Chrome, Firefox, Safari |
| 속도 | 빠름 | 빠름 |
| API | 유사 | 유사 |
| 크기 | 큼 | 큼 |

**권장**: Playwright (브라우저 지원이 더 좋음)

**배포 고려사항**:
```
Serverless (Vercel): 제한적 (timeout, memory)
Docker/VM: 완전 지원
Edge: 지원 안 됨
```

### 단순 파싱 (Puppeteer 없이)

MVP에서는 직접 fetch 사용:
```typescript
// Storybook v7+
const response = await fetch(`${storybookUrl}/index.json`);
const data = await response.json();

// Storybook v6
const response = await fetch(`${storybookUrl}/stories.json`);
const data = await response.json();
```

---

## UI 컴포넌트

### 접근 방식: Custom + Radix Primitives

**Shadcn/ui 전체를 사용하지 않는 이유**:
- DS-Runtime Hub에는 특정 UI 요구사항이 있음
- 미리보기되는 DS와의 디자인 충돌 방지
- 최소한의 중립적인 스타일링 유지

**권장 Primitives**:
```bash
npm install @radix-ui/react-dialog
npm install @radix-ui/react-tabs
npm install @radix-ui/react-collapsible
npm install @radix-ui/react-tooltip
```

**필요한 커스텀 컴포넌트**:
| 컴포넌트 | 목적 |
|----------|------|
| ChatPanel | 메시지 목록 + 입력 |
| ComponentTree | 접히는 컴포넌트 목록 |
| PropsEditor | props용 동적 폼 |
| PreviewFrame | Storybook iframe 래퍼 |
| ActionButton | Copy for AI, Export |

---

## 개발 도구

### 패키지 매니저

**pnpm** (권장)
```bash
npm install -g pnpm
pnpm install
```

이유:
- npm/yarn보다 빠름
- 디스크 효율적
- 엄격한 의존성 해석

### Linting & Formatting

```json
// package.json
{
  "devDependencies": {
    "eslint": "^8.x",
    "eslint-config-next": "^14.x",
    "prettier": "^3.x",
    "@typescript-eslint/parser": "^6.x"
  }
}
```

### 테스팅

| 유형 | 도구 |
|------|------|
| Unit | Vitest |
| Component | Testing Library |
| E2E | Playwright |

---

## 환경 변수

```bash
# .env.local

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# (선택) 저장된 composition용 Database
DATABASE_URL=...

# (선택) Analytics
NEXT_PUBLIC_ANALYTICS_ID=...
```

---

## 배포 고려사항

### Vercel (MVP 권장)

장점:
- Next.js에 대한 제로 설정
- Edge functions
- Preview deployments

단점:
- Puppeteer 제한적 (외부 서비스 사용하거나 생략)
- Serverless function timeout (hobby 10s, pro 60s)

### Docker (전체 기능용)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
```

필요한 경우:
- Puppeteer/Playwright 토큰 추출
- 장시간 실행 프로세스
- 커스텀 서버 요구사항

---

## 버전 요약

| 기술 | 버전 | 필수 |
|------|------|------|
| Node.js | 20.x LTS | 예 |
| pnpm | 8.x+ | 권장 |
| Next.js | 14.x 또는 15.x | 예 |
| React | 18.x 또는 19.x | 예 |
| TypeScript | 5.x | 예 |
| Tailwind CSS | 3.x | 예 |
| Zustand | 4.x | 예 |

---

## 사용하지 않는 것 (결정)

| 기술 | 사용하지 않는 이유 |
|------|-------------------|
| Monaco Editor | 코드 편집 기능 불필요 |
| Sandpack | 코드 생성 안 함, Storybook iframe 사용 |
| Vercel AI SDK | Claude 프롬프트에 대한 더 많은 제어 필요 |
| Redux | 이 앱 규모에 과함 |
| Prisma/DB | MVP는 localStorage 사용, 나중에 추가 |

---

## 다음 문서

- [04. API Contract](./04-api-contract.md) - 6개 API 엔드포인트
- [06. 디렉토리 구조](./06-directory-structure.md) - 코드 조직
