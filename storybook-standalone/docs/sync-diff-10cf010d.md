# UI 동기화 Diff — 커밋 10cf010d + 692b392e (2026-03-27)

> `components.py` 업데이트 및 레이아웃 모듈 추가를 위한 참조 문서

**주요 커밋**:
- `10cf010d` — aplus-world-ui UI 라이브러리 동기화 (2026-03-27)
- `692b392e` — 추가 동기화: DataGrid, tokens, tailwind preset (2026-03-27)

**변경 규모**: 52 files changed, +1,830 / -333

---

## 1. components.py 반영 필요 사항 요약

### 화이트리스트 변경

| 변경          | 컴포넌트       | 비고                                            |
| ------------- | -------------- | ----------------------------------------------- |
| **추가**      | `FormGrid`     | 폼 필드 N단 그리드 레이아웃 컨테이너             |
| **추가**      | `FormGridCell` | FormGrid 개별 셀 (colSpan 병합 지원)             |
| **추가**      | `GridLayout`   | 12컬럼 12종 타입 기반 섹션 레이아웃             |
| **추가**      | `RowPattern`   | 행 단위 슬롯 기반 레이아웃 (간격 자동 관리)      |
| **추가**      | `RowSlot`      | RowPattern 내 슬롯 (filter, grid, detail 등)     |
| **추가**      | `SectionColumnProvider` | GridLayout 섹션 컨텍스트 (useSectionColumn) |

### 기존 컴포넌트 Breaking Changes

| 컴포넌트        | 주요 변경                                                                                | components.py 영향                       |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Button**      | `variant` → `buttonType` (outline→ghost, outline-destructive→secondary-destructive)      | 화이트리스트 props, 시스템 프롬프트 규칙 |
| **FilterBar**   | `actionSpan` 타입 제한 (`1 \| 2`만 허용, 3~12 제거)                                       | props 스키마 업데이트                    |
| **Dialog**      | 중첩 닫기 시 body overflow hidden 소실 수정                                              | 버그 수정 (API 변경 없음)                |
| **Drawer**      | Body/Footer 레이아웃 수정 (padding, gap 조정)                                           | 스타일 수정 (API 변경 없음)              |
| **Link**        | `RouterLinkProps` extends 제거 (as prop 제거)                                            | props 스키마 단순화                      |
| **DataGrid**    | 추가 컬럼 구성, 스크롤 동기화 개선, 인터페이스 확장                                      | 주요 업데이트 (섹션 5 참조)              |

### 시스템 프롬프트 규칙 업데이트 필요 항목

1. **Button variant 선택 규칙**: `variant` → `buttonType` 변경
   - `outline` → `ghost`
   - `outline-destructive` → `secondary-destructive`
   - 새로운 타입: `ghost-inverse` (ActionBar 내부용)

2. **FilterBar actionSpan 규칙**: 값 범위를 `1 | 2`로 제한 (이전: 1~12)

3. **Link API 간소화**: `as` prop 지원 제거 (RouterLinkProps 제거)

---

## 2. 신규 컴포넌트 — 레이아웃 모듈

### 2.1 FormGrid & FormGridCell

> 폼 필드를 N단(columns) 그리드로 배치하기 위한 레이아웃 컨테이너

**파일**: `src/layout/FormGrid.tsx`

#### FormGrid Props

| Prop      | 타입                 | 기본값 | 설명                           |
| --------- | -------------------- | ------ | ------------------------------ |
| `columns` | `1 \| 2 \| 3 \| 4`   | `2`    | 그리드 열 수                   |
| `title`   | `string`             | —      | 그리드 상단 타이틀 (optional)  |
| `mode`    | `'base' \| 'compact'`| auto   | SpacingModeProvider에서 상속   |

#### FormGridCell Props

| Prop     | 타입                    | 기본값 | 설명                                    |
| -------- | ----------------------- | ------ | --------------------------------------- |
| `colSpan` | `1 \| 2 \| 3 \| 4`     | `1`    | 열 병합 (FormGrid columns 내 상대값)    |
| `align`   | `'start' \| 'center' \| 'end'` | — | 셀의 수직 정렬                          |

