"""repair_loop 모듈 단위 테스트."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.schemas.chat import FileContent, Message
from app.schemas.validation import ValidationError, ValidationReport
from app.services.code_validator import ComponentCatalog


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
        assert "Button" in messages[0]["content"]
        assert "Chip" in messages[0]["content"]
        assert "모든 파일" in messages[0]["content"]
        assert '<file path="x.tsx">' in messages[1]["content"]
        assert "[missing_import]" in messages[1]["content"]


class TestRepairCode:
    """repair_code() 단위 테스트. AI provider를 모의(mock)한다."""

    @pytest.fixture
    def catalog(self):
        return ComponentCatalog.load_default()

    @pytest.fixture
    def broken_files(self):
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

    async def test_repair_success(self, catalog, broken_files, broken_report):
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

    async def test_repair_still_fails(self, catalog, broken_files, broken_report):
        from app.services.repair_loop import repair_code

        still_broken = '<file path="src/pages/Login.tsx">\nconst Login = () => <Chip />;\n</file>'
        provider = AsyncMock()
        provider.chat.return_value = (
            Message(role="assistant", content=still_broken),
            None,
        )

        result = await repair_code(broken_files, broken_report, provider, catalog)
        assert result.success is False
        assert result.files[0].content == broken_files[0].content
        assert result.report is broken_report

    async def test_repair_ai_error(self, catalog, broken_files, broken_report):
        from app.services.repair_loop import repair_code

        provider = AsyncMock()
        provider.chat.side_effect = RuntimeError("API timeout")

        result = await repair_code(broken_files, broken_report, provider, catalog)
        assert result.success is False
        assert result.files == broken_files
        assert result.report is broken_report

    async def test_repair_parse_error(self, catalog, broken_files, broken_report):
        from app.services.repair_loop import repair_code

        provider = AsyncMock()
        provider.chat.return_value = (
            Message(role="assistant", content="그냥 텍스트만 있어요"),
            None,
        )

        result = await repair_code(broken_files, broken_report, provider, catalog)
        assert result.success is False
        assert result.files == broken_files

    async def test_repair_multi_file(self, catalog):
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

    async def test_repair_backfill_missing_files(self, catalog):
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
        result_paths = {f.path for f in result.files}
        assert "b.tsx" in result_paths
        assert len(result.files) == 2
