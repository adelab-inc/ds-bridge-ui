# 2막: Props 편집 기능 - 기술 분석 문서

> **작성일**: 2026-01-20
> **버전**: 1.0
> **상태**: 분석 완료, 구현 대기

---

## 목차

1. [개요](#1-개요)
2. [기획자용 요약](#2-기획자용-요약)
3. [PM용 요약](#3-pm용-요약)
4. [개발자용 상세 스펙](#4-개발자용-상세-스펙)
5. [현재 구현 상태 분석](#5-현재-구현-상태-분석)
6. [기술 결정 사항](#6-기술-결정-사항)
7. [구현 계획](#7-구현-계획)
8. [위험 요소 및 고려사항](#8-위험-요소-및-고려사항)

---

## 1. 개요

### 1.1 2막이란?

DS-Runtime Hub의 5막 로드맵 중 두 번째 단계로, **"보기만 하던 디자인 시스템을 직접 만져볼 수 있게"** 만드는 기능입니다.

### 1.2 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **정의 불변** | 컴포넌트 정의(JSON)는 수정하지 않음 |
| **인스턴스 편집** | 개별 인스턴스의 실행 상태(props)만 변경 |
| **즉시 반영** | props 변경 시 화면 즉시 반영 |

### 1.3 성공 기준

- [ ] 구성 트리에서 컴포넌트 선택 가능
- [ ] props 변경 시 화면 즉시 반영
- [ ] 선택한 인스턴스만 변경됨
- [ ] JSON/코드 변경 없음

---

## 2. 기획자용 요약

### 2.1 사용자 시나리오

```
1. 사용자가 왼쪽 컴포넌트 트리에서 "Button" 클릭
2. 하단에 Props 편집 패널이 나타남
3. variant를 "solid"에서 "outline"으로 변경
4. 오른쪽 미리보기가 즉시 업데이트됨
5. 다른 컴포넌트(Input)를 클릭하면 새로운 Props 패널 표시
6. Button의 편집 내용은 유지됨
```

### 2.2 UI 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Header                                                      │
├─────────────────────┬───────────────────────────────────────┤
│  Chat Section       │                                       │
│                     │                                       │
├─────────────────────┤         Storybook Preview             │
│  Component Tree     │         (실시간 업데이트)              │
│  ▸ Button ●        │                                       │
│  ▸ Input           │         [선택된 컴포넌트 표시]         │
│  ▸ Card            │                                       │
├─────────────────────┤                                       │
│  Props Panel        │                                       │
│  ┌───────────────┐ │                                       │
│  │ variant: [▼] │ │                                       │
│  │ size:    [▼] │ │                                       │
│  │ disabled: □  │ │                                       │
│  └───────────────┘ │                                       │
└─────────────────────┴───────────────────────────────────────┘
```

### 2.3 주요 인터랙션

| 액션 | 결과 |
|------|------|
| 컴포넌트 클릭 | 선택 표시 + Props 패널 표시 |
| Props 값 변경 | 미리보기 즉시 업데이트 |
| Reset 버튼 클릭 | 기본값으로 복원 |
| 다른 컴포넌트 선택 | Props 패널 전환 (이전 편집 유지) |

### 2.4 지원하는 Props 컨트롤

| 타입 | UI 형태 | 예시 |
|------|---------|------|
| 텍스트 | 입력 필드 | `children`, `label` |
| 선택 | 드롭다운 | `variant`, `size` |
| 불리언 | 체크박스 | `disabled`, `loading` |
| 숫자 | 숫자 입력 | `maxLength`, `rows` |
| 객체 | JSON 편집기 | `style`, `data` |

---

## 3. PM용 요약

### 3.1 작업 범위

| 구분 | 항목 |
|------|------|
| **신규 개발** | Props 편집 패널, 컨트롤 컴포넌트 5종, 상태 관리 스토어, URL 생성 훅 |
| **수정** | 컴포넌트 트리 (선택 기능), Storybook iframe (args 전달), 레이아웃 |
| **미변경** | API, 백엔드, 데이터베이스, ds.json 스키마 |

### 3.2 예상 일정

| Phase | 내용 | 예상 소요 |
|-------|------|----------|
| Phase 1 | 기반 (타입, 스토어, 훅) | 1-2일 |
| Phase 2 | Props Editor UI | 2-3일 |
| Phase 3 | 컴포넌트 트리 연동 | 1일 |
| Phase 4 | Live Preview 연동 | 1일 |
| Phase 5 | 레이아웃 통합 | 0.5일 |
| Phase 6 | 마무리 (엣지케이스, 접근성) | 0.5일 |
| **합계** | | **6-8일** |

### 3.3 의존성

```
Phase 1 ──┬──▶ Phase 2 ──▶ Phase 5 ──▶ Phase 6
          │
          └──▶ Phase 3 ──▶ Phase 4 ──┘
```

- Phase 1은 병렬 작업 가능 (타입/스토어/훅)
- Phase 2, 3은 Phase 1 완료 후 병렬 작업 가능
- Phase 4는 Phase 2, 3 완료 필요
- Phase 5, 6은 순차 진행

### 3.4 테스트 범위

| 테스트 유형 | 내용 |
|------------|------|
| **유닛 테스트** | 스토어 액션, URL 생성 훅, 컨트롤 컴포넌트 |
| **통합 테스트** | 선택→편집→미리보기 플로우 |
| **수동 테스트** | 다양한 Storybook URL로 검증 |

### 3.5 리스크

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|----------|
| Storybook args 미지원 | 높음 | 사전 테스트로 확인 |
| Props 타입 다양성 | 중간 | fallback 컨트롤 제공 |
| iframe 통신 이슈 | 낮음 | URL 기반으로 우회 |

---

## 4. 개발자용 상세 스펙

### 4.1 신규 파일 구조

```
apps/web/
├── stores/
│   └── useComponentEditorStore.ts     # 선택 & 편집 상태 관리
│
├── types/
│   └── component-editor.ts            # 에디터 전용 타입
│
├── hooks/
│   └── useStorybookArgsUrl.ts         # Storybook URL 생성
│
└── components/features/props-editor/
    ├── index.ts                       # barrel export
    ├── props-panel.tsx                # 메인 패널 컴포넌트
    ├── props-form.tsx                 # 동적 폼 렌더링
    └── controls/
        ├── text-control.tsx           # string props
        ├── select-control.tsx         # enum/union props
        ├── boolean-control.tsx        # boolean props
        ├── number-control.tsx         # number props
        └── object-control.tsx         # object props
```

### 4.2 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `components/features/component-list/component-item.tsx` | 선택 상태 시각화 (하이라이트, 아이콘) |
| `components/features/component-list/component-tree.tsx` | onSelect 이벤트, selectedId prop |
| `components/features/component-list/component-list-section.tsx` | 스토어 연결 |
| `components/features/preview/storybook-iframe.tsx` | args prop 추가, URL 재생성 |
| `components/features/preview/preview-section.tsx` | 스토어 연결 |
| `components/layout/desktop-layout.tsx` | PropsPanel 통합 |

### 4.3 타입 정의

```typescript
// types/component-editor.ts

import type { PropInfo } from './ds-extraction';

/** Props 값 타입 */
export type PropValue = string | number | boolean | object | null;

/** Props 오버라이드 맵 */
export type PropsOverrides = Record<string, PropValue>;

/** 선택된 컴포넌트 정보 */
export interface SelectedComponent {
  /** 컴포넌트 고유 ID */
  id: string;
  /** 컴포넌트 이름 */
  name: string;
  /** 카테고리 (UI, Form, Layout 등) */
  category: string;
  /** 스토리 ID 목록 */
  stories: string[];
  /** Props 정의 (ds-extraction에서 추출) */
  props: PropInfo[];
  /** 현재 선택된 스토리 ID */
  selectedStory?: string;
}

/** 컴포넌트별 편집 상태 */
export interface ComponentEditState {
  /** 현재 Props 오버라이드 */
  overrides: PropsOverrides;
  /** 수정 여부 */
  isDirty: boolean;
  /** 마지막 수정 시간 */
  lastModified: number;
}
```

### 4.4 Zustand 스토어 스펙

```typescript
// stores/useComponentEditorStore.ts

import { create } from 'zustand';
import type {
  SelectedComponent,
  PropsOverrides,
  PropValue,
  ComponentEditState
} from '@/types/component-editor';

interface ComponentEditorState {
  // ===== 상태 =====
  /** 현재 선택된 컴포넌트 */
  selectedComponent: SelectedComponent | null;
  /** 현재 선택된 스토리 ID */
  selectedStoryId: string | null;
  /** 컴포넌트별 편집 상태 맵 (componentId → editState) */
  editStates: Map<string, ComponentEditState>;

  // ===== 액션 =====
  /** 컴포넌트 선택 */
  selectComponent: (component: SelectedComponent | null) => void;
  /** 스토리 선택 */
  selectStory: (storyId: string | null) => void;
  /** Props 값 업데이트 */
  updateProp: (propName: string, value: PropValue) => void;
  /** 개별 Prop 리셋 */
  resetProp: (propName: string) => void;
  /** 모든 Props 리셋 */
  resetAllProps: () => void;

  // ===== 계산된 값 =====
  /** 현재 컴포넌트의 Props 오버라이드 반환 */
  getCurrentOverrides: () => PropsOverrides;
  /** 수정 사항 존재 여부 */
  hasUnsavedChanges: () => boolean;

  // ===== 리셋 =====
  reset: () => void;
}

export const useComponentEditorStore = create<ComponentEditorState>((set, get) => ({
  // 초기 상태
  selectedComponent: null,
  selectedStoryId: null,
  editStates: new Map(),

  // 컴포넌트 선택
  selectComponent: (component) => {
    if (!component) {
      set({ selectedComponent: null, selectedStoryId: null });
      return;
    }

    // 기본 스토리 자동 선택 (첫 번째 스토리)
    const defaultStory = component.stories[0] ?? null;
    set({
      selectedComponent: component,
      selectedStoryId: defaultStory
    });
  },

  // 스토리 선택
  selectStory: (storyId) => set({ selectedStoryId: storyId }),

  // Props 업데이트
  updateProp: (propName, value) => {
    const { selectedComponent, editStates } = get();
    if (!selectedComponent) return;

    const componentId = selectedComponent.id;
    const currentState = editStates.get(componentId) ?? {
      overrides: {},
      isDirty: false,
      lastModified: 0,
    };

    const newOverrides = { ...currentState.overrides, [propName]: value };
    const newState: ComponentEditState = {
      overrides: newOverrides,
      isDirty: true,
      lastModified: Date.now(),
    };

    const newEditStates = new Map(editStates);
    newEditStates.set(componentId, newState);
    set({ editStates: newEditStates });
  },

  // 개별 Prop 리셋
  resetProp: (propName) => {
    const { selectedComponent, editStates } = get();
    if (!selectedComponent) return;

    const componentId = selectedComponent.id;
    const currentState = editStates.get(componentId);
    if (!currentState) return;

    const { [propName]: _, ...restOverrides } = currentState.overrides;
    const newState: ComponentEditState = {
      overrides: restOverrides,
      isDirty: Object.keys(restOverrides).length > 0,
      lastModified: Date.now(),
    };

    const newEditStates = new Map(editStates);
    newEditStates.set(componentId, newState);
    set({ editStates: newEditStates });
  },

  // 모든 Props 리셋
  resetAllProps: () => {
    const { selectedComponent, editStates } = get();
    if (!selectedComponent) return;

    const componentId = selectedComponent.id;
    const newEditStates = new Map(editStates);
    newEditStates.delete(componentId);
    set({ editStates: newEditStates });
  },

  // 현재 오버라이드 반환
  getCurrentOverrides: () => {
    const { selectedComponent, editStates } = get();
    if (!selectedComponent) return {};
    return editStates.get(selectedComponent.id)?.overrides ?? {};
  },

  // 수정 사항 존재 여부
  hasUnsavedChanges: () => {
    const { selectedComponent, editStates } = get();
    if (!selectedComponent) return false;
    return editStates.get(selectedComponent.id)?.isDirty ?? false;
  },

  // 전체 리셋
  reset: () => set({
    selectedComponent: null,
    selectedStoryId: null,
    editStates: new Map(),
  }),
}));
```

### 4.5 URL 생성 훅

```typescript
// hooks/useStorybookArgsUrl.ts

import { useMemo } from 'react';
import type { PropsOverrides } from '@/types/component-editor';

/**
 * Storybook iframe URL 생성 훅
 *
 * @param baseUrl - Storybook 기본 URL (예: https://storybook.example.com)
 * @param storyId - 스토리 ID (예: ui-button--primary)
 * @param args - Props 오버라이드 객체
 * @returns 완성된 iframe URL 또는 null
 *
 * @example
 * const url = useStorybookArgsUrl(
 *   'https://storybook.example.com',
 *   'ui-button--primary',
 *   { variant: 'outline', size: 'lg' }
 * );
 * // => https://storybook.example.com/iframe.html?id=ui-button--primary&viewMode=story&args=variant:outline;size:lg
 */
export function useStorybookArgsUrl(
  baseUrl: string | undefined,
  storyId: string | undefined,
  args: PropsOverrides
): string | null {
  return useMemo(() => {
    if (!baseUrl || !storyId) return null;

    // args를 Storybook 형식으로 인코딩
    // 형식: key:value;key2:value2
    const argsEntries = Object.entries(args).filter(
      ([, value]) => value !== undefined && value !== null
    );

    let argsString = '';
    if (argsEntries.length > 0) {
      argsString = argsEntries
        .map(([key, value]) => {
          const encodedValue = encodeArgValue(value);
          return `${key}:${encodedValue}`;
        })
        .join(';');
    }

    // URL 구성
    const params = new URLSearchParams({
      id: storyId,
      viewMode: 'story',
    });

    if (argsString) {
      params.set('args', argsString);
    }

    return `${baseUrl}/iframe.html?${params.toString()}`;
  }, [baseUrl, storyId, args]);
}

/**
 * args 값을 Storybook 형식으로 인코딩
 */
function encodeArgValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    // 객체는 JSON 문자열화 후 인코딩
    return encodeURIComponent(JSON.stringify(value));
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  // 문자열은 특수문자 인코딩
  return encodeURIComponent(String(value));
}
```

### 4.6 컨트롤 매핑 로직

```typescript
// components/features/props-editor/props-form.tsx (일부)

import type { PropInfo } from '@/types/ds-extraction';
import { TextControl } from './controls/text-control';
import { SelectControl } from './controls/select-control';
import { BooleanControl } from './controls/boolean-control';
import { NumberControl } from './controls/number-control';
import { ObjectControl } from './controls/object-control';

/**
 * PropInfo의 control 타입에 따라 적절한 컨트롤 컴포넌트 반환
 */
function getControlComponent(propInfo: PropInfo) {
  switch (propInfo.control) {
    case 'select':
      return SelectControl;
    case 'boolean':
      return BooleanControl;
    case 'number':
      return NumberControl;
    case 'object':
      return ObjectControl;
    case 'text':
    default:
      return TextControl;
  }
}
```

### 4.7 StorybookIframe 수정 스펙

```typescript
// components/features/preview/storybook-iframe.tsx (수정 후)

interface StorybookIframeProps extends React.ComponentProps<"div"> {
  url?: string;
  storyId?: string;
  args?: PropsOverrides;  // 신규 추가
}

function StorybookIframe({
  url,
  storyId,
  args = {},  // 기본값 빈 객체
  className,
  ...props
}: StorybookIframeProps) {
  // useStorybookArgsUrl 훅 사용
  const iframeSrc = useStorybookArgsUrl(url, storyId, args);

  // ... 나머지 로직 동일
}
```

### 4.8 데이터 흐름 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│                         User Actions                             │
└──────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐    ┌───────────────────┐    ┌────────────────┐
│ ComponentTree │    │    PropsPanel     │    │  Reset Button  │
│   (클릭)      │    │    (값 변경)      │    │                │
└───────┬───────┘    └─────────┬─────────┘    └────────┬───────┘
        │                      │                       │
        ▼                      ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                  useComponentEditorStore (Zustand)               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ selectedComponent | selectedStoryId | editStates (Map)  │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    useStorybookArgsUrl (Hook)                    │
│          (baseUrl, storyId, args) → encoded iframe URL           │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     StorybookIframe                              │
│                  src={generatedUrl} → 실시간 미리보기             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. 현재 구현 상태 분석

### 5.1 1막 완료 현황

| 기능 | 상태 | 비고 |
|------|------|------|
| Storybook URL 연동 | ✅ 완료 | index.json 파싱 |
| 컴포넌트 목록 표시 | ✅ 완료 | 트리 구조, 카테고리 그룹핑 |
| Props 메타데이터 추출 | ✅ 완료 | HTML ArgTypes 테이블 파싱 |
| Storybook 미리보기 | ✅ 완료 | iframe 렌더링 |
| AI 코드 생성 | ✅ 완료 | SSE 스트리밍 |
| 코드 미리보기 | ✅ 완료 | 탭 기반 전환 |

### 5.2 2막 미구현 현황

| 기능 | 상태 | 구현 계획 |
|------|------|----------|
| 컴포넌트 선택 상태 | ❌ 미구현 | Zustand 스토어 |
| Props 편집 패널 | ❌ 미구현 | 신규 컴포넌트 |
| Live Preview 업데이트 | ❌ 미구현 | args 쿼리 파라미터 |
| Props 상태 동기화 | ❌ 미구현 | Map 기반 상태 관리 |

### 5.3 기존 코드 활용 가능 영역

| 기존 코드 | 활용 방안 |
|----------|----------|
| `useCodeGenerationStore.ts` | Zustand 스토어 패턴 참고 |
| `PropInfo` 타입 | control 타입으로 컨트롤 매핑 |
| `StorybookIframe` | args prop 추가로 확장 |
| `ComponentTree` | onSelect 콜백 추가 |
| resizable-panels | 기존 레이아웃 유지 |

---

## 6. 기술 결정 사항

### 6.1 Live Preview 방식

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **A. Query Params** | Storybook 네이티브 지원, 구현 간단 | URL 길이 제한 | ✅ 선택 |
| B. PostMessage | 유연함 | Storybook 커스터마이징 필요 | ❌ |
| C. Custom Renderer | 완전한 제어 | 복잡도 높음, 유지보수 어려움 | ❌ |

**선택 이유**: Storybook은 `args` 쿼리 파라미터를 네이티브로 지원하며, 기존 iframe 구조를 그대로 활용할 수 있습니다.

### 6.2 상태 관리 방식

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **A. Zustand Store** | 기존 패턴 일관성, 간결함 | - | ✅ 선택 |
| B. React Context | React 순정 | 보일러플레이트 많음 | ❌ |
| C. URL State | 공유 가능 | 복잡도 증가 | ❌ |

**선택 이유**: 기존 `useCodeGenerationStore`와 동일한 패턴을 사용하여 코드베이스 일관성을 유지합니다.

### 6.3 PropsPanel 배치

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| **A. LeftPanel 하단** | 자연스러운 워크플로우 | 스크롤 증가 | ✅ 선택 |
| B. 별도 패널 | 넓은 공간 | 레이아웃 변경 필요 | ❌ |
| C. 모달 | 집중 편집 | 미리보기 가림 | ❌ |

**선택 이유**: 기존 레이아웃을 유지하면서 "위에서 선택 → 아래서 편집" 흐름을 제공합니다.

---

## 7. 구현 계획

### 7.1 Phase 1: 기반 (1-2일)

**목표**: 타입, 스토어, 훅 기반 구축

**태스크**:
- [ ] `types/component-editor.ts` 생성
- [ ] `stores/useComponentEditorStore.ts` 생성
- [ ] `hooks/useStorybookArgsUrl.ts` 생성
- [ ] 유닛 테스트 작성

**산출물**:
- 타입 정의 파일
- 동작하는 스토어 (콘솔에서 테스트 가능)
- URL 생성 훅

### 7.2 Phase 2: Props Editor UI (2-3일)

**목표**: Props 편집 UI 컴포넌트 개발

**태스크**:
- [ ] `props-editor/controls/text-control.tsx` 생성
- [ ] `props-editor/controls/select-control.tsx` 생성
- [ ] `props-editor/controls/boolean-control.tsx` 생성
- [ ] `props-editor/controls/number-control.tsx` 생성
- [ ] `props-editor/controls/object-control.tsx` 생성
- [ ] `props-editor/props-form.tsx` 생성
- [ ] `props-editor/props-panel.tsx` 생성
- [ ] Storybook 스토리 작성 (컴포넌트별)

**산출물**:
- 5개 컨트롤 컴포넌트
- PropsForm 동적 렌더링
- PropsPanel 메인 컴포넌트

### 7.3 Phase 3: 컴포넌트 트리 연동 (1일)

**목표**: 컴포넌트 선택 기능 구현

**태스크**:
- [ ] `component-item.tsx` 선택 상태 시각화 추가
- [ ] `component-tree.tsx` onSelect 이벤트 추가
- [ ] `component-list-section.tsx` 스토어 연결
- [ ] 선택 시 하이라이트 스타일 적용

**산출물**:
- 클릭 시 컴포넌트 선택 동작
- 선택된 컴포넌트 시각적 표시

### 7.4 Phase 4: Live Preview 연동 (1일)

**목표**: Props 변경 시 미리보기 실시간 업데이트

**태스크**:
- [ ] `storybook-iframe.tsx` args prop 추가
- [ ] `preview-section.tsx` 스토어 연결
- [ ] 디바운싱 적용 (text/number: 150ms)
- [ ] URL 생성 및 iframe 업데이트 검증

**산출물**:
- Props 변경 시 iframe URL 자동 업데이트
- 부드러운 사용자 경험 (디바운싱)

### 7.5 Phase 5: 레이아웃 통합 (0.5일)

**목표**: PropsPanel을 레이아웃에 통합

**태스크**:
- [ ] `desktop-layout.tsx`에 PropsPanel 추가
- [ ] 조건부 렌더링 (선택 시만 표시)
- [ ] 애니메이션 적용 (등장/사라짐)
- [ ] 모바일 대응 확인

**산출물**:
- 완성된 2막 UI
- 반응형 동작

### 7.6 Phase 6: 마무리 (0.5일)

**목표**: 엣지 케이스 처리 및 접근성

**태스크**:
- [ ] 빈 props 처리
- [ ] 복잡한 객체 props 처리
- [ ] 로딩/에러 상태 UI
- [ ] 키보드 네비게이션
- [ ] 최종 테스트

**산출물**:
- 안정적인 2막 기능
- 접근성 준수

---

## 8. 위험 요소 및 고려사항

### 8.1 기술적 위험

| 위험 | 영향도 | 발생 확률 | 완화 방안 |
|------|--------|----------|----------|
| Storybook args 미지원 | 높음 | 낮음 | 사전 테스트, fallback UI |
| URL 길이 제한 | 중간 | 낮음 | 큰 객체는 JSON 압축 |
| iframe 보안 정책 | 중간 | 낮음 | sandbox 속성 조정 |
| Base UI Hydration | 낮음 | 중간 | ClientOnly 래퍼 |

### 8.2 UX 고려사항

| 항목 | 고려 내용 |
|------|----------|
| **디바운싱** | Text/Number는 150ms, Select/Boolean은 즉시 |
| **로딩 상태** | iframe 로딩 중 스켈레톤 표시 |
| **에러 상태** | 잘못된 값 입력 시 경고 표시 |
| **편집 표시** | 수정된 컴포넌트에 시각적 마커 |
| **Reset 확인** | Reset All은 확인 다이얼로그 |

### 8.3 접근성 고려사항

| 항목 | 구현 방안 |
|------|----------|
| 키보드 | 트리 탐색(Arrow), 폼 이동(Tab) |
| 스크린리더 | aria-label, role 적용 |
| 포커스 | 선택 시 PropsPanel 포커스 이동 |
| 색상 대비 | WCAG AA 기준 충족 |

### 8.4 성능 고려사항

| 항목 | 최적화 방안 |
|------|------------|
| 리렌더링 | Zustand selector로 필요한 상태만 구독 |
| iframe 로딩 | 디바운싱으로 불필요한 로딩 방지 |
| 메모리 | 컴포넌트 선택 해제 시 editState 유지 (의도적) |

---

## 부록 A. 참고 파일 목록

| 파일 | 경로 | 참고 이유 |
|------|------|----------|
| Zustand 패턴 | `apps/web/stores/useCodeGenerationStore.ts` | 스토어 구조 참고 |
| Props 타입 | `apps/web/types/ds-extraction.ts` | PropInfo, DSComponent |
| Storybook iframe | `apps/web/components/features/preview/storybook-iframe.tsx` | 확장 대상 |
| 컴포넌트 트리 | `apps/web/components/features/component-list/component-tree.tsx` | 수정 대상 |
| 레이아웃 | `apps/web/components/layout/desktop-layout.tsx` | 통합 지점 |
| 상수 | `apps/web/lib/constants.ts` | 레이아웃 상수 |

## 부록 B. 용어 정리

| 용어 | 설명 |
|------|------|
| **Props** | React 컴포넌트에 전달되는 속성 값 |
| **args** | Storybook에서 스토리에 전달되는 인자 |
| **오버라이드** | 기본값을 덮어쓰는 사용자 지정 값 |
| **인스턴스** | 컴포넌트의 특정 사용 사례 |
| **정의** | ds.json에 저장된 컴포넌트 스펙 |
