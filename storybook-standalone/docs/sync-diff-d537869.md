# UI 동기화 Diff — 커밋 d537869 (2026-03-23)

> `components.py` 업데이트를 위한 참조 문서

**커밋**: `d5378693` — aplus-world-ui UI 라이브러리 동기화
**변경 규모**: 94 files changed, +12,818 / -6,260

---

## 1. components.py 반영 필요 사항 요약

### 화이트리스트 변경

| 변경 | 컴포넌트 | 비고 |
|------|----------|------|
| **삭제** | `Pagination` | 소스에서 컴포넌트 + hook + 스토리 전체 제거됨 |
| **추가 후보** | `ActionBar` | DataGrid 선택 시 플로팅 액션바 |
| **추가 후보** | `FilterBar` | 12컬럼 그리드 필터 패널 (초기화/조회 버튼 내장) |
| **추가 후보** | `LabelValue` | 읽기 전용 라벨-값 표시 (Field의 display 대응) |
| **추가 후보** | `Popover` | Compound 패턴 플로팅 콘텐츠 패널 |
| **추가 후보** | `TitleSection` | 페이지 헤더 (Breadcrumb + 제목 + 액션) |

### 기존 컴포넌트 Breaking Changes

| 컴포넌트 | 주요 변경 | components.py 영향 |
|----------|----------|-------------------|
| **Button** | `variant` -> `buttonType`, `isDisabled`/`isLoading` -> `interaction` | 화이트리스트 props, 시스템 프롬프트 규칙 |
| **Field** | `isDisabled`/`isReadOnly` -> `interaction`, `helperText` -> `helptext`, `multiline` 제거 | props 보충 데이터, 셀프클로징 규칙 |
| **Select** | `error`/`hasValue` -> `interaction`, `MenuItem` -> `MenuItemBase` | props 보충 데이터 |
| **Alert** | `variant` -> `type` | props 스키마 |
| **Toast** | `ToastVariant` -> `ToastType`, `AlertActions` 의존 제거 | 시스템 프롬프트 |
| **Tag** | children API -> `label` prop, `colorSwatch` -> `color` | props 스키마 |
| **OptionGroup** | `title` -> `label`, `helperText` -> `helptext`, `required` -> `showAsterisk` | props 스키마 |
| **IconButton** | `variant` -> `iconButtonType`, `isDisabled`/`isLoading` -> `interaction` | props 스키마 |
| **Menu/Item** | `state` -> `interaction`, `destructive` -> `danger`, Context 추가 | 내부 구조 |

### 시스템 프롬프트 규칙 업데이트 필요 항목

1. **`isDisabled`/`isReadOnly` 교정 규칙**: Button, Field, Select, IconButton 모두 `interaction` prop으로 통합됨. `disabled`/`readOnly` HTML 속성 보충도 재검토 필요
2. **Button variant 선택 규칙**: `variant` -> `buttonType`으로 변경, `ghost-inverse` 타입 추가 (ActionBar 내부용)
3. **Pagination 관련 규칙**: 화이트리스트에서 제거 필요
4. **Tag 사용 규칙**: `<Tag>텍스트</Tag>` -> `<Tag label="텍스트" />` 변경

---

## 2. 신규 컴포넌트

### 2.1 ActionBar

> 데이터 테이블/리스트에서 항목 선택 시 나타나는 플로팅 액션바

**파일**: `src/components/ActionBar.tsx`
**스토리**: `src/stories/ActionBar.stories.tsx`

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `count` | `number` | (필수) | 선택된 항목 수 |
| `children` | `ReactNode` | (필수) | 액션 버튼들 (Button ghost-inverse) |
| `visible` | `boolean` | `true` | 표시/숨김 + 애니메이션 |
| `onClose` | `() => void` | — | X 버튼 클릭 콜백 |
| `position` | `"fixed" \| "absolute"` | `"fixed"` | 위치 모드 |
| `selectionLabel` | `string` | `"개 선택됨"` | i18n용 라벨 |

#### 사용 예시 (ActionBar.stories.tsx — Default)

```tsx
<ActionBar
  count={3}
  position="absolute"
  visible={true}
  onClose={() => console.log('close')}
>
  <Button
    buttonType="ghost-inverse"
    size="md"
    label="다운로드"
    showStartIcon={true}
    startIcon={<Icon name="blank" size={16} />}
    showEndIcon={false}
  />
  <Button
    buttonType="ghost-inverse"
    size="md"
    label="삭제"
    showStartIcon={true}
    startIcon={<Icon name="blank" size={16} />}
    showEndIcon={false}
  />
</ActionBar>
```

---

### 2.2 FilterBar

> 12컬럼 CSS Grid 필터 패널. 초기화/조회 버튼 내장.

**파일**: `src/components/FilterBar.tsx`
**스토리**: `src/stories/FilterBar.stories.tsx`

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `children` | `ReactNode` | (필수) | `<div className="col-span-N">`으로 감싼 필터 요소들 |
| `mode` | `"base" \| "compact"` | `"base"` | 스페이싱 모드 (SpacingModeProvider 연동) |
| `onReset` | `() => void` | — | 초기화 버튼 콜백 |
| `onSearch` | `() => void` | — | 조회하기 버튼 콜백 |
| `isLoading` | `boolean` | `false` | 조회 중 로딩 상태 |
| `actionSpan` | `1~12` | `2` | 액션 버튼 영역 col-span |
| `showReset` | `boolean` | `true` | 초기화 버튼 표시 |
| `showSearch` | `boolean` | `true` | 조회하기 버튼 표시 |
| `resetLabel` | `string` | `"초기화"` | 초기화 버튼 라벨 |
| `searchLabel` | `string` | `"조회하기"` | 조회 버튼 라벨 |

#### 사용 예시 (FilterBar.stories.tsx — Default)

```tsx
<FilterBar mode="compact" onReset={() => {}} onSearch={() => {}}>
  {/* 각 필터를 col-span-N div로 감싸 12컬럼 그리드에 배치 */}
  <div className="col-span-2">
    <Select label="보험사" options={insurerOptions} showLabel size="sm" />
  </div>
  <div className="col-span-2">
    <Field label="상품명" showLabel placeholder="상품코드/보험사" size="sm" />
  </div>
  <div className="col-span-2">
    <FieldGroup label="계약번호 구분" size="sm">
      <Select options={contractNoTypeOptions} size="sm" />
      <Field placeholder="전체" size="sm" />
    </FieldGroup>
  </div>
  <div className="col-span-1">
    <Select label="계약구분" options={contractTypeOptions} showLabel size="sm" />
  </div>
  {/* ... Actions (span-2)는 onReset/onSearch props로 자동 렌더링 */}
</FilterBar>
```

**핵심 규칙**:
- 12컬럼 합계를 초과하면 CSS Grid auto-flow로 자동 줄바꿈
- `actionSpan` 만큼의 마지막 컬럼에 초기화+조회 버튼 자동 배치
- `SpacingModeProvider`를 내부에서 사용하여 내부 Field/Select spacing 자동 제어

---

### 2.3 LabelValue

> 읽기 전용 라벨-값 표시. Field의 display 모드 대응.

