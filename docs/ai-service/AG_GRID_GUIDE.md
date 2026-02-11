# AG Grid 코드 생성 가이드

DS-Runtime Hub 프로젝트에서 AG Grid 컴포넌트 코드를 생성할 때 참조하는 가이드 문서입니다.

> **중요:** AG Grid를 사용할 때는 반드시 `@aplus/ui`의 `DataGrid` 래퍼 컴포넌트를 사용합니다. `AgGridReact`를 직접 사용하지 마세요.

---

## 📁 컴포넌트 위치

```
packages/ui/src/components/DataGrid/
├── DataGrid.tsx   # DataGrid 래퍼 컴포넌트 + 셀 렌더러 + 유틸리티
└── index.ts       # 모든 export
```

## 📦 Export 목록

| Export | 설명 |
|--------|------|
| `DataGrid` | AG Grid 래퍼 컴포넌트 (메인) |
| `ButtonCellRenderer` | 버튼 셀 렌더러 |
| `CheckboxCellRenderer` | 체크박스 셀 렌더러 |
| `ImageCellRenderer` | 이미지 셀 렌더러 |
| `COLUMN_TYPES` | 미리 정의된 컬럼 타입 (number, date, currency, percent) |
| `AgGridUtils` | 그리드 유틸리티 함수 모음 |
| `DataGridProps` | DataGrid 컴포넌트 Props 타입 |

---

## 🤖 코드 생성 방법

### Step 1: Import

```typescript
// 기본 사용
import { DataGrid } from '@aplus/ui';
import { ColDef } from 'ag-grid-community';

// 셀 렌더러가 필요한 경우
import { DataGrid, ButtonCellRenderer, CheckboxCellRenderer, ImageCellRenderer } from '@aplus/ui';

// 컬럼 타입 또는 유틸리티가 필요한 경우
import { DataGrid, COLUMN_TYPES, AgGridUtils } from '@aplus/ui';

// 이벤트 타입이 필요한 경우
import { ColDef, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
```

### Step 2: 요구사항 분석

사용자 요청에서 다음을 파악합니다:
- 데이터 구조 (필드, 타입)
- 필요한 기능 (선택, 페이지네이션, 편집 등)
- 컬럼 구성 (숫자, 날짜, 통화 등 → `COLUMN_TYPES` 활용)
- 커스텀 셀 렌더링 여부 (버튼, 체크박스, 이미지)

### Step 3: 코드 생성

**필수 규칙:**
1. `DataGrid` 래퍼 컴포넌트 사용 (테마 자동 적용)
2. `ColDef<T>` 제네릭 타입 사용
3. `headerName` 명시적 지정 (접근성)
4. 숫자/날짜/통화/퍼센트 컬럼은 `COLUMN_TYPES` spread 활용

---

## 📋 DataGrid Props 레퍼런스

### 필수 Props

| Prop | 타입 | 설명 |
|------|------|------|
| `rowData` | `any[]` | 그리드에 표시할 행 데이터 배열 |
| `columnDefs` | `ColDef[]` | 컬럼 정의 배열 |

### 테마 및 스타일

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `theme` | `'quartz' \| 'alpine' \| 'balham' \| 'material' \| 'custom'` | `'quartz'` | 그리드 테마 |
| `height` | `number \| string` | `400` | 그리드 높이 |
| `width` | `number \| string` | `'100%'` | 그리드 너비 |
| `className` | `string` | `''` | 추가 CSS 클래스 |

### 그리드 옵션

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `pagination` | `boolean` | `false` | 페이지네이션 활성화 |
| `paginationPageSize` | `number` | `10` | 페이지당 행 수 |
| `paginationPageSizeSelector` | `number[]` | `[10, 20, 50, 100]` | 페이지 크기 선택 옵션 |
| `domLayout` | `'normal' \| 'autoHeight' \| 'print'` | `'normal'` | DOM 레이아웃 |
| `rowModelType` | `'clientSide' \| 'infinite' \| 'viewport' \| 'serverSide'` | `'clientSide'` | 행 모델 타입 |

### 선택 및 필터링

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `rowSelection` | `'single' \| 'multiple'` | - | 행 선택 모드 |
| `enableFilter` | `boolean` | `true` | 필터링 활성화 |
| `enableSorting` | `boolean` | `true` | 정렬 활성화 |
| `quickFilterText` | `string` | - | 빠른 필터 텍스트 |

