# Code Validator (Stage 4) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI가 생성한 TSX 코드를 서버 측에서 정적 검증해 3종 카테고리(`unknown_component`, `missing_import`, `external_url`)의 명백한 오류를 기계적으로 검출하고, 응답 메타(`ParsedResponse.validation`) 또는 스트리밍 `done` 이벤트에 리포트를 첨부한다.

**Architecture:** Python 정규식 + JSX 스캐너 기반. 외부 의존성 0. 신규 모듈 2개(`app/services/code_validator.py`, `app/schemas/validation.py`) + 기존 3개 파일 수정(`app/schemas/chat.py`, `app/core/config.py`, `app/api/chat.py`). Feature flag `ENABLE_VALIDATION` 기본 off.

**Tech Stack:** Python 3.12+, Pydantic v2, FastAPI, pytest, regex (표준 라이브러리 `re`).

**Spec**: `docs/superpowers/specs/2026-04-16-spec-validator-design.md`
**Parent**: `docs/superpowers/specs/2026-04-16-figma-ai-quality-design.md`

> **실행 전 공통 전제**:
> - 모든 `uv run pytest`, `uv run mypy`, `uv run ruff` 커맨드는 `apps/ai-service/` 작업 디렉토리에서 실행한다. 각 단계에서 에이전트가 신규 세션을 시작하면 `cd apps/ai-service` 를 먼저 수행한다.
> - 커밋 메시지 프리픽스는 대문자(`Fix:`, `Feat:`, `Refactor:`)만 사용한다. `Co-Authored-By` 라인은 추가하지 않는다.
> - BE only — `apps/web/` 는 절대 수정하지 않는다.

---

## File Structure

### 신규 (Create)
| 파일 | 책임 |
|---|---|
| `apps/ai-service/app/schemas/validation.py` | `ValidationError`, `ValidationReport` Pydantic 모델 |
| `apps/ai-service/app/services/code_validator.py` | `ComponentCatalog`, scanner 함수들, `validate_code` 진입점 |
| `apps/ai-service/tests/test_code_validator.py` | 단위 테스트 13+건 |
| `apps/ai-service/tests/fixtures/validator/README.md` | 픽스처 디렉터리 설명 |
| `apps/ai-service/tests/fixtures/validator/*.tsx` | 회귀 픽스처 (3-5건) |
| `apps/ai-service/tests/fixtures/validator/expected/*.json` | 각 픽스처의 기대 리포트 |

### 수정 (Modify)
| 파일 | 변경 |
|---|---|
| `apps/ai-service/app/schemas/chat.py` | `ParsedResponse.validation: ValidationReport \| None` 필드 추가 |
| `apps/ai-service/app/core/config.py` | `enable_validation`, `validation_timeout_ms` 필드 추가 |
| `apps/ai-service/app/api/chat.py` | non-streaming(L687 이전) + streaming(L1035 이전) 2곳 훅 추가 |

---

## Chunk 1: 데이터 계약 + 설정

### Task 1: ValidationError/ValidationReport 스키마

**Files:**
- Create: `apps/ai-service/app/schemas/validation.py`
- Test: `apps/ai-service/tests/test_code_validator.py` (신규 — 이 Task에서 파일 자체를 처음 만듦)

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# apps/ai-service/tests/test_code_validator.py
"""code_validator 모듈 및 validation 스키마 단위 테스트."""

from __future__ import annotations

import pytest

from app.schemas.validation import ValidationError, ValidationReport


class TestValidationSchemas:
    def test_validation_error_minimal(self):
        err = ValidationError(
            category="unknown_component",
            location="line 10, <Foo>",
            message="Foo is not in DS catalog",
        )
        assert err.category == "unknown_component"
        assert err.suggested_fix is None

    def test_validation_error_with_fix(self):
        err = ValidationError(
            category="missing_import",
            location="line 5",
            message="Chip used but not imported",
            suggested_fix="add `import { Chip } from '@/components'`",
        )
        assert err.suggested_fix is not None

    def test_validation_report_passed_default(self):
        report = ValidationReport(passed=True, errors=[], warnings=[], elapsed_ms=5)
        assert report.passed is True
        assert report.errors == []
        assert report.elapsed_ms == 5

    def test_validation_report_with_errors(self):
        err = ValidationError(
            category="external_url",
            location="line 3",
            message="external URL hardcoded",
        )
        report = ValidationReport(passed=False, errors=[err], warnings=[], elapsed_ms=12)
        assert report.passed is False
        assert len(report.errors) == 1