#### 사용 예시

```tsx
<FormGrid columns={3} title="기본 정보">
  <FormGridCell>
    <LabelValue label="이름" text="홍길동" showLabel />
  </FormGridCell>
  <FormGridCell colSpan={2}>
    <LabelValue label="주소" text="서울특별시 강남구" showLabel />
  </FormGridCell>
  <FormGridCell>
    <LabelValue label="사번" text="A12345" showLabel />
  </FormGridCell>
</FormGrid>
```

#### 사용 토큰

| 용도                | 토큰명                            | base  | compact |
| ------------------- | --------------------------------- | ----- | ------- |
| column-gap          | `component-gap-field-group-x`     | 24px  | 20px    |
| row-gap             | `component-gap-field-group-y`     | 16px  | 12px    |
| title → grid 간격   | `layout-stack-md`                 | 12px  | 12px    |

---

### 2.2 GridLayout

> 12컬럼 12종 타입 기반 섹션 레이아웃 (가이드 Section 5 기반)

**파일**: `src/layout/GridLayout.tsx`

#### GridLayout Props

| Prop      | 타입                                               | 기본값 | 설명                    |
| --------- | -------------------------------------------------- | ------ | ----------------------- |
| `type`    | GridType (A-H)                                    | `'A'`  | 그리드 유형             |
| `gap`     | `string`                                           | `'gap-layout-inline-xl2'` | 섹션 간 gap 토큰 |
| `children`| `ReactNode`                                        | —      | 섹션 컨텐츠             |

#### GridType 정의

| 타입 | 컬럼 구성      | 설명          | 용도                   |
| ---- | -------------- | ------------- | ---------------------- |
| `A`  | 12             | 단일 영역형   | 기본 화면 구조         |
| `B`  | 6 + 6          | 균등 2열형    | 좌우 대칭 레이아웃     |
| `C`  | 3 + 9          | 목록+상세형   | 필터 + 그리드          |
| `C-2`| 9 + 3          | 목록+상세형   | 필터 + 그리드 (역순)   |
| `D`  | 4 + 8          | 필터 확장형   | 필터(좁음) + 그리드    |
| `D-2`| 8 + 4          | 필터 확장형   | 필터(좁음) + 그리드 (역순) |
| `E`  | 4 + 4 + 4      | 균등 3열형    | 3개 섹션 병렬          |
| `F`  | 2 + 8 + 2      | 중앙 집중형   | 중앙 강조              |
| `G`  | 2 + 2 + 8      | 탐색 2단계형  | 탐색 + 탐색 + 상세     |
| `H`  | 3 + 3 + 3 + 3  | 균등 4열형    | 4개 섹션 병렬          |

#### 사용 예시

```tsx
<GridLayout type="C">
  <div>{/* 필터 영역 (col-3) */}</div>
  <div>{/* 그리드 영역 (col-9) */}</div>
</GridLayout>

// SectionColumnProvider 자동 주입 — useSectionColumn() 후크로 열 크기 조회 가능
<GridLayout type="E">
  <div>섹션 1</div>
  <div>섹션 2</div>
  <div>섹션 3</div>
</GridLayout>
```

---

### 2.3 RowPattern & RowSlot

> 행 단위 슬롯 기반 레이아웃 (간격 자동 관리)

**파일**: `src/layout/RowPattern.tsx`

#### RowPattern Props

| Prop      | 타입              | 기본값 | 설명                                 |
| --------- | ----------------- | ------ | ------------------------------------ |
| `pattern` | RowPatternCode    | —      | 패턴 코드 (RP-1~RP-8, 검증용)        |
| `children`| `ReactNode`       | —      | RowSlot 컨텐츠                       |

#### RowSlot Props & SlotId

| Prop    | 타입   | 기본값 | 설명                           |
| ------- | ------ | ------ | ------------------------------ |
| `slot`  | SlotId | —      | 슬롯 ID (filter, grid, detail 등) |
| `children` | ReactNode | — | 슬롯 컨텐츠                    |

