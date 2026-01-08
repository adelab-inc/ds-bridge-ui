# Phase 1 분석 리포트

> 커밋 12f9656 (`feat(web): 메인 레이아웃 및 핵심 UI 컴포넌트 구현`) 분석

## 개요

| 항목 | 내용 |
|------|------|
| 분석일 | 2026-01-08 |
| 커밋 | 12f96562bae7a1c06d521b9b5a696266a158afb1 |
| 변경 파일 | 36개 (+1,892 / -550 lines) |
| 현재 단계 | 마크업 완료, 비즈니스 로직 미구현 |

---

## 1. 구현 현황

### 1.1 완료된 작업

| 영역 | 구현 내용 | 파일 |
|------|----------|------|
| **레이아웃** | 2단 Resizable 패널 | `main-layout.tsx` |
| **헤더** | URL 입력, JSON 업로드, 드롭다운 메뉴 | `header.tsx` |
| **모바일** | 바텀시트 + 탭 전환 | `mobile-sheet.tsx` |
| **Chat** | 메시지 리스트, 입력창 | `chat-section.tsx`, `chat-input.tsx` |
| **Components** | 트리 구조, 접기/펼치기 | `component-list-section.tsx`, `component-tree.tsx` |
| **Actions** | Copy for AI, Copy Tokens, Export JSON 버튼 | `actions-section.tsx` |
| **Preview** | Storybook iframe, Composition 탭 | `preview-section.tsx` |
| **UI 컴포넌트** | Tabs, Tooltip, ScrollArea, Collapsible, Resizable | `components/ui/` |

### 1.2 현재 상태의 한계

모든 이벤트 핸들러가 Mock 상태:

```typescript
// 예: actions-section.tsx
const handleCopyForAI = () => {
  if (onCopyForAI) {
    onCopyForAI()
  } else {
    console.log("Copy for AI clicked")  // ← 실제 로직 없음
  }
}
```

**비즈니스 로직 부재:**
- 상태 관리 (Zustand) 없음
- API 연결 없음
- Storybook 파싱 로직 없음
- 클립보드 복사 기능 없음

---

## 2. RSC (React Server Components) 사용 분석

### 2.1 현재 구조

```
app/
├── layout.tsx      (Server Component ✅)
├── page.tsx        (Server Component ✅)
    └── <MainLayout />  ← "use client" 🚨
        └── 모든 하위 컴포넌트가 클라이언트 번들에 포함
```

### 2.2 "use client" 사용 현황

| 디렉토리 | 파일 수 | "use client" 사용 |
|----------|---------|-------------------|
| `components/layout/` | 5개 | 5개 (100%) |
| `components/features/` | 12개 | 12개 (100%) |
| `components/ui/` | 14개 | 14개 (100%) |
| **합계** | **31개** | **31개 (100%)** |

### 2.3 문제점

| 문제 | 영향 |
|------|------|
| **루트에서 클라이언트 컴포넌트 직접 사용** | 전체 트리가 클라이언트 번들에 포함 |
| **번들 크기 증가** | 불필요한 JavaScript 전송 |
| **SSR 이점 감소** | 서버 렌더링 후에도 hydration 필요 |
| **초기 로드 지연** | JavaScript 파싱/실행 시간 증가 |

### 2.4 현실적 제약

다음 라이브러리들로 인해 클라이언트 컴포넌트가 필수:

- **react-resizable-panels**: DOM 조작, 이벤트 리스너 필요
- **Base UI**: `useId()` 사용으로 SSR Hydration 이슈 발생
- **인터랙티브 UI**: useState, useEffect, 이벤트 핸들러

`ClientOnly` 래퍼로 Hydration 이슈를 해결한 점은 적절한 타협.

### 2.5 개선 권장 패턴

```tsx
// 권장: 서버/클라이언트 경계 명확히 분리

// app/page.tsx (Server Component)
export default async function Page() {
  // 서버에서 정적 데이터 처리
  const config = await getAppConfig()

  return (
    <div className="flex h-screen flex-col">
      {/* 정적 부분은 서버에서 렌더링 */}
      <StaticHeader title={config.title} />

      {/* 인터랙티브 부분만 클라이언트로 */}
      <InteractiveContent />
    </div>
  )
}

// components/interactive-content.tsx
"use client"
// 상태, 이벤트 핸들러가 필요한 부분만
```

