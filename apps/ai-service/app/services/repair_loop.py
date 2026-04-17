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


def build_file_blocks(files: list[FileContent]) -> str:
    """FileContent 목록을 <file path="...">content</file> 형태로 합친다."""
    if not files:
        return ""
    blocks: list[str] = []
    for f in files:
        blocks.append(f'<file path="{f.path}">\n{f.content}\n</file>')
    return "\n\n".join(blocks)


_REPAIR_SYSTEM_TEMPLATE = """\
당신은 코드 수정 전문가입니다. 아래 TSX 코드에서 발견된 오류를 수정하세요.
수정 시 기존 구조와 로직은 최대한 유지하고, 오류만 정확히 고치세요.
수정 여부와 관계없이 모든 파일을 <file path="...">...</file> 형식으로 반환하세요.
오류가 없는 파일도 원본 그대로 포함해야 합니다.

## 사용 가능한 DS 컴포넌트
{component_names}
위 컴포넌트는 `import {{ ComponentName }} from "@/components"` 로 사용합니다."""


def build_repair_messages(
    files: list[FileContent],
    errors: list[ValidationError],
    component_names: set[str],
) -> list[dict[str, str]]:
    """Repair AI 호출용 system/user 메시지를 조립한다."""
    system_content = _REPAIR_SYSTEM_TEMPLATE.format(
        component_names=", ".join(sorted(component_names)),
    )
    file_blocks = build_file_blocks(files)
    formatted_errors = format_errors_for_repair(errors)
    user_content = f"## 원본 코드\n{file_blocks}\n\n## 검출된 오류\n{formatted_errors}"

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]
