"""외부 파트너 API 응답 스키마

외부 시스템에서 crid(=room_id)를 인자로 디자인 코드와 디스크립션을 조회할 때 사용.
"""
from pydantic import BaseModel, Field


class ExternalCodeResponse(BaseModel):
    """디자인모드 최종 코드 조회 응답"""

    crid: str = Field(..., description="채팅방 ID (URL의 crid 파라미터)")
    code: str = Field(..., description="생성된 TSX 코드 본문")
    path: str = Field(..., description="코드 파일 경로 (예: src/pages/InsuranceCodeApplication.tsx)")
    generated_at: int = Field(..., description="코드 생성 시각 (Unix epoch ms)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "crid": "5169a302-629f-4759-8568-c0a7849f4439",
                "code": "import React from 'react';\n\nconst InsuranceCodeApplication = () => { /* ... */ };\n\nexport default InsuranceCodeApplication;",
                "path": "src/pages/InsuranceCodeApplication.tsx",
                "generated_at": 1716700800000,
            }
        }
    }


class ExternalDescriptionResponse(BaseModel):
    """디스크립션 조회 응답

    `content`는 사용자가 편집한 버전이 있으면 그것을, 없으면 AI 생성 원본을 반환합니다.
    """

    crid: str = Field(..., description="채팅방 ID (URL의 crid 파라미터)")
    content: str = Field(..., description="디스크립션 본문 (Markdown). 편집본 우선, 없으면 AI 원본.")
    version: int = Field(..., description="디스크립션 버전 (1부터 시작, 변경 시마다 증가)")
    is_edited: bool = Field(..., description="사용자 편집본 여부. true면 content는 편집본.")
    updated_at: int = Field(..., description="최종 갱신 시각 (Unix epoch ms)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "crid": "5169a302-629f-4759-8568-c0a7849f4439",
                "content": "## 화면 개요\n\n### ■ 화면명\n- 보험사개별코드신청\n\n...",
                "version": 3,
                "is_edited": True,
                "updated_at": 1716700800000,
            }
        }
    }


class ExternalErrorResponse(BaseModel):
    """외부 API 공통 에러 응답"""

    detail: str = Field(..., description="에러 메시지")

    model_config = {
        "json_schema_extra": {
            "example": {"detail": "Room not found: 5169a302-629f-4759-8568-c0a7849f4439"}
        }
    }