#### SlotId 정의 (가이드 용어 기반)

- `filter` — 검색/필터 영역
- `actions` — 버튼 영역
- `grid` — 데이터 그리드 영역
- `detail` — 상세 정보 영역
- `form` — 입력 폼 영역
- `summary` — 요약 통계 영역
- `navigation` — 탐색/트리 영역
- `section` — 병렬 비교 영역
- `info` — 기본 정보 표시 영역
- `tab` — 탭 전환 영역

#### 슬롯 간격 규칙 (가이드 Section 2.1 기반)

| 조합 | 간격 |
| --- | ---- |
| filter → grid | 20px |
| filter → summary | 12px |
| summary → actions | 12px |
| actions → grid | 12px |
| tab → filter | 20px |
| (기본값) | 20px |

#### 사용 예시

```tsx
<RowPattern pattern="RP-1">
  <RowSlot slot="filter">
    <FilterBar onReset={onReset} onSearch={onSearch} />
  </RowSlot>
  <RowSlot slot="actions">
    <Button label="삭제" buttonType="destructive" />
  </RowSlot>
  <RowSlot slot="grid">
    <DataGrid />
  </RowSlot>
</RowPattern>

// 탭 구조 (가이드 Section 2.1)
<RowPattern pattern="RP-8">
  <RowSlot slot="tab">
    <Tab />
  </RowSlot>
  <RowSlot slot="info">
    <FormGrid columns={3} />
  </RowSlot>
  <RowSlot slot="filter">
    <FilterBar />
  </RowSlot>
  <RowSlot slot="grid">
    <DataGrid />
  </RowSlot>
</RowPattern>
```

---

### 2.4 SectionColumnProvider & useSectionColumn

> GridLayout 내 섹션의 컬럼 정보 제공 (Context API)

**파일**: `src/layout/SectionColumnProvider.tsx`

#### Context Value

```tsx
export interface SectionColumnContextValue {
  columnSize: ColumnSize;  // 2 | 3 | 4 | 6 | 8 | 9 | 12
  gridType: GridType;      // 'A' | 'B' | 'C' | ...
  sectionIndex: number;    // 섹션 인덱스
}
```

#### 사용 예시

```tsx
function FilterSection() {
  const { columnSize, gridType } = useSectionColumn();

  return (
    <div>
      <p>현재 섹션: {columnSize}컬럼 ({gridType})</p>
    </div>
  );
}

<GridLayout type="C">
  <FilterSection /> {/* columnSize = 3 */}
  <div>{/* columnSize = 9 */}</div>
</GridLayout>
```

---

## 3. 삭제된 컴포넌트

**없음** — 이번 동기화에서는 컴포넌트 삭제 사항이 없습니다.

---

## 4. 기존 컴포넌트 Breaking Changes

### 4.1 Button — Variant 개편

#### Before (커밋 이전)

```tsx
<Button variant="primary" />
<Button variant="secondary" />
<Button variant="tertiary" />
<Button variant="outline" />           // ← 변경됨
<Button variant="destructive" />
<Button variant="outline-destructive" /> // ← 변경됨
```

#### After (10cf010d 이후)

```tsx
<Button buttonType="primary" />
<Button buttonType="secondary" />
<Button buttonType="tertiary" />
<Button buttonType="ghost" />          // outline → ghost
<Button buttonType="destructive" />
<Button buttonType="secondary-destructive" /> // outline-destructive → secondary-destructive
<Button buttonType="ghost-inverse" />  // 새로운 타입 (ActionBar용)
```

#### 마이그레이션 매핑표

| 이전 Props       | 신규 Props                        |
| ---------------- | --------------------------------- |
| `variant="outline"` | `buttonType="ghost"`              |
| `variant="outline-destructive"` | `buttonType="secondary-destructive"` |
| 기타 variant     | `buttonType` 그대로 대응           |

#### 스토리 예시 (Button.stories.tsx)