### 로딩 및 상태

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `loading` | `boolean` | `false` | 로딩 상태 |
| `loadingOverlayComponent` | `string` | - | 커스텀 로딩 오버레이 |
| `noRowsOverlayComponent` | `string` | - | 데이터 없음 오버레이 |
| `animateRows` | `boolean` | `true` | 행 애니메이션 |

### 편집

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `editType` | `'fullRow'` | - | 편집 타입 |
| `stopEditingWhenCellsLoseFocus` | `boolean` | `true` | 포커스 잃을 때 편집 중단 |

### 고급 기능

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `cellSelection` | `boolean` | `false` | 셀 선택 활성화 |
| `enableCharts` | `boolean` | `false` | 차트 기능 활성화 |
| `sideBar` | `boolean \| string \| any` | `false` | 사이드바 설정 |
| `maintainColumnOrder` | `boolean` | `true` | 컬럼 순서 유지 |
| `autoGroupColumnDef` | `ColDef` | - | 자동 그룹 컬럼 정의 |
| `defaultColDef` | `ColDef` | - | 기본 컬럼 정의 (모든 컬럼에 적용) |

### 커스텀 함수

| Prop | 타입 | 설명 |
|------|------|------|
| `getRowId` | `(params: GetRowIdParams) => string` | 행 ID 생성 |
| `getRowClass` | `(params: RowClassParams) => string \| string[]` | 행 CSS 클래스 생성 |

### 이벤트 핸들러

| Prop | 타입 | 설명 |
|------|------|------|
| `onGridReady` | `(event: GridReadyEvent) => void` | 그리드 준비 완료 |
| `onSelectionChanged` | `(event: SelectionChangedEvent) => void` | 선택 변경 |
| `onCellClicked` | `(event: CellClickedEvent) => void` | 셀 클릭 |
| `onRowSelected` | `(event: RowSelectedEvent) => void` | 행 선택 |
| `onFilterChanged` | `(event: FilterChangedEvent) => void` | 필터 변경 |
| `onSortChanged` | `(event: SortChangedEvent) => void` | 정렬 변경 |
| `onCellValueChanged` | `(event: CellValueChangedEvent) => void` | 셀 값 변경 |
| `onColumnMoved` | `(event: ColumnMovedEvent) => void` | 컬럼 이동 |
| `onRowDataChanged` | `() => void` | 행 데이터 변경 |

---

## 🧩 커스텀 셀 렌더러

### ButtonCellRenderer

셀에 클릭 가능한 버튼을 렌더링합니다.

```typescript
import { DataGrid, ButtonCellRenderer } from '@aplus/ui';

const columnDefs: ColDef[] = [
  {
    headerName: '액션',
    field: 'action',
    cellRenderer: ButtonCellRenderer,
    cellRendererParams: {
      onClick: (data: any) => console.log('클릭:', data),
    },
  },
];
```

### CheckboxCellRenderer

셀에 체크박스를 렌더링합니다.

```typescript
import { DataGrid, CheckboxCellRenderer } from '@aplus/ui';

const columnDefs: ColDef[] = [
  {
    headerName: '활성',
    field: 'isActive',
    cellRenderer: CheckboxCellRenderer,
    cellRendererParams: {
      onCheckboxChange: (data: any, checked: boolean) => {
        console.log('변경:', data, checked);
      },
    },
  },
];
```

### ImageCellRenderer

셀에 이미지(30x30)를 렌더링합니다.

```typescript
import { DataGrid, ImageCellRenderer } from '@aplus/ui';

const columnDefs: ColDef[] = [
  {
    headerName: '프로필',
    field: 'avatarUrl',
    cellRenderer: ImageCellRenderer,
    width: 80,
  },
];
```

---

## 📊 미리 정의된 컬럼 타입 (COLUMN_TYPES)

자주 사용되는 컬럼 타입을 spread로 적용합니다.

```typescript
import { DataGrid, COLUMN_TYPES } from '@aplus/ui';
```

| 타입 | 설명 | 주요 설정 |
|------|------|----------|
| `numberColumn` | 숫자 컬럼 | 우측 정렬, `agNumberColumnFilter`, width: 130 |
| `dateColumn` | 날짜 컬럼 | `agDateColumnFilter`, `agDateCellEditor`, width: 150 |
| `currencyColumn` | 통화 컬럼 (KRW) | 우측 정렬, KRW 포맷, width: 150 |
| `percentColumn` | 퍼센트 컬럼 | 우측 정렬, `%` 접미사, width: 130 |

