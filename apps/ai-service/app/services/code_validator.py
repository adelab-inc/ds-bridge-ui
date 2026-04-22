"""정적 TSX 코드 검증 (Stage 4).

Sub-spec: docs/superpowers/specs/2026-04-16-spec-validator-design.md
"""

from __future__ import annotations

import json
import re
import time
from collections.abc import Iterable  # noqa: F401
from dataclasses import dataclass
from pathlib import Path

from app.schemas.validation import ValidationError, ValidationReport

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

# 기본 스키마 위치 (우선순위 순서대로 탐색)
_AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_SCHEMA_CANDIDATES: tuple[Path, ...] = (
    _AI_SERVICE_ROOT / "component-schema.json",
)
# 로컬 개발 환경에서만 존재하는 storybook 경로 (Docker에서는 parents 부족으로 IndexError)
try:
    _STORYBOOK_SCHEMA = _AI_SERVICE_ROOT.parents[1] / "storybook-standalone" / "dist" / "component-schema.json"
    _DEFAULT_SCHEMA_CANDIDATES = _DEFAULT_SCHEMA_CANDIDATES + (_STORYBOOK_SCHEMA,)
except IndexError:
    pass


class ComponentCatalog:
    """허용된 컴포넌트 이름 및 prop enum 화이트리스트."""

    def __init__(
        self,
        schema_components: set[str],
        prop_enums: dict[str, dict[str, frozenset[str]]] | None = None,
        extra: set[str] | None = None,
    ) -> None:
        self._known: set[str] = set(schema_components)
        self._known.update(LAYOUT_COMPONENTS_V1)
        self._known.update(REACT_BUILTINS)
        if extra:
            self._known.update(extra)
        # {component_name: {prop_name: {valid literal values}}}
        self._prop_enums: dict[str, dict[str, frozenset[str]]] = prop_enums or {}

    def is_known(self, name: str) -> bool:
        return name in self._known

    def add(self, name: str) -> None:
        self._known.add(name)

    def get_names(self) -> set[str]:
        """DS 컴포넌트 이름 반환 (REACT_BUILTINS 제외)."""
        return self._known - REACT_BUILTINS

    def get_prop_enum(self, component: str, prop: str) -> frozenset[str] | None:
        """컴포넌트의 prop에 허용된 리터럴 enum 값 반환. 없으면 None."""
        return self._prop_enums.get(component, {}).get(prop)

    @classmethod
    def load_default(cls, schema_path: Path | None = None) -> ComponentCatalog:
        """`component-schema.json`에서 컴포넌트 이름 + prop enum을 로드한다.

        `schema_path`가 지정되지 않으면 `_DEFAULT_SCHEMA_CANDIDATES`를 순서대로 탐색.
        """
        candidates: tuple[Path, ...]
        if schema_path is not None:
            candidates = (schema_path,)
        else:
            candidates = _DEFAULT_SCHEMA_CANDIDATES

        data: dict[str, object] | None = None
        for path in candidates:
            try:
                with path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                break
            except (OSError, json.JSONDecodeError):
                continue

        if data is None:
            return cls(schema_components=set(), prop_enums={})

        raw_components = data.get("components") or {}
        components_dict: dict[str, object] = (
            raw_components if isinstance(raw_components, dict) else {}
        )
        components = set(components_dict.keys())
        prop_enums: dict[str, dict[str, frozenset[str]]] = {}
        for comp_name, comp_def in components_dict.items():
            if not isinstance(comp_def, dict):
                continue
            props = comp_def.get("props") or {}
            if not isinstance(props, dict):
                continue
            comp_enums: dict[str, frozenset[str]] = {}
            for prop_name, prop_def in props.items():
                if not isinstance(prop_def, dict):
                    continue
                ptype = prop_def.get("type")
                # enum 판정: type이 문자열 리스트인 경우만
                if isinstance(ptype, list) and ptype and all(isinstance(v, str) for v in ptype):
                    comp_enums[prop_name] = frozenset(ptype)
            if comp_enums:
                prop_enums[comp_name] = comp_enums

        return cls(schema_components=components, prop_enums=prop_enums)


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

    # 문자열을 먼저 제거해야 문자열 안의 // 나 /* 가 주석으로 오인되지 않음
    without_strings = _STRING_RE.sub(_blank, source)
    without_block = _BLOCK_COMMENT_RE.sub(_blank, without_strings)
    without_line = _LINE_COMMENT_RE.sub(_blank, without_block)
    return without_line


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


@dataclass(frozen=True)
class JSXPropLiteral:
    component: str
    prop: str
    value: str
    line: int  # 1-based (JSX 여는 태그 시작 라인)


# JSX 여는 태그 전체 (속성 본문 캡처). `<Name ... >` 또는 `<Name ... />`
_JSX_TAG_OPEN_RE = re.compile(
    r"""
    <(?P<name>[A-Z][A-Za-z0-9_]*)     # 컴포넌트 이름
    (?P<attrs>(?:
        [^<>{}'"]                       # 일반 문자
      | \{(?:[^{}]|\{[^{}]*\})*\}       # JSX expression (1-depth 중첩 허용)
      | "(?:\\.|[^"\\])*"               # 큰따옴표 문자열
      | '(?:\\.|[^'\\])*'               # 작은따옴표 문자열
    )*)
    /?>
    """,
    re.VERBOSE | re.DOTALL,
)