```tsx
// Primary
<Button buttonType="primary" size="md" label="Primary" />

// Ghost (구 outline)
<Button buttonType="ghost" size="md" label="Ghost" />

// Secondary-Destructive (구 outline-destructive)
<Button buttonType="secondary-destructive" size="md" label="Delete" />

// Ghost-Inverse (새로운, 다크 배경용)
<div style={{ background: '#7B68EE', padding: 24 }}>
  <Button buttonType="ghost-inverse" size="md" label="Action" />
</div>
```

---

### 4.2 FilterBar — actionSpan 타입 제한

#### Before (커밋 이전)

```tsx
// actionSpan: 1~12 모두 허용
<FilterBar actionSpan={3} onSearch={onSearch} onReset={onReset} />
<FilterBar actionSpan={6} onSearch={onSearch} onReset={onReset} />
```

#### After (10cf010d 이후)

```tsx
// actionSpan: 1 | 2 만 허용
<FilterBar actionSpan={1} onSearch={onSearch} onReset={onReset} />
<FilterBar actionSpan={2} onSearch={onSearch} onReset={onReset} />
```

#### Props 변경

| Prop | 변경 전 | 변경 후 | 설명 |
| --- | --- | --- | --- |
| `actionSpan` | `number (1~12)` | `1 \| 2` | 타입 제한 (우측 정렬 구현 최적화) |

#### 스토리 예시 (FilterBar.stories.tsx)

```tsx
// actionSpan={2} — 기본 (12컬럼 중 우측 2컬럼)
<FilterBar
  actionSpan={2}
  onReset={() => console.log('reset')}
  onSearch={() => console.log('search')}
>
  {/* 필터 필드들 */}
</FilterBar>

// actionSpan={1} — 액션 영역 좁음 (우측 1컬럼)
<FilterBar
  actionSpan={1}
  onReset={() => console.log('reset')}
  onSearch={() => console.log('search')}
>
  {/* 필터 필드들 */}
</FilterBar>
```

---

### 4.3 Dialog — 중첩 닫기 시 body overflow 수정

#### 변경 내용

- 중첩 Dialog 닫을 때 부모 Dialog가 열려있어도 `body { overflow: hidden }`이 제거되는 버그 수정
- `ModalStackProvider` 스택 관리 개선 (`useModalStack` hook 추가)

#### API 변경: 없음

Dialog 컴포넌트 Props는 변경되지 않았으며, 내부 스택 관리만 개선되었습니다.

#### 영향받는 컴포넌트

- `Dialog` (내부 개선)
- `Drawer` (내부 개선)
- `ModalStackProvider` (스택 추적 개선)

---

### 4.4 Drawer — Body/Footer 레이아웃 수정

#### 변경 내용

- Body 영역 padding/gap 조정
- Footer 영역 레이아웃 최적화

#### API 변경: 없음

Drawer 컴포넌트 Props는 변경되지 않았으며, 스타일링만 개선되었습니다.

---

### 4.5 Link — RouterLinkProps extends 제거

#### Before (커밋 이전)

```tsx
<Link as="a" href="/page">외부 링크</Link>
<Link asChild><CustomComponent /></Link>
```

#### After (10cf010d 이후)

```tsx
<Link href="/page">내부 링크</Link>
// as, asChild prop 제거됨
```

#### Props 변경

| Prop 제거 | 이유 |
| --- | --- |
| `as` | RouterLinkProps 제거 (Next.js Link API 정리) |
| `asChild` | RouterLinkProps 제거 |

---

### 4.6 DataGrid — 주요 업데이트 (커밋 692b392e)

#### 변경 내용

- 추가 컬럼 구성 옵션 확장 (+356 lines)
- 스크롤 동기화 개선
- 행/열 선택 인터페이스 확장

#### Props 스키마: 별도 검토 필요

DataGrid는 크기가 크고 인터페이스가 확장되었으므로, 별도의 상세 문서 검토가 권장됩니다.
(`storybook-standalone/packages/ui/src/components/DataGrid/DataGrid.tsx` 참조)

---

## 5. 디자인 토큰 변경

### 5.1 Color Token Changes

#### 주요 변경사항