**사용법:**

```typescript
const columnDefs: ColDef[] = [
  { field: 'name', headerName: '이름', flex: 1 },
  { field: 'age', headerName: '나이', ...COLUMN_TYPES.numberColumn },
  { field: 'joinDate', headerName: '입사일', ...COLUMN_TYPES.dateColumn },
  { field: 'salary', headerName: '급여', ...COLUMN_TYPES.currencyColumn },
  { field: 'rate', headerName: '달성률', ...COLUMN_TYPES.percentColumn },
];
```

---

## 🔧 AgGridUtils 유틸리티

`onGridReady`에서 `GridApi`를 저장하여 유틸리티 함수와 함께 사용합니다.

```typescript
import { DataGrid, AgGridUtils } from '@aplus/ui';
import { GridApi, GridReadyEvent } from 'ag-grid-community';

const [gridApi, setGridApi] = useState<GridApi | null>(null);

<DataGrid
  rowData={data}
  columnDefs={columnDefs}
  onGridReady={(e: GridReadyEvent) => setGridApi(e.api)}
/>
```

### 데이터 내보내기

```typescript
AgGridUtils.exportToCsv(gridApi, 'users.csv');
AgGridUtils.exportToExcel(gridApi, 'users.xlsx');
```

### 선택 관리

```typescript
AgGridUtils.getSelectedRows(gridApi);  // 선택된 행 가져오기
AgGridUtils.selectAll(gridApi);        // 모든 행 선택
AgGridUtils.deselectAll(gridApi);      // 모든 행 선택 해제
```

### 네비게이션 및 컬럼

```typescript
AgGridUtils.scrollToRow(gridApi, 50);      // 50번째 행으로 스크롤
AgGridUtils.autoSizeAllColumns(gridApi);   // 모든 컬럼 크기 자동 조정
```

### 필터 및 정렬

```typescript
AgGridUtils.getFilterModel(gridApi);                 // 현재 필터 상태
AgGridUtils.setFilterModel(gridApi, filterModel);    // 필터 적용
AgGridUtils.getSortModel(gridApi);                   // 현재 정렬 상태
AgGridUtils.setSortModel(gridApi, sortModel);        // 정렬 적용
```

---

## 📝 코드 생성 예시

### 요청 예시
> "사용자 목록을 보여주는 테이블을 만들어줘. 이름, 이메일, 역할, 상태 컬럼이 필요하고 행 선택 기능도 있어야 해."

### 생성 코드

```typescript
import { useCallback } from 'react';
import { DataGrid } from '@aplus/ui';
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
    { field: 'name', headerName: '이름', flex: 1 },
    { field: 'email', headerName: '이메일', flex: 2 },
    { field: 'role', headerName: '역할', width: 120 },
    { field: 'status', headerName: '상태', width: 100 },
  ];

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<User>) => {
      const selectedRows = event.api.getSelectedRows();
      onSelectionChange?.(selectedRows);
    },
    [onSelectionChange]
  );

  return (
    <DataGrid
      rowData={data}
      columnDefs={columnDefs}
      height={400}
      rowSelection="multiple"
      onSelectionChanged={handleSelectionChanged}
    />
  );
}
```

### 페이지네이션 + 통화/퍼센트 컬럼 예시

```typescript
import { DataGrid, COLUMN_TYPES } from '@aplus/ui';
import { ColDef } from 'ag-grid-community';

interface Product {
  id: string;
  name: string;
  price: number;
  discount: number;
  stockDate: string;
}

export function ProductTable({ data }: { data: Product[] }) {
  const columnDefs: ColDef<Product>[] = [
    { field: 'name', headerName: '상품명', flex: 1 },
    { field: 'price', headerName: '가격', ...COLUMN_TYPES.currencyColumn },
    { field: 'discount', headerName: '할인율', ...COLUMN_TYPES.percentColumn },
    { field: 'stockDate', headerName: '입고일', ...COLUMN_TYPES.dateColumn },
  ];

  return (
    <DataGrid
      rowData={data}
      columnDefs={columnDefs}
      height={500}
      pagination
      paginationPageSize={20}
    />
  );
}
```

### 셀 렌더러 + 유틸리티 예시

