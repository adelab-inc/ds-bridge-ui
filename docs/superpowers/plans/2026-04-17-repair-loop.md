# Repair Loop (Stage 5) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검증 실패 시 AI에게 1회 자동 수정을 요청하는 Repair Loop를 구현한다.

**Architecture:** Stage 4 Validator가 `passed=False`를 반환하면, 에러 목록 + 원본 코드 + DS 컴포넌트 목록을 AI에게 보내 수정을 요청한다. 수정된 코드를 재검증하여 `passed=True`면 교체, 아니면 원본을 유지한다. 모든 실패 경로에서 1차 코드가 보존된다.

**Tech Stack:** Python 3.12+, FastAPI, Pydantic v2, pytest, dataclasses

**Spec:** `docs/superpowers/specs/2026-04-16-spec-repair-loop-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/ai-service/app/core/config.py` | Modify | `enable_repair: bool = False` 추가 |
| `apps/ai-service/app/services/code_validator.py` | Modify | `ComponentCatalog.get_names()` 메서드 추가 |
| `apps/ai-service/app/services/repair_loop.py` | **Create** | `RepairResult`, helper 함수들, `repair_code()` |
| `apps/ai-service/app/api/chat.py` | Modify | `_maybe_validate_parsed` → `_maybe_validate_and_repair` 교체 |
| `apps/ai-service/tests/test_repair_loop.py` | **Create** | repair_loop 단위 테스트 |
| `apps/ai-service/tests/test_code_validator.py` | Modify | chat.py 통합 테스트 추가 |

---

## Chunk 1: Foundation

### Task 1: Feature flag `enable_repair`

**Files:**
- Modify: `apps/ai-service/app/core/config.py:54-56`
- Modify: `apps/ai-service/tests/test_code_validator.py` (TestConfigValidationFlags)

- [ ] **Step 1: Write the failing test**

In `apps/ai-service/tests/test_code_validator.py`, inside `TestConfigValidationFlags`:

```python
def test_enable_repair_default_false(self, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "x")
    from app.core.config import Settings

    s = Settings()
    assert s.enable_repair is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ai-service && uv run pytest tests/test_code_validator.py::TestConfigValidationFlags::test_enable_repair_default_false -v`
Expected: FAIL with `AttributeError: 'Settings' object has no attribute 'enable_repair'`

- [ ] **Step 3: Add `enable_repair` to Settings**

In `apps/ai-service/app/core/config.py`, after line 56 (`validation_timeout_ms`):

```python
    # Code Repair (Stage 5)
    enable_repair: bool = False           # Repair 루프 (ENABLE_VALIDATION=True 전제)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/ai-service && uv run pytest tests/test_code_validator.py::TestConfigValidationFlags -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd apps/ai-service && git add app/core/config.py tests/test_code_validator.py
git commit -m "Feat: enable_repair feature flag 추가 (기본 off)"
```

---

### Task 2: `ComponentCatalog.get_names()`

**Files:**
- Modify: `apps/ai-service/app/services/code_validator.py:38-68` (ComponentCatalog class)
- Modify: `apps/ai-service/tests/test_code_validator.py` (TestComponentCatalog)

- [ ] **Step 1: Write the failing test**

In `apps/ai-service/tests/test_code_validator.py`, inside `TestComponentCatalog`:

```python
def test_get_names_excludes_react_builtins(self):
    from app.services.code_validator import ComponentCatalog

    catalog = ComponentCatalog.load_default()
    names = catalog.get_names()
    # DS 컴포넌트는 포함
    assert "Button" in names
    assert "GridLayout" in names
    # React builtins은 제외
    assert "Fragment" not in names
    assert "React" not in names

def test_get_names_returns_set_of_str(self):
    from app.services.code_validator import ComponentCatalog

    catalog = ComponentCatalog(schema_components={"Button", "Chip"}, extra={"CustomWidget"})
    names = catalog.get_names()
    assert isinstance(names, set)
    assert "Button" in names
    assert "Chip" in names
    assert "CustomWidget" in names
    # LAYOUT_COMPONENTS_V1도 포함
    assert "GridLayout" in names
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ai-service && uv run pytest tests/test_code_validator.py::TestComponentCatalog::test_get_names_excludes_react_builtins -v`
Expected: FAIL with `AttributeError: 'ComponentCatalog' object has no attribute 'get_names'`

- [ ] **Step 3: Add `get_names()` method**

In `apps/ai-service/app/services/code_validator.py`, inside `ComponentCatalog` class, after `add()` method:

