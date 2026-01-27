# AG Grid 코드 생성 가이드

DS-Runtime Hub 프로젝트에서 AG Grid 컴포넌트 코드를 생성할 때 참조하는 가이드 문서입니다.

## 📁 파일 구조

```
src/
├── themes/
│   └── agGridTheme.ts          # AG Grid 테마 정의 (런타임 사용)
├── tokens/
│   └── ag-grid-tokens.json     # Figma 토큰 형식 (디자인 시스템 연동)
└── schemas/
    └── ag-grid-component.storybook.json  # 컴포넌트 메타데이터 + 코드 템플릿
```

## 📄 파일별 역할

### 1. `agGridTheme.ts`
실제 런타임에서 AG Grid에 적용되는 테마 파일입니다.

```typescript
import { dsRuntimeTheme } from '@/themes/agGridTheme';

// 그리드에 적용
<AgGridReact theme={dsRuntimeTheme} ... />
```

### 2. `ag-grid-tokens.json`
Figma 토큰 형식으로 변환된 디자인 토큰입니다. 기존 Figma 토큰 파이프라인과 통합하여 사용합니다.

**주요 토큰 경로:**
- `agGrid.colors.accent` → `#0033A0`
- `agGrid.sizing.row.height` → `40`
- `agGrid.borderRadius.wrapper` → `8`

### 3. `ag-grid-component.storybook.json`
LLM이 코드 생성 시 참조하는 컴포넌트 스키마입니다.

**포함 내용:**
- `requiredImports`: 필수 import 문
- `props`: AgGridReact props 정의
- `colDefProps`: 컬럼 정의 props
- `codeTemplates`: 상황별 코드 템플릿
- `designGuidelines`: 디자인 가이드라인
- `examples`: 사용 예시

---

## 🤖 Claude Code 코드 생성 방법

### Step 1: 컨텍스트 로드

코드 생성 전 다음 파일들을 컨텍스트에 포함합니다:

```
@ag-grid-component.storybook.json
@ag-grid-tokens.json
```

### Step 2: 요구사항 분석

사용자 요청에서 다음을 파악합니다:
- 데이터 구조 (필드, 타입)
- 필요한 기능 (선택, 페이지네이션, 편집 등)
- 컬럼 구성

### Step 3: 템플릿 선택

`ag-grid-component.storybook.json`의 `codeTemplates`에서 적절한 템플릿을 선택합니다:

| 템플릿 | 사용 상황 |
|--------|----------|
| `basic` | 단순 데이터 표시 |
| `withSelection` | 행 선택 기능 필요 |
| `withPagination` | 대량 데이터, 페이지네이션 필요 |
| `editable` | 셀 편집 기능 필요 |

### Step 4: 코드 생성

**필수 규칙:**
1. 항상 `dsRuntimeTheme` import 및 적용
2. 컨테이너에 height 지정 필수
3. TypeScript 타입 정의 포함
4. 컬럼 정의는 `ColDef<T>[]` 타입 사용

---

## 📝 코드 생성 예시

### 요청 예시
> "사용자 목록을 보여주는 테이블을 만들어줘. 이름, 이메일, 역할, 상태 컬럼이 필요하고 행 선택 기능도 있어야 해."

### 생성 코드

```typescript
import { useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { dsRuntimeTheme } from '@/themes/agGridTheme';
import { ColDef, SelectionChangedEvent } from 'ag-grid-community';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface UserTableProps {
  data: User[];
  onSelectionChange?: (selectedUsers: User[]) => void;
}

export function UserTable({ data, onSelectionChange }: UserTableProps) {
  const columnDefs: ColDef<User>[] = [
    { 
      checkboxSelection: true, 
      headerCheckboxSelection: true, 
      width: 50 
    },
    { field: 'name', headerName: '이름', flex: 1 },
    { field: 'email', headerName: '이메일', flex: 2 },
    { field: 'role', headerName: '역할', width: 120 },
    { field: 'status', headerName: '상태', width: 100 },
  ];

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
  };

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent<User>) => {
    const selectedRows = event.api.getSelectedRows();
    onSelectionChange?.(selectedRows);
  }, [onSelectionChange]);

  return (
    <div style={{ height: 400 }}>
      <AgGridReact<User>
        theme={dsRuntimeTheme}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowSelection="multiple"
        onSelectionChanged={handleSelectionChanged}
        animateRows
      />
    </div>
  );
}
```

---

## ⚠️ 주의사항

### 필수 체크리스트

- [ ] `dsRuntimeTheme` import 및 `theme` prop에 적용
- [ ] 컨테이너 `height` 지정 (또는 `domLayout="autoHeight"`)
- [ ] `ColDef<T>` 제네릭 타입 사용
- [ ] `headerName` 명시적 지정 (접근성)
- [ ] 이벤트 핸들러는 `useCallback`으로 메모이제이션

### 하지 말아야 할 것

```typescript
// ❌ 직접 스타일 override
<AgGridReact style={{ '--ag-header-background-color': 'red' }} />

// ❌ height 없는 컨테이너
<div>
  <AgGridReact ... />
</div>

// ❌ 테마 미적용
<AgGridReact rowData={data} columnDefs={cols} />
```

### 올바른 사용

```typescript
// ✅ 테마 적용 + height 지정
<div style={{ height: 500 }}>
  <AgGridReact
    theme={dsRuntimeTheme}
    rowData={data}
    columnDefs={cols}
  />
</div>
```

---

## 🎨 디자인 토큰 참조

코드 생성 시 일관된 스타일을 위해 토큰 값을 참조합니다:

| 토큰 | 값 | 용도 |
|------|-----|------|
| `colors.accent` | `#0033A0` | 포커스, 선택 상태 |
| `colors.border` | `#DEE2E6` | 테두리 |
| `colors.foreground` | `#212529` | 기본 텍스트 |
| `colors.subtle` | `#6C757D` | 보조 텍스트 |
| `sizing.rowHeight` | `40` | 행 높이 |
| `sizing.headerHeight` | `42` | 헤더 높이 |
| `borderRadius.wrapper` | `8` | 그리드 외곽 radius |
| `borderRadius.button` | `6` | 버튼 radius |

---

## 🔄 Theme Builder 업데이트 시

AG Grid Theme Builder에서 테마를 수정한 경우:

1. Theme Builder에서 JS 파일 다운로드
2. `agGridTheme.ts`의 `withParams()` 내용 교체
3. `ag-grid-tokens.json` 토큰 값 동기화
4. 변경된 토큰이 있으면 이 가이드 문서의 토큰 테이블 업데이트

**Theme Builder URL:** https://www.ag-grid.com/theme-builder/

---

## 📚 참고 자료

- [AG Grid 공식 문서](https://www.ag-grid.com/react-data-grid/)
- [Theming API](https://www.ag-grid.com/react-data-grid/theming/)
- [Column Definitions](https://www.ag-grid.com/react-data-grid/column-definitions/)
- [Row Selection](https://www.ag-grid.com/react-data-grid/row-selection/)
