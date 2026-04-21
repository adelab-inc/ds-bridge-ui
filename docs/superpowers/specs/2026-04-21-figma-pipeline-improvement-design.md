# Figma 파이프라인 전처리 고도화 + 프롬프트 튜닝

## 목표

Figma URL 모드에서 코드 생성 정확도를 85% → 95%+ 로 끌어올린다.
기존 파이프라인 구조(prefetch → simplify → prompt inject → single streaming)는 유지하고,
정보 손실을 줄이고 AI 가이드를 개선한다.

## 수정 대상 파일

| 파일 | 변경 범위 |
|------|----------|
| `apps/ai-service/app/services/figma_simplify.py` | 버그 수정 + 데이터 보존 강화 |
| `apps/ai-service/app/services/tool_calling_loop.py` | 프롬프트 조립 개선 |
| `apps/ai-service/app/api/components.py` | 시스템 프롬프트 가이드 추가 |

---

## 변경 1: parse_component_name 버그 수정 (P1)

### 문제

`figma_simplify.py:219` — variant 형식 컴포넌트명에서 컴포넌트 이름을 항상 `None`으로 반환.

```python
# 현재 (버그)
return None, variant
```

입력 `"Size=sm, Type=tertiary"` → `(None, {"size": "sm", "type": "tertiary"})`

이후 호출부(L587, L600, L630)에서 `comp_name`이 None이면 `name` 필드로 fallback하지만,
`componentName` 경로(L600)에서는 fallback 없이 `component` 키가 설정 안 됨.

### 해결

이 함수는 Figma의 `componentName` 필드를 파싱하는데, 이 값은 variant 키=값 쌍만 포함하고
실제 컴포넌트 이름은 별도의 `name` 필드나 `component_map`에 있다.
따라서 `None` 반환 자체는 의도된 설계이고, 문제는 **호출부에서 fallback이 누락**된 것.

`componentName` 경로(L599-605)에 fallback 추가:

```python
if key == "componentName":
    comp_name, variant = parse_component_name(value)
    if comp_name:
        out["component"] = comp_name
    elif "name" in out:          # ← 추가: name 필드로 fallback
        out["component"] = out["name"]
    if variant:
        out["variant"] = variant
    continue
```

### 영향 범위

- `simplify_node` 내부 로직만 변경
- `parse_component_name` 함수 시그니처 불변
- 외부 호출부 변경 없음

---

## 변경 2: component_map 없을 때 fallback 강화 (P1)

### 문제

`figma_simplify.py:582-597` — `component_map`이 None이거나 `componentId`가 맵에 없으면
컴포넌트 정보가 완전히 소실되고, `continue`로 넘어감.

```python
if key == "componentId":
    if component_map and value in component_map:
        # ... 매핑
    continue  # ← 매핑 실패해도 그냥 skip
```

### 해결

매핑 실패 시 `_unmappedComponentId`를 메타데이터로 보존.
AI가 이 필드를 보고 "이건 Figma 컴포넌트인데 이름을 모르겠다"고 판단 가능.

```python
if key == "componentId":
    if component_map and value in component_map:
        mapped_name = component_map[value]
        # ... 기존 매핑 로직
    else:
        # fallback: 매핑 실패 메타데이터 보존
        out["_unmappedComponentId"] = value
    continue
```

### 영향 범위

- `simplify_node` 내부만 변경
- JSON 출력에 `_unmappedComponentId` 필드 추가 (AI 참고용)

---

## 변경 3: 매핑 안 된 variant 속성 보존 (P2)

### 문제

`figma_simplify.py:708-718` — `_VARIANT_PROP_REMAP`에 `remap`이 있을 때,
remap 딕셔너리에 없는 키는 `remap.get(k, k)` → 원래 키 유지.
하지만 `new_key`가 빈 문자열(`""`)이면 삭제됨.

현재 `"button": {"state": ""}` 설정으로 `state` 키가 삭제되는 건 의도적(Figma 내부 상태).
하지만 remap 테이블 자체가 불완전해서 필요한 속성이 누락될 수 있음.

### 해결

1. `_VARIANT_PROP_REMAP` 테이블 보강 — 누락된 컴포넌트 추가:

```python
_VARIANT_PROP_REMAP: dict[str, dict[str, str]] = {
    "button": {"type": "buttonType", "state": ""},
    "iconbutton": {"type": "iconButtonType", "state": ""},
    "badge": {
        "status variant": "status",
        "level variant": "level",
        "style": "appearance",
    },
    "chip": {"state": ""},
    "alert": {"variant": "type"},
    "field": {"display": "isDisplay", "state": ""},
    "select": {"state": ""},
    "tag": {"state": ""},
    "checkbox": {"state": ""},
    "radio": {"state": ""},
    "toggle": {"state": ""},
    "tab": {"state": ""},
    "pagination": {},
    "drawer": {},
    "dialog": {},
}
```

2. `_VARIANT_VALUE_REMAP` 확장:

```python
_VARIANT_VALUE_REMAP: dict[str, dict[str, dict[str, str]]] = {
    "button": {
        "buttonType": {"outline": "secondary", "ghost": "ghost", "danger": "destructive"},
    },
    "iconbutton": {
        "iconButtonType": {"outline": "secondary", "ghost": "ghost"},
    },
    "badge": {
        "status": {"공지": "warning", "new": "info", "완료": "success", "마감": "error"},
    },
}
```

### 영향 범위

- 상수 변경만, 로직 불변
- 기존 매핑 유지하면서 추가만

---

## 변경 4: dedup 시 그리드 메타데이터 보존 (P2)

### 문제

