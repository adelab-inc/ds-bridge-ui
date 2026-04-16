# Sub-Spec 1 — Code Validator (Stage 4)

**Parent**: `2026-04-16-figma-ai-quality-design.md` (§6 순서 1)
**날짜**: 2026-04-16
**범위**: `apps/ai-service/` — 생성된 TSX 코드 검증 모듈 신규 도입

---

## 1. 목적

AI가 생성한 TSX를 서버 측에서 **정적 검증**하여, 명백한 오류를 기계적으로 검출하고 응답 메타에 리포트를 첨부한다. 사용자 체감 품질의 즉시 개선보다는 **이후 모든 개선의 측정 기준**을 제공하는 것이 우선.

### 성공 기준

- 골든 샘플(Board Detail 등) 재생성 시 이미 알려진 오류들(Icon 환각, 외부 URL, import 누락)이 **100% 검출**된다
- False positive 0건에 수렴 (regex 기반이므로 확실한 것만 검출)
- Validator 자체가 레이턴시에 측정 가능한 영향을 주지 않는다 (p50 <20ms)

---

## 2. 범위

### v1 검증 카테고리 (3종)

| 카테고리 | 검출 대상 | 예시 |
|---|---|---|
| `unknown_component` | JSX에 등장하는 컴포넌트 중 DS 카탈로그에도, 로컬 선언에도 없는 것 | `<Foo />`, `<Icon name=...>`에서 Icon 자체는 허용이지만 `<Bar />`가 없는 건 실패 |
| `external_url` | 외부 URL 하드코딩 | `src="https://..."`, `src="http://..."`, `backgroundImage: url('https://...')` |
| `missing_import` | JSX에서 사용했으나 import/로컬 선언되지 않은 식별자 | `<Chip>` 썼는데 import 문에 Chip 없음 |

### v2 이후로 연기

- `unknown_icon` — Icon catalog(Icon name Enum) 선확보 필요
- `invalid_prop` — 컴포넌트별 props schema 정밀화 필요
- `ast_parse_error` — AST 도입 시점까지 연기

---

## 3. 아키텍처

### 3.1 모듈 구조

```
apps/ai-service/app/
├── services/
│   └── code_validator.py          # 신규 — 스캐너 + 검증 오케스트레이터
├── schemas/
│   └── validation.py              # 신규 — ValidationReport / ValidationError Pydantic
└── api/
    └── chat.py                    # 수정 — 응답 조립 직전 validator 호출
```

### 3.2 주요 심볼 (모듈 경계)

```python
# app/services/code_validator.py

class ComponentCatalog:
    """DS 컴포넌트 이름 화이트리스트. 싱글턴/캐시."""
    def __init__(self, schema_path: Path, extra_layout: Iterable[str]) -> None: ...
    def is_known(self, name: str) -> bool: ...
    @classmethod
    def load_default(cls) -> "ComponentCatalog": ...

def scan_jsx_components(source: str) -> list[JSXUsage]:
    """regex 기반 JSX 사용 스캐너. <PascalCase [props]> 패턴 수집."""

def scan_imports(source: str) -> set[str]:
    """top-level import 식별자 수집 (alias는 사용명 기준)."""

def scan_local_decls(source: str) -> set[str]:
    """파일 내 로컬 `const/let/function/class` PascalCase 선언 수집."""

def scan_external_urls(source: str) -> list[Location]:
    """src/href/url() 내 http(s):// 리터럴 검색."""

def validate_code(
    source: str,
    catalog: ComponentCatalog,
) -> ValidationReport:
    """진입점. 3종 검사를 모아 ValidationReport를 반환."""
```

### 3.3 데이터 계약

```python
# app/schemas/validation.py

class ValidationError(BaseModel):
    category: str
    # v1 카테고리:
    #   "unknown_component"      <Foo/> not in DS catalog and not locally declared/imported
    #   "missing_import"          DS catalog에는 존재하지만 import 누락
    #   "external_url"            src/href/url(...) https?:// 리터럴
    #   "validator_internal_error" Validator 자체 예외/타임아웃 (부모 spec의 ast_parse_error와 구분)
    location: str  # "line 42, col 8" 또는 "line 42, <Chip>"
    message: str
    suggested_fix: str | None = None

class ValidationReport(BaseModel):
    passed: bool
    errors: list[ValidationError] = []
    warnings: list[ValidationError] = []  # v1은 비어있음. v2용 필드
    elapsed_ms: int
```

`ParsedResponse` (기존 `app/schemas/chat.py`)에 optional 필드 추가:

```python
class ParsedResponse(BaseModel):
    conversation: str
    files: list[FileContent]
    raw: str
    validation: ValidationReport | None = None   # 신규 — 피처 플래그 off 시 None
```

---

## 4. 검증 로직 상세

### 4.1 컴포넌트 카탈로그

**소스**:
1. `component-schema.json`의 `components` 키 (현재 22개)
2. 레이아웃 컴포넌트 목록을 모듈 상수 `LAYOUT_COMPONENTS_V1`로 정의 (`# TODO(sub-spec 2): component-schema.json 확장 후 제거`):
   `GridLayout`, `RowPattern`, `FormGrid`, `FormGridCell`, `SectionCard`, `TitleSection`, `Icon`, `DataGrid`
