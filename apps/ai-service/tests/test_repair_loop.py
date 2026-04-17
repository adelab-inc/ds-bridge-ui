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
