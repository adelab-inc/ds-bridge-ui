"""정적 TSX 코드 검증 (Stage 4).

Sub-spec: docs/superpowers/specs/2026-04-16-spec-validator-design.md
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable  # noqa: F401
from dataclasses import dataclass
from pathlib import Path

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
    def load_default(cls, schema_path: Path | None = None) -> ComponentCatalog:
        """`component-schema.json`에서 컴포넌트 이름을 로드한다."""
        path = schema_path or _DEFAULT_SCHEMA_PATH
        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            components = set((data.get("components") or {}).keys())
        except (OSError, json.JSONDecodeError):
            components = set()
        return cls(schema_components=components)


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