- **semantic-error 색상 계열**: 값 재조정
  - `bg-semantic-error`: `#d32f2f` (유지)
  - `border-semantic-error`: `#d32f2f` (유지)
  - `bg-semantic-error-subtle`: `#fae6e6` (유지)

- **새로운 컬러 토큰 추가**:
  - `state-overlay-on-inverse-hover` / `state-overlay-on-inverse-pressed` — Ghost-Inverse 버튼용

#### 영향받는 컴포넌트

- Button (ghost-inverse variant)
- Alert, Badge, Toast (상태 표시)

---

### 5.2 Space Token Changes

#### 신규 추가 토큰

Layout 모듈 도입에 따른 새로운 gap/stack 토큰:

| 토큰명 | base | compact | 용도 |
| --- | --- | --- | --- |
| `layout-stack-lg` | 20px | 20px | 섹션 간 큰 간격 (RowPattern) |
| `layout-stack-md` | 12px | 12px | 섹션 간 중간 간격 |
| `layout-inline-xl2` | 48px | 48px | GridLayout 섹션 간 수평 간격 |
| `component-gap-field-group-x` | 24px | 20px | FormGrid 컬럼 간격 |
| `component-gap-field-group-y` | 16px | 12px | FormGrid 행 간격 |
| `component-gap-filterbar-items` | 16px | 12px | FilterBar 내 필드 간격 |

---

### 5.3 Component Definitions 업데이트

#### Button 컴포넌트 정의

새 `buttonType` variant 스키마:

```json
{
  "button": {
    "variants": {
      "buttonType": {
        "primary": "...",
        "secondary": "...",
        "ghost": "...",
        "tertiary": "...",
        "destructive": "...",
        "secondary-destructive": "...",
        "ghost-inverse": "..."
      }
    }
  }
}
```

#### FilterBar 컴포넌트 정의

새 `actionSpan` 타입:

```json
{
  "filterBar": {
    "props": {
      "actionSpan": {
        "type": "number",
        "enum": [1, 2],
        "default": 2
      }
    }
  }
}
```

---

### 5.4 Tailwind Preset 업데이트

#### 새로운 토큰 추가

- FormGrid 관련 spacing 토큰
- RowPattern 관련 spacing 토큰
- GridLayout 관련 spacing 토큰

#### 영향 범위

`storybook-standalone/packages/ui/tailwind.preset.js` 확장

---

## 6. 공통 아키텍처 패턴 변경

### 6.1 Layout 모듈 도입

#### 개요

`src/layout/` 디렉토리 신규 추가 (7개 파일):

```
src/layout/
├── FormGrid.tsx                  (FormGrid + FormGridCell)
├── GridLayout.tsx                (GridLayout)
├── RowPattern.tsx                (RowPattern + RowSlot)
├── SectionColumnProvider.tsx      (Context)
├── constants.ts                   (GRID_TYPE_DEFINITIONS, COL_SPAN_CLASS)
├── types.ts                       (TypeScript 타입 정의)
└── index.ts                       (Exports)
```

#### Exports (index.ts)

```tsx
export { GridLayout } from './GridLayout';
export { RowPattern, RowSlot } from './RowPattern';
export { SectionColumnProvider, useSectionColumn } from './SectionColumnProvider';
export * from './FormGrid';
export { COL_SPAN_CLASS, GRID_TYPE_DEFINITIONS } from './constants';
export type { ... } from './types';
```

#### 컴포넌트 index.ts 업데이트

```tsx
// Before
export * from './components';

// After
export * from './components';
export * from '../layout';  // ← 레이아웃 모듈 추가
```

---

### 6.2 FormGrid Pattern

#### 사용 시나리오

1. **기본 폼 입력**: N단 필드 배치
2. **필드 + OptionGroup 혼합**: 상단 정렬 (align prop)
3. **동적 열 수 변경**: SpacingModeProvider와 함께 사용

#### 주요 특징

- CVA (class-variance-authority) 기반 스타일
- SpacingModeProvider 자동 감지 (base / compact 모드)
- title prop으로 섹션 헤더 자동 생성

---

### 6.3 GridLayout Pattern

#### 사용 시나리오