`_dedup_repeated_rows`가 3+ 반복행을 1행으로 줄이면서 `_repeatedRows` 힌트만 남김.
하지만 DataGrid 컬럼 정보(`_columns`)는 dedup 이전에 추출(`_extract_grid_columns`)되지만
최종 JSON에 명시적으로 포함되지 않음.

### 해결

`simplify_node`에서 DataGrid 감지 시 `_gridStructure` 메타데이터를 JSON에 추가:

```python
# simplify_node 내부, children 처리 후
if comp_lower in ("datagrid", "ag-grid", "grid"):
    columns = _extract_grid_columns(out)
    if columns:
        out["_gridStructure"] = {
            "columnCount": len(columns),
            "columnNames": [c.get("headerName", c.get("field", "")) for c in columns],
        }
```

기존 `_extract_grid_columns` 함수가 이미 컬럼을 추출하므로 그 결과를 노드에 첨부.

### 영향 범위

- `simplify_node` 내부, children 처리 블록
- JSON 출력에 `_gridStructure` 필드 추가

---

## 변경 5: 프롬프트 긍정 가이드 추가 (P3)

### 문제

시스템 프롬프트에 금지 규칙 26개 vs 긍정 가이드 8개 (3.25:1).
AI가 "뭘 하면 안 되는지"만 학습하고, 데이터 해석 방법을 모름.

### 해결

`tool_calling_loop.py`의 figma_context 조립부에 데이터 해석 가이드 추가:

```python
figma_context += (
    "\n## Figma JSON 데이터 해석 가이드\n"
    "- `_repeatedRows: N`: 동일 행 N개 존재. 이 행을 템플릿으로 Mock 데이터 최소 N건 생성\n"
    "- `_gridStructure`: DataGrid 컬럼 정보. columnNames를 ColDef headerName으로 정확히 사용\n"
    "- `_unmappedComponentId`: Figma 컴포넌트 이름 불명. JSON 구조(type, children, variant)로 컴포넌트 추론\n"
    "- `component: null` + `variant` 존재: variant의 key/value로 DS 컴포넌트와 props를 추론\n"
    "- `⚠️_RENDER`: 이 컴포넌트를 반드시 사용. 다른 컴포넌트로 변경 불가\n"
    "\n### 컴포넌트 추론 규칙\n"
    "- INSTANCE + variant에 `buttonType` → Button\n"
    "- INSTANCE + variant에 `isDisplay` → Field (읽기전용)\n"
    "- INSTANCE + children에 options 목록 → Select\n"
    "- INSTANCE + `label` + `characters` → 텍스트가 있는 입력 필드\n"
    "- FRAME + `_repeatedRows` → DataGrid (또는 반복 리스트)\n"
)
```

### 영향 범위

- `tool_calling_loop.py`의 figma_context 문자열에 추가
- 기존 규칙과 중복 없음 (기존은 "금지" 위주, 이건 "해석" 위주)

---

## 변경 6: 좌표 정규화 (선택적, P3)

### 문제

`_strip_coords`가 `_y, _x, _w, _h`를 완전 삭제.
AI가 요소 간 상대적 위치/크기를 알 수 없음.

### 해결

완전 삭제 대신 w(너비)만 보존. 나머지(_y, _x, _h)는 삭제 유지.
w는 GridLayout 비율 검증에 AI가 직접 참고할 수 있으므로 유용.

```python
def _strip_coords(node: dict) -> None:
    node.pop("_y", None)
    node.pop("_x", None)
    # _w는 보존 (GridLayout 비율 참고용)
    node.pop("_h", None)
    for child in node.get("children", []):
        if isinstance(child, dict):
            _strip_coords(child)
```

### 영향 범위

- `tool_calling_loop.py`의 `_strip_coords` 함수
- JSON에 `_w` 필드가 남아서 토큰 소폭 증가 (노드당 ~5토큰)

---

## 구현 순서

| 단계 | 변경 | 파일 | 난이도 |
|------|------|------|--------|
| 1 | parse_component_name fallback | figma_simplify.py | 쉬움 |
| 2 | component_map fallback | figma_simplify.py | 쉬움 |
| 3 | variant 매핑 테이블 확장 | figma_simplify.py | 쉬움 |
| 4 | 그리드 메타데이터 보존 | figma_simplify.py | 보통 |
| 5 | 프롬프트 가이드 추가 | tool_calling_loop.py | 쉬움 |
| 6 | 좌표 w 보존 | tool_calling_loop.py | 쉬움 |

모든 변경은 독립적이며 순서 무관하게 적용 가능.

## 검증 방법

```bash
# 1. 임포트 정상 확인
cd apps/ai-service && uv run python -c "from app.main import app; print('OK')"

# 2. parse_component_name 동작 확인
uv run python -c "
from app.services.figma_simplify import parse_component_name
# variant만 있는 경우 → None 반환 (정상)
assert parse_component_name('Size=sm, Type=tertiary') == (None, {'size': 'sm', 'type': 'tertiary'})
# 일반 이름 → 이름 반환
assert parse_component_name('header')[0] == 'header'
print('parse_component_name OK')
"

# 3. 실제 Figma URL로 생성 테스트 (수동)
# - 생성된 코드에서 component_map 매핑 실패 로그 확인
# - _gridStructure가 JSON에 포함되는지 확인
# - AI가 긍정 가이드를 참고하는지 출력 확인
```

## 변경하지 않는 것

- Figma API 호출 로직 (fetch_page_structure, fetch_node_detail, export_node_image)
- 멀티턴 tool calling 도입 (별도 작업)
- 프론트엔드 코드
- 스크린샷 기반 자기 검증 루프 (별도 작업 — 접근 A)