**파일**: `src/components/LabelValue.tsx`
**스토리**: `src/stories/LabelValue.stories.tsx`

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `text` | `string` | (필수) | 표시할 값 텍스트 |
| `size` | `"md" \| "sm"` | `"md"` | 컴포넌트 크기 (md=36px, sm=32px) |
| `labelWidth` | `"compact" \| "default" \| "wide"` | `"default"` | 라벨 너비 (120/160/200px) |
| `mode` | `"base" \| "compact"` | — | 스페이싱 모드 |
| `showLabel` | `boolean` | — | 라벨 표시 (Discriminated Union) |
| `label` | `string` | — | showLabel=true일 때 필수 |
| `showHelptext` | `boolean` | — | 도움말 표시 (Discriminated Union) |
| `helptext` | `string` | — | showHelptext=true일 때 필수 |
| `showPrefix` | `boolean` | — | 접두사 표시 |
| `showStartIcon` | `boolean` | — | 시작 아이콘 |
| `showEndIcon` | `boolean` | — | 끝 아이콘 |

#### 사용 예시 (LabelValue.stories.tsx — Default)

```tsx
<LabelValue
  size="md"
  mode="base"
  labelWidth="default"
  text="표시 값"
  showLabel={true}
  label="레이블"
  showHelptext={true}
  helptext="도움말 텍스트입니다."
  showPrefix={false}
  showStartIcon={false}
  showEndIcon={false}
/>
```

**LabelValue vs Field 구분**:

| 구분 | LabelValue | Field |
|------|-----------|-------|
| 용도 | 조회 전용 표시 | 입력/편집 |
| 레이아웃 | 수평 (label 왼쪽, value 오른쪽) | 수직 (label 상단, input 하단) |
| 값 영역 | `<p>` 텍스트 + `bg-field-bg-filled` | `<input>` + border |
| Interaction | 없음 (순수 조회) | default/editing/display/readonly/disabled |

---

### 2.4 Popover

> Compound 패턴 플로팅 콘텐츠 패널. Controlled/Uncontrolled 지원.

**파일**: `src/components/Popover.tsx`
**스토리**: `src/stories/Popover.stories.tsx`

#### Props — Root

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `open` | `boolean` | — | Controlled 열림 상태 |
| `defaultOpen` | `boolean` | `false` | Uncontrolled 기본값 |
| `onOpenChange` | `(open: boolean) => void` | — | 상태 변경 콜백 |

#### Sub-components

- `Popover.Trigger` — 트리거 요소 (children에 cloneElement)
- `Popover.Content` — 팝오버 콘텐츠 (Portal 렌더링)
  - `widthMode`: `"match-trigger" \| "hug-content"` (기본: `"hug-content"`)
  - `align`: `"start" \| "center" \| "end"` (기본: `"start"`)
  - `side`: `"bottom" \| "top"` (기본: `"bottom"`)
  - `sideOffset`: `number` (기본: `8`)
  - `maxHeight`: `number` (기본: `420`)
  - `mode`: `"base" \| "compact"`

#### 사용 예시 (Popover.stories.tsx — Default)

```tsx
<Popover>
  <Popover.Trigger>
    <Button label="툴바 열기" showStartIcon={false} showEndIcon={false} />
  </Popover.Trigger>
  <Popover.Content side="bottom" align="start" sideOffset={8}>
    <div className="flex items-center gap-2">
      <IconButton iconOnly={<Icon name="undo" size={20} />} iconButtonType="ghost" size="md" aria-label="실행 취소" tooltip="실행 취소" />
      <IconButton iconOnly={<Icon name="redo" size={20} />} iconButtonType="ghost" size="md" aria-label="다시 실행" tooltip="다시 실행" />
      <IconButton iconOnly={<Icon name="delete" size={20} />} iconButtonType="ghost-destructive" size="md" aria-label="삭제" tooltip="삭제" />
    </div>
  </Popover.Content>
</Popover>
```

---

### 2.5 TitleSection

> 페이지 상단 제목 + Breadcrumb + 액션 버튼 레이아웃.

**파일**: `src/components/TitleSection.tsx`
**스토리**: `src/stories/TitleSection.stories.tsx`

#### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `title` | `string` | (필수) | 페이지 제목 (h1) = breadcrumb 마지막 항목 |
| `menu2` | `string` | — | Title 바로 위 상위 경로 |
| `menu3` | `string` | — | Menu2 위 상위 경로 |
| `menu4` | `string` | — | Menu3 위 최상위 경로 |
| `showBreadcrumb` | `boolean` | `true` | Breadcrumb 표시 여부 |
| `showMenu2` | `boolean` | `true` | Menu2 표시 |
| `showMenu3` | `boolean` | `true` | Menu3 표시 |
| `showMenu4` | `boolean` | `false` | Menu4 표시 |
| `favorite` | `boolean` | — | 즐겨찾기 상태 (undefined=미표시) |
| `onFavoriteChange` | `(v: boolean) => void` | — | 즐겨찾기 토글 콜백 |
| `children` | `ReactNode` | — | 우측 액션 영역 |
| `mode` | `"base" \| "compact"` | `"base"` | CVA variant |

**Menu 계층 제약**: `showMenu4`는 `showMenu3=true`일 때만, `showMenu3`는 `showMenu2=true`일 때만 허용.

#### 사용 예시 (TitleSection.stories.tsx — Default)

```tsx
<TitleSection
  title="개인고객리스트"
  menu2="고객관리"
  menu3="고객관리"
  showBreadcrumb={true}
  showMenu2={true}
  showMenu3={true}
  showMenu4={false}
  favorite={false}
  onFavoriteChange={(v) => setFavorite(v)}
  mode="base"
>
  {/* 우측 액션 버튼 */}
  <Button buttonType="tertiary" size="sm" label="Excel 다운로드" showStartIcon={false} showEndIcon={true} endIcon={<Icon name="external" size={16} />} />
  <Button buttonType="secondary" size="sm" label="조회" showStartIcon={false} showEndIcon={false} />
  <Button buttonType="primary" size="sm" label="등록" showStartIcon={false} showEndIcon={false} />
</TitleSection>
```

---

## 3. 삭제된 컴포넌트

### Pagination (전체 제거)

- `src/components/Pagination/Pagination.tsx` (177줄)
- `src/components/Pagination/NumberButton.tsx` (49줄)
- `src/components/Pagination/Ellipsis.tsx` (32줄)
- `src/components/Pagination/index.ts` (3줄)
- `src/hooks/usePagination.ts` (90줄)
- `src/stories/Pagination.stories.tsx` (60줄)

**components.py 조치**: `AVAILABLE_COMPONENTS_WHITELIST`에서 `"Pagination"` 제거

---

## 4. 기존 컴포넌트 Breaking Changes

### 4.1 Button

**스토리**: `src/stories/Button.stories.tsx`

