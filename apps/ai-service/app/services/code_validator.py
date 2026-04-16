"""정적 TSX 코드 검증 (Stage 4).

Sub-spec: docs/superpowers/specs/2026-04-16-spec-validator-design.md
"""

from __future__ import annotations

import json
from collections.abc import Iterable  # noqa: F401
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
