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