1. **필터 + 그리드 레이아웃**: GridType C / C-2 / D / D-2
2. **대시보드 섹션 배치**: GridType E, F, G, H
3. **반응형 다중 섹션**: 최대 4개까지 지원

#### 주요 특징

- 12컬럼 Tailwind Grid 기반
- SectionColumnProvider 자동 주입
- useSectionColumn() hook로 섹션별 컬럼 정보 조회

---

### 6.4 RowPattern Pattern

#### 사용 시나리오

1. **테이블 구조**: Filter → Summary → Actions → Grid (RP-1)
2. **탭 + 폼**: Tab → Filter → Grid (RP-8)
3. **상세보기**: Navigation → Detail (RP-6)

#### 주요 특징

- SlotId별 자동 간격 관리 (가이드 Section 2.1 기반)
- 검증용 `pattern` code (RP-1 ~ RP-8)
- Flexbox 기반 행 방향 배치

---

## 7. 전체 컴포넌트 스토리 참조

### 7.1 Layout Components (신규 5종)

#### FormGrid
**스토리**: `src/stories/FormGrid.stories.tsx`
- Default: 2단 그리드
- ThreeColumnsWithSpan: 3단 + colSpan 병합
- WithTitle: 타이틀 포함
- WithFields: Field 조합
- CompactMode: Base vs Compact 비교
- ColumnsComparison: 1~4단 비교

#### GridLayout
**스토리**: `src/stories/GridLayout.stories.tsx` (커밋 10cf010d에서 신규 추가 예정)
- GridType A~H 각각 1개씩 8개 스토리
- 타입별 섹션 배치 시각화

#### RowPattern
**스토리**: `src/stories/RowPattern.stories.tsx` (커밋 10cf010d에서 신규 추가 예정)
- RP-1: 테이블 구조
- RP-2: 상세보기
- RP-8: 탭 + 폼

---

### 7.2 Basic Components

#### Button
**스토리**: `src/stories/Button.stories.tsx`
- 타입: primary, secondary, ghost, tertiary, destructive, secondary-destructive, ghost-inverse
- 크기: lg, md, sm
- 상태: default, hover, pressed, focused, disabled, loading
- 아이콘: showStartIcon, showEndIcon (size별 동적 선택)

#### IconButton
**스토리**: `src/stories/IconButton.stories.tsx`
- 타입: primary, secondary, ghost, tertiary, destructive, ghost-inverse
- 크기: lg, md, sm
- 아이콘 선택 드롭다운 포함

#### Link
**스토리**: `src/stories/Link.stories.tsx`
- href 기반 네비게이션
- 외부 링크 (target="_blank")

---

### 7.3 Form Components

#### Field
**스토리**: `src/stories/Field.stories.tsx`
- 크기: md, sm
- 상태: default, focus, filled, disabled, readonly, error
- 라벨, helptext 표시 옵션
- 프리픽스, 아이콘 지원

#### FieldGroup
**스토리**: `src/stories/FieldGroup.stories.tsx`
- 복합 필드 (Select + Field)
- 라벨 표시/숨김

#### Select
**스토리**: `src/stories/Select.stories.tsx`
- 크기: md, sm
- 옵션 목록
- 다중 선택 (multiselect)

#### Checkbox
**스토리**: `src/stories/Checkbox.stories.tsx`
- 상태: checked, unchecked, indeterminate
- 크기: md, sm

#### Radio
**스토리**: `src/stories/Radio.stories.tsx`
- 상태: checked, unchecked
- 크기: md, sm

#### OptionGroup
**스토리**: `src/stories/OptionGroup.stories.tsx`
- 방향: horizontal, vertical
- 크기: md, sm
- Option children으로 Radio/Checkbox 포함

#### ToggleSwitch
**스토리**: `src/stories/ToggleSwitch.stories.tsx`
- 상태: on, off
- 크기: md, sm

---

### 7.4 Data Display Components

#### Tag / TagGroup
**스토리**: `src/stories/Tag.stories.tsx`
- Removable tags
- Color variants

