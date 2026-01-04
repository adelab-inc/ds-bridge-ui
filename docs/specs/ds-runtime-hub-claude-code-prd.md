# DS-Runtime Hub - Claude Code 개발 문서

## 프로젝트 개요

**프로젝트명**: DS-Runtime Hub  
**목적**: 디자인 시스템을 실행·조합·코드 복사까지 한 번에 하는 플랫폼  
**핵심 가치**: "추측 없이 바로 구현 가능"

---

## 기술 스택 (권장)

```
Frontend: Next.js 14+ (App Router), TypeScript, Tailwind CSS
State: Zustand 또는 Jotai
AI Integration: Anthropic Claude API (채팅 기능)
Storybook Parsing: Puppeteer 또는 Playwright (런타임 파싱)
Package: npm/pnpm
```

---

## 핵심 데이터 구조

### ds.json 스키마

```typescript
interface DSJson {
  meta: {
    name: string;           // 디자인 시스템 이름
    version: string;        // 버전
    source: 'url' | 'extract';  // 생성 방식
    storybookUrl?: string;  // 원본 Storybook URL
    createdAt: string;
    updatedAt: string;
  };
  
  components: Component[];
  tokens?: DesignTokens;
}

interface Component {
  id: string;               // 고유 ID
  name: string;             // 컴포넌트 이름 (e.g., "Button")
  category?: string;        // 카테고리 (e.g., "Form", "Layout")
  
  props: PropDefinition[];
  stories: Story[];
  
  // 메타 정보
  description?: string;
  filePath?: string;        // 원본 파일 경로
}

interface PropDefinition {
  name: string;             // prop 이름
  type: 'string' | 'number' | 'boolean' | 'enum' | 'object';
  required: boolean;
  defaultValue?: any;
  options?: string[];       // enum일 경우 선택지
  description?: string;
}

interface Story {
  id: string;               // 스토리 ID
  name: string;             // 스토리 이름 (e.g., "Primary", "Large")
  args: Record<string, any>;  // 해당 스토리의 props 값
}

interface DesignTokens {
  colors?: Record<string, string>;
  spacing?: Record<string, string>;
  typography?: {
    fontFamily?: Record<string, string>;
    fontSize?: Record<string, string>;
    fontWeight?: Record<string, string>;
    lineHeight?: Record<string, string>;
  };
  borderRadius?: Record<string, string>;
  shadows?: Record<string, string>;
}
```

### Composition (페이지 조합) 스키마

```typescript
interface Composition {
  id: string;
  name: string;             // e.g., "Dashboard", "Login Page"
  description?: string;
  
  structure: CompositionNode[];
  usedTokens?: string[];    // 이 조합에서 사용된 토큰 키 목록
  
  createdAt: string;
  updatedAt: string;
}

interface CompositionNode {
  componentId: string;      // ds.json의 component.id 참조
  storyId?: string;         // 특정 story 사용 시
  props?: Record<string, any>;  // 오버라이드된 props
  children?: CompositionNode[];
  
  // 레이아웃 힌트
  layout?: {
    position?: 'header' | 'sidebar' | 'main' | 'footer';
    order?: number;
  };
}
```

---

## 주요 기능 및 API 설계

### 1. Storybook URL 파싱

**엔드포인트**: `POST /api/storybook/parse`

```typescript
// Request
{
  url: string;  // Storybook URL (e.g., "https://storybook.example.com")
}

// Response
{
  success: boolean;
  data?: DSJson;
  error?: string;
}
```

**구현 로직**:
1. Storybook의 `stories.json` 또는 `index.json` 엔드포인트 접근
2. 컴포넌트 목록, props, stories 추출
3. (선택) iframe으로 각 스토리 로드 → computed styles 추출
4. ds.json 형태로 변환

**파싱 대상 URL 패턴**:
```
{storybookUrl}/stories.json
{storybookUrl}/index.json
{storybookUrl}/iframe.html?id={storyId}
```

### 2. npx ds-hub extract (CLI)

**별도 npm 패키지**: `ds-hub-cli`

```bash
npx ds-hub extract [options]

Options:
  --storybook-dir <path>   Storybook 설정 디렉토리 (default: .storybook)
  --output <path>          출력 경로 (default: ./ds.json)
  --include-tokens         토큰 추출 포함
  --token-source <path>    토큰 파일 경로 (e.g., tokens.json, theme.ts)
```