```

- [ ] **Step 2: 테스트 실패 확인**

```
cd apps/ai-service
uv run pytest tests/test_code_validator.py::TestValidationSchemas -v
```

Expected: FAIL (`ModuleNotFoundError: No module named 'app.schemas.validation'`)

- [ ] **Step 3: 최소 구현**

```python
# apps/ai-service/app/schemas/validation.py
"""검증 결과 스키마."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ValidationError(BaseModel):
    """단일 검증 오류.

    category v1 값:
        - "unknown_component": JSX에 등장한 컴포넌트가 DS 카탈로그에도 로컬 선언에도 없음
        - "missing_import": DS 카탈로그에는 있지만 import 선언이 없음
        - "external_url": `src`/`href`/`url()` 리터럴에 외부 https?:// 포함
        - "validator_internal_error": Validator 자체 예외/타임아웃
    """

    category: str = Field(..., description="오류 카테고리 (위 주석 참조)")
    location: str = Field(..., description="예: 'line 42, <Checkbox>'")
    message: str = Field(..., description="사람이 읽을 수 있는 설명")
    suggested_fix: str | None = Field(None, description="자동 수정 힌트(가능한 경우)")


class ValidationReport(BaseModel):
    """코드 검증 결과."""

    passed: bool
    errors: list[ValidationError] = Field(default_factory=list)
    warnings: list[ValidationError] = Field(default_factory=list)
    elapsed_ms: int = 0
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestValidationSchemas -v
```

Expected: PASS (4 passed)

- [ ] **Step 5: 커밋**

```
git add apps/ai-service/app/schemas/validation.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: ValidationError/ValidationReport 스키마 추가"
```

---

### Task 2: ParsedResponse에 validation 필드 확장

**Files:**
- Modify: `apps/ai-service/app/schemas/chat.py`

- [ ] **Step 1: 실패하는 테스트 작성 (기존 test_code_validator.py에 추가)**

```python
# 추가: 파일 상단 import에 ParsedResponse 추가
from app.schemas.chat import FileContent, ParsedResponse


class TestParsedResponseValidation:
    def test_parsed_response_validation_default_none(self):
        parsed = ParsedResponse(
            conversation="hi",
            files=[],
            raw="hi",
        )
        assert parsed.validation is None

    def test_parsed_response_accepts_validation_report(self):
        report = ValidationReport(passed=True, errors=[], warnings=[], elapsed_ms=3)
        parsed = ParsedResponse(
            conversation="hi",
            files=[FileContent(path="a.tsx", content="x")],
            raw="hi",
            validation=report,
        )
        assert parsed.validation is not None
        assert parsed.validation.passed is True
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestParsedResponseValidation -v
```

Expected: FAIL (`ParsedResponse` doesn't accept `validation` kwarg)

- [ ] **Step 3: 최소 구현**

`apps/ai-service/app/schemas/chat.py` 상단 import 영역에 추가:
```python
from app.schemas.validation import ValidationReport
```

`ParsedResponse` 클래스 내 기존 `raw: str = Field(...)` 직후에 추가:
```python
    validation: ValidationReport | None = Field(
        None,
        description="정적 검증 결과 (ENABLE_VALIDATION=false이면 None)",
    )
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestParsedResponseValidation -v
```

Expected: PASS (2 passed)

- [ ] **Step 5: 기존 chat 관련 테스트 회귀 없음 확인**

```
uv run pytest tests/test_chat.py tests/test_components.py tests/test_components_api.py -q
```

Expected: 기존과 동일 결과 (모두 통과 또는 pre-existing 실패는 그대로)

- [ ] **Step 6: 커밋**

```
git add apps/ai-service/app/schemas/chat.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: ParsedResponse.validation optional 필드 추가"
```

---

### Task 3: Config 피처 플래그 추가

**Files:**
- Modify: `apps/ai-service/app/core/config.py`

- [ ] **Step 1: 실패하는 테스트 작성 (test_code_validator.py에 추가)**

```python
class TestConfigValidationFlags:
    def test_enable_validation_default_false(self, monkeypatch):
        """기본값 검증. Supabase 필수 env 는 conftest 실행 시점 .env 또는 실제
        환경변수로부터 로드된다. 혹시 로컬 실행 환경이 다를 수 있어 명시적으로
        주입해둔다."""
        monkeypatch.setenv("SUPABASE_URL", "http://x")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "x")
        # `lru_cache` 초기화 방지 — 매번 새 인스턴스 생성
        from app.core.config import Settings

        s = Settings()
        assert s.enable_validation is False
        assert s.validation_timeout_ms == 200
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestConfigValidationFlags -v
```

Expected: FAIL (`AttributeError: 'Settings' has no attribute 'enable_validation'`)

- [ ] **Step 3: 최소 구현**

`apps/ai-service/app/core/config.py` 의 `max_image_size_mb` 다음 줄에 추가:

```python
    # Code Validation (Stage 4)
    enable_validation: bool = False       # 기본 off, 단계적 롤아웃
    validation_timeout_ms: int = 200      # validator 자체 타임아웃
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestConfigValidationFlags -v
```

Expected: PASS (1 passed)

- [ ] **Step 5: 커밋**

```
git add apps/ai-service/app/core/config.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: ENABLE_VALIDATION / VALIDATION_TIMEOUT_MS 설정 추가"
```

---

## Chunk 2: Validator 핵심 로직 (Catalog + Scanners)

### Task 4: ComponentCatalog 싱글턴

**Files:**
- Create: `apps/ai-service/app/services/code_validator.py`
- Test: `apps/ai-service/tests/test_code_validator.py` (확장)

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# 파일 상단 import 추가
from pathlib import Path


class TestComponentCatalog:
    def test_load_default_includes_ds_components(self):
        from app.services.code_validator import ComponentCatalog

        catalog = ComponentCatalog.load_default()
        # component-schema.json의 대표 컴포넌트
        assert catalog.is_known("Button") is True
        assert catalog.is_known("Field") is True

    def test_load_default_includes_layout_components(self):
        from app.services.code_validator import ComponentCatalog

        catalog = ComponentCatalog.load_default()
        assert catalog.is_known("GridLayout") is True
        assert catalog.is_known("FormGrid") is True
        assert catalog.is_known("TitleSection") is True
        assert catalog.is_known("Icon") is True

    def test_unknown_component_returns_false(self):
        from app.services.code_validator import ComponentCatalog

        catalog = ComponentCatalog.load_default()
        assert catalog.is_known("TotallyFakeComponent") is False

    def test_react_fragment_allowed(self):
        from app.services.code_validator import ComponentCatalog

        catalog = ComponentCatalog.load_default()
        assert catalog.is_known("Fragment") is True
        assert catalog.is_known("React") is True

    def test_add_custom_name(self):
        from app.services.code_validator import ComponentCatalog

        catalog = ComponentCatalog(schema_components=set(), extra=set())
        assert catalog.is_known("Widget") is False
        catalog.add("Widget")
        assert catalog.is_known("Widget") is True
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestComponentCatalog -v
```

Expected: FAIL (`ModuleNotFoundError: No module named 'app.services.code_validator'`)

- [ ] **Step 3: 최소 구현**

```python
# apps/ai-service/app/services/code_validator.py
"""정적 TSX 코드 검증 (Stage 4).

Sub-spec: docs/superpowers/specs/2026-04-16-spec-validator-design.md
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

# TODO(sub-spec 2): component-schema.json 확장 후 제거
LAYOUT_COMPONENTS_V1: frozenset[str] = frozenset(
    {
        "GridLayout",
        "RowPattern",
        "FormGrid",
        "FormGridCell",
        "SectionCard",
        "TitleSection",
        "Icon",
        "DataGrid",
    }
)

# React 기본 식별자 (JSX에서 PascalCase로 등장 가능)
REACT_BUILTINS: frozenset[str] = frozenset({"Fragment", "React"})

# 기본 스키마 위치
_DEFAULT_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "component-schema.json"