**서버로 옮길 수 있는 요소:**
- 정적 헤더/로고 마크업
- 메타데이터 생성
- 초기 설정 데이터 fetch

**클라이언트 필수 요소:**
- `useState`, `useEffect` 사용 컴포넌트
- 이벤트 핸들러 (onClick, onChange)
- Browser API (window, document, clipboard)
- react-resizable-panels, Base UI

---

## 3. TO-BE 작업 목록

### 3.1 우선순위별 정리

| 우선순위 | 작업 | 설명 | 예상 파일 |
|---------|------|------|----------|
| 🔴 P1 | **Zustand 스토어** | 전역 상태 관리 | `stores/` |
| 🔴 P1 | **Storybook Parser** | URL → stories.json 파싱 | `lib/parser/` |
| 🟡 P2 | **API Routes** | BFF 패턴 엔드포인트 | `app/api/` |
| 🟡 P2 | **Copy for AI** | 클립보드 복사 + 프롬프트 생성 | `lib/clipboard.ts` |
| 🟢 P3 | **AI Chat 연동** | OpenAI/Anthropic 스트리밍 | `app/api/chat/` |
| 🟢 P3 | **Export JSON** | ds.json 다운로드 | `lib/export.ts` |

### 3.2 스토어 설계 (예정)

```typescript
// stores/storybook-store.ts
interface StorybookStore {
  url: string | null
  stories: Story[]
  selectedStoryId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  setUrl: (url: string) => void
  fetchStories: () => Promise<void>
  selectStory: (id: string) => void
}

// stores/chat-store.ts
interface ChatStore {
  messages: ChatMessage[]
  isStreaming: boolean

  // Actions
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
}

// stores/composition-store.ts
interface CompositionStore {
  selectedComponents: string[]
  composition: CompositionNode[]

  // Actions
  addComponent: (id: string) => void
  removeComponent: (id: string) => void
  reorderComponents: (from: number, to: number) => void
}
```

### 3.3 API 설계 (예정)

```
app/api/
├── parse/
│   └── route.ts      # POST: Storybook URL → stories.json
├── compose/
│   └── route.ts      # POST: 선택된 컴포넌트 → 조합 결과
└── chat/
    └── route.ts      # POST: AI 채팅 (스트리밍)
```

---

## 4. 파일 구조 현황

```
apps/web/
├── app/
│   ├── layout.tsx              # 루트 레이아웃 (SC)
│   ├── page.tsx                # 홈페이지 (SC → CC)
│   └── globals.css
│
├── components/
│   ├── layout/                 # 레이아웃 컴포넌트
│   │   ├── header.tsx
│   │   ├── left-panel.tsx
│   │   ├── right-panel.tsx
│   │   ├── main-layout.tsx
│   │   └── mobile-sheet.tsx
│   │
│   ├── features/               # 기능별 컴포넌트
│   │   ├── chat/
│   │   ├── component-list/
│   │   ├── actions/
│   │   └── preview/
│   │
│   └── ui/                     # shadcn/Base UI 컴포넌트
│       ├── button.tsx
│       ├── tabs.tsx
│       ├── tooltip.tsx
│       ├── client-only.tsx     # SSR Hydration 래퍼
│       └── ...
│
└── lib/
    ├── utils.ts                # cn() 유틸리티
    └── constants.ts            # 레이아웃 상수
```

---

## 5. 결론

### 현재 상태 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| UI 마크업 | ✅ 완료 | 레이아웃, 컴포넌트 구조 완성 |
| 반응형 | ✅ 완료 | 데스크탑/모바일 분기 |
| 상태 관리 | ❌ 미구현 | Zustand 스토어 필요 |
| API 연결 | ❌ 미구현 | BFF 패턴 구현 필요 |
| RSC 최적화 | ⚠️ 부분적 | 클라이언트 경계 재설계 권장 |

### 다음 단계 권장

1. **Zustand 스토어 구현** → 상태 관리 기반 마련
2. **Storybook Parser 구현** → 핵심 기능 동작
3. **API Routes 구현** → 서버 사이드 로직 분리
4. **RSC 경계 최적화** → 번들 크기 및 성능 개선
