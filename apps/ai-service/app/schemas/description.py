from pydantic import BaseModel, Field


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