class ComponentCatalog:
    """허용된 컴포넌트 이름 화이트리스트."""

    def __init__(
        self,
        schema_components: set[str],
        extra: set[str] | None = None,
    ) -> None:
        self._known: set[str] = set(schema_components)
        self._known.update(LAYOUT_COMPONENTS_V1)
        self._known.update(REACT_BUILTINS)
        if extra:
            self._known.update(extra)

    def is_known(self, name: str) -> bool:
        return name in self._known

    def add(self, name: str) -> None:
        self._known.add(name)

    @classmethod
    def load_default(cls, schema_path: Path | None = None) -> "ComponentCatalog":
        """`component-schema.json`에서 컴포넌트 이름을 로드한다."""
        path = schema_path or _DEFAULT_SCHEMA_PATH
        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            components = set((data.get("components") or {}).keys())
        except (OSError, json.JSONDecodeError):
            components = set()
        return cls(schema_components=components)
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestComponentCatalog -v
```

Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```
git add apps/ai-service/app/services/code_validator.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: ComponentCatalog - DS 컴포넌트 화이트리스트 로더"
```

---

### Task 5: JSX 컴포넌트 스캐너

**Files:**
- Modify: `apps/ai-service/app/services/code_validator.py`
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
class TestScanJsxComponents:
    def test_single_self_closing(self):
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components("<Button />")
        names = [u.name for u in usages]
        assert names == ["Button"]

    def test_open_close_pair(self):
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components("<Button>Click</Button>")
        names = [u.name for u in usages]
        assert names == ["Button"]

    def test_nested(self):
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components("<GridLayout><Button /></GridLayout>")
        names = sorted({u.name for u in usages})
        assert names == ["Button", "GridLayout"]

    def test_html_tags_ignored(self):
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components("<div><section>hi</section></div>")
        assert usages == []

    def test_line_comment_ignored(self):
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components("// <Foo />\nconst x = 1;")
        assert usages == []

    def test_block_comment_ignored(self):
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components("/* <Foo /> */ const x = 1;")
        assert usages == []

    def test_string_literal_ignored(self):
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components('const s = "<Bar />"; <Button />')
        names = [u.name for u in usages]
        assert names == ["Button"]

    def test_line_number_tracked(self):
        from app.services.code_validator import scan_jsx_components

        src = "const x = 1;\n\n<Button />"
        usages = scan_jsx_components(src)
        assert len(usages) == 1
        assert usages[0].line == 3

    def test_react_fragment_dotted(self):
        """<React.Fragment> 는 전체가 스캐너에서 skip 된다.

        `_JSX_OPEN_RE` 의 lookahead `(?=[\\s/>])` 는 `.` 을 허용하지 않으므로
        `<React.Fragment>` 는 매치되지 않는다. Fragment 구문은 단순히 "JSX 컴포넌트
        사용"이 아니라고 보는 것이 의미상 정확하므로 이 동작을 고정한다.
        """
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components("<React.Fragment><Button /></React.Fragment>")
        names = [u.name for u in usages]
        assert names == ["Button"]

    def test_shorthand_fragment(self):
        """<></> 단축 문법은 JSX 컴포넌트로 인식되지 않는다."""
        from app.services.code_validator import scan_jsx_components

        usages = scan_jsx_components("<><Button /></>")
        names = [u.name for u in usages]
        assert names == ["Button"]
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestScanJsxComponents -v
```

Expected: FAIL (`ImportError: cannot import name 'scan_jsx_components'`)

- [ ] **Step 3: 최소 구현**

`apps/ai-service/app/services/code_validator.py` 에 추가 (파일 하단):