```python
def get_names(self) -> set[str]:
    """DS 컴포넌트 이름 반환 (REACT_BUILTINS 제외)."""
    return self._known - REACT_BUILTINS
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ai-service && uv run pytest tests/test_code_validator.py::TestComponentCatalog -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd apps/ai-service && git add app/services/code_validator.py tests/test_code_validator.py
git commit -m "Feat: ComponentCatalog.get_names() 추가 (REACT_BUILTINS 제외)"
```

---

### Task 3: `format_errors_for_repair()` 헬퍼

**Files:**
- Create: `apps/ai-service/app/services/repair_loop.py`
- Create: `apps/ai-service/tests/test_repair_loop.py`

- [ ] **Step 1: Write the failing test**

Create `apps/ai-service/tests/test_repair_loop.py`:

```python
"""repair_loop 모듈 단위 테스트."""

from __future__ import annotations

import pytest

from app.schemas.validation import ValidationError, ValidationReport


class TestFormatErrorsForRepair:
    def test_single_file_errors(self):
        from app.services.repair_loop import format_errors_for_repair

        errors = [
            ValidationError(
                category="missing_import",
                location="src/pages/Login.tsx: line 5, <Chip>",
                message="Chip used but not imported",
                suggested_fix='add `import { Chip } from "@/components"`',
            ),
            ValidationError(
                category="external_url",
                location="src/pages/Login.tsx: line 8",
                message='external URL hardcoded: <img src="https://example.com/a.png" />',
                suggested_fix="외부 URL 대신 placeholder box 또는 실제 자산 경로 사용",
            ),
        ]
        result = format_errors_for_repair(errors)
        assert "## src/pages/Login.tsx" in result
        assert "[missing_import]" in result
        assert "[external_url]" in result
        assert "수정 힌트:" in result

    def test_multi_file_errors_grouped(self):
        from app.services.repair_loop import format_errors_for_repair

        errors = [
            ValidationError(
                category="missing_import",
                location="src/pages/Login.tsx: line 5, <Chip>",
                message="Chip used but not imported",
                suggested_fix='add `import { Chip } from "@/components"`',
            ),
            ValidationError(
                category="external_url",
                location="src/pages/Detail.tsx: line 12",
                message="external URL hardcoded: ...",
                suggested_fix="외부 URL 대신 placeholder box 사용",
            ),
        ]
        result = format_errors_for_repair(errors)
        assert "## src/pages/Login.tsx" in result
        assert "## src/pages/Detail.tsx" in result

    def test_empty_errors(self):
        from app.services.repair_loop import format_errors_for_repair

        assert format_errors_for_repair([]) == ""

    def test_error_without_file_path_prefix(self):
        """파일 경로 접두사가 없는 에러도 처리한다 (legacy 호환)."""
        from app.services.repair_loop import format_errors_for_repair

        errors = [
            ValidationError(
                category="missing_import",
                location="line 5, <Chip>",
                message="Chip used but not imported",
                suggested_fix=None,
            ),
        ]
        result = format_errors_for_repair(errors)
        assert "[missing_import]" in result
        assert "line 5" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ai-service && uv run pytest tests/test_repair_loop.py::TestFormatErrorsForRepair::test_single_file_errors -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.repair_loop'`

- [ ] **Step 3: Implement `format_errors_for_repair()`**

Create `apps/ai-service/app/services/repair_loop.py`:

```python
"""Repair Loop (Stage 5) — 검증 실패 코드 AI 자동 수정.

Sub-spec: docs/superpowers/specs/2026-04-16-spec-repair-loop-design.md
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass

from app.schemas.chat import FileContent
from app.schemas.validation import ValidationError, ValidationReport

logger = logging.getLogger(__name__)


def format_errors_for_repair(errors: list[ValidationError]) -> str:
    """ValidationError 목록을 파일별로 그룹핑하여 사람이 읽기 좋은 문자열로 변환."""
    if not errors:
        return ""

    # location에서 파일 경로 추출: "src/pages/Login.tsx: line 5, <Chip>" → "src/pages/Login.tsx"
    groups: dict[str, list[ValidationError]] = defaultdict(list)
    for err in errors:
        # "파일경로: line N" 형식이면 파일 경로 분리, 아니면 "(unknown)" 그룹
        if ": " in err.location and ("line " in err.location):
            colon_idx = err.location.index(": ")
            file_path = err.location[:colon_idx]
            groups[file_path].append(err)
        else:
            groups["(unknown)"].append(err)

    lines: list[str] = []
    for file_path, errs in groups.items():
        if file_path != "(unknown)":
            lines.append(f"## {file_path}")
        for i, err in enumerate(errs, 1):
            loc = err.location
            # 파일 경로 접두사 제거하여 간결하게
            if file_path != "(unknown)" and loc.startswith(f"{file_path}: "):
                loc = loc[len(f"{file_path}: "):]
            line = f"{i}. [{err.category}] {loc} — {err.message}"
            lines.append(line)
            if err.suggested_fix:
                lines.append(f"   → 수정 힌트: {err.suggested_fix}")
        lines.append("")  # 그룹 간 빈 줄

    return "\n".join(lines).strip()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ai-service && uv run pytest tests/test_repair_loop.py::TestFormatErrorsForRepair -v`
