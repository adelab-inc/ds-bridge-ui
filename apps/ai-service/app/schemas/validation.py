"""검증 결과 스키마."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ValidationError(BaseModel):
    """단일 검증 오류.

    category v1 값:
        - "unknown_component": JSX에 등장한 컴포넌트가 DS 카탈로그에도 로컬 선언에도 없음
        - "missing_import": DS 카탈로그에는 있지만 import 선언이 없음
        - "external_url": `src`/`href`/`url()` 리터럴에 외부 https?:// 포함
        - "invalid_prop_value": schema에 enum이 정의된 prop의 리터럴 값이 enum에 없음
        - "validator_internal_error": Validator 자체 예외/타임아웃
    """

    category: str = Field(..., description="오류 카테고리 (위 주석 참조)")
    location: str = Field(..., description="예: 'line 42, <Checkbox>'")
    message: str = Field(..., description="사람이 읽을 수 있는 설명")
    suggested_fix: str | None = Field(None, description="자동 수정 힌트(가능한 경우)")


class ValidationReport(BaseModel):
    """코드 검증 결과."""

    passed: bool
    errors: list[ValidationError] = Field(default_factory=list)
    warnings: list[ValidationError] = Field(default_factory=list)
    elapsed_ms: int = 0
