"""Code repair loop — stub (미구현).

ENABLE_REPAIR=true일 때 호출되지만, 아직 구현되지 않았으므로
원본 코드를 그대로 반환한다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.schemas.chat import FileContent
from app.schemas.validation import ValidationReport

logger = logging.getLogger(__name__)


@dataclass
class RepairResult:
    success: bool = False
    files: list[FileContent] = field(default_factory=list)
    report: ValidationReport | None = None


async def repair_code(
    files: list[FileContent],
    report: ValidationReport,
    provider: object,
    catalog: object,
) -> RepairResult:
    """Repair loop stub — 미구현 상태이므로 항상 실패 반환."""
    logger.warning("repair_code called but not implemented, returning original code")
    return RepairResult(success=False)