| 변경 | Before | After |
|------|--------|-------|
| variant prop 이름 | `variant` | `buttonType` |
| variant 값 | `"primary" \| "secondary" \| "outline" \| "outline-destructive" \| "destructive"` | 동일 + `"tertiary"` + `"ghost-inverse"` 추가 |
| 비활성 상태 | `isDisabled={true}` | `interaction="disabled"` |
| 로딩 상태 | `isLoading={true}` | `interaction="loading"` |
| 라벨 | `children` | `label` prop |
| 아이콘 | `<Button><Icon />텍스트</Button>` | `showStartIcon={true} startIcon={<Icon />} label="텍스트"` |

**사용 예시 (변경 후)**:

```tsx
// 기본 버튼
<Button buttonType="primary" size="md" label="확인" showStartIcon={false} showEndIcon={false} />

// 비활성 버튼
<Button buttonType="primary" interaction="disabled" label="비활성" showStartIcon={false} showEndIcon={false} />

// 로딩 버튼
<Button buttonType="primary" interaction="loading" label="처리중" showStartIcon={false} showEndIcon={false} />

// 아이콘 + 라벨
<Button buttonType="outline" size="sm" label="다운로드" showStartIcon={true} startIcon={<Icon name="blank" size={16} />} showEndIcon={false} />
```

---

### 4.2 Field

**스토리**: `src/stories/Field.stories.tsx`

| 변경 | Before | After |
|------|--------|-------|
| 비활성 | `isDisabled={true}` | `interaction="disabled"` |
| 읽기전용 | `isReadOnly={true}` | `interaction="readonly"` |
| 도움말 prop | `helperText` | `helptext` |
| 라벨 패턴 | `label="이름"` | `showLabel={true} label="이름"` (Discriminated Union) |
| 도움말 패턴 | `helperText="설명"` | `showHelptext={true} helptext="설명"` (Discriminated Union) |
| multiline | `multiline={true}` | **제거됨** |
| rowsVariant | `rowsVariant="flexible"` | **제거됨** |
| display 모드 | 없음 | `isDisplay={true}` 추가 |
| 아이콘 크기 | md=14px, sm=12px | md=20px, sm=16px |
| 아이콘 패턴 | `startIcon={<Icon />}` | `showStartIcon={true} startIcon={<Icon />}` |
| 라운딩 | md: `rounded-lg` (동일) | sm: `rounded-lg` -> `rounded-md` |

**사용 예시 (변경 후)**:

```tsx
// 기본 필드 (self-closing 유지)
<Field
  showLabel={true}
  label="이름"
  showHelptext={true}
  helptext="성명을 입력하세요"
  placeholder="홍길동"
  size="md"
  showStartIcon={false}
  showEndIcon={false}
/>

// 비활성 필드
<Field showLabel={true} label="이름" interaction="disabled" showHelptext={false} showStartIcon={false} showEndIcon={false} />

// display 모드 (읽기 전용 표시)
<Field showLabel={true} label="이름" isDisplay={true} value="홍길동" showHelptext={false} showStartIcon={false} showEndIcon={false} />
```

**components.py `_SCHEMA_SUPPLEMENTS` 변경 필요**: `disabled`/`readOnly` HTML 속성 보충 방식 재검토 (`interaction` prop과의 관계 정리)

---

### 4.3 Select

**스토리**: `src/stories/Select.stories.tsx`

| 변경 | Before | After |
|------|--------|-------|
| 에러 상태 | `error={true}` | `interaction="error"` |
| 비활성 | `isDisabled` (스키마) | `interaction="disabled"` |
| 값 존재 | `hasValue={true}` | 자동 감지 |
| 옵션 타입 | `MenuItem` 기반 | `MenuItemBase` 기반 |
| 라벨 패턴 | `label="선택"` | `showLabel={true} label="선택"` (Discriminated Union) |
| 도움말 패턴 | `helperText="설명"` | `showHelptext={true} helptext="설명"` |
| 아이콘 패턴 | `startIcon={<Icon />}` | `showStartIcon={true} startIcon={<Icon />}` |

**SelectOption 인터페이스** (MenuItemBase 기반):

```ts
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  badge?: string;
  badgeDot?: boolean;
  destructive?: boolean;
}
```

**사용 예시 (변경 후)**:

```tsx
<Select
  showLabel={true}
  label="보험사"
  options={[
    { value: 'samsung', label: '삼성생명' },
    { value: 'hanwha', label: '한화생명' },
  ]}
  placeholder="선택하세요"
  size="sm"
  onChange={(value) => setValue(value)}
  showHelptext={false}
  showStartIcon={false}
/>
```

> **onChange 시그니처는 동일**: `(value: string) => void` (NOT `e.target.value`)

---

### 4.4 Alert / Toast

**스토리**: `src/stories/Alert.stories.tsx`, `src/stories/Toast.stories.tsx`

| 변경 | Before | After |
|------|--------|-------|
| Alert variant | `variant="error"` | `type="error"` |
| Toast variant type | `ToastVariant` | `ToastType` |
| Toast action type | `AlertActions` (import) | `ToastAction { label, onClick }` (자체 정의) |
| Toast helper | `toast.success(msg)` 동일 | 내부: `createVariantFunction` -> `createTypeFunction` |

**사용 예시 (변경 후)**:

```tsx
// Alert
<Alert type="error" title="오류 발생" body="서버에 연결할 수 없습니다." />
<Alert type="info" title="안내" body="데이터가 저장되었습니다." />

// Toast (useToast hook 사용)
const toast = useToast();
toast.success('저장 완료');
toast.error('오류 발생');
toast({ message: '알림', type: 'info', actions: [{ label: '확인', onClick: () => {} }] });
```

---

### 4.5 Tag

**스토리**: `src/stories/Tag.stories.tsx`

| 변경 | Before | After |
|------|--------|-------|
| 텍스트 전달 | `<Tag>카테고리</Tag>` (children) | `<Tag label="카테고리" />` |
| 색상 스와치 | `colorSwatch="red"` | `tagType={TagType.SWATCH} color={TagColor.RED}` |
| 닫기 버튼 | `hasCloseButton={true}` | `tagType={TagType.CLOSABLE}` (implicit) |
| 폰트 | `text-caption-xs-regular` | `text-caption-sm-regular` |

**사용 예시 (변경 후)**:

```tsx
// 기본 태그
<Tag label="카테고리" />

// 색상 스와치 태그
<Tag tagType="swatch" color="red" label="중요" />

// 닫기 가능 태그
<Tag tagType="closable" label="제거 가능" onClose={() => console.log('제거')} />
```

---

### 4.6 OptionGroup

**스토리**: `src/stories/OptionGroup.stories.tsx`

| 변경 | Before | After |
|------|--------|-------|
| 제목 | `title="그룹명"` | `label="그룹명"` |
| 제목 표시 | 없음 | `showLabel={true}` |
| 필수 표시 | `required={true}` | `showAsterisk={true}` |
| 도움말 | `helperText="설명"` | `helptext="설명"` |
| 수평 배치 | `orientation="horizontal"` | 동일 + `flex-wrap` 추가 |
| Context | 없음 | `OptionGroupContext` 추가 (size 자동 전달) |

---

### 4.7 IconButton

**스토리**: `src/stories/IconButton.stories.tsx`