# 속성 본문 안의 `key="literal"` (단순 문자열 값만)
_PROP_STRING_ATTR_RE = re.compile(
    r"""
    (?<![A-Za-z0-9_])            # 식별자 경계
    (?P<k>[a-zA-Z_][\w-]*)
    \s*=\s*
    "(?P<v>[^"\\]*(?:\\.[^"\\]*)*)"   # 큰따옴표 문자열 리터럴
    """,
    re.VERBOSE,
)


def scan_jsx_prop_string_literals(source: str) -> list[JSXPropLiteral]:
    """`<Comp prop="literal">` 형태의 **정적 문자열** prop만 수집한다.

    `prop={...}` 동적 표현은 제외. 주석/문자열 안의 JSX는 `scan_jsx_components`와
    동일한 방식으로 사전 마스킹 후 탐색한다.
    """
    cleaned = _strip_comments_and_strings(source)
    # _strip_comments_and_strings는 '문자열 리터럴' 내용을 blank로 날리므로
    # cleaned에는 prop 값 리터럴이 남지 않는다. 원문에서 태그 위치만 쓰고 속성은 원문으로 읽는다.
    results: list[JSXPropLiteral] = []
    for match in _JSX_TAG_OPEN_RE.finditer(source):
        # 이 태그가 주석/문자열 안에 있으면 skip
        if match.start() < len(cleaned) and cleaned[match.start()] == ' ':
            continue
        name = match.group("name")
        attrs = match.group("attrs") or ""
        tag_line = source.count("\n", 0, match.start()) + 1
        for attr in _PROP_STRING_ATTR_RE.finditer(attrs):
            results.append(
                JSXPropLiteral(
                    component=name,
                    prop=attr.group("k"),
                    value=attr.group("v"),
                    line=tag_line,
                )
            )
    return results


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
    names: set[str] = set()
    for match in _IMPORT_LINE_RE.finditer(source):
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


_LOCAL_DECL_RE = re.compile(
    r"\b(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_]*)\b"
)


def scan_local_decls(source: str) -> set[str]:
    """파일 내부 `const/let/var/function/class` PascalCase 선언 식별자."""
    cleaned = _strip_comments_and_strings(source)
    return {m.group(1) for m in _LOCAL_DECL_RE.finditer(cleaned)}


_EXTERNAL_URL_RE = re.compile(
    r"""
    (?<![a-zA-Z0-9_-])(?:src|href)\s*=\s*['"]https?://[^'"]+['"]
    |
    \burl\(\s*['"]?https?://[^)'"]+
    """,
    re.VERBOSE,
)


@dataclass(frozen=True)
class UrlHit:
    line: int
    snippet: str


def scan_external_urls(source: str) -> list[UrlHit]:
    """src/href/url() 내 https?:// 리터럴을 수집한다.

    템플릿 리터럴, 주석, 문자열 리터럴 안의 URL은 제외된다.
    """
    cleaned = _strip_comments_and_strings(source)
    hits: list[UrlHit] = []

    # Raw source에서 패턴을 찾되, cleaned에서 blanked된 위치는 제외
    for match in _EXTERNAL_URL_RE.finditer(source):
        # match.start() 위치가 cleaned에서 blanked 되었는지 확인
        # (주석/문자열 안에 있으면 blanked 됨)
        if match.start() < len(cleaned) and cleaned[match.start()] == ' ':
            # 이 매치는 주석/문자열 안에 있음 → 스킵
            continue

        line = source.count("\n", 0, match.start()) + 1
        raw_line = source.splitlines()[line - 1] if line - 1 < len(source.splitlines()) else ""
        hits.append(UrlHit(line=line, snippet=raw_line.strip()))
    return hits


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
                        suggested_fix=None,
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

        # Prop enum 값 검증: 스키마에 enum이 정의된 prop에 대해 리터럴 값이 목록에 있는지 확인
        seen_props: set[tuple[str, str, str, int]] = set()
        for lit in scan_jsx_prop_string_literals(source):
            enum = catalog.get_prop_enum(lit.component, lit.prop)
            if enum is None:
                continue
            if lit.value in enum:
                continue
            key = (lit.component, lit.prop, lit.value, lit.line)
            if key in seen_props:
                continue
            seen_props.add(key)
            sorted_values = sorted(enum)
            errors.append(
                ValidationError(
                    category="invalid_prop_value",
                    location=f"line {lit.line}, <{lit.component} {lit.prop}=\"{lit.value}\">",
                    message=(
                        f"{lit.component}.{lit.prop}={lit.value!r} is not in schema enum "
                        f"{sorted_values}"
                    ),
                    suggested_fix=f"use one of: {', '.join(sorted_values)}",
                )
            )
    except Exception as exc:  # noqa: BLE001 — validator 자체 장애는 삼킴
        errors = [
            ValidationError(
                category="validator_internal_error",
                location="-",
                message=f"validator crashed: {type(exc).__name__}: {exc}",
                suggested_fix=None,
            )
        ]

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    return ValidationReport(
        passed=not errors,
        errors=errors,
        warnings=[],
        elapsed_ms=elapsed_ms,
    )
