"""Repair Loop (Stage 5) — 검증 실패 코드 AI 자동 수정.

Sub-spec: docs/superpowers/specs/2026-04-16-spec-repair-loop-design.md
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass

from app.schemas.chat import FileContent
from app.schemas.validation import ValidationError, ValidationReport

logger = logging.getLogger(__name__)


def format_errors_for_repair(errors: list[ValidationError]) -> str:
    """ValidationError 목록을 파일별로 그룹핑하여 사람이 읽기 좋은 문자열로 변환."""
    if not errors:
        return ""

    groups: dict[str, list[ValidationError]] = defaultdict(list)
    for err in errors:
        if ": " in err.location and ("line " in err.location):
            colon_idx = err.location.index(": ")
            file_path = err.location[:colon_idx]
            groups[file_path].append(err)
        else:
            groups["(unknown)"].append(err)

    lines: list[str] = []
    for file_path, errs in groups.items():
        if file_path != "(unknown)":
            lines.append(f"## {file_path}")
        for i, err in enumerate(errs, 1):
            loc = err.location
            if file_path != "(unknown)" and loc.startswith(f"{file_path}: "):
                loc = loc[len(f"{file_path}: "):]
            line = f"{i}. [{err.category}] {loc} — {err.message}"
            lines.append(line)
            if err.suggested_fix:
                lines.append(f"   → 수정 힌트: {err.suggested_fix}")
        lines.append("")

    return "\n".join(lines).strip()