| 변경 | Before | After |
|------|--------|-------|
| variant | `variant="ghost"` | `iconButtonType="ghost"` |
| 비활성 | `isDisabled={true}` | `interaction="disabled"` |
| 로딩 | `isLoading={true}` | `interaction="loading"` |
| Tooltip | 외부에서 감싸기 | `tooltip` prop 내장 (Tooltip import 포함) |

**사용 예시 (변경 후)**:

```tsx
<IconButton
  iconOnly={<Icon name="search" size={20} />}
  iconButtonType="ghost"
  size="md"
  aria-label="검색"
  tooltip="검색"
/>
```

---

### 4.8 Menu / Menu.Item

**스토리**: `src/stories/Menu.stories.tsx`, `src/stories/MenuItemPreset.stories.tsx` (신규)

| 변경 | Before | After |
|------|--------|-------|
| Item state | `state="hover"` | `interaction="hover"` |
| Item danger | `destructive={true}` | `danger={true}` |
| MenuItem 타입 | `Menu.tsx` 내부 정의 | `types.ts`로 분리 (`MenuItemBase`, `MenuItem`) |
| Context | 없음 | `MenuContext` 추가 (compound component) |
| Exports | `MenuItem` (type) | `MenuItemBase`, `MenuItem` (types) + `menuHeadingVariants`, `menuItemVariants` |

---

### 4.9 DataGrid

**스토리**: `src/stories/Chart.stories.tsx` (변경 미미)

| 변경 | Before | After |
|------|--------|-------|
| 라이브러리 | `ag-grid-community` AllCommunityModule | `ag-grid-enterprise` AllEnterpriseModule |
| 테마 | `themeQuartz` 단일 | `themeQuartz`, `themeAlpine`, `themeBalham` 지원 |
| CSS import | 없음 | `'ag-grid-community/styles/ag-grid.css'` 추가 |

---

## 5. 디자인 토큰 변경

### color.json

- 새 변수 ID 추가 (`VariableID:4757:164268`, `4757:164269`)
- 다수 변수의 `scopes: []` -> `scopes: ["ALL_FILLS"]` 업데이트

### space.json

- 신규 spacing 토큰: `component-inset-label-value-x/y`, `component-inset-filterbar-*`, `component-inset-action-bar-*`
- 기존 토큰 값 조정 (mode별 compact 변형)

### typography.json

| 변경 | Before | After |
|------|--------|-------|
| 추가 | — | `body/md/bold` (Pretendard 700, 16px/24px) |
| 추가 | — | `body/sm/bold` (Pretendard 700, 14px/20px) |
| `caption/sm/medium` | 14px | 12px |
| `caption/xs/regular` | 14px | 12px |
| `table/header/medium` | 16px/24px | 14px/20px |

---

## 6. 공통 아키텍처 패턴 변경

### Discriminated Union Types

Field, Select, LabelValue, OptionGroup 등에서 `show*` + 값 prop을 묶는 패턴 도입:

```ts
// showLabel=true이면 label 필수, false이면 label 불가
type LabelProps =
  | { showLabel: true; label: string }
  | { showLabel: false; label?: never };
```

**components.py 영향**: AI가 생성하는 코드에서 `showLabel={true}` 없이 `label`만 전달하면 타입 에러. 시스템 프롬프트에 규칙 추가 필요.

### 통합 `interaction` prop

Button, Field, Select, IconButton에서 `isDisabled` / `isLoading` / `isReadOnly` 등 boolean flag를 단일 `interaction` enum으로 통합:

```ts
interaction: 'default' | 'hover' | 'pressed' | 'focused' | 'disabled' | 'loading'
// Field 전용: 'readonly' 추가
```

**components.py 영향**: `_supplement_schema()`의 `isDisabled -> disabled` 교정 로직 재검토. `interaction` prop이 스키마에 이미 포함되므로 HTML `disabled` 속성 보충 방식 재정립 필요.

### SpacingModeProvider

FilterBar, LabelValue, Popover 등 다수 컴포넌트가 `mode` prop (`"base" | "compact"`) 지원. `SpacingModeProvider` Context를 통해 일괄 제어 가능.

### Compound Component Context

Menu, Popover에서 Context API 기반 compound component 패턴 도입:

```tsx
// Popover
<Popover>
  <Popover.Trigger><Button /></Popover.Trigger>
  <Popover.Content>...</Popover.Content>
</Popover>

// Menu (기존 패턴 유지 + Context 추가)
```

---

## 7. 전체 컴포넌트 스토리 참조 및 사용 예시

> 모든 스토리 파일 경로는 `storybook-standalone/packages/ui/src/stories/` 기준입니다.
> 컴포넌트 파일 경로는 `storybook-standalone/packages/ui/src/components/` 기준입니다.

---

### Basic

#### Button

**스토리**: `Button.stories.tsx` | **변경됨** (buttonType + interaction 리팩터링)

```tsx
// 기본
<Button buttonType="primary" size="md" label="확인" showStartIcon={false} showEndIcon={false} />

// outline + 아이콘
<Button buttonType="outline" size="sm" label="다운로드"
  showStartIcon={true} startIcon={<Icon name="blank" size={16} />} showEndIcon={false} />

// 비활성 / 로딩
<Button buttonType="primary" interaction="disabled" label="비활성" showStartIcon={false} showEndIcon={false} />
<Button buttonType="primary" interaction="loading" label="처리중" showStartIcon={false} showEndIcon={false} />

// tertiary (신규 variant)
<Button buttonType="tertiary" size="sm" label="Excel 다운로드"
  showStartIcon={false} showEndIcon={true} endIcon={<Icon name="external" size={16} />} />

// ghost-inverse (ActionBar 내부용)
<Button buttonType="ghost-inverse" size="md" label="삭제"
  showStartIcon={true} startIcon={<Icon name="blank" size={16} />} showEndIcon={false} />
```

#### IconButton

**스토리**: `IconButton.stories.tsx` | **변경됨** (iconButtonType + interaction + tooltip 내장)

```tsx
<IconButton iconOnly={<Icon name="search" size={20} />} iconButtonType="ghost" size="md"
  aria-label="검색" tooltip="검색" />

<IconButton iconOnly={<Icon name="delete" size={20} />} iconButtonType="ghost-destructive" size="md"
  aria-label="삭제" tooltip="삭제" />

// 비활성
<IconButton iconOnly={<Icon name="search" size={20} />} iconButtonType="ghost" interaction="disabled"
  size="md" aria-label="검색" />
```

#### Link

**스토리**: `Link.stories.tsx` | 변경 미미

```tsx
<Link to="/" underline="on-hover" tone="link" size="md">Link</Link>
```

---

### Display

#### Alert

**스토리**: `Alert.stories.tsx` | **변경됨** (variant -> type)

```tsx
<Alert type="error" title="오류 발생" body="서버에 연결할 수 없습니다." />
<Alert type="info" title="안내" body="데이터가 저장되었습니다." />
<Alert type="success" title="완료" body="저장되었습니다." />
<Alert type="warning" title="주의" body="저장되지 않은 변경사항이 있습니다." />
```

#### Badge

**스토리**: `Badge.stories.tsx` | 변경 미미