#### Badge
**스토리**: `src/stories/Badge.stories.tsx`
- 상태: primary, neutral, success, error, warning, info
- 스타일: solid, subtle

#### Chip / ChipGroup
**스토리**: `src/stories/Chip.stories.tsx`
- Selectable chips
- 아이콘 지원

#### LabelValue
**스토리**: `src/stories/LabelValue.stories.tsx`
- 읽기 전용 라벨-값 표시
- Field의 display 모드 대응

#### Tab
**스토리**: `src/stories/Tab.stories.tsx`
- 탭 전환 인터페이스
- 드래그 정렬 (react-beautiful-dnd)

#### DataGrid
**스토리**: `src/stories/DataGrid.stories.tsx`
- 컬럼 구성 (고정/유동)
- 행 선택 (체크박스)
- 정렬, 필터링
- 스크롤 동기화 (헤더/바디)

#### Chart
**스토리**: `src/stories/Chart.stories.tsx`
- 차트 유형별 예시

---

### 7.5 Feedback Components

#### Alert
**스토리**: `src/stories/Alert.stories.tsx`
- 타입: success, error, warning, info
- 닫기 버튼 지원

#### Toast
**스토리**: `src/stories/Toast.stories.tsx`
- 타입: success, error, warning, info
- 자동 dismiss 옵션
- 액션 버튼 지원

#### Tooltip
**스토리**: `src/stories/Tooltip.stories.tsx`
- 위치: top, right, bottom, left
- 지연 표시

---

### 7.6 Navigation Components

#### Menu
**스토리**: `src/stories/Menu.stories.tsx`
- 중첩 메뉴
- 아이콘 지원
- 구분선 (Divider)
- 위험 항목 (danger prop)

#### TreeMenu
**스토리**: `src/stories/TreeMenu.stories.tsx`
- 계층 구조 표시
- 확장/축소 (expand/collapse)
- 아이콘 지원

---

### 7.7 Overlay Components

#### Dialog
**스토리**: `src/stories/Dialog.stories.tsx`
- Modal 기본 동작
- 중첩 Dialog (스택 관리)
- 닫기 버튼, 액션 버튼

#### Drawer
**스토리**: `src/stories/Drawer.stories.tsx`
- 위치: right, left, top, bottom
- Body/Footer 레이아웃
- 닫기 동작

#### Popover
**스토리**: `src/stories/Popover.stories.tsx`
- Compound pattern (Popover.Trigger + Popover.Content)
- 위치 자동 조정

---

## 8. 마이그레이션 체크리스트

### components.py 업데이트 항목

- [ ] 화이트리스트에 `FormGrid`, `FormGridCell` 추가
- [ ] 화이트리스트에 `GridLayout` 추가
- [ ] 화이트리스트에 `RowPattern`, `RowSlot` 추가
- [ ] 화이트리스트에 `SectionColumnProvider`, `useSectionColumn` 추가
- [ ] Button `variant` prop → `buttonType` 규칙 추가
- [ ] Button `outline` → `ghost` 변환 규칙 추가
- [ ] Button `outline-destructive` → `secondary-destructive` 변환 규칙 추가
- [ ] Button `ghost-inverse` 새 타입 추가
- [ ] FilterBar `actionSpan` 범위 제한 (1|2만) 규칙 추가
- [ ] Link `as` prop 제거 (더 이상 사용 안 함)
- [ ] DataGrid props 스키마 검토 (별도 문서)

### 스토리 참조 정책

모든 신규/변경된 컴포넌트 사용법은 `src/stories/*.stories.tsx` 파일의 Default/Primary 스토리를 참조하세요.

---

## 9. 참고 자료

- **가이드 문서**: Figma Design System Guide (Section 2.1, Section 5, Section 6)
- **커밋 메시지**: `10cf010d`, `692b392e`
- **SYNC_GUIDE.md**: `storybook-standalone/docs/SYNC_GUIDE.md`
- **컴포넌트 소스**: `storybook-standalone/packages/ui/src/components/`, `src/layout/`
- **스토리 파일**: `storybook-standalone/packages/ui/src/stories/`