```typescript
import { useState, useCallback } from 'react';
import { DataGrid, ButtonCellRenderer, CheckboxCellRenderer, AgGridUtils } from '@aplus/ui';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export function TaskTable({ data }: { data: Task[] }) {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const columnDefs: ColDef<Task>[] = [
    {
      headerName: '완료',
      field: 'completed',
      cellRenderer: CheckboxCellRenderer,
      cellRendererParams: {
        onCheckboxChange: (data: Task, checked: boolean) => {
          console.log('상태 변경:', data.id, checked);
        },
      },
      width: 80,
    },
    { field: 'title', headerName: '제목', flex: 1 },
    {
      headerName: '삭제',
      cellRenderer: ButtonCellRenderer,
      cellRendererParams: {
        onClick: (data: Task) => console.log('삭제:', data.id),
      },
      width: 100,
    },
  ];

  const handleExport = useCallback(() => {
    if (gridApi) {
      AgGridUtils.exportToCsv(gridApi, 'tasks.csv');
    }
  }, [gridApi]);

  return (
    <div>
      <button onClick={handleExport}>CSV 내보내기</button>
      <DataGrid
        rowData={data}
        columnDefs={columnDefs}
        height={400}
        onGridReady={(e: GridReadyEvent) => setGridApi(e.api)}
      />
    </div>
  );
}
```

---

## ⚠️ 주의사항

### 필수 체크리스트

- [ ] `DataGrid` 래퍼 컴포넌트 사용 (`@aplus/ui`에서 import)
- [ ] `ColDef<T>` 제네릭 타입 사용
- [ ] `headerName` 명시적 지정 (접근성)
- [ ] 이벤트 핸들러는 `useCallback`으로 메모이제이션
- [ ] 숫자/날짜/통화/퍼센트 컬럼은 `COLUMN_TYPES` 활용

### 하지 말아야 할 것

```typescript
// ❌ AgGridReact 직접 사용
import { AgGridReact } from 'ag-grid-react';
<AgGridReact rowData={data} columnDefs={cols} />

// ❌ 존재하지 않는 테마 import
import { dsRuntimeTheme } from '@/themes/agGridTheme';

// ❌ 테마 스타일 직접 override
<DataGrid style={{ '--ag-header-background-color': 'red' }} />

// ❌ height를 컨테이너 div로 지정
<div style={{ height: 500 }}>
  <DataGrid rowData={data} columnDefs={cols} />
</div>
```

### 올바른 사용

```typescript
// ✅ DataGrid 래퍼 사용 + height prop
import { DataGrid } from '@aplus/ui';

<DataGrid
  rowData={data}
  columnDefs={cols}
  height={500}
/>

// ✅ COLUMN_TYPES 활용
import { DataGrid, COLUMN_TYPES } from '@aplus/ui';

const columnDefs: ColDef[] = [
  { field: 'amount', headerName: '금액', ...COLUMN_TYPES.currencyColumn },
];

// ✅ 셀 렌더러 활용
import { DataGrid, ButtonCellRenderer } from '@aplus/ui';

const columnDefs: ColDef[] = [
  {
    headerName: '액션',
    cellRenderer: ButtonCellRenderer,
    cellRendererParams: { onClick: (data) => handleClick(data) },
  },
];
```

---

## 🎨 내장 디자인 토큰

DataGrid 내부에 `aplusGridTheme`이 내장되어 있어 별도 테마 설정이 불필요합니다. 참고용 토큰 값:

| 토큰 | 값 | 용도 |
|------|-----|------|
| `brand-primary` | `#0033A0` | 포커스, 선택, 체크박스 |
| `border-default` | `#DEE2E6` | 테두리 |
| `text-primary` | `#212529` | 기본 텍스트 |
| `text-secondary` | `#495057` | 보조 텍스트 |
| `bg-surface` | `#FFFFFF` | 배경 |
| `bg-selection` | `#ECF0FA` | 선택된 행 배경 |
| Row Height | `40px` | 행 높이 |
| Header Height | `42px` | 헤더 높이 |
| Font | Pretendard, 14px | 기본 폰트 |
| Border Radius | `8px` (wrapper) / `6px` (button) | 라운딩 |

---

## 📚 참고 자료

- [AG Grid 공식 문서](https://www.ag-grid.com/react-data-grid/)
- [AG Grid v34 Theming API](https://www.ag-grid.com/react-data-grid/theming/)
- [Column Definitions](https://www.ag-grid.com/react-data-grid/column-definitions/)
- [Row Selection](https://www.ag-grid.com/react-data-grid/row-selection/)