```tsx
// level badge
<Badge type="level" level="primary" appearance="solid" label="Badge" mode="base" />

// dot badge (상대 위치 부모 필요)
<span className="relative inline-flex">
  <span className="truncate text-body-sm-regular text-text-secondary">알림</span>
  <Badge type="dot" position="top-right" mode="base" />
</span>
```

#### Chip

**스토리**: `Chip.stories.tsx` | 변경됨 (아이콘/interaction 리팩터링)

```tsx
// 기본 Chip (선택 가능)
<Chip label="카테고리" size="md" selected={false}
  showIcon={false} iconOnly={false} showClose={false}
  onClick={() => setSelected(!selected)} />

// 아이콘 + 닫기 버튼
<Chip label="필터" size="md" selected={true}
  showIcon={true} icon={<Icon name="blank" size={20} />}
  iconOnly={false} showClose={true} onClose={() => {}} />
```

#### ChipGroup

**스토리**: `Chip.stories.tsx` (Chip 스토리에 포함) | 변경 미미

```tsx
// 단일 선택 그룹
<ChipGroup selectionType="single" variant="no-scroll" mode="base">
  <Chip label="전체" size="md" showIcon={false} iconOnly={false} showClose={false} />
  <Chip label="카테고리1" size="md" showIcon={false} iconOnly={false} showClose={false} />
  <Chip label="카테고리2" size="md" showIcon={false} iconOnly={false} showClose={false} />
</ChipGroup>

// 복수 선택 + 스크롤 모드
<ChipGroup selectionType="multiple" variant="scroll" mode="base">
  <Chip label="태그1" size="md" showIcon={false} iconOnly={false} showClose={false} />
  <Chip label="태그2" size="md" showIcon={false} iconOnly={false} showClose={false} />
</ChipGroup>
```

**Props**:

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `selectionType` | `"single" \| "multiple"` | — | 선택 모드 |
| `variant` | `"scroll" \| "no-scroll"` | `"scroll"` | 스크롤/줄바꿈 모드 |
| `mode` | `"base" \| "compact"` | `"base"` | 스페이싱 모드 |
| `defaultValue` | `string \| string[]` | — | 초기 선택값 |
| `disabled` | `boolean` | — | 전체 비활성 |

#### Dialog

**스토리**: `Dialog.stories.tsx` | **변경됨** (compound variant)

```tsx
const [isOpen, setIsOpen] = useState(false);

<Button label="Open Dialog" onClick={() => setIsOpen(true)} showStartIcon={false} showEndIcon={false} />
<Dialog size="md" mode="base" open={isOpen} onClose={() => setIsOpen(false)}>
  <Dialog.Header title="Dialog Title" subtitle="부제목" />
  <Dialog.Body>Dialog content goes here.</Dialog.Body>
  <Dialog.Footer className="justify-between">
    <Option label="다시 보지 않기">
      <Checkbox value={dontShowAgain} onChange={() => {}} />
    </Option>
    <div className="flex gap-component-gap-control-group">
      <Button buttonType="outline" label="취소" onClick={() => setIsOpen(false)}
        showStartIcon={false} showEndIcon={false} />
      <Button buttonType="primary" label="확인" onClick={() => setIsOpen(false)}
        showStartIcon={false} showEndIcon={false} />
    </div>
  </Dialog.Footer>
</Dialog>
```

**ModalStackProvider를 사용한 중첩 Dialog 패턴**:

> Dialog/Drawer가 중첩될 때 z-index와 ESC 키 우선순위를 자동 관리합니다.
> 앱 최상단에 `ModalStackProvider`를 배치하면, 내부 Dialog/Drawer가 자동으로 스택에 등록됩니다.

```tsx
// 앱 최상단
<ModalStackProvider baseZIndex={40}>
  <App />
</ModalStackProvider>

// 중첩 Dialog 사용 (z-index 자동 관리)
const [outerOpen, setOuterOpen] = useState(false);
const [innerOpen, setInnerOpen] = useState(false);

{/* 첫 번째 Dialog — z-index: 40 */}
<Dialog open={outerOpen} onClose={() => setOuterOpen(false)}>
  <Dialog.Header title="외부 Dialog" />
  <Dialog.Body>
    <Button label="내부 Dialog 열기" onClick={() => setInnerOpen(true)}
      showStartIcon={false} showEndIcon={false} />
  </Dialog.Body>
  <Dialog.Footer>
    <Button buttonType="primary" label="확인" onClick={() => setOuterOpen(false)}
      showStartIcon={false} showEndIcon={false} />
  </Dialog.Footer>
</Dialog>

{/* 두 번째 Dialog — z-index: 50 (자동 증가) */}
<Dialog open={innerOpen} onClose={() => setInnerOpen(false)}>
  <Dialog.Header title="내부 Dialog" />
  <Dialog.Body>이 Dialog가 최상위이므로 ESC 키로 이것만 닫힙니다.</Dialog.Body>
  <Dialog.Footer>
    <Button buttonType="primary" label="확인" onClick={() => setInnerOpen(false)}
      showStartIcon={false} showEndIcon={false} />
  </Dialog.Footer>
</Dialog>
```

> `ModalStackProvider` 없이도 단일 Dialog/Drawer는 정상 동작합니다. 중첩 모달이 필요할 때만 Provider를 배치하세요.

#### Drawer

**스토리**: `Drawer.stories.tsx` | **변경됨** (레이아웃 개선)

```tsx
const [isOpen, setIsOpen] = useState(false);

<Button label="Open Drawer" onClick={() => setIsOpen(true)} showStartIcon={false} showEndIcon={false} />
<Drawer size="md" mode="base" dim={true} open={isOpen} onClose={() => setIsOpen(false)}>
  <Drawer.Header title="Drawer Title" showSubtitle={false} />
  <Drawer.Body>Drawer content goes here.</Drawer.Body>
  <Drawer.Footer>
    <Button buttonType="outline" label="닫기" onClick={() => setIsOpen(false)}
      showStartIcon={false} showEndIcon={false} />
    <Button buttonType="primary" label="저장" onClick={() => setIsOpen(false)}
      showStartIcon={false} showEndIcon={false} />
  </Drawer.Footer>
</Drawer>
```

#### Divider

**스토리**: `Divider.stories.tsx` | 변경 미미

```tsx
<Divider orientation="horizontal" tone="default" />
<Divider orientation="vertical" tone="default" />
<Divider orientation="horizontal" tone="inverse" /> {/* 어두운 배경용 */}
```

#### Tag

**스토리**: `Tag.stories.tsx` | **변경됨** (label prop + tagType)

```tsx
<Tag label="카테고리" />
<Tag tagType="swatch" color="red" label="중요" />
<Tag tagType="closable" label="제거 가능" onClose={() => console.log('제거')} />
```

#### TagGroup

**스토리**: `Tag.stories.tsx` (Tag 스토리에 포함) | 변경됨 (label prop 연동)

