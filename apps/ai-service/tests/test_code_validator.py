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

        src = 'import {\n  Button,\n  Field,\n  Chip,\n} from "@/components";\n'
        assert scan_imports(src) == {"Button", "Field", "Chip"}


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

    def test_line_comment_ignored(self):
        from app.services.code_validator import scan_external_urls

        src = '// <img src="https://x.com" />'
        assert scan_external_urls(src) == []

    def test_block_comment_ignored(self):
        from app.services.code_validator import scan_external_urls

        src = '/* <img src="https://x.com" /> */'
        assert scan_external_urls(src) == []

    def test_word_boundary_data_src(self):
        from app.services.code_validator import scan_external_urls

        # data-src should NOT match src
        src = '<img data-src="https://x.com" />'
        assert scan_external_urls(src) == []


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
