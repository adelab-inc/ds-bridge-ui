# DataGrid 체크박스 선택 해제 및 액션바 미동작 수정 요청

## 현상

1. DataGrid에서 체크박스 선택 시, 해제하지 않았음에도 선택값이 해제됨
2. 선택 기반 액션바(일괄 승인, 일괄 삭제 등) 인터랙션 확인 불가

## 원인

`apps/web/components/features/preview/code-preview-iframe.tsx`의 AgGridReact 래퍼에 3가지 문제:

### 원인 1: `getRowId` 미전달

`getRowId`가 props에서 추출/전달되지 않아, `setGridOption('rowData', ...)` 호출 시 AG Grid가 행을 식별할 수 없어 **모든 선택이 초기화**됨.

```
// line 387-391 — rowData 변경 시 이 코드가 실행되면 선택 초기화
React.useEffect(() => {
  if (gridApiRef.current && props.rowData) {
    gridApiRef.current.setGridOption('rowData', props.rowData);
  }
}, [props.rowData]);
```

### 원인 2: `suppressRowClickSelection` 전달 (v34 삭제된 옵션)

AG Grid v34에서 삭제된 `suppressRowClickSelection`을 래퍼가 여전히 전달하고 있음 (line 445, 501).

### 원인 3: 이벤트 핸들러가 초기 렌더 시 1회만 바인딩

`createGrid()`의 `useEffect([], [])`로 `onSelectionChanged` 등 콜백이 마운트 시 한 번만 설정됨.
이후 re-render로 새 콜백이 생성되어도 그리드에 반영되지 않음.

## 수정 방법

### 수정 파일

`apps/web/components/features/preview/code-preview-iframe.tsx`

### 수정 1: `getRowId` props 추출 및 전달 (line 444 근처)

```javascript
// 기존
var onColumnMoved = props.onColumnMoved;
var suppressRowClickSelection = props.suppressRowClickSelection;

// 변경
var onColumnMoved = props.onColumnMoved;
var getRowId = props.getRowId;
// suppressRowClickSelection 제거 (v34에서 삭제됨)
```

### 수정 2: createGrid gridOptions에 `getRowId` 추가, `suppressRowClickSelection` 제거

**AgGridReact createGrid (line 348~367 근처):**

```javascript
const gridOptions = {
  // ... 기존 옵션들 ...
  getRowId: props.getRowId,  // 추가
  // suppressRowClickSelection 제거
};
```

**DataGrid → AgGridReact 전달 (line 493~501 근처):**

```javascript
React.createElement(AgGridReact, {
  // ... 기존 props ...
  onCellValueChanged: onCellValueChanged,
  onColumnMoved: onColumnMoved,
  getRowId: getRowId,           // 추가
  // suppressRowClickSelection 제거
})
```

### 수정 3: 이벤트 핸들러 ref 패턴 적용 (선택사항, 고급)

콜백이 항상 최신 값을 사용하도록 ref 패턴 적용:

```javascript
// AgGridReact 내부
const callbacksRef = React.useRef({});
callbacksRef.current = {
  onSelectionChanged: props.onSelectionChanged,
  onCellClicked: props.onCellClicked,
  onRowSelected: props.onRowSelected,
};

// createGrid에서:
onSelectionChanged: function(params) {
  if (callbacksRef.current.onSelectionChanged) {
    callbacksRef.current.onSelectionChanged(params);
  }
},
```

## 수정 후 기대 동작

```tsx
// AI가 생성하는 코드 예시
const [selectedRows, setSelectedRows] = React.useState([]);
const [rowData] = React.useState([...]);

<DataGrid
  rowData={rowData}
  columnDefs={columnDefs}
  rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
  getRowId={(params) => params.data.id}
  onSelectionChanged={(event) => {
    setSelectedRows(event.api.getSelectedRows());
  }}
/>

{/* 선택 시 액션바 표시 */}
{selectedRows.length > 0 && (
  <div className="flex items-center gap-3 bg-[#e7f5ff] ...">
    <span>{selectedRows.length}건 선택</span>
    <Button>일괄 승인</Button>
  </div>
)}
```

## 영향 범위

- 프리뷰 iframe 내 DataGrid 컴포넌트만 해당
- `getRowId` 추가: props가 없으면 undefined로 전달되어 기존 동작 유지
- `suppressRowClickSelection` 제거: v34에서 삭제된 옵션이므로 영향 없음
