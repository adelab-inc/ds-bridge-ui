from pydantic import BaseModel, Field, computed_field, model_validator

from app.core.hashing import content_hash, short_hash


class DescriptionExtractRequest(BaseModel):
    """디스크립션 추출 요청"""

    room_id: str = Field(
        ...,
        description="채팅방 ID",
        json_schema_extra={"example": "550e8400-e29b-41d4-a716-446655440000"},
    )


class DescriptionExtractResponse(BaseModel):
    """디스크립션 추출 응답"""

    id: str = Field(..., description="디스크립션 ID")
    version: int = Field(..., description="버전 번호")
    content: str = Field(..., description="AI 생성 디스크립션 텍스트")
    reason: str = Field(..., description="생성 사유")


class DescriptionResponse(BaseModel):
    """디스크립션 조회 응답 (전체 필드)"""

    id: str
    room_id: str
    content: str
    version: int
    reason: str
    edited_content: str | None = None
    created_at: int
    description_hash: str | None = Field(
        default=None,
        description=(
            "표시 본문(`edited_content ?? content`)의 SHA-256 해시(hex, 64자). DB 저장 컬럼에서 옴. "
            "external API(`/external/description/{crid}`)의 `description_hash` 와 동일 값. "
            "런타임허브 뱃지는 앞 7자만 표시하면 됨."
        ),
    )

    @model_validator(mode="after")
    def _fill_description_hash(self) -> "DescriptionResponse":
        """저장 컬럼이 비어있을 때(마이그레이션 적용 전 등)만 본문으로 즉석 계산."""
        if self.description_hash is None:
            self.description_hash = content_hash(self.edited_content or self.content)
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def description_hash_short(self) -> str | None:
        """`description_hash` 의 git 약식 형태(앞 7자). 화면 뱃지 표시용."""
        return short_hash(self.description_hash)


class EditContentRequest(BaseModel):
    """편집 내용 저장 요청"""

    edited_content: str = Field(
        ...,
        min_length=1,
        description="사용자가 편집한 디스크립션 텍스트",
    )


class EditContentResponse(BaseModel):
    """편집 내용 저장 응답"""

    id: str
    version: int
    edited_content: str


class VersionSummaryResponse(BaseModel):
    """버전 요약"""

    id: str
    version: int
    reason: str
    created_at: int


class VersionListResponse(BaseModel):
    """버전 목록 응답"""

    versions: list[VersionSummaryResponse]