**구현 로직**:
1. 로컬 Storybook 빌드 정보 읽기
2. 컴포넌트/props/stories 추출
3. (옵션) 토큰 파일 파싱
4. ds.json 생성

### 3. 채팅 API (가이드형)

**엔드포인트**: `POST /api/chat`

```typescript
// Request
{
  dsJson: DSJson;           // 현재 로드된 DS
  messages: ChatMessage[];  // 대화 히스토리
  currentComposition?: Composition;  // 현재 조합 상태
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Response
{
  message: string;          // AI 응답
  actions?: ChatAction[];   // UI에서 실행할 액션들
}

interface ChatAction {
  type: 'show_components' | 'show_props' | 'show_stories' | 
        'add_to_composition' | 'update_composition' | 'navigate';
  payload: any;
}
```

**프롬프트 설계 원칙**:
- AI는 ds.json에 있는 정보만 참조
- 추측/생성 금지, 탐색/안내만 수행
- 응답은 항상 실행 가능한 액션으로 연결

**시스템 프롬프트 예시**:
```
You are a Design System Navigator for DS-Runtime Hub.

RULES:
1. ONLY reference components, props, and stories that exist in the provided ds.json
2. NEVER generate or hallucinate components that don't exist
3. Always suggest runnable actions (show component, change props, add to composition)
4. Respond in the user's language

AVAILABLE DATA:
{ds.json 내용}

CURRENT COMPOSITION:
{현재 조합 상태}
```

### 4. Composition 관리

**엔드포인트**: `POST /api/composition`

```typescript
// Create/Update Composition
{
  action: 'create' | 'update' | 'add_component' | 'remove_component';
  compositionId?: string;
  data: Partial<Composition> | CompositionNode;
}
```

### 5. Copy for AI

**엔드포인트**: `POST /api/export/copy-for-ai`

```typescript
// Request
{
  dsJson: DSJson;
  composition: Composition;
  options?: {
    includeTokens: boolean;
    format: 'prompt' | 'json' | 'markdown';
  };
}

// Response
{
  content: string;  // 클립보드에 복사할 내용
}
```

**출력 템플릿**:
```
We use {dsJson.meta.name} Design System.

TOKENS (use these exact values)
{토큰 목록}

CONFIRMED COMPOSITION (already reviewed)
{컴포넌트 구조 + props}

Generate a React page using existing DS components.
Use the tokens above for spacing and colors.
```

### 6. 토큰 추출 (Computed Styles)

**엔드포인트**: `POST /api/tokens/extract`

```typescript
// Request
{
  storybookUrl: string;
  sampleStories: string[];  // 추출할 대표 스토리 ID 목록
}

// Response
{
  tokens: DesignTokens;
  source: 'computed';  // computed styles에서 추출됨을 표시
}
```

**구현 로직**:
1. Puppeteer로 각 스토리 iframe 로드
2. 대표 요소들의 computed styles 추출
3. 패턴 분석하여 토큰화 (색상 그룹핑, spacing 패턴 등)

---

## 페이지 구조

### 메인 페이지 (`/`)

```
┌─────────────────────────────────────────────────────┐
│  Header: 로고 + [URL 입력] + [Upload JSON]          │
├─────────────────────┬───────────────────────────────┤
│                     │                               │
│  Left Panel         │  Right Panel                  │
│  ┌───────────────┐  │  ┌─────────────────────────┐  │
│  │ Chat Area     │  │  │ Storybook iframe        │  │
│  │               │  │  │ 또는                     │  │
│  │               │  │  │ Composition Preview     │  │
│  └───────────────┘  │  └─────────────────────────┘  │
│  ┌───────────────┐  │                               │
│  │ Component List│  │                               │
│  │ (collapsible) │  │                               │
│  └───────────────┘  │                               │
│  ┌───────────────┐  │                               │
│  │ Actions       │  │                               │
│  │ [Copy for AI] │  │                               │
│  │ [Copy Tokens] │  │                               │
│  │ [Export JSON] │  │                               │
│  └───────────────┘  │                               │
└─────────────────────┴───────────────────────────────┘
```

### 상태 관리

```typescript
interface AppState {
  // DS 데이터
  dsJson: DSJson | null;
  loadingState: 'idle' | 'parsing' | 'ready' | 'error';
  error: string | null;
  
  // 현재 선택
  selectedComponent: string | null;
  selectedStory: string | null;
  
  // 조합
  currentComposition: Composition | null;
  
  // 채팅
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  
  // UI
  rightPanelMode: 'storybook' | 'composition' | 'preview';
  leftPanelTab: 'chat' | 'components' | 'tokens';
}
```