```tsx
// 기본 줄바꿈(wrap)
<TagGroup layout="wrap" mode="base">
  <Tag label="태그1" />
  <Tag label="태그2" />
  <Tag label="태그3" />
</TagGroup>

// 접히기 모드 (collapsible) — 초과 태그 숨김
<TagGroup layout="collapsible" maxVisibleTags={3} mode="base">
  <Tag label="태그1" />
  <Tag label="태그2" />
  <Tag label="태그3" />
  <Tag label="태그4" />
  <Tag label="태그5" />
</TagGroup>

// 수평 스크롤
<TagGroup layout="horizontalScroll" mode="base">
  <Tag label="태그1" />
  <Tag label="태그2" />
</TagGroup>

// 인라인 (overflow hidden)
<TagGroup layout="inline" mode="base">
  <Tag label="태그1" />
  <Tag label="태그2" />
</TagGroup>
```

**Props**:

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `layout` | `"wrap" \| "collapsible" \| "horizontalScroll" \| "inline"` | `"wrap"` | 레이아웃 모드 |
| `maxVisibleTags` | `number` | `Infinity` | collapsible 모드에서 보여줄 태그 수 |
| `mode` | `"base" \| "compact"` | `"base"` | 스페이싱 모드 |

#### Tooltip

**스토리**: `Tooltip.stories.tsx` | **변경됨** (포지셔닝 업데이트)

```tsx
// 기본 (truncation=false)
<Tooltip content="툴팁 내용" side="top">
  <Button label="호버하세요" showStartIcon={false} showEndIcon={false} />
</Tooltip>

// 스크롤 가능한 긴 텍스트 (truncation=true)
<Tooltip content="매우 긴 텍스트..." truncation={true} side="bottom">
  <Button label="호버하세요" showStartIcon={false} showEndIcon={false} />
</Tooltip>
```

#### Toast

**스토리**: `Toast.stories.tsx` | **변경됨** (ToastVariant -> ToastType)

```tsx
const toast = useToast();
toast.success('저장 완료');
toast.error('오류 발생');
toast.warning('주의');
toast.info('안내 메시지');
toast({ message: '알림', type: 'info', actions: [{ label: '확인', onClick: () => {} }] });
```

---

### Form

#### Field

**스토리**: `Field.stories.tsx` | **변경됨** (Discriminated Union + interaction)

```tsx
// 기본 (self-closing 유지)
<Field showLabel={true} label="이름" showHelptext={true} helptext="성명을 입력하세요"
  placeholder="홍길동" size="md" showStartIcon={false} showEndIcon={false} />

// 라벨 없음
<Field showLabel={false} placeholder="검색어 입력" size="sm"
  showHelptext={false} showStartIcon={false} showEndIcon={false} />

// 비활성 / 읽기전용
<Field showLabel={true} label="이름" interaction="disabled"
  showHelptext={false} showStartIcon={false} showEndIcon={false} />
<Field showLabel={true} label="이름" interaction="readonly" value="홍길동"
  showHelptext={false} showStartIcon={false} showEndIcon={false} />

// display 모드 (읽기 전용 표시)
<Field showLabel={true} label="이름" isDisplay={true} value="홍길동"
  showHelptext={false} showStartIcon={false} showEndIcon={false} />
```

#### FieldGroup

**스토리**: `FieldGroup.stories.tsx` | 변경 미미

```tsx
// 휴대폰 번호 — 여러 필드를 그룹화
<FieldGroup label="휴대폰 번호" helperText="연락 가능한 번호를 입력하세요." size="md" mode="base">
  <Select options={phoneOptions} placeholder="선택" className="w-[100px]" size="md" />
  <Field placeholder="0000" className="flex-1" size="md" />
  <Field placeholder="0000" className="flex-1" size="md" />
</FieldGroup>
```

#### Select

**스토리**: `Select.stories.tsx` | **변경됨** (MenuItemBase + interaction)

```tsx
<Select
  showLabel={true} label="보험사"
  options={[
    { value: 'samsung', label: '삼성생명' },
    { value: 'hanwha', label: '한화생명' },
  ]}
  placeholder="선택하세요" size="sm"
  onChange={(value) => setValue(value)}
  showHelptext={false} showStartIcon={false}
/>

// 비활성 / 에러
<Select showLabel={true} label="보험사" interaction="disabled" options={[]} showHelptext={false} showStartIcon={false} />
<Select showLabel={true} label="보험사" interaction="error" options={[]}
  showHelptext={true} helptext="필수 선택 항목입니다." showStartIcon={false} />
```

> **onChange 시그니처**: `(value: string) => void` (NOT `e.target.value`)

#### Checkbox

**스토리**: `Checkbox.stories.tsx` | 변경 미미 (interaction 용어 통일)

```tsx
const [value, setValue] = useState<'unchecked' | 'checked'>('unchecked');

<Checkbox
  value={value}
  interaction="default"
  size="18"
  onChange={() => setValue(prev => prev === 'unchecked' ? 'checked' : 'unchecked')}
  aria-label="Checkbox"
/>

// 비활성
<Checkbox value="unchecked" interaction="disabled" size="18" aria-label="Disabled" />
```

#### Radio

**스토리**: `Radio.stories.tsx` | 변경 미미 (interaction 용어 통일)

```tsx
const [value, setValue] = useState<'unchecked' | 'checked'>('unchecked');

<Radio
  value={value}
  interaction="default"
  size="18"
  onChange={() => setValue(prev => prev === 'unchecked' ? 'checked' : 'unchecked')}
  aria-label="Radio button"
/>
```

#### ToggleSwitch

**스토리**: `ToggleSwitch.stories.tsx` | 변경 미미

```tsx
const [selected, setSelected] = useState<'on' | 'off'>('off');

<ToggleSwitch
  selected={selected}
  onChange={() => setSelected(prev => prev === 'on' ? 'off' : 'on')}
  aria-label="Toggle"
/>
```

#### Option

**스토리**: `Option.stories.tsx` | 변경 미미

```tsx
// Radio와 조합
<Option label="옵션 A" size="md" mode="base">
  <Radio value="checked" interaction="default" onChange={() => {}} aria-label="radio" />
</Option>

// Checkbox와 조합
<Option label="옵션 B" size="md" mode="base">
  <Checkbox value="unchecked" onChange={() => {}} aria-label="checkbox" />
</Option>
```

#### OptionGroup

**스토리**: `OptionGroup.stories.tsx` | **변경됨** (label + showLabel + Context)

```tsx
<OptionGroup label="WM상담" showLabel={true} orientation="horizontal" size="sm">
  <Option label="체결" size="sm">
    <Checkbox size="18" value="unchecked" />
  </Option>
</OptionGroup>

<OptionGroup label="전자서명" showLabel={true} orientation="horizontal" size="sm">
  <Option label="N" size="sm">
    <Radio size="18" value="checked" />
  </Option>
  <Option label="Y" size="sm">
    <Radio size="18" value="unchecked" />
  </Option>
</OptionGroup>
```

---

### Navigation

#### Menu

**스토리**: `Menu.stories.tsx`, `MenuItemPreset.stories.tsx` (신규) | **변경됨** (Compound component + Context)