3. React 프래그먼트/내장 식별자 허용리스트: `Fragment`, `React`
4. HTML 네이티브 태그(소문자 시작)는 검사 제외
5. 로컬 선언된 식별자(`const Foo = ...`, `function Bar() ...`)는 로컬 화이트리스트에 추가

**확장 훅**: `ComponentCatalog`에 `add(name)` 메서드를 두어 테스트/플러그인이 추가 주입 가능.

### 4.2 JSX 스캐너 (regex)

```python
# <PascalCase ...> 또는 <PascalCase/>
JSX_OPEN_RE = re.compile(r"<([A-Z][A-Za-z0-9_]*)[\s/>]")
```

주석/문자열 내부를 무시하는 기본 전처리 포함:
- 라인 주석 `//...`, 블록 주석 `/* ... */` 제거 후 스캔
- 문자열 리터럴(`"..."`, `'...'`, 템플릿 리터럴)은 토큰화 중 건너뜀

**수용된 오탐 트레이드오프**:
- TypeScript 제네릭(`ComponentType<Foo>`)/캐스트(`<Foo>value`) 는 regex에서 JSX로 오탐 가능. 대부분 `Foo`가 로컬 선언/import에 존재하므로 `known_local`에서 걸러짐. 잔여 오탐은 v2의 AST 전환 시 해결.

### 4.3 Import / 로컬 선언 스캐너

```python
# import { A, B as BB } from "..."
IMPORT_RE = re.compile(r'import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from')
# const Foo = / function Foo() / class Foo / export default function Foo
DECL_RE = re.compile(r'\b(?:const|let|function|class)\s+([A-Z][A-Za-z0-9_]*)')
```

- `import { X, Y as Z }` → `{"X", "Z"}` 수집 (별칭은 사용명 기준)
- 기본 import(`import Foo from ...`)도 포함
- `import type { ... }`도 포함 (React 컨벤션상 PascalCase는 값일 확률 높음)

### 4.4 외부 URL 스캐너

```python
EXTERNAL_URL_RE = re.compile(
    r'''(?:src|href)\s*=\s*["']https?://[^"']+["']'''
    r"|url\(\s*['\"]?https?://[^)'\"]+"
)
```

예외:
- 환경 변수 치환 표현(`${...}`) 포함 URL은 무시 (동적 src는 오탐 위험)

### 4.5 검증 규칙 조합

```
usages = scan_jsx_components(source)
imports = scan_imports(source)
local_decls = scan_local_decls(source)
known_local = imports | local_decls

for u in usages:
    in_local = u.name in known_local
    in_catalog = catalog.is_known(u.name)
    if not in_local and not in_catalog:
        emit unknown_component    # 우선순위 규칙: 카탈로그에도 없으면 unknown_component 만 발행
    elif not in_local and in_catalog:
        emit missing_import       # 카탈로그에는 있는데 import 누락

emit external_url for each EXTERNAL_URL_RE hit
```

**중복 방지 규칙**: 동일 `(name, line)` 쌍은 한 번만 리포트. `unknown_component`와 `missing_import`는 상호 배타 — `unknown_component`가 강한 신호이므로 우선.

### 4.6 판정

- `errors` 1건 이상 → `passed=False`
- `errors` 0건 → `passed=True`
- `warnings`는 v1에서 사용 안 함

---

## 5. 훅 지점 (chat.py 통합)

**대상**: `/Users/junghun/Desktop/ds-bridge-ui/apps/ai-service/app/api/chat.py`

### 5.1 위치

`chat.py` 의 2개 엔드포인트 모두:
1. `@router.post("")` non-streaming chat (현재 L586 근처, `return ChatResponse(...)` 직전 L687)
2. `@router.post("/stream")` streaming (L704 근처, `run_figma_tool_calling_loop` 루프 종료 후 최종 조립 시점)

### 5.2 호출 패턴

```python
from app.services.code_validator import ComponentCatalog, validate_code
from app.core.config import settings

# module-level singleton (LRU 캐시)
_catalog = ComponentCatalog.load_default()

# chat.py — 기존 `parsed = parse_ai_response(...)` 직후
if settings.enable_validation and parsed.files:
    # v1: 여러 파일이 있어도 모두 검증. 에러는 하나의 report에 합산
    merged = ValidationReport(passed=True, errors=[], warnings=[], elapsed_ms=0)
    for f in parsed.files:
        r = validate_code(f.content, _catalog)
        merged.errors.extend(r.errors)
        merged.warnings.extend(r.warnings)
        merged.elapsed_ms += r.elapsed_ms
    merged.passed = not merged.errors
    parsed.validation = merged
```

스트리밍 경로는 최종 `done` 이벤트 직전에 동일하게 호출. 스트림 본문(청크)에는 주입하지 않음 — 최종 메타데이터에만 포함.

### 5.3 에러 처리

