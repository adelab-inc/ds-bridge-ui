"""Repair Loop (Stage 5) — 검증 실패 코드 AI 자동 수정.

Sub-spec: docs/superpowers/specs/2026-04-16-spec-repair-loop-design.md
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass

from app.schemas.chat import FileContent, Message
from app.schemas.validation import ValidationError, ValidationReport
from app.services.code_validator import ComponentCatalog, validate_code

logger = logging.getLogger(__name__)


@dataclass
class RepairResult:
    """repair_code() 반환 결과 (내부 전용, 직렬화 불필요)."""

    success: bool
    files: list[FileContent]
    report: ValidationReport
    elapsed_ms: int


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


async def repair_code(
    files: list[FileContent],
    report: ValidationReport,
    provider: object,
    catalog: ComponentCatalog,
) -> RepairResult:
    """검증 실패 코드를 AI에게 수정 요청. 최대 1회.

    Args:
        files: 1차 생성 파일 목록
        report: 1차 검증 리포트
        provider: AI 프로바이더 (chat 메서드 사용)
        catalog: 컴포넌트 카탈로그

    Returns:
        RepairResult — success=True면 수정 성공
    """
    t0 = time.perf_counter()

    try:
        # 1. 메시지 조립
        component_names = catalog.get_names()
        messages_dicts = build_repair_messages(files, report.errors, component_names)

        # 2. dict → Message 객체 변환
        messages = [Message(role=m["role"], content=m["content"]) for m in messages_dicts]

        # 3. AI 호출
        response_message, _usage = await provider.chat(messages)

        # 4. 응답 파싱 (순환 import 방지를 위해 지연 임포트)
        from app.api.chat import parse_ai_response

        parsed = parse_ai_response(response_message.content)
        if not parsed.files:
            logger.warning("repair: AI 응답에서 파일을 추출할 수 없음")
            elapsed = int((time.perf_counter() - t0) * 1000)
            return RepairResult(success=False, files=files, report=report, elapsed_ms=elapsed)

        # 5. 누락 파일 backfill
        repaired_paths = {f.path for f in parsed.files}
        for original_file in files:
            if original_file.path not in repaired_paths:
                parsed.files.append(original_file)

        # 6. 재검증 (에러 location에 파일 경로 접두사 추가)
        merged_errors: list[ValidationError] = []
        merged_warnings: list[ValidationError] = []
        v_elapsed = 0
        for f in parsed.files:
            v_report = validate_code(f.content, catalog)
            for err in v_report.errors:
                err.location = f"{f.path}: {err.location}"
            for warn in v_report.warnings:
                warn.location = f"{f.path}: {warn.location}"
            merged_errors.extend(v_report.errors)
            merged_warnings.extend(v_report.warnings)
            v_elapsed += v_report.elapsed_ms

        new_report = ValidationReport(
            passed=not merged_errors,
            errors=merged_errors,
            warnings=merged_warnings,
            elapsed_ms=v_elapsed,
        )

        elapsed = int((time.perf_counter() - t0) * 1000)

        if new_report.passed:
            logger.info("repair success: %d errors → 0", len(report.errors))
            return RepairResult(
                success=True, files=parsed.files, report=new_report, elapsed_ms=elapsed
            )
        else:
            logger.info(
                "repair failed: %d errors → %d errors",
                len(report.errors),
                len(new_report.errors),
            )
            return RepairResult(
                success=False, files=files, report=report, elapsed_ms=elapsed
            )

    except Exception as exc:  # noqa: BLE001
        elapsed = int((time.perf_counter() - t0) * 1000)
        logger.warning("repair crashed: %s: %s", type(exc).__name__, exc)
        return RepairResult(success=False, files=files, report=report, elapsed_ms=elapsed)