Expected: ALL PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd apps/ai-service && git add app/services/repair_loop.py tests/test_repair_loop.py
git commit -m "Feat: format_errors_for_repair() 헬퍼 함수 추가"
```

---

### Task 4: `build_file_blocks()` + `build_repair_messages()` 헬퍼

**Files:**
- Modify: `apps/ai-service/app/services/repair_loop.py`
- Modify: `apps/ai-service/tests/test_repair_loop.py`

- [ ] **Step 1: Write the failing tests**

In `apps/ai-service/tests/test_repair_loop.py`:

```python
from app.schemas.chat import FileContent


class TestBuildFileBlocks:
    def test_single_file(self):
        from app.services.repair_loop import build_file_blocks

        files = [FileContent(path="src/pages/Login.tsx", content="const x = 1;")]
        result = build_file_blocks(files)
        assert '<file path="src/pages/Login.tsx">' in result
        assert "const x = 1;" in result
        assert "</file>" in result

    def test_multi_file(self):
        from app.services.repair_loop import build_file_blocks

        files = [
            FileContent(path="a.tsx", content="aaa"),
            FileContent(path="b.tsx", content="bbb"),
        ]
        result = build_file_blocks(files)
        assert '<file path="a.tsx">' in result
        assert '<file path="b.tsx">' in result
        assert "aaa" in result
        assert "bbb" in result

    def test_empty_files(self):
        from app.services.repair_loop import build_file_blocks

        assert build_file_blocks([]) == ""