```tsx
// MenuItemPreset 프리셋 유형
// Text Only
{ type: 'text-only', id: '1', label: '메뉴 이름' }
// Icon + Label
{ type: 'icon-label', id: '1', label: '아이콘과 메뉴', leadingIcon: <Icon name="widgets" size={20} /> }
// Shortcut
{ type: 'shortcut', id: '1', label: '복사하기', shortcutText: 'Ctrl+C' }
// Destructive
{ type: 'text-only', id: '1', label: '삭제', danger: true }
```

#### TreeMenu

**스토리**: `TreeMenu.stories.tsx` | **변경됨** (interaction 리팩터링)

```tsx
const items = [
  { id: '1', label: '메뉴 1', children: [
    { id: '1-1', label: '하위 메뉴 1-1' },
    { id: '1-2', label: '하위 메뉴 1-2' },
  ]},
  { id: '2', label: '메뉴 2' },
];

<TreeMenu
  size="md"
  items={items}
  onItemClick={(item) => console.log(item.label)}
  onExpandToggle={(id, isExpanded) => console.log(id, isExpanded)}
/>
```

#### Tab

**스토리**: `Tab.stories.tsx` | 변경됨 (spacing 조정)

```tsx
const [value, setValue] = useState('home');

const items = [
  { value: 'home', label: '홈' },
  { value: 'profile', label: '프로필' },
  { value: 'settings', label: '설정' },
];

<Tab items={items} value={value} onChange={setValue} widthMode="content" mode="base" />
```

#### Segment

**스토리**: `Segment.stories.tsx` | 변경됨 (styling 조정)

```tsx
const [value, setValue] = useState('day');

const items = [
  { value: 'day', label: '일간' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
];

<Segment items={items} value={value} onChange={setValue} size="md" widthMode="equal" mode="base" />
```

---

### Layout / Composite

#### ActionBar

**스토리**: `ActionBar.stories.tsx` | **신규**

```tsx
<ActionBar count={3} position="absolute" visible={true} onClose={() => {}}>
  <Button buttonType="ghost-inverse" size="md" label="다운로드"
    showStartIcon={true} startIcon={<Icon name="blank" size={16} />} showEndIcon={false} />
  <Button buttonType="ghost-inverse" size="md" label="삭제"
    showStartIcon={true} startIcon={<Icon name="blank" size={16} />} showEndIcon={false} />
</ActionBar>
```

#### FilterBar

**스토리**: `FilterBar.stories.tsx` | **신규**

```tsx
<FilterBar mode="compact" onReset={() => {}} onSearch={() => {}}>
  <div className="col-span-2">
    <Select showLabel={true} label="보험사" options={options} size="sm" showHelptext={false} showStartIcon={false} />
  </div>
  <div className="col-span-2">
    <Field showLabel={true} label="상품명" placeholder="검색" size="sm" showHelptext={false} showStartIcon={false} showEndIcon={false} />
  </div>
  {/* 12컬럼 합계 초과 시 자동 줄바꿈. 마지막 actionSpan(기본2) 컬럼에 버튼 자동 배치 */}
</FilterBar>
```

#### LabelValue

**스토리**: `LabelValue.stories.tsx` | **신규**

```tsx
<LabelValue
  size="md" mode="base" labelWidth="default"
  text="표시 값"
  showLabel={true} label="레이블"
  showHelptext={false}
  showPrefix={false} showStartIcon={false} showEndIcon={false}
/>
```

#### Popover

**스토리**: `Popover.stories.tsx` | **신규**

```tsx
<Popover>
  <Popover.Trigger>
    <Button label="열기" showStartIcon={false} showEndIcon={false} />
  </Popover.Trigger>
  <Popover.Content side="bottom" align="start" sideOffset={8}>
    <div className="flex items-center gap-2">
      <IconButton iconOnly={<Icon name="undo" size={20} />} iconButtonType="ghost" size="md" aria-label="실행 취소" tooltip="실행 취소" />
      <IconButton iconOnly={<Icon name="delete" size={20} />} iconButtonType="ghost-destructive" size="md" aria-label="삭제" tooltip="삭제" />
    </div>
  </Popover.Content>
</Popover>
```

#### TitleSection

**스토리**: `TitleSection.stories.tsx` | **신규**

```tsx
<TitleSection
  title="개인고객리스트"
  menu2="고객관리" menu3="고객관리"
  showBreadcrumb={true} showMenu2={true} showMenu3={true} showMenu4={false}
  favorite={false} onFavoriteChange={(v) => setFavorite(v)}
  mode="base"
>
  <Button buttonType="tertiary" size="sm" label="Excel 다운로드"
    showStartIcon={false} showEndIcon={true} endIcon={<Icon name="external" size={16} />} />
  <Button buttonType="primary" size="sm" label="등록"
    showStartIcon={false} showEndIcon={false} />
</TitleSection>
```

#### FormGrid

**스토리**: `FormGrid.stories.tsx` | **신규** (스토리 전용 레이아웃)

```tsx
<FormGrid columns={2}>
  <FormGridCell>
    <LabelValue showLabel={true} label="이름" text="홍길동" size="md"
      showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
  </FormGridCell>
  <FormGridCell>
    <LabelValue showLabel={true} label="사번" text="A12345" size="md"
      showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
  </FormGridCell>
</FormGrid>
```

---

### Data

#### DataGrid

**스토리**: `Chart.stories.tsx` (AG Grid) | **변경됨** (enterprise 마이그레이션)

> DataGrid는 AG Grid Enterprise 래퍼. 프리뷰 미지원 (UMD stub).

#### Chart

**스토리**: `Chart.stories.tsx` | 변경 미미

> AG Charts 래퍼. DataGrid와 동일 스토리 파일에서 관리.

---

### Utility / Provider

#### Icon

**파일**: `Icon.tsx` | **변경됨** (IconName -> 사이즈별 타입 분리, IconSize 타입 추가)

| 변경 | Before | After |
|------|--------|-------|
| 아이콘 이름 타입 | `IconName` (단일) | `IconName16`, `IconName18`, `IconName20`, `IconName24`, `IconName28` (사이즈별) |
| 사이즈 타입 | 없음 | `IconSize = 16 \| 18 \| 20 \| 24 \| 28` |
| 아이콘 수 | 기존 | 대폭 추가 (size별 분류) |

**IconSize별 주요 용도**:

| Size | 용도 |
|------|------|
| `16` | Button/Chip startIcon/endIcon (sm), Tag 아이콘 |
| `18` | Checkbox, Radio 내부 |
| `20` | Button/Chip startIcon/endIcon (md), IconButton (md), Menu/Item leadingIcon, Select/Field 아이콘 |
| `24` | IconButton (lg), TitleSection favorite, ActionBar 닫기 버튼 |
| `28` | 대형 아이콘 용도 |

**사용 예시**:

```tsx
// 직접 사용
<Icon name="search" size={20} />
<Icon name="close" size={16} className="text-icon-interactive-default" />
<Icon name="star-fill" size={24} className="text-[#EAB308]" />

// createIcon 헬퍼 (스토리/동적 생성용)
import { createIcon } from './Icon';
const icon = createIcon('search', 20); // React.createElement(Icon, { name: 'search', size: 20 })
```