- Validator 자체 예외는 삼키고 `passed=False, errors=[{"category":"validator_internal_error", ...}]`로 리포트 (1차 코드 반환은 유지)
- Validator 타임아웃(설정 `VALIDATION_TIMEOUT_MS=200`) 초과 시 동일 처리

---

## 6. 설정 & 피처 플래그

`apps/ai-service/app/core/config.py`:

```python
enable_validation: bool = Field(default=False, alias="ENABLE_VALIDATION")
validation_timeout_ms: int = Field(default=200, alias="VALIDATION_TIMEOUT_MS")
```

기본 off. 환경변수로 단계적 활성화. Repair(sub-spec 4)는 이 spec과 무관 — Validator는 독립 롤아웃 가능.

---

## 7. 테스트 전략

### 7.1 단위 테스트 (`apps/ai-service/tests/test_code_validator.py`)

| 케이스 | 입력 | 기대 |
|---|---|---|
| happy path | `import { Button } from "@/components"; <Button/>` | passed=True |
| unknown component | `<Foo />` (import 없음) | `unknown_component` 1건 |
| missing import | `<Chip />` (import 없음, DS에는 존재) | `missing_import` 1건 |
| external url | `<img src="https://foo.com/a.jpg" />` | `external_url` 1건 |
| nested jsx | `<GridLayout><Button/></GridLayout>` + 정상 import | passed=True |
| alias import | `import { Button as Btn } from ...; <Btn/>` | passed=True |
| local component | `const MyBlock = () => <div/>; <MyBlock/>` | passed=True |
| HTML element | `<div/><section/>` | passed=True (소문자 스킵) |
| comment false positive | `// <Foo />` | passed=True |
| string false positive | `const s = "<Bar />";` | passed=True |
| fragment | `<><Button/></>` (정상 import) | passed=True |
| multi file | 2개 FileContent (1개 정상, 1개 unknown_component) | errors 1건 |
| external url multiple | img×2, backgroundImage×1 | `external_url` 3건 |

### 7.2 회귀 테스트 (골든 출력)

- `apps/ai-service/tests/fixtures/validator/` 신규 디렉터리
- `apps/ai-service/test-batch-output/` (현재 디렉터리명, 하이픈 사용, git 미추적)에서 대표 3-5개 선정해 위 fixtures 경로로 복사·커밋 (메타 spec §7 Note 이행)
  - Board Detail 오류 사례 (Icon blank, external URL 포함)
  - 정상 케이스 2건
  - 경계 케이스 1-2건
- `pytest.mark.parametrize`로 각 파일의 예상 리포트와 대조

### 7.3 CI

- `uv run pytest apps/ai-service/tests/test_code_validator.py` 추가
- 전체 파이프라인 e2e는 이 spec 범위 밖

---

## 8. 관측성

- 로그: 각 호출당 `category` 별 카운트 + `elapsed_ms`
- 로그 포맷: `{"event": "validation", "passed": ..., "counts": {"unknown_component": 0, ...}, "elapsed_ms": ...}`
- 장기적으로 Cloud Run 로그 필터에서 카테고리별 발생률 추적 → sub-spec 2/3/4의 효과 측정 근거

---

## 9. 비범위 (Out of Scope)

- AST 기반 검증 (v2)
- Icon name catalog 검증 (v2 — Storybook에서 추출 작업 필요)
- 컴포넌트별 props 스키마 검증 (v2)
- 생성 코드 자동 수정 (sub-spec 4 — Repair Loop 담당)
- 프런트엔드 수정 없음

---

## 10. 오픈 이슈

- `ComponentCatalog`의 레이아웃 컴포넌트 하드코딩 리스트가 향후 DS 변경을 놓칠 가능성 — sub-spec 2(Preprocessing)에서 `component-schema.json` 확장 논의 필요
- 스트리밍 응답 전달 형식 — **v1 결정: 별도 SSE 이벤트 타입 없음. 최종 `done` 이벤트 직전 메타데이터에만 포함.** 클라이언트 확장이 필요해지면 v2에서 `type: "validation"` 이벤트 추가 고려.
- `warnings` 필드는 v1에서 비어있지만 스키마에 노출됨 — 클라이언트 무시해도 되는지 확인 (BE only이므로 변경 안전)

---

## 11. 수용 기준 (DoD)

- [ ] `code_validator.py` + `schemas/validation.py` 추가
- [ ] 단위 테스트 13건 이상 통과 (§7.1)
- [ ] 회귀 픽스처 3건 이상 커밋 (§7.2)
- [ ] `chat.py` 2개 엔드포인트에 feature flag 기반 훅 추가
- [ ] `ENABLE_VALIDATION=true` 환경에서 로컬 실행 시 Board Detail 생성 결과에 대해 known issue 검출 확인
- [ ] `ENABLE_VALIDATION=false` (기본)에서 동작 변화 없음 (회귀 테스트로 보장)
- [ ] 레이턴시 단위 벤치마크: 1KB TSX 입력 p50 <20ms (pytest-benchmark 또는 수동 측정 스크립트)
