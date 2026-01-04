# 02. 시스템 아키텍처

> **대상 독자**: 개발자, PM
> **기술 수준**: 중급

## TL;DR

- **핵심 흐름**: Storybook URL → ds.json 파싱 → Runtime Hub → Copy for AI
- **주요 컴포넌트**: Storybook Parser, Chat Navigator, Composition Engine
- **AI 역할**: 가이드 전용 (생성 금지, ds.json 기반 네비게이션만)

---

## 시스템 개요

```
User                          DS-Runtime Hub                     External
 |                                  |                               |
 |  1. Storybook URL 입력           |                               |
 |--------------------------------->|                               |
 |                                  |  2. stories.json Fetch        |
 |                                  |------------------------------>|
 |                                  |<------------------------------|
 |                                  |  3. ds.json으로 파싱           |
 |                                  |                               |
 |  4. 컴포넌트 목록 확인            |                               |
 |<---------------------------------|                               |
 |                                  |                               |
 |  5. 채팅: "버튼 보여줘"           |                               |
 |--------------------------------->|  6. Claude API (가이드 전용)   |
 |                                  |------------------------------>|
 |                                  |<------------------------------|
 |  7. Button으로 네비게이션         |                               |
 |<---------------------------------|                               |
 |                                  |                               |
 |  8. 페이지 조합                   |                               |
 |--------------------------------->|                               |
 |                                  |                               |
 |  9. Copy for AI                  |                               |
 |<---------------------------------|                               |
 |                                  |                               |
 | 10. IDE에 붙여넣기, vibe coding   |                               |
```

---

## 핵심 컴포넌트

### 1. Storybook Parser

**목적**: Storybook URL에서 컴포넌트 정보 추출

```
Storybook URL
     |
     v
+-----------------+
| stories.json 또는|
| index.json      |
+-----------------+
     |
     v
+-----------------+
| Component 목록  |
| Props           |
| Stories/Variants|
+-----------------+
     |
     v
+-----------------+
| ds.json         |
+-----------------+
```

**Storybook 버전별 엔드포인트**:
| 버전 | 엔드포인트 |
|------|------------|
| v7+ | `/index.json` |
| v6 | `/stories.json` |

**CORS 처리**: 서버 사이드 fetch 필수

### 2. Chat Navigator (AI)

**목적**: ds.json 기반 사용자 가이드 - 코드 생성 금지

```
+------------------+
| 사용자 질문      |
+------------------+
        |
        v
+------------------+
| System Prompt    |
| + ds.json 데이터 |
+------------------+
        |
        v
+------------------+
| Claude API       |
+------------------+
        |
        v
+------------------+
| 응답 +           |
| Actions          |
+------------------+
```

**핵심 규칙**:
- ds.json에 있는 컴포넌트만 참조
- 절대 생성하거나 추측하지 않음
- 항상 실행 가능한 액션 제안

### 3. Composition Engine

**목적**: 컴포넌트를 페이지 레이아웃으로 조합

```
+------------------+     +------------------+
| Component A      | +   | Component B      |
| (Button)         |     | (Card)           |
+------------------+     +------------------+
        |                        |
        +------------+-----------+
                     |
                     v
        +------------------+
        | Composition      |
        | - structure[]    |
        | - layout hints   |
        +------------------+
                     |
                     v
        +------------------+
        | Preview          |
        +------------------+
```

### 4. Copy for AI Generator

**목적**: Composition을 AI 친화적 프롬프트로 내보내기

```
Composition + Tokens
        |
        v
+----------------------+
| We use [DS Name].    |
|                      |
| TOKENS               |
| - colors, spacing... |
|                      |
| COMPOSITION          |
| - Component 목록     |
| - Props 값           |
+----------------------+
        |
        v
    Clipboard
```

---

## 데이터 흐름

### ds.json 구조

```typescript
interface DSJson {
  meta: {
    name: string;
    version: string;
    source: 'url' | 'extract';
    storybookUrl?: string;
  };

  components: Component[];
  tokens?: DesignTokens;
}

interface Component {
  id: string;
  name: string;
  category?: string;
  props: PropDefinition[];
  stories: Story[];
}
```

### Composition 구조

```typescript
interface Composition {
  id: string;
  name: string;
  structure: CompositionNode[];
  usedTokens?: string[];
}

interface CompositionNode {
  componentId: string;
  storyId?: string;
  props?: Record<string, any>;
  children?: CompositionNode[];
  layout?: {
    position?: 'header' | 'sidebar' | 'main' | 'footer';
    order?: number;
  };
}
```