**주요 IconName20 목록** (20px — 가장 많이 사용):
`add`, `arrow-right`, `blank`, `calendar`, `check`, `chevron-down`, `chevron-left`, `chevron-right`, `chevron-up`, `close`, `delete`, `edit`, `error`, `external`, `filter-list`, `folder`, `info`, `link`, `person`, `redo`, `search`, `settings`, `star-fill`, `star-line`, `undo`, `widgets` 등

**주요 IconName16 목록** (16px):
`add`, `blank`, `calendar`, `check`, `chevron-down`, `close`, `delete`, `edit`, `external`, `loading`, `minus`, `search`, `star-fill`, `star-line` 등

#### LoadingSpinner

**파일**: `LoadingSpinner.tsx` | 변경 미미 (variant 목록 업데이트)

> Button/IconButton 내부에서 `interaction="loading"` 시 자동 사용되는 Lottie 애니메이션 스피너.
> 직접 사용하는 경우는 드뭄.

```tsx
// Button/IconButton 내부적으로 사용 (직접 호출할 필요 없음)
<LoadingSpinner variant="primary" size={20} />
```

**variant -> 스피너 색상 매핑**:

| variant | 스피너 |
|---------|--------|
| `primary`, `destructive`, `ghost-inverse` | White |
| `secondary`, `tertiary`, `ghost` | Grey |
| `outline` | Blue |
| `outline-destructive`, `ghost-destructive` | Red |

#### SpacingModeProvider

**파일**: `SpacingModeProvider.tsx` | 변경 미미

> 하위 컴포넌트의 spacing mode를 일괄 제어하는 Context Provider.
> FilterBar, LabelValue, Popover, Field, Select 등이 이 Context를 참조함.

```tsx
// 전역 모드 설정
<SpacingModeProvider mode="compact">
  <App />
</SpacingModeProvider>

// 중첩 오버라이드
<SpacingModeProvider mode="base">
  <Dashboard>
    <SpacingModeProvider mode="compact">
      <FilterBar onReset={() => {}} onSearch={() => {}}>...</FilterBar>
    </SpacingModeProvider>
  </Dashboard>
</SpacingModeProvider>
```

**Props**:

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `mode` | `"base" \| "compact"` | 부모 상속 | 스페이싱 모드 |

**Hook**: `useSpacingMode()` — 현재 spacing mode 반환

#### ModalStackProvider

**파일**: `ModalStackProvider.tsx` | 변경 미미

> 중첩 모달(Dialog, Drawer)의 z-index와 포커스를 자동 관리하는 Provider.
> Dialog/Drawer 내부에서 자동 사용됨.

```tsx
// 앱 최상단에 배치
<ModalStackProvider baseZIndex={40}>
  <App />
</ModalStackProvider>
```

**Props**:

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `baseZIndex` | `number` | `40` | z-index 시작값 |

**Hook**: `useModalStackContext()` — `{ register, unregister, isTopModal, getZIndex }` 반환

---

### 스토리 파일 전체 인덱스

| # | 컴포넌트 | 스토리 파일 | 상태 | 분류 |
|---|----------|------------|------|------|
| 1 | Button | `Button.stories.tsx` | 변경됨 | 입력 |
| 2 | IconButton | `IconButton.stories.tsx` | 변경됨 | 입력 |
| 3 | Checkbox | `Checkbox.stories.tsx` | 변경 미미 | 입력 |
| 4 | Radio | `Radio.stories.tsx` | 변경 미미 | 입력 |
| 5 | ToggleSwitch | `ToggleSwitch.stories.tsx` | 변경 미미 | 입력 |
| 6 | Select | `Select.stories.tsx` | 변경됨 | 입력 |
| 7 | Field | `Field.stories.tsx` | 변경됨 | 입력 |
| 8 | FieldGroup | `FieldGroup.stories.tsx` | 변경 미미 | 입력 |
| 9 | Alert | `Alert.stories.tsx` | 변경됨 | 표시 |
| 10 | Badge | `Badge.stories.tsx` | 변경 미미 | 표시 |
| 11 | Chip | `Chip.stories.tsx` | 변경됨 | 표시 |
| 12 | ChipGroup | `Chip.stories.tsx` (포함) | 변경 미미 | 표시 |
| 13 | Tag | `Tag.stories.tsx` | 변경됨 | 표시 |
| 14 | TagGroup | `Tag.stories.tsx` (포함) | 변경됨 | 표시 |
| 15 | Dialog | `Dialog.stories.tsx` | 변경됨 | 표시 |
| 16 | Drawer | `Drawer.stories.tsx` | 변경됨 | 표시 |
| 17 | Tooltip | `Tooltip.stories.tsx` | 변경됨 | 표시 |
| 18 | Divider | `Divider.stories.tsx` | 변경 미미 | 표시 |
| 19 | Link | `Link.stories.tsx` | 변경 미미 | 표시 |
| 20 | Menu | `Menu.stories.tsx` | 변경됨 | 네비게이션 |
| 21 | MenuItemPreset | `MenuItemPreset.stories.tsx` | 신규 | 네비게이션 |
| 22 | TreeMenu | `TreeMenu.stories.tsx` | 변경됨 | 네비게이션 |
| 23 | Tab | `Tab.stories.tsx` | 변경됨 | 네비게이션 |
| 24 | Segment | `Segment.stories.tsx` | 변경됨 | 네비게이션 |
| 25 | Option | `Option.stories.tsx` | 변경 미미 | 유틸리티 |
| 26 | OptionGroup | `OptionGroup.stories.tsx` | 변경됨 | 유틸리티 |
| 27 | Icon | — (스토리 없음) | 변경됨 | 수동 관리 |
| 28 | LoadingSpinner | — (스토리 없음) | 변경 미미 | 수동 관리 |
| 29 | Toast | `Toast.stories.tsx` | 변경됨 | 수동 관리 |
| 30 | DataGrid | `Chart.stories.tsx` | 변경됨 | 수동 관리 |
| 31 | Chart | `Chart.stories.tsx` | 변경 미미 | 수동 관리 |
| 32 | SpacingModeProvider | — (스토리 없음) | 변경 미미 | 수동 관리 |
| 33 | ModalStackProvider | — (스토리 없음) | 변경 미미 | 수동 관리 |
| 34 | ActionBar | `ActionBar.stories.tsx` | 신규 | 신규 |
| 35 | FilterBar | `FilterBar.stories.tsx` | 신규 | 신규 |
| 36 | LabelValue | `LabelValue.stories.tsx` | 신규 | 신규 |
| 37 | Popover | `Popover.stories.tsx` | 신규 | 신규 |
| 38 | TitleSection | `TitleSection.stories.tsx` | 신규 | 신규 |
| 39 | FormGrid | `FormGrid.stories.tsx` | 신규 | 신규 (스토리 전용) |
| 40 | usePopup | `usePopup.stories.tsx` | — | hook 스토리 |

> 모든 스토리 파일 경로: `storybook-standalone/packages/ui/src/stories/`
> 컴포넌트 파일 경로: `storybook-standalone/packages/ui/src/components/`
