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
