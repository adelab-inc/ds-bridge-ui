"""code_validator 모듈 및 validation 스키마 단위 테스트."""

from __future__ import annotations

from app.schemas.chat import FileContent, ParsedResponse
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