```python
import re
from dataclasses import dataclass

# <PascalCase ...> 또는 <PascalCase/>
_JSX_OPEN_RE = re.compile(r"<([A-Z][A-Za-z0-9_]*)(?=[\s/>])")

# 라인/블록 주석 제거 (DOTALL, 순서 중요: 블록 먼저)
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
_LINE_COMMENT_RE = re.compile(r"//[^\n]*")

# 문자열/템플릿 리터럴 치환용 (내용을 공백으로 교체해 라인 오프셋 유지)
_STRING_RE = re.compile(
    r"""
    (?P<q>['"`])            # 시작 따옴표
    (?:\\.|(?!(?P=q)).)*    # 이스케이프 또는 닫는 따옴표 아닌 문자
    (?P=q)                  # 같은 따옴표로 종료
    """,
    re.DOTALL | re.VERBOSE,
)


def _strip_comments_and_strings(source: str) -> str:
    """주석/문자열 리터럴을 공백(동일 길이)으로 치환해 라인 번호 보존."""

    def _blank(match: re.Match[str]) -> str:
        s = match.group(0)
        # 개행은 보존
        return "".join("\n" if ch == "\n" else " " for ch in s)

    without_block = _BLOCK_COMMENT_RE.sub(_blank, source)
    without_line = _LINE_COMMENT_RE.sub(_blank, without_block)
    without_strings = _STRING_RE.sub(_blank, without_line)
    return without_strings


@dataclass(frozen=True)
class JSXUsage:
    name: str
    line: int  # 1-based


def scan_jsx_components(source: str) -> list[JSXUsage]:
    """JSX 컴포넌트 사용(대문자 시작)을 수집한다."""
    cleaned = _strip_comments_and_strings(source)
    usages: list[JSXUsage] = []
    for match in _JSX_OPEN_RE.finditer(cleaned):
        name = match.group(1)
        line = cleaned.count("\n", 0, match.start()) + 1
        usages.append(JSXUsage(name=name, line=line))
    return usages
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestScanJsxComponents -v
```

Expected: PASS (10 passed)

- [ ] **Step 5: 커밋**

```
git add apps/ai-service/app/services/code_validator.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: scan_jsx_components - PascalCase JSX 사용 추출"
```

---

### Task 6: Import 스캐너

**Files:**
- Modify: `apps/ai-service/app/services/code_validator.py`
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
class TestScanImports:
    def test_named_imports(self):
        from app.services.code_validator import scan_imports

        src = 'import { Button, Chip } from "@/components";'
        assert scan_imports(src) == {"Button", "Chip"}

    def test_alias_import(self):
        from app.services.code_validator import scan_imports

        src = 'import { Button as Btn } from "@/components";'
        assert scan_imports(src) == {"Btn"}

    def test_default_import(self):
        from app.services.code_validator import scan_imports

        src = 'import Foo from "./foo";'
        assert scan_imports(src) == {"Foo"}

    def test_default_plus_named(self):
        from app.services.code_validator import scan_imports

        src = 'import React, { useState } from "react";'
        result = scan_imports(src)
        assert "React" in result
        assert "useState" in result

    def test_type_only_imports(self):
        from app.services.code_validator import scan_imports

        src = 'import type { Foo } from "./types";'
        assert "Foo" in scan_imports(src)

    def test_no_imports(self):
        from app.services.code_validator import scan_imports

        assert scan_imports("const x = 1;") == set()

    def test_multiline_named_imports(self):
        """실제 AI 출력은 보통 여러 줄에 걸쳐 named import를 쓴다."""
        from app.services.code_validator import scan_imports

        src = (
            "import {\n"
            "  Button,\n"
            "  Field,\n"
            "  Chip,\n"
            '} from "@/components";\n'
        )
        assert scan_imports(src) == {"Button", "Field", "Chip"}
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestScanImports -v
```

Expected: FAIL (`ImportError: cannot import name 'scan_imports'`)

- [ ] **Step 3: 최소 구현**

`code_validator.py` 에 추가:

```python
# import { A, B as BB } from "..."  또는  import Default from "..."  또는  import type { ... } from "..."
_IMPORT_LINE_RE = re.compile(
    r"""
    import \s+ (?:type \s+)?       # type-only import 허용
    (?:
        (?P<default>[A-Za-z_$][\w$]*)\s*  # default import
        (?:,\s*)?
    )?
    (?:\{\s*(?P<named>[^}]*)\s*\})?  # named imports
    \s* from \s* ['"][^'"]+['"]
    """,
    re.VERBOSE,
)


def scan_imports(source: str) -> set[str]:
    """top-level `import` 문에서 사용 이름(alias는 우변) 수집."""
    cleaned = _strip_comments_and_strings(source)
    names: set[str] = set()
    for match in _IMPORT_LINE_RE.finditer(cleaned):
        default = match.group("default")
        if default:
            names.add(default)
        named = match.group("named")
        if named:
            for raw in named.split(","):
                token = raw.strip()
                if not token:
                    continue
                # "X as Y" → Y 사용
                parts = [p.strip() for p in token.split(" as ")]
                names.add(parts[-1])
    return names
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestScanImports -v
```

Expected: PASS (7 passed)

- [ ] **Step 5: 커밋**

```
git add apps/ai-service/app/services/code_validator.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: scan_imports - import 식별자 수집 (alias 우변 기준)"
```

---

### Task 7: 로컬 선언 스캐너

**Files:**
- Modify: `apps/ai-service/app/services/code_validator.py`
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
class TestScanLocalDecls:
    def test_const_pascal(self):
        from app.services.code_validator import scan_local_decls

        src = "const MyBlock = () => <div/>;"
        assert scan_local_decls(src) == {"MyBlock"}

    def test_function_pascal(self):
        from app.services.code_validator import scan_local_decls

        src = "function Header() { return <div/>; }"
        assert scan_local_decls(src) == {"Header"}

    def test_class_pascal(self):
        from app.services.code_validator import scan_local_decls

        assert scan_local_decls("class Widget {}") == {"Widget"}

    def test_lowercase_ignored(self):
        from app.services.code_validator import scan_local_decls

        src = "const useSomething = () => {};"
        assert "useSomething" not in scan_local_decls(src)

    def test_multiple(self):
        from app.services.code_validator import scan_local_decls

        src = (
            "const Foo = () => <div/>;\n"
            "function Bar() { return <div/>; }\n"
            "const x = 1;\n"
        )
        assert scan_local_decls(src) == {"Foo", "Bar"}
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestScanLocalDecls -v
```

Expected: FAIL (`ImportError: cannot import name 'scan_local_decls'`)

- [ ] **Step 3: 최소 구현**

`code_validator.py` 에 추가:

```python
_LOCAL_DECL_RE = re.compile(
    r"\b(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_]*)\b"
)


def scan_local_decls(source: str) -> set[str]:
    """파일 내부 `const/let/var/function/class` PascalCase 선언 식별자."""
    cleaned = _strip_comments_and_strings(source)
    return {m.group(1) for m in _LOCAL_DECL_RE.finditer(cleaned)}
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestScanLocalDecls -v
```

Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```
git add apps/ai-service/app/services/code_validator.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: scan_local_decls - 로컬 PascalCase 선언 수집"
```

---

### Task 8: 외부 URL 스캐너

**Files:**
- Modify: `apps/ai-service/app/services/code_validator.py`
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
class TestScanExternalUrls:
    def test_src_https(self):
        from app.services.code_validator import scan_external_urls

        src = '<img src="https://example.com/a.jpg" />'
        hits = scan_external_urls(src)
        assert len(hits) == 1
        assert hits[0].line == 1

    def test_href_http(self):
        from app.services.code_validator import scan_external_urls

        hits = scan_external_urls('<a href="http://x.com">link</a>')
        assert len(hits) == 1

    def test_css_url(self):
        from app.services.code_validator import scan_external_urls

        src = "backgroundImage: url('https://x.com/bg.png')"
        hits = scan_external_urls(src)
        assert len(hits) == 1

    def test_relative_url_ignored(self):
        from app.services.code_validator import scan_external_urls

        assert scan_external_urls('<img src="/local/a.jpg" />') == []

    def test_template_literal_ignored(self):
        from app.services.code_validator import scan_external_urls

        # 동적 치환 URL은 오탐 방지 차원에서 현재 구현 단계에선 스킵
        src = "const s = `https://${host}/a.jpg`;"
        assert scan_external_urls(src) == []

    def test_multiple_hits(self):
        from app.services.code_validator import scan_external_urls

        src = (
            '<img src="https://a.com/1.png" />\n'
            '<img src="https://b.com/2.png" />'
        )
        assert len(scan_external_urls(src)) == 2
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestScanExternalUrls -v
```

Expected: FAIL (`ImportError: cannot import name 'scan_external_urls'`)

- [ ] **Step 3: 최소 구현**

`code_validator.py` 에 추가:

```python
_EXTERNAL_URL_RE = re.compile(
    r"""
    (?:src|href)\s*=\s*['"]https?://[^'"]+['"]
    |
    url\(\s*['"]?https?://[^)'"]+
    """,
    re.VERBOSE,
)


@dataclass(frozen=True)
class UrlHit:
    line: int
    snippet: str


def scan_external_urls(source: str) -> list[UrlHit]:
    """src/href/url() 내 https?:// 리터럴을 수집한다.

    템플릿 리터럴은 `_strip_comments_and_strings`에서 공백으로 치환되어
    자동으로 제외된다.
    """
    cleaned = _strip_comments_and_strings(source)
    hits: list[UrlHit] = []
    for match in _EXTERNAL_URL_RE.finditer(cleaned):
        line = cleaned.count("\n", 0, match.start()) + 1
        # 원본에서 해당 줄 내용을 잘라 snippet에 담는다 (공백으로 치환된 cleaned가 아니라)
        raw_line = source.splitlines()[line - 1] if line - 1 < len(source.splitlines()) else ""
        hits.append(UrlHit(line=line, snippet=raw_line.strip()))
    return hits
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestScanExternalUrls -v
```

Expected: PASS (6 passed)

- [ ] **Step 5: 커밋**

```
git add apps/ai-service/app/services/code_validator.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: scan_external_urls - src/href/url() 외부 URL 감지"
```

---

## Chunk 3: Orchestrator + chat.py 통합

### Task 9: validate_code 진입점

**Files:**
- Modify: `apps/ai-service/app/services/code_validator.py`
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
class TestValidateCode:
    def _catalog(self):
        from app.services.code_validator import ComponentCatalog

        return ComponentCatalog.load_default()

    def test_happy_path(self):
        from app.services.code_validator import validate_code

        src = (
            'import { Button } from "@/components";\n'
            "const Page = () => <Button>hi</Button>;\n"
        )
        report = validate_code(src, self._catalog())
        assert report.passed is True
        assert report.errors == []

    def test_unknown_component(self):
        from app.services.code_validator import validate_code

        src = "const Page = () => <TotallyFake />;"
        report = validate_code(src, self._catalog())
        assert report.passed is False
        categories = [e.category for e in report.errors]
        assert "unknown_component" in categories

    def test_missing_import(self):
        from app.services.code_validator import validate_code

        # Chip는 DS 카탈로그에 존재 but import 없음
        src = "const Page = () => <Chip />;"
        report = validate_code(src, self._catalog())
        assert report.passed is False
        categories = [e.category for e in report.errors]
        assert "missing_import" in categories
        assert "unknown_component" not in categories  # 상호 배타

    def test_external_url(self):
        from app.services.code_validator import validate_code

        src = '<img src="https://foo.com/a.jpg" />'
        report = validate_code(src, self._catalog())
        assert report.passed is False
        assert any(e.category == "external_url" for e in report.errors)

    def test_local_component_not_flagged(self):
        from app.services.code_validator import validate_code

        src = (
            "const MyBlock = () => <div/>;\n"
            "const Page = () => <MyBlock />;\n"
        )
        report = validate_code(src, self._catalog())
        assert report.passed is True

    def test_alias_import_not_flagged(self):
        from app.services.code_validator import validate_code

        src = (
            'import { Button as Btn } from "@/components";\n'
            "const Page = () => <Btn />;\n"
        )
        report = validate_code(src, self._catalog())
        assert report.passed is True

    def test_fragment_not_flagged(self):
        from app.services.code_validator import validate_code

        src = (
            'import { Button } from "@/components";\n'
            "const Page = () => <><Button /></>;\n"
        )
        report = validate_code(src, self._catalog())
        assert report.passed is True

    def test_elapsed_ms_recorded(self):
        from app.services.code_validator import validate_code

        report = validate_code("<Button />", self._catalog())
        assert report.elapsed_ms >= 0

    def test_duplicate_usage_not_double_reported(self):
        from app.services.code_validator import validate_code

        # 같은 unknown 이름이 같은 줄에 2번 — 1건만 리포트
        src = "<Fake /><Fake />"
        report = validate_code(src, self._catalog())
        fakes = [e for e in report.errors if "Fake" in e.message]
        assert len(fakes) == 1

    def test_internal_error_graceful(self, monkeypatch):
        """validator 내부 예외가 발생해도 ValidationReport를 반환한다."""
        from app.services import code_validator

        def _boom(_source: str) -> list:
            raise RuntimeError("boom")

        monkeypatch.setattr(code_validator, "scan_jsx_components", _boom)
        report = code_validator.validate_code("<Button />", self._catalog())
        assert report.passed is False
        assert any(e.category == "validator_internal_error" for e in report.errors)
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestValidateCode -v
```

Expected: FAIL (`ImportError: cannot import name 'validate_code'`)

- [ ] **Step 3: 최소 구현**

`code_validator.py` 에 추가:

```python
import time

from app.schemas.validation import ValidationError, ValidationReport


def _format_location(line: int, name: str | None = None) -> str:
    if name:
        return f"line {line}, <{name}>"
    return f"line {line}"


def validate_code(source: str, catalog: ComponentCatalog) -> ValidationReport:
    """TSX 소스를 검증한다.

    - `unknown_component`: DS 카탈로그에도 없고 로컬 선언/import에도 없는 PascalCase 사용
    - `missing_import`: DS 카탈로그에는 있으나 import/로컬 선언 없음
    - `external_url`: src/href/url()의 https?:// 리터럴
    - 중복 방지: `(name, line)` 쌍당 1회.
    - 예외 발생 시 `validator_internal_error` 1건을 담은 리포트 반환.
    """
    t0 = time.perf_counter()
    errors: list[ValidationError] = []
    try:
        usages = scan_jsx_components(source)
        imports = scan_imports(source)
        locals_ = scan_local_decls(source)
        known_local = imports | locals_

        seen: set[tuple[str, int]] = set()
        for u in usages:
            if (u.name, u.line) in seen:
                continue
            seen.add((u.name, u.line))

            in_local = u.name in known_local
            in_catalog = catalog.is_known(u.name)
            if not in_local and not in_catalog:
                errors.append(
                    ValidationError(
                        category="unknown_component",
                        location=_format_location(u.line, u.name),
                        message=f"{u.name} is not in DS catalog and not declared locally",
                    )
                )
            elif not in_local and in_catalog:
                errors.append(
                    ValidationError(
                        category="missing_import",
                        location=_format_location(u.line, u.name),
                        message=f"{u.name} used but not imported",
                        suggested_fix=f'add `import {{ {u.name} }} from "@/components"`',
                    )
                )

        for hit in scan_external_urls(source):
            errors.append(
                ValidationError(
                    category="external_url",
                    location=_format_location(hit.line),
                    message=f"external URL hardcoded: {hit.snippet}",
                    suggested_fix="외부 URL 대신 placeholder box 또는 실제 자산 경로 사용",
                )
            )
    except Exception as exc:  # noqa: BLE001 — validator 자체 장애는 삼킴
        errors = [
            ValidationError(
                category="validator_internal_error",
                location="-",
                message=f"validator crashed: {type(exc).__name__}: {exc}",
            )
        ]

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    return ValidationReport(
        passed=not errors,
        errors=errors,
        warnings=[],
        elapsed_ms=elapsed_ms,
    )
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py -v
```

Expected: 지금까지 작성한 모든 케이스 PASS (약 40+개 passed)

- [ ] **Step 5: 타입 검사**

```
uv run mypy app/services/code_validator.py app/schemas/validation.py
```

Expected: 0 errors

- [ ] **Step 6: 커밋**

```
git add apps/ai-service/app/services/code_validator.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: validate_code - 3종 카테고리 통합 검증 진입점"
```

---

### Task 10: chat.py non-streaming 훅 추가

**Files:**
- Modify: `apps/ai-service/app/api/chat.py:660-687`
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: 통합 테스트 작성 (훅이 동작하는지 스모크)**

```python
class TestChatNonStreamingIntegration:
    """chat.py의 validator 훅이 feature flag에 따라 동작/비동작하는지.

    실제 /chat 엔드포인트 호출은 AI/DB 의존성이 커서 여기서는
    chat.py 내부의 훅 함수(`_maybe_validate_parsed`)를 직접 임포트해
    단위 수준에서 검사한다.
    """

    def test_validation_field_none_when_flag_off(self, monkeypatch):
        """ENABLE_VALIDATION=False (기본)일 때 validation 필드는 None."""
        from app.api.chat import _maybe_validate_parsed  # 신규 helper
        from app.schemas.chat import FileContent, ParsedResponse

        parsed = ParsedResponse(
            conversation="",
            files=[FileContent(path="x.tsx", content="<Chip />")],
            raw="",
        )
        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": False})(),
        )
        _maybe_validate_parsed(parsed)
        assert parsed.validation is None

    def test_validation_field_set_when_flag_on(self, monkeypatch):
        from app.api.chat import _maybe_validate_parsed
        from app.schemas.chat import FileContent, ParsedResponse

        parsed = ParsedResponse(
            conversation="",
            files=[FileContent(path="x.tsx", content="<Chip />")],  # missing_import
            raw="",
        )
        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True})(),
        )
        _maybe_validate_parsed(parsed)
        assert parsed.validation is not None
        categories = [e.category for e in parsed.validation.errors]
        assert "missing_import" in categories

    def test_validation_merges_multiple_files(self, monkeypatch):
        """복수 파일의 errors 는 하나의 ValidationReport 로 합쳐진다."""
        from app.api.chat import _maybe_validate_parsed
        from app.schemas.chat import FileContent, ParsedResponse

        parsed = ParsedResponse(
            conversation="",
            files=[
                FileContent(
                    path="a.tsx",
                    content='import { Button } from "@/components";\nconst A = () => <Button/>;\n',
                ),  # clean
                FileContent(
                    path="b.tsx",
                    content="<Chip />",  # missing_import
                ),
            ],
            raw="",
        )
        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True})(),
        )
        _maybe_validate_parsed(parsed)
        assert parsed.validation is not None
        categories = [e.category for e in parsed.validation.errors]
        assert categories == ["missing_import"]  # 합쳐진 결과에 1건만
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestChatNonStreamingIntegration -v
```

Expected: FAIL (`ImportError: cannot import name '_maybe_validate_parsed'`)

- [ ] **Step 3: 최소 구현**

`apps/ai-service/app/api/chat.py` — `run_figma_tool_calling_loop` import 부근에 추가:

```python
from app.services.code_validator import ComponentCatalog, validate_code
from app.schemas.validation import ValidationReport
```

파일 모듈 레벨(라우터 정의 위)에 싱글턴 + helper 추가:

```python
# Validator 싱글턴 (모듈 import 시 1회 로드)
_CODE_CATALOG = ComponentCatalog.load_default()


def _maybe_validate_parsed(parsed: ParsedResponse) -> None:
    """ENABLE_VALIDATION이 켜져 있으면 parsed.files를 검증해 parsed.validation에 기록한다.

    여러 파일이 있어도 모두 검증하며, errors/elapsed_ms는 합산한다.
    """
    settings = get_settings()
    if not settings.enable_validation or not parsed.files:
        return

    merged_errors: list = []
    merged_warnings: list = []
    elapsed_total = 0
    for f in parsed.files:
        report = validate_code(f.content, _CODE_CATALOG)
        merged_errors.extend(report.errors)
        merged_warnings.extend(report.warnings)
        elapsed_total += report.elapsed_ms

    parsed.validation = ValidationReport(
        passed=not merged_errors,
        errors=merged_errors,
        warnings=merged_warnings,
        elapsed_ms=elapsed_total,
    )
```

non-streaming 핸들러 내에 훅을 삽입한다. 현재 `app/api/chat.py` 내에서 `parsed = parse_ai_response(` 패턴은 **단 1곳(line 673)**이다. 해당 라인 바로 뒤에 `_maybe_validate_parsed(parsed)` 를 추가한다.

먼저 grep으로 유일성 확인:

```
uv run python -c "import re, pathlib; p=pathlib.Path('app/api/chat.py'); hits=[i for i,l in enumerate(p.read_text().splitlines(),1) if 'parse_ai_response(' in l and 'parsed =' in l]; print(hits)"
```

Expected output: 단일 라인 번호 (예: `[673]`).

그 다음 `Edit` 도구로 `old_string`을 다음과 같이 설정해 정확히 1곳만 매치되도록 한다:

```python
        parsed = parse_ai_response(response_message.content)
```

`new_string`:

```python
        parsed = parse_ai_response(response_message.content)
        _maybe_validate_parsed(parsed)
```

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestChatNonStreamingIntegration -v
```

Expected: PASS (3 passed)

- [ ] **Step 5: 기존 chat 테스트 회귀 없음 확인**

```
uv run pytest tests/test_chat.py -q
```

Expected: 기존과 동일 (모두 통과 또는 pre-existing 실패는 그대로)

- [ ] **Step 6: 커밋**

```
git add apps/ai-service/app/api/chat.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: chat.py non-streaming에 validator 훅 추가 (feature flag)"
```

---

### Task 11: chat.py streaming(`/stream`) 훅 추가

**Files:**
- Modify: `apps/ai-service/app/api/chat.py:~1026-1035` (`collected_files` 처리 → `done` broadcast)
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
class TestChatStreamingIntegration:
    def test_build_done_payload_flag_off(self, monkeypatch):
        from app.api.chat import _build_done_validation_payload

        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": False})(),
        )
        payload = _build_done_validation_payload(
            collected_files=[{"path": "x.tsx", "content": "<Chip />"}]
        )
        assert payload == {}  # 플래그 off면 빈 dict

    def test_build_done_payload_flag_on(self, monkeypatch):
        from app.api.chat import _build_done_validation_payload

        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True})(),
        )
        payload = _build_done_validation_payload(
            collected_files=[{"path": "x.tsx", "content": "<Chip />"}]
        )
        assert "validation" in payload
        vdict = payload["validation"]
        assert vdict["passed"] is False
        categories = [e["category"] for e in vdict["errors"]]
        assert "missing_import" in categories

    def test_build_done_payload_no_files(self, monkeypatch):
        from app.api.chat import _build_done_validation_payload

        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True})(),
        )
        payload = _build_done_validation_payload(collected_files=[])
        assert payload == {}
```

- [ ] **Step 2: 테스트 실패 확인**

```
uv run pytest tests/test_code_validator.py::TestChatStreamingIntegration -v
```

Expected: FAIL (`ImportError: cannot import name '_build_done_validation_payload'`)

- [ ] **Step 3: 최소 구현**

`apps/ai-service/app/api/chat.py` 에 `_maybe_validate_parsed` 바로 아래 추가:

```python
def _build_done_validation_payload(collected_files: list[dict]) -> dict:
    """스트리밍 `done` 이벤트에 첨부할 검증 리포트 딕셔너리를 만든다.

    ENABLE_VALIDATION=false 이거나 생성 파일이 없으면 빈 dict를 반환해
    기존 페이로드 형식을 유지한다.
    """
    settings = get_settings()
    if not settings.enable_validation or not collected_files:
        return {}

    merged_errors: list = []
    merged_warnings: list = []
    elapsed_total = 0
    for f in collected_files:
        content = f.get("content", "")
        if not content:
            continue
        report = validate_code(content, _CODE_CATALOG)
        merged_errors.extend(report.errors)
        merged_warnings.extend(report.warnings)
        elapsed_total += report.elapsed_ms

    report_obj = ValidationReport(
        passed=not merged_errors,
        errors=merged_errors,
        warnings=merged_warnings,
        elapsed_ms=elapsed_total,
    )
    return {"validation": report_obj.model_dump()}
```

`collected_files` 는 이미 `chat.py` 스트리밍 경로에서 `list[dict]` 로 수집되며, 각 아이템은 `{"path": str, "content": str}` 형태다 (line 1012~1013 참고). 따라서 `_build_done_validation_payload` 의 `f.get("content", "")` 전제는 유효하다.

기존 `await broadcast_event(room_id, "done", {"message_id": message_id})` 라인(파일 내 단 1곳)을 다음으로 교체:

```python
        done_payload = {"message_id": message_id}
        done_payload.update(_build_done_validation_payload(collected_files))
        await broadcast_event(room_id, "done", done_payload)
```

> **SSE wire 호환성**: 플래그 off(기본) 시 `_build_done_validation_payload` 는 빈 dict 를 반환해 기존 `{"message_id": ...}` 만 전송된다. 플래그 on 시에만 `validation` 키가 추가되므로, 기존 프론트엔드가 `message_id` 키만 사용한다면 호환성 유지된다.

- [ ] **Step 4: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestChatStreamingIntegration -v
```

Expected: PASS (3 passed)

- [ ] **Step 5: 전체 validator 스위트 재확인**

```
uv run pytest tests/test_code_validator.py -v
```

Expected: 전 케이스 PASS

- [ ] **Step 6: 커밋**

```
git add apps/ai-service/app/api/chat.py apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: chat.py /stream done 이벤트에 validation 페이로드 첨부"
```

---

## Chunk 4: 회귀 픽스처 + 레이턴시 벤치마크

### Task 12: 회귀 픽스처 커밋

**Files:**
- Create: `apps/ai-service/tests/fixtures/validator/README.md`
- Create: `apps/ai-service/tests/fixtures/validator/clean_page.tsx`
- Create: `apps/ai-service/tests/fixtures/validator/missing_imports.tsx`
- Create: `apps/ai-service/tests/fixtures/validator/external_url.tsx`
- Create: `apps/ai-service/tests/fixtures/validator/expected/clean_page.json`
- Create: `apps/ai-service/tests/fixtures/validator/expected/missing_imports.json`
- Create: `apps/ai-service/tests/fixtures/validator/expected/external_url.json`
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: README + 3개 픽스처 + 기대 리포트 파일 생성**

`apps/ai-service/tests/fixtures/validator/README.md`:

```markdown
# Validator Regression Fixtures

code_validator 회귀 기준 세트.
- `*.tsx`: 입력 소스 (실제 생성 코드 축약본)
- `expected/*.json`: `{"passed": bool, "categories": [str, ...]}` — 상세 메시지는 검사 대상 아님

출처: `apps/ai-service/test-batch-output/`에서 대표 케이스를 축약·커밋.
```

`clean_page.tsx` (실제 AI 출력 스타일 — 레이아웃 컴포넌트도 명시적 import):

```tsx
import { Button, Field, GridLayout, TitleSection } from "@/components";

export default function Page() {
  return (
    <GridLayout type="A">
      <div>
        <TitleSection title="제목" />
        <Field label="이메일" />
        <Button variant="primary">로그인</Button>
      </div>
    </GridLayout>
  );
}
```

`missing_imports.tsx`:

```tsx
import { Button } from "@/components";

export default function Page() {
  return (
    <GridLayout type="A">
      <Chip>파일.pdf</Chip>
      <Button>저장</Button>
    </GridLayout>
  );
}
```

`external_url.tsx`:

```tsx
import { Button } from "@/components";

export default function Page() {
  return (
    <div>
      <img src="https://example.com/banner.png" alt="banner" />
      <Button>확인</Button>
    </div>
  );
}
```

`expected/clean_page.json`:

```json
{"passed": true, "categories": []}
```

`expected/missing_imports.json`:

```json
{"passed": false, "categories": ["missing_import"]}
```

`expected/external_url.json`:

```json
{"passed": false, "categories": ["external_url"]}
```

- [ ] **Step 2: 회귀 테스트 추가 (기대 리포트 대조)**

`tests/test_code_validator.py` 에 추가:

```python
class TestRegressionFixtures:
    FIXTURES_DIR = Path(__file__).parent / "fixtures" / "validator"

    @pytest.mark.parametrize(
        "stem",
        ["clean_page", "missing_imports", "external_url"],
    )
    def test_fixture(self, stem: str):
        from app.services.code_validator import ComponentCatalog, validate_code

        src_path = self.FIXTURES_DIR / f"{stem}.tsx"
        expected_path = self.FIXTURES_DIR / "expected" / f"{stem}.json"

        source = src_path.read_text(encoding="utf-8")
        expected = json.loads(expected_path.read_text(encoding="utf-8"))

        report = validate_code(source, ComponentCatalog.load_default())
        categories = sorted({e.category for e in report.errors})
        assert report.passed == expected["passed"]
        assert categories == expected["categories"]
```

파일 상단 import에 `import json` 확인 (이미 있으면 skip).

- [ ] **Step 3: 테스트 통과 확인**

```
uv run pytest tests/test_code_validator.py::TestRegressionFixtures -v
```

Expected: PASS (3 parametrized cases passed)

- [ ] **Step 4: 커밋**

```
git add apps/ai-service/tests/fixtures/validator/ apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: validator 회귀 픽스처 3건 커밋 (clean / missing_import / external_url)"
```

---

### Task 13: 레이턴시 벤치마크

**Files:**
- Modify: `apps/ai-service/tests/test_code_validator.py`

- [ ] **Step 1: 벤치마크 테스트 추가**

```python
class TestLatency:
    def test_p50_under_50ms_for_1kb_input(self):
        """1KB TSX 입력 50회 실행 중 median <50ms.

        목표는 p50 <20ms 이지만 CI 머신 편차를 고려해 assertion은 <50ms 로 완화.
        실제 로컬 기대치는 5~15ms. 지속적으로 20ms를 초과하면 성능 회귀로 간주.
        """
        import statistics
        from app.services.code_validator import ComponentCatalog, validate_code

        catalog = ComponentCatalog.load_default()
        # 약 1KB TSX 조립 (문자 수 기준)
        line = 'import { Button, Field, Chip } from "@/components";\n'
        body = '<GridLayout type="A"><Field label="x"/><Button>ok</Button></GridLayout>\n'
        source = line + (body * 20)  # 대략 1KB+
        assert len(source) >= 800  # 샘플 크기 sanity

        times: list[float] = []
        for _ in range(50):
            t0 = time.perf_counter()
            validate_code(source, catalog)
            times.append((time.perf_counter() - t0) * 1000)

        median = statistics.median(times)
        # CI 여유 마진 포함 <50ms. 로컬 기대치 <20ms.
        assert median < 50.0, f"median={median:.2f}ms (target <50ms, goal <20ms)"
```

파일 상단에 `import time` 추가 (이미 있으면 skip).

- [ ] **Step 2: 테스트 실행**

```
uv run pytest tests/test_code_validator.py::TestLatency -v
```

Expected: PASS (1 passed — 실제 median 수 ms 수준)

- [ ] **Step 3: 전체 스위트 마지막 확인**

```
uv run pytest tests/test_code_validator.py -v
uv run mypy app/services/code_validator.py app/schemas/validation.py
uv run ruff check app/services/code_validator.py app/schemas/validation.py
```

Expected: 전 테스트 PASS, mypy 0 errors, ruff 0 issues.

- [ ] **Step 4: 커밋**

```
git add apps/ai-service/tests/test_code_validator.py
git commit -m "Feat: validator 1KB 입력 p50 <50ms 벤치마크"
```

---

## 최종 수용 기준 체크

- [ ] `code_validator.py` + `schemas/validation.py` 추가됨
- [ ] `TestValidationSchemas` 4건, `TestParsedResponseValidation` 2건, `TestConfigValidationFlags` 1건, `TestComponentCatalog` 5건, `TestScanJsxComponents` 10건, `TestScanImports` 7건, `TestScanLocalDecls` 5건, `TestScanExternalUrls` 6건, `TestValidateCode` 10건, `TestChatNonStreamingIntegration` 3건, `TestChatStreamingIntegration` 3건, `TestRegressionFixtures` 3건, `TestLatency` 1건 — **총 60건 이상** 통과 (spec DoD "13건 이상"을 충분히 상회)
- [ ] 회귀 픽스처 3건(`tests/fixtures/validator/*.tsx`)이 git에 커밋되어 있음
- [ ] `chat.py` 2개 엔드포인트(non-streaming + streaming)에 feature flag 훅 추가됨
- [ ] `ENABLE_VALIDATION=true` 로컬 실행 시 `missing_imports.tsx` 같은 케이스에 known issue 검출 (Task 12 회귀 테스트로 보장)
- [ ] `ENABLE_VALIDATION=false` (기본)에서 `parsed.validation is None`, streaming `done` payload에 `validation` 키 없음 (Task 10/11 테스트로 보장)
- [ ] 레이턴시: 1KB 입력 p50 <20ms (Task 13)