class TestBuildRepairMessages:
    def test_message_structure(self):
        from app.services.repair_loop import build_repair_messages

        files = [FileContent(path="x.tsx", content="<Chip />")]
        errors = [
            ValidationError(
                category="missing_import",
                location="x.tsx: line 1, <Chip>",
                message="Chip used but not imported",
                suggested_fix='add `import { Chip } from "@/components"`',
            ),
        ]
        component_names = {"Button", "Chip", "Field"}
        messages = build_repair_messages(files, errors, component_names)

        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        # system에 컴포넌트 목록 포함
        assert "Button" in messages[0]["content"]
        assert "Chip" in messages[0]["content"]
        # system에 모든 파일 반환 지시 포함
        assert "모든 파일" in messages[0]["content"]
        # user에 파일 블록 + 에러 포함
        assert '<file path="x.tsx">' in messages[1]["content"]
        assert "[missing_import]" in messages[1]["content"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ai-service && uv run pytest tests/test_repair_loop.py::TestBuildFileBlocks::test_single_file -v`
Expected: FAIL with `ImportError: cannot import name 'build_file_blocks'`

- [ ] **Step 3: Implement both helpers**

In `apps/ai-service/app/services/repair_loop.py`, add:

```python
def build_file_blocks(files: list[FileContent]) -> str:
    """FileContent 목록을 <file path="...">content</file> 형태로 합친다."""
    if not files:
        return ""
    blocks: list[str] = []
    for f in files:
        blocks.append(f'<file path="{f.path}">\n{f.content}\n</file>')
    return "\n\n".join(blocks)


_REPAIR_SYSTEM_TEMPLATE = """\
당신은 코드 수정 전문가입니다. 아래 TSX 코드에서 발견된 오류를 수정하세요.
수정 시 기존 구조와 로직은 최대한 유지하고, 오류만 정확히 고치세요.
수정 여부와 관계없이 모든 파일을 <file path="...">...</file> 형식으로 반환하세요.
오류가 없는 파일도 원본 그대로 포함해야 합니다.

## 사용 가능한 DS 컴포넌트
{component_names}
위 컴포넌트는 `import {{ ComponentName }} from "@/components"` 로 사용합니다."""


def build_repair_messages(
    files: list[FileContent],
    errors: list[ValidationError],
    component_names: set[str],
) -> list[dict[str, str]]:
    """Repair AI 호출용 system/user 메시지를 조립한다."""
    system_content = _REPAIR_SYSTEM_TEMPLATE.format(
        component_names=", ".join(sorted(component_names)),
    )
    file_blocks = build_file_blocks(files)
    formatted_errors = format_errors_for_repair(errors)
    user_content = f"## 원본 코드\n{file_blocks}\n\n## 검출된 오류\n{formatted_errors}"

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ai-service && uv run pytest tests/test_repair_loop.py::TestBuildFileBlocks tests/test_repair_loop.py::TestBuildRepairMessages -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd apps/ai-service && git add app/services/repair_loop.py tests/test_repair_loop.py
git commit -m "Feat: build_file_blocks() + build_repair_messages() 헬퍼 추가"
```

---

### Task 5: `RepairResult` 데이터클래스 + `repair_code()` 핵심 로직

**Files:**
- Modify: `apps/ai-service/app/services/repair_loop.py`
- Modify: `apps/ai-service/tests/test_repair_loop.py`

이 태스크는 `repair_code()` 전체를 구현하며, 4가지 시나리오를 테스트한다.

- [ ] **Step 1: Write failing tests for repair_code()**

In `apps/ai-service/tests/test_repair_loop.py`:

```python
from unittest.mock import AsyncMock, MagicMock

from app.services.code_validator import ComponentCatalog


class TestRepairCode:
    """repair_code() 단위 테스트. AI provider를 모의(mock)한다."""

    @pytest.fixture
    def catalog(self):
        return ComponentCatalog.load_default()

    @pytest.fixture
    def broken_files(self):
        """Chip을 import 없이 사용 — missing_import 에러."""
        return [
            FileContent(
                path="src/pages/Login.tsx",
                content='const Login = () => <Chip label="hi" />;',
            ),
        ]

    @pytest.fixture
    def broken_report(self):
        return ValidationReport(
            passed=False,
            errors=[
                ValidationError(
                    category="missing_import",
                    location="src/pages/Login.tsx: line 1, <Chip>",
                    message="Chip used but not imported",
                    suggested_fix='add `import { Chip } from "@/components"`',
                ),
            ],
            elapsed_ms=1,
        )

    @pytest.mark.asyncio
    async def test_repair_success(self, catalog, broken_files, broken_report):
        """AI가 올바른 코드를 반환하면 success=True."""
        from app.schemas.chat import Message
        from app.services.repair_loop import repair_code

        fixed_code = (
            'import { Chip } from "@/components";\n'
            'const Login = () => <Chip label="hi" />;'
        )
        ai_response = f'수정했습니다.\n\n<file path="src/pages/Login.tsx">\n{fixed_code}\n</file>'

        provider = AsyncMock()
        provider.chat.return_value = (
            Message(role="assistant", content=ai_response),
            None,
        )

        result = await repair_code(broken_files, broken_report, provider, catalog)
        assert result.success is True
        assert len(result.files) == 1
        assert "import" in result.files[0].content
        assert result.report.passed is True
        assert result.elapsed_ms >= 0
        provider.chat.assert_called_once()

    @pytest.mark.asyncio
    async def test_repair_still_fails(self, catalog, broken_files, broken_report):
        """AI가 여전히 잘못된 코드를 반환하면 success=False, 원본 코드 보존."""
        from app.schemas.chat import Message
        from app.services.repair_loop import repair_code

        still_broken = '<file path="src/pages/Login.tsx">\nconst Login = () => <Chip />;\n</file>'
        provider = AsyncMock()
        provider.chat.return_value = (
            Message(role="assistant", content=still_broken),
            None,
        )

        result = await repair_code(broken_files, broken_report, provider, catalog)
        assert result.success is False
        assert result.files[0].content == broken_files[0].content  # 원본 보존
        assert result.report is broken_report  # 1차 리포트 유지

    @pytest.mark.asyncio
    async def test_repair_ai_error(self, catalog, broken_files, broken_report):
        """AI 호출이 예외를 던지면 success=False, 원본 코드 보존."""
        from app.services.repair_loop import repair_code

        provider = AsyncMock()
        provider.chat.side_effect = RuntimeError("API timeout")

        result = await repair_code(broken_files, broken_report, provider, catalog)
        assert result.success is False
        assert result.files == broken_files
        assert result.report is broken_report

    @pytest.mark.asyncio
    async def test_repair_parse_error(self, catalog, broken_files, broken_report):
        """AI가 파싱 불가능한 응답을 반환하면 success=False."""
        from app.schemas.chat import Message
        from app.services.repair_loop import repair_code

        provider = AsyncMock()
        provider.chat.return_value = (
            Message(role="assistant", content="그냥 텍스트만 있어요"),
            None,
        )

        result = await repair_code(broken_files, broken_report, provider, catalog)
        assert result.success is False
        assert result.files == broken_files
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ai-service && uv run pytest tests/test_repair_loop.py::TestRepairCode::test_repair_success -v`
Expected: FAIL with `ImportError: cannot import name 'repair_code'`

- [ ] **Step 3: Implement `RepairResult` and `repair_code()`**

In `apps/ai-service/app/services/repair_loop.py`, add:

```python
from app.services.code_validator import ComponentCatalog, validate_code


@dataclass
class RepairResult:
    """repair_code() 반환값. 내부 전용 타입."""

    success: bool
    files: list[FileContent]
    report: ValidationReport
    elapsed_ms: int


async def repair_code(
    files: list[FileContent],
    report: ValidationReport,
    provider: object,
    catalog: ComponentCatalog,
) -> RepairResult:
    """검증 실패 코드를 AI에게 수정 요청. 최대 1회.

    Args:
        files: 1차 생성 파일 목록
        report: 1차 검증 리포트
        provider: AI 프로바이더 (chat 메서드 사용)
        catalog: 컴포넌트 카탈로그

    Returns:
        RepairResult — success=True면 수정 성공
    """
    t0 = time.perf_counter()

    try:
        # 1. 메시지 조립
        component_names = catalog.get_names()
        messages_dicts = build_repair_messages(files, report.errors, component_names)

        # 2. dict → Message 객체 변환
        from app.schemas.chat import Message

        messages = [Message(role=m["role"], content=m["content"]) for m in messages_dicts]

        # 3. AI 호출
        response_message, _usage = await provider.chat(messages)

        # 4. 응답 파싱 (순환 import 방지를 위해 함수 내부에서 지연 임포트)
        from app.api.chat import parse_ai_response

        parsed = parse_ai_response(response_message.content)
        if not parsed.files:
            logger.warning("repair: AI 응답에서 파일을 추출할 수 없음")
            elapsed = int((time.perf_counter() - t0) * 1000)
            return RepairResult(success=False, files=files, report=report, elapsed_ms=elapsed)

        # 5. 누락 파일 backfill
        repaired_paths = {f.path for f in parsed.files}
        for original_file in files:
            if original_file.path not in repaired_paths:
                parsed.files.append(original_file)

        # 6. 재검증 (에러 location에 파일 경로 접두사 추가 — _maybe_validate_and_repair와 동일 형식)
        merged_errors: list[ValidationError] = []
        merged_warnings: list[ValidationError] = []
        v_elapsed = 0
        for f in parsed.files:
            v_report = validate_code(f.content, catalog)
            for err in v_report.errors:
                err.location = f"{f.path}: {err.location}"
            for warn in v_report.warnings:
                warn.location = f"{f.path}: {warn.location}"
            merged_errors.extend(v_report.errors)
            merged_warnings.extend(v_report.warnings)
            v_elapsed += v_report.elapsed_ms

        new_report = ValidationReport(
            passed=not merged_errors,
            errors=merged_errors,
            warnings=merged_warnings,
            elapsed_ms=v_elapsed,
        )

        elapsed = int((time.perf_counter() - t0) * 1000)

        if new_report.passed:
            logger.info(
                "repair result",
                extra={
                    "success": True,
                    "elapsed_ms": elapsed,
                    "errors_before": len(report.errors),
                    "errors_after": 0,
                },
            )
            return RepairResult(
                success=True, files=parsed.files, report=new_report, elapsed_ms=elapsed
            )
        else:
            logger.info(
                "repair result",
                extra={
                    "success": False,
                    "elapsed_ms": elapsed,
                    "errors_before": len(report.errors),
                    "errors_after": len(new_report.errors),
                },
            )
            return RepairResult(
                success=False, files=files, report=report, elapsed_ms=elapsed
            )

    except Exception as exc:  # noqa: BLE001
        elapsed = int((time.perf_counter() - t0) * 1000)
        logger.warning("repair failed: %s: %s", type(exc).__name__, exc)
        return RepairResult(success=False, files=files, report=report, elapsed_ms=elapsed)
```

**순환 import 방지**: `chat.py` → `repair_loop.py` → `chat.py` 순환을 피하기 위해 `parse_ai_response`는 반드시 `repair_code()` 함수 내부에서 지연 임포트한다. 모듈 최상위에 두면 안 됨.

**에러 location 파일 경로 접두사**: `_maybe_validate_and_repair`와 `repair_code()` 모두 검증 결과의 `ValidationError.location`에 파일 경로를 접두사로 추가한다 (예: `"src/pages/Login.tsx: line 5, <Chip>"`). 이는 기존 `_maybe_validate_parsed`에서는 없던 동작이지만, repair 프롬프트의 에러 파일 귀속을 위해 의도적으로 도입한다. `ValidationError`는 Pydantic `BaseModel`이며 `frozen`이 아니므로 필드 재할당이 가능하다.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ai-service && uv run pytest tests/test_repair_loop.py::TestRepairCode -v`
Expected: ALL PASS (4 tests)

순환 import 에러 발생 시 `parse_ai_response` 임포트를 `repair_code()` 함수 내부로 이동.

- [ ] **Step 5: Run full test suite**

Run: `cd apps/ai-service && uv run pytest tests/test_repair_loop.py -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
cd apps/ai-service && git add app/services/repair_loop.py tests/test_repair_loop.py
git commit -m "Feat: RepairResult + repair_code() 핵심 로직 구현"
```

---

### Task 6: 다중 파일 repair 테스트

**Files:**
- Modify: `apps/ai-service/tests/test_repair_loop.py`

- [ ] **Step 1: Write multi-file tests**

In `apps/ai-service/tests/test_repair_loop.py`, inside `TestRepairCode`:

```python
@pytest.mark.asyncio
async def test_repair_multi_file(self, catalog):
    """2개 파일 중 1개만 에러 → 모든 파일이 AI에 전달되고, 결과도 2개 파일."""
    from app.schemas.chat import Message
    from app.services.repair_loop import repair_code

    files = [
        FileContent(
            path="a.tsx",
            content='import { Button } from "@/components";\nconst A = () => <Button />;\n',
        ),
        FileContent(
            path="b.tsx",
            content='const B = () => <Chip label="x" />;',
        ),
    ]
    report = ValidationReport(
        passed=False,
        errors=[
            ValidationError(
                category="missing_import",
                location="b.tsx: line 1, <Chip>",
                message="Chip used but not imported",
                suggested_fix='add `import { Chip } from "@/components"`',
            ),
        ],
        elapsed_ms=1,
    )

    fixed_b = 'import { Chip } from "@/components";\nconst B = () => <Chip label="x" />;'
    ai_response = (
        '<file path="a.tsx">\n'
        'import { Button } from "@/components";\nconst A = () => <Button />;\n'
        '</file>\n\n'
        f'<file path="b.tsx">\n{fixed_b}\n</file>'
    )
    provider = AsyncMock()
    provider.chat.return_value = (
        Message(role="assistant", content=ai_response),
        None,
    )

    result = await repair_code(files, report, provider, catalog)
    assert result.success is True
    assert len(result.files) == 2
    paths = {f.path for f in result.files}
    assert paths == {"a.tsx", "b.tsx"}

@pytest.mark.asyncio
async def test_repair_backfill_missing_files(self, catalog):
    """AI가 일부 파일만 반환 시 원본에서 누락 파일 보충."""
    from app.schemas.chat import Message
    from app.services.repair_loop import repair_code

    files = [
        FileContent(
            path="a.tsx",
            content='import { Button } from "@/components";\nconst A = () => <Button />;\n',
        ),
        FileContent(
            path="b.tsx",
            content='import { Chip } from "@/components";\nconst B = () => <Chip />;\n',
        ),
    ]
    report = ValidationReport(
        passed=False,
        errors=[
            ValidationError(
                category="missing_import",
                location="a.tsx: line 1, <Chip>",
                message="test error",
                suggested_fix=None,
            ),
        ],
        elapsed_ms=1,
    )

    # AI가 a.tsx만 반환 (b.tsx 누락)
    ai_response = (
        '<file path="a.tsx">\n'
        'import { Button } from "@/components";\nconst A = () => <Button />;\n'
        '</file>'
    )
    provider = AsyncMock()
    provider.chat.return_value = (
        Message(role="assistant", content=ai_response),
        None,
    )

    result = await repair_code(files, report, provider, catalog)
    # b.tsx가 backfill 되어 2개 파일
    result_paths = {f.path for f in result.files}
    assert "b.tsx" in result_paths
    assert len(result.files) == 2
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd apps/ai-service && uv run pytest tests/test_repair_loop.py::TestRepairCode::test_repair_multi_file tests/test_repair_loop.py::TestRepairCode::test_repair_backfill_missing_files -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
cd apps/ai-service && git add tests/test_repair_loop.py
git commit -m "Feat: 다중 파일 repair + backfill 테스트 추가"
```

---

## Chunk 2: Chat.py Integration

### Task 7: `_maybe_validate_and_repair()` — chat.py 통합

**Files:**
- Modify: `apps/ai-service/app/api/chat.py:56-79` (`_maybe_validate_parsed` → `_maybe_validate_and_repair`)
- Modify: `apps/ai-service/app/api/chat.py:737` (호출부)

기존 `_maybe_validate_parsed`(동기)를 `_maybe_validate_and_repair`(async)로 교체한다.

- [ ] **Step 1: Write failing integration tests**

In `apps/ai-service/tests/test_code_validator.py`, add new class:

```python
class TestValidateAndRepairIntegration:
    """_maybe_validate_and_repair 통합 테스트."""

    def _make_parsed(self, content: str, path: str = "x.tsx") -> ParsedResponse:
        return ParsedResponse(
            conversation="",
            files=[FileContent(path=path, content=content)],
            raw="",
        )

    @pytest.mark.asyncio
    async def test_repair_flag_off_no_repair(self, monkeypatch):
        """ENABLE_REPAIR=False → repair 안 함, 검증만."""
        from app.api.chat import _maybe_validate_and_repair

        parsed = self._make_parsed("<Chip />")
        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True, "enable_repair": False})(),
        )
        await _maybe_validate_and_repair(parsed, provider=None)
        assert parsed.validation is not None
        assert parsed.validation.passed is False  # Chip missing import
        # provider=None이므로 repair 호출 시 에러 발생해야 하지만, flag off라 호출 안 됨

    @pytest.mark.asyncio
    async def test_repair_flag_on_success(self, monkeypatch):
        """ENABLE_REPAIR=True + AI가 올바른 코드 반환 → 파일 교체."""
        from unittest.mock import AsyncMock

        from app.api.chat import _maybe_validate_and_repair
        from app.schemas.chat import Message

        parsed = self._make_parsed("<Chip />")

        fixed_code = 'import { Chip } from "@/components";\nconst Page = () => <Chip />;'
        ai_response = f'수정했습니다.\n\n<file path="x.tsx">\n{fixed_code}\n</file>'
        provider = AsyncMock()
        provider.chat.return_value = (
            Message(role="assistant", content=ai_response),
            None,
        )

        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True, "enable_repair": True})(),
        )
        await _maybe_validate_and_repair(parsed, provider)
        assert parsed.validation is not None
        assert parsed.validation.passed is True
        assert "import" in parsed.files[0].content  # 파일이 교체됨

    @pytest.mark.asyncio
    async def test_repair_flag_on_failure_preserves_original(self, monkeypatch):
        """ENABLE_REPAIR=True + AI 수정 실패 → 1차 코드 유지."""
        from unittest.mock import AsyncMock

        from app.api.chat import _maybe_validate_and_repair
        from app.schemas.chat import Message

        original_content = "<Chip />"
        parsed = self._make_parsed(original_content)

        # AI가 여전히 잘못된 코드 반환
        ai_response = '<file path="x.tsx">\n<Chip />\n</file>'
        provider = AsyncMock()
        provider.chat.return_value = (
            Message(role="assistant", content=ai_response),
            None,
        )

        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True, "enable_repair": True})(),
        )
        await _maybe_validate_and_repair(parsed, provider)
        assert parsed.validation is not None
        assert parsed.validation.passed is False
        # 원본 코드 유지 (chat.py의 _postprocess_code가 적용될 수 있으므로 원본과 동일 확인은 content 기반)

    @pytest.mark.asyncio
    async def test_validation_off_skips_everything(self, monkeypatch):
        """ENABLE_VALIDATION=False → 검증도 repair도 안 함."""
        from app.api.chat import _maybe_validate_and_repair

        parsed = self._make_parsed("<Chip />")
        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": False, "enable_repair": True})(),
        )
        await _maybe_validate_and_repair(parsed, provider=None)
        assert parsed.validation is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ai-service && uv run pytest tests/test_code_validator.py::TestValidateAndRepairIntegration::test_repair_flag_off_no_repair -v`
Expected: FAIL with `ImportError: cannot import name '_maybe_validate_and_repair'`

- [ ] **Step 3: Replace `_maybe_validate_parsed` with `_maybe_validate_and_repair`**

In `apps/ai-service/app/api/chat.py`:

1. Add import at top (near existing validator imports):
```python
from app.services.repair_loop import repair_code
```

2. Replace the `_maybe_validate_parsed` function (lines 56-79) with:

```python
async def _maybe_validate_and_repair(parsed: ParsedResponse, provider: object) -> None:
    """ENABLE_VALIDATION이 켜져 있으면 parsed.files를 검증하고,
    ENABLE_REPAIR까지 켜져 있으면 AI 수정을 시도한다.

    여러 파일이 있어도 모두 검증하며, errors/elapsed_ms는 합산한다.
    repair 성공 시 parsed.files와 parsed.validation을 교체한다.
    """
    settings = get_settings()
    if not settings.enable_validation or not parsed.files:
        return

    # 1. 검증
    merged_errors: list[ValidationError] = []
    merged_warnings: list[ValidationError] = []
    elapsed_total = 0
    for f in parsed.files:
        report = validate_code(f.content, _CODE_CATALOG)
        # 에러 location에 파일 경로 접두사 추가
        for err in report.errors:
            err.location = f"{f.path}: {err.location}"
        for warn in report.warnings:
            warn.location = f"{f.path}: {warn.location}"
        merged_errors.extend(report.errors)
        merged_warnings.extend(report.warnings)
        elapsed_total += report.elapsed_ms

    merged_report = ValidationReport(
        passed=not merged_errors,
        errors=merged_errors,
        warnings=merged_warnings,
        elapsed_ms=elapsed_total,
    )

    # 2. 검증 통과 또는 repair 비활성 → 리포트만 설정
    if merged_report.passed or not settings.enable_repair:
        parsed.validation = merged_report
        return

    # 3. Repair 시도
    result = await repair_code(parsed.files, merged_report, provider, _CODE_CATALOG)
    if result.success:
        parsed.files = result.files
        parsed.validation = result.report
    else:
        parsed.validation = merged_report
```

3. 호출부 변경 (non-streaming chat endpoint 내부, `_maybe_validate_parsed(parsed)` 호출부):

```python
# Before:
_maybe_validate_parsed(parsed)

# After:
await _maybe_validate_and_repair(parsed, provider)
```

4. 기존 `_maybe_validate_parsed` 함수 삭제 (더 이상 사용되지 않음).

- [ ] **Step 4: Update existing tests that reference `_maybe_validate_parsed`**

`TestChatNonStreamingIntegration` 클래스의 기존 3개 테스트를 `_maybe_validate_and_repair`로 변경:
- `_maybe_validate_parsed(parsed)` → `await _maybe_validate_and_repair(parsed, provider=None)`
- 테스트를 `async def`로 변경, `@pytest.mark.asyncio` 추가
- monkeypatch의 mock settings에 `enable_repair=False` 추가 (기존 동작 유지)

```python
class TestChatNonStreamingIntegration:
    """chat.py의 validator+repair 훅이 feature flag에 따라 동작하는지."""

    @pytest.mark.asyncio
    async def test_validation_field_none_when_flag_off(self, monkeypatch):
        from app.api.chat import _maybe_validate_and_repair

        parsed = ParsedResponse(
            conversation="",
            files=[FileContent(path="x.tsx", content="<Chip />")],
            raw="",
        )
        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": False, "enable_repair": False})(),
        )
        await _maybe_validate_and_repair(parsed, provider=None)
        assert parsed.validation is None

    @pytest.mark.asyncio
    async def test_validation_field_set_when_flag_on(self, monkeypatch):
        from app.api.chat import _maybe_validate_and_repair

        parsed = ParsedResponse(
            conversation="",
            files=[FileContent(path="x.tsx", content="<Chip />")],
            raw="",
        )
        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True, "enable_repair": False})(),
        )
        await _maybe_validate_and_repair(parsed, provider=None)
        assert parsed.validation is not None
        categories = [e.category for e in parsed.validation.errors]
        assert "missing_import" in categories

    @pytest.mark.asyncio
    async def test_validation_merges_multiple_files(self, monkeypatch):
        from app.api.chat import _maybe_validate_and_repair

        parsed = ParsedResponse(
            conversation="",
            files=[
                FileContent(
                    path="a.tsx",
                    content='import { Button } from "@/components";\nconst A = () => <Button/>;\n',
                ),
                FileContent(
                    path="b.tsx",
                    content="<Chip />",
                ),
            ],
            raw="",
        )
        monkeypatch.setattr(
            "app.api.chat.get_settings",
            lambda: type("S", (), {"enable_validation": True, "enable_repair": False})(),
        )
        await _maybe_validate_and_repair(parsed, provider=None)
        assert parsed.validation is not None
        categories = [e.category for e in parsed.validation.errors]
        assert "missing_import" in categories
```

- [ ] **Step 5: Run all tests**

Run: `cd apps/ai-service && uv run pytest tests/test_code_validator.py tests/test_repair_loop.py -v`
Expected: ALL PASS

- [ ] **Step 6: Lint check**

Run: `cd apps/ai-service && uv run ruff check app/api/chat.py app/services/repair_loop.py`
Expected: No errors (fix any if found)

- [ ] **Step 7: Commit**

```bash
cd apps/ai-service && git add app/api/chat.py app/services/repair_loop.py tests/test_code_validator.py tests/test_repair_loop.py
git commit -m "Feat: _maybe_validate_and_repair() — chat.py repair 통합"
```

---

### Task 8: 전체 테스트 + 린트 최종 검증

**Files:** (변경 없음, 검증만)

- [ ] **Step 1: Run full test suite**

Run: `cd apps/ai-service && uv run pytest tests/ -v`
Expected: ALL PASS (기존 63 + 신규 ~15 = ~78 tests)

- [ ] **Step 2: Lint and format**

Run: `cd apps/ai-service && uv run ruff check app/ tests/ && uv run ruff format --check app/ tests/`
Expected: No errors

- [ ] **Step 3: Fix any issues found**

린트/포맷 이슈가 있으면 수정 후 커밋.

- [ ] **Step 4: Final commit (if fixes needed)**

```bash
cd apps/ai-service && git add -u
git commit -m "Fix: repair loop 린트/포맷 수정"
```
