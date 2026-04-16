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

    without_block = _BLOCK_COMMENT_RE.sub(_blank, source)
    without_line = _LINE_COMMENT_RE.sub(_blank, without_block)
    without_strings = _STRING_RE.sub(_blank, without_line)
    return without_strings


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