---

## MVP 개발 순서

### Phase 1: 기본 구조 (1-2주)

1. **프로젝트 셋업**
   - Next.js + TypeScript 프로젝트 생성
   - Tailwind CSS 설정
   - 기본 레이아웃 구성

2. **Storybook URL 파싱**
   - stories.json / index.json 파싱 로직
   - ds.json 변환 로직
   - 에러 핸들링

3. **기본 UI**
   - URL 입력 폼
   - 컴포넌트 목록 표시
   - Storybook iframe 임베드

### Phase 2: 채팅 & 조합 (2-3주)

4. **채팅 기능**
   - Claude API 연동
   - 가이드형 프롬프트 설계
   - 채팅 UI 구현

5. **Composition 기능**
   - 컴포넌트 조합 로직
   - 조합 미리보기
   - 조합 저장/로드

6. **Props 편집**
   - 동적 props 폼 생성
   - 실시간 미리보기 업데이트

### Phase 3: Export & 토큰 (1-2주)

7. **Copy for AI**
   - 프롬프트 템플릿 생성
   - 클립보드 복사 기능

8. **토큰 추출**
   - Computed styles 추출 (Puppeteer)
   - 토큰 표시 UI
   - Copy as CSS/Tailwind/JS

### Phase 4: CLI & 고도화 (2주+)

9. **npx ds-hub extract CLI**
   - npm 패키지 구성
   - 로컬 Storybook 파싱
   - 토큰 파일 연동

10. **추가 기능**
    - 조합 공유 (Public/Private)
    - 사용자 인증
    - 히스토리 관리

---

## 핵심 구현 포인트

### Storybook 파싱 시 주의사항

```typescript
// Storybook 버전별 엔드포인트 차이
const STORYBOOK_ENDPOINTS = {
  v7: '/index.json',
  v6: '/stories.json',
};

// CORS 이슈 대응
// 서버 사이드에서 fetch 수행 필요
```

### 채팅 프롬프트 핵심 원칙

```typescript
const CHAT_SYSTEM_PROMPT = `
You are a Design System Navigator.

CRITICAL RULES:
1. ONLY mention components that exist in the provided ds.json
2. NEVER invent or hallucinate component names
3. When user asks "what components are available", list ONLY from ds.json
4. Always respond with actionable suggestions

When suggesting actions, use this format:
[ACTION:show_component:Button] - to show a component
[ACTION:add_composition:Button:Primary] - to add to composition
`;
```

### Composition 렌더링 전략

```typescript
// 옵션 1: Storybook iframe 조합
// - 각 컴포넌트를 별도 iframe으로 로드
// - 장점: 완벽한 스타일 격리
// - 단점: 성능, 레이아웃 제약

// 옵션 2: 동적 컴포넌트 렌더링 (권장)
// - ds.json 기반으로 React 컴포넌트 동적 생성
// - 장점: 자유로운 레이아웃
// - 단점: 스타일 충돌 가능성

// 옵션 3: Preview 서버
// - 별도 서버에서 조합 결과 렌더링
// - 장점: 완벽한 격리 + 자유로운 레이아웃
// - 단점: 인프라 복잡도
```

---

## 환경 변수

```env
# .env.local

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# (Optional) Database
DATABASE_URL=...
```

---

## 참고: 유사 서비스 대비 차별점

| 기능 | Storybook | v0/Lovable | DS-Runtime Hub |
|------|-----------|------------|----------------|
| 기존 DS 기반 | ⭕ | ❌ | ⭕ |
| 페이지 조합 | ❌ | ⭕ | ⭕ |
| AI 채팅 | ❌ | ⭕ | ⭕ (가이드형) |
| Copy for AI | ❌ | ❌ | ⭕ |
| 토큰 추출 | ❌ | ❌ | ⭕ |
| 실행 기반 | ⭕ | ❌ | ⭕ |

---

## 다음 단계 질문 (개발 시작 전 결정 필요)

1. **인증/저장**: 조합 저장을 위한 DB 필요 여부? (MVP는 로컬 스토리지로 가능)
2. **Storybook 버전**: 주 타겟 버전? (v7 권장)
3. **토큰 우선순위**: Computed styles vs Figma tokens export 중 MVP 우선순위
4. **배포 환경**: Vercel? AWS? (Puppeteer 사용 시 서버리스 제약 고려)
