# DataGrid 프리뷰 렌더링 버그

> 대상 파일: `apps/web/components/features/preview/code-preview-iframe.tsx`

## 현상

- AI가 생성한 DataGrid 코드가 프리뷰에서 **5번 중 1번 정도만 렌더링**됨
- 렌더링 실패 시 에러 없이 빈 화면 (silent failure)
- `ButtonCellRenderer` 등 셀 렌더러 컬럼이 항상 안 보임

## 원인 1: AG Grid CDN 로딩 race condition

### 위치

`AgGridReact` 래퍼 내부 `useEffect` (line ~218)

### 문제

```javascript
React.useEffect(() => {
  if (!containerRef.current || !window.agGrid) {
    console.error('[AgGridReact] AG Grid not loaded');
    return; // ← CDN 아직 로딩 중이면 즉시 포기, 재시도 없음
  }
  // ... createGrid 로직
}, []);
```

- `<head>`에서 AG Grid CDN을 `<script src="...">` 로 로딩
- iframe `srcDoc` 환경에서 외부 스크립트 로딩 타이밍이 불안정
- CDN이 느리면 `window.agGrid === undefined` → 그리드 생성 자체를 건너뜀
- `useEffect`가 `[]` deps로 한 번만 실행되므로, 이후 CDN 로딩 완료돼도 재시도 안 함

### 수정 방향

`window.agGrid`가 로딩될 때까지 polling (100ms 간격) 또는 `<script onload>` 콜백으로 대기 후 그리드 생성

```javascript
React.useEffect(() => {
  if (!containerRef.current) return;
  var destroyed = false;
  var pollTimer = null;

  function tryInit() {
    if (destroyed) return;
    if (!window.agGrid) {
      pollTimer = setTimeout(tryInit, 100); // 100ms 간격 재시도
      return;
    }
    createGridInstance();
  }

  // ... createGridInstance 내부에 기존 createGrid 로직

  tryInit();

  return function() {
    destroyed = true;
    if (pollTimer) clearTimeout(pollTimer);
    // ... cleanup
  };
}, []);
```

## 원인 2: sanitizeColumnDefs가 cellRenderer 전부 삭제

### 위치

`sanitizeColumnDefs` 함수 (line ~204-215)

### 문제

```javascript
function sanitizeColumnDefs(cols) {
  return (cols || []).map(function(col) {
    var rest = Object.assign({}, col);
    delete rest.cellRenderer;          // ← 전부 삭제
    delete rest.cellRendererFramework; // ← 전부 삭제
    delete rest.cellRendererParams;    // ← 전부 삭제
    if (rest.children) {
      rest.children = sanitizeColumnDefs(rest.children);
    }
    return rest;
  });
}
```

- vanilla `createGrid()` API는 React 컴포넌트를 cellRenderer로 사용 불가 → 그래서 전부 삭제 중
- 하지만 `ButtonCellRenderer`, `CheckboxCellRenderer`, `ImageCellRenderer` 같은 **정상적인 셀 렌더러도 삭제**됨
- 결과: 버튼/체크박스/이미지 컬럼이 항상 빈 셀로 렌더링

### 수정 방향

알려진 셀 렌더러를 vanilla JS DOM 함수로 변환하여 AG Grid에 전달

```javascript
var vanillaRenderers = {
  ButtonCellRenderer: function(params) {
    var btn = document.createElement('button');
    btn.textContent = params.label || params.value || '클릭';
    btn.style.cssText = 'padding:4px 8px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
    if (params.onClick) {
      btn.onclick = function(e) { e.stopPropagation(); params.onClick(params.data); };
    }
    return btn;
  },
  CheckboxCellRenderer: function(params) {
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!params.value;
    cb.disabled = true;
    return cb;
  },
  ImageCellRenderer: function(params) {
    if (!params.value) return document.createTextNode('');
    var img = document.createElement('img');
    img.src = params.value;
    img.style.cssText = 'width:30px;height:30px;object-fit:cover;border-radius:4px;';
    return img;
  }
};

function sanitizeColumnDefs(cols) {
  return (cols || []).map(function(col) {
    var rest = Object.assign({}, col);
    var renderer = rest.cellRenderer;
    if (renderer) {
      var name = typeof renderer === 'function' ? renderer.name : (typeof renderer === 'string' ? renderer : null);
      if (name && vanillaRenderers[name]) {
        rest.cellRenderer = vanillaRenderers[name]; // vanilla JS로 변환
      } else {
        delete rest.cellRenderer;       // 미지원 렌더러는 제거
        delete rest.cellRendererParams;
      }
    }
    delete rest.cellRendererFramework;
    if (rest.children) {
      rest.children = sanitizeColumnDefs(rest.children);
    }
    return rest;
  });
}
```

## 요약

| 이슈 | 현상 | 원인 | 수정 |
|------|------|------|------|
| Race condition | 5번 중 1번만 렌더링 | CDN 로딩 전 useEffect 실행 → 재시도 없음 | polling으로 CDN 로딩 대기 |
| cellRenderer 삭제 | 버튼/체크박스 컬럼 안 보임 | sanitizeColumnDefs가 전부 delete | 알려진 렌더러를 vanilla JS DOM 함수로 변환 |