---

## 페이지 구조

### 메인 페이지 레이아웃

```
+-------------------------------------------------------------+
|  Header: [로고]  [URL 입력]  [Upload JSON]                    |
+------------------------+------------------------------------+
|                        |                                    |
|  Left Panel (400px)    |  Right Panel (flex)                |
|  +------------------+  |  +--------------------------------+|
|  | Chat Area        |  |  |                                ||
|  | (AI Navigator)   |  |  |  Storybook iframe              ||
|  |                  |  |  |  또는                           ||
|  +------------------+  |  |  Composition Preview           ||
|  +------------------+  |  |                                ||
|  | Component List   |  |  +--------------------------------+|
|  | (접히는 목록)     |  |                                    |
|  +------------------+  |                                    |
|  +------------------+  |                                    |
|  | Actions          |  |                                    |
|  | [Copy for AI]    |  |                                    |
|  | [Copy Tokens]    |  |                                    |
|  | [Export JSON]    |  |                                    |
|  +------------------+  |                                    |
+------------------------+------------------------------------+
```

### 상태 관리

```typescript
interface AppState {
  // DS 데이터
  dsJson: DSJson | null;
  loadingState: 'idle' | 'parsing' | 'ready' | 'error';
  error: string | null;

  // 선택 상태
  selectedComponent: string | null;
  selectedStory: string | null;

  // Composition
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

## 팀 역할

### FE 개발자

```
+------------------------------------------+
| FE 개발자 담당 영역                        |
|                                          |
| - UI Components (React)                  |
| - Storybook Parser (fetch + parse)       |
| - Chat UI (입력, 메시지, 액션)             |
| - Composition Manager                    |
| - Preview Renderer                       |
| - Copy for AI Generator                  |
| - State Management (Zustand)             |
+------------------------------------------+
```

### AI 개발자

```
+------------------------------------------+
| AI 개발자 담당 영역                        |
|                                          |
| - Claude API 연동                        |
| - System Prompt 설계                     |
| - Action 파싱 로직                        |
| - Token 추출 (Puppeteer)                 |
| - 가이드형 응답 검증                       |
+------------------------------------------+
```

### 공동

```
+------------------------------------------+
| 공동 담당 영역                             |
|                                          |
| - ds.json Schema 정의                    |
| - Composition Schema 정의                |
| - API Contract (types)                   |
| - Chat Action Types                      |
+------------------------------------------+
```

---

## Composition 렌더링 옵션

### 옵션 1: Storybook iframe (단순)

```
+------------------+
| iframe 1: Button |
+------------------+
| iframe 2: Card   |
+------------------+
```
- 장점: 완벽한 스타일 격리
- 단점: 레이아웃 제약, 성능

### 옵션 2: Dynamic Rendering (MVP 권장)

```
+------------------+
| React Container  |
| +--------------+ |
| | Button       | |
| +--------------+ |
| | Card         | |
| +--------------+ |
+------------------+
```
- 장점: 유연한 레이아웃
- 단점: 스타일 충돌 가능성

### 옵션 3: Preview Server (향후)

```
Hub --> Preview Server --> iframe
```
- 장점: 완벽한 격리 + 유연성
- 단점: 인프라 복잡도

---

## 외부 연동

### Claude API

- 목적: 가이드형 채팅 네비게이션
- 모델: Claude 3.5 Sonnet (또는 최신)
- 스트리밍: SSE로 실시간 응답

### Puppeteer/Playwright

- 목적: computed styles에서 토큰 추출
- 트리거: 토큰 추출 기능 (선택)
- 배포: 서버리스가 아닌 환경 필요

---

## 보안 고려사항

### Storybook URL 검증

```typescript
// fetch 전 URL 검증
const isValidStorybookUrl = (url: string): boolean => {
  // 프로토콜 확인
  // 도메인 허용 목록 확인 (선택)
  // SSRF 공격 방지
};
```

### 채팅 입력 sanitization

- 표시 전 사용자 입력 escape
- 메시지 길이 제한
- API 호출 rate limiting

---

## 다음 문서

- [03. 기술 스택](./03-tech-stack.md) - 기술 선정과 이유
- [04. API Contract](./04-api-contract.md) - 6개 API 엔드포인트 스펙
