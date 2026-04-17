"""repair_loop 모듈 단위 테스트."""

from __future__ import annotations

import pytest

from app.schemas.chat import FileContent
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
