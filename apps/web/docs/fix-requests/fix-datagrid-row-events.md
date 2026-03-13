# DataGrid 행 클릭/더블클릭 이벤트 미지원 수정 요청

## 현상

- DataGrid에서 행 클릭/더블클릭 시 모달(Dialog)이나 Drawer를 여는 패턴이 **동작하지 않음**
- HTML `<table>`에서는 `onClick`으로 정상 동작하지만, DataGrid(AG Grid)에서는 안 됨

## 원인

`apps/web/components/features/preview/code-preview-iframe.tsx`의 DataGrid wrapper가 `onRowClicked`, `onRowDoubleClicked` 이벤트를 AG Grid에 전달하지 않음

### 현재 지원되는 이벤트 (line 437~444, 493~501)

```
onGridReady, onSelectionChanged, onCellClicked, onRowSelected,
onFilterChanged, onSortChanged, onCellValueChanged, onColumnMoved
```

### 누락된 이벤트

```
onRowClicked, onRowDoubleClicked
```

## 수정 방법

### 수정 파일

`apps/web/components/features/preview/code-preview-iframe.tsx`

### 수정 1: props 추출 (line 443 근처)

```javascript
// 기존
var onCellValueChanged = props.onCellValueChanged;
var onColumnMoved = props.onColumnMoved;

// 아래 2줄 추가
var onRowClicked = props.onRowClicked;
var onRowDoubleClicked = props.onRowDoubleClicked;
```

### 수정 2: AG Grid에 전달 (line 499~501 근처)

```javascript
// 기존
onCellValueChanged: onCellValueChanged,
onColumnMoved: onColumnMoved,
suppressRowClickSelection: suppressRowClickSelection,

// onColumnMoved 아래에 2줄 추가
onRowClicked: onRowClicked,
onRowDoubleClicked: onRowDoubleClicked,
```

### 수정 3: createGrid gridOptions에도 추가 (line 362~366 근처)

```javascript
// 기존
onSelectionChanged: props.onSelectionChanged,
onCellClicked: props.onCellClicked,
onRowSelected: props.onRowSelected,
onFilterChanged: props.onFilterChanged,
onSortChanged: props.onSortChanged,

// 아래 2줄 추가
onRowClicked: props.onRowClicked,
onRowDoubleClicked: props.onRowDoubleClicked,
```

## 수정 후 기대 동작

```tsx
// AI가 생성하는 코드 예시
<DataGrid
  rowData={rowData}
  columnDefs={columnDefs}
  onRowDoubleClicked={(event) => {
    setSelectedItem(event.data);
    setIsDetailOpen(true);
  }}
/>

// → 행 더블클릭 시 Dialog/Drawer가 정상적으로 열림
```

## 영향 범위

- 프리뷰 iframe 내 DataGrid 컴포넌트만 해당
- 기존 동작에 영향 없음 (props가 없으면 undefined로 전달되어 무시됨)
