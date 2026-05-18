"""외부 파트너 API 응답 스키마

외부 시스템에서 crid(=room_id)를 인자로 디자인 코드와 디스크립션을 조회할 때 사용.
"""
from pydantic import BaseModel, Field


class ExternalCodeResponse(BaseModel):
    """디자인모드 최종 코드 조회 응답.

    채팅방(crid)에서 가장 최근에 AI가 생성한 React TSX 파일의 본문과 메타데이터를 반환합니다.
    외부 시스템은 `code` 필드를 그대로 파일로 저장하거나 IDE 에 붙여넣을 수 있습니다.
    """

    crid: str = Field(
        ...,
        description="채팅방 ID (요청 시 URL의 crid 파라미터와 동일한 값)",
        examples=["5169a302-629f-4759-8568-c0a7849f4439"],
    )
    code: str = Field(
        ...,
        description=(
            "생성된 TSX 코드 본문. UTF-8 인코딩된 React 컴포넌트 소스 그대로. "
            "Import 구문, JSX, export 까지 포함됨."
        ),
    )
    path: str = Field(
        ...,
        description=(
            "코드가 위치할 파일 경로 (참고용). 외부 시스템에서 파일명을 결정할 때 활용 가능. "
            "AI 가 화면명에 기반해 자동 생성한 값이라 외부 시스템 구조와 일치할 필요는 없음."
        ),
        examples=["src/pages/InsuranceCodeApplication.tsx"],
    )
    generated_at: int = Field(
        ...,
        description="코드 생성 시각 (Unix epoch milliseconds). 가장 최근 코드 메시지의 응답 완료 시각.",
        examples=[1716700800000],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "crid": "5169a302-629f-4759-8568-c0a7849f4439",
                "code": (
                    "import React from 'react';\n"
                    "import { DataGrid } from '@aplus/ui';\n\n"
                    "const InsuranceCodeApplication = () => {\n"
                    "  return <DataGrid rowData={[]} columnDefs={[]} />;\n"
                    "};\n\n"
                    "export default InsuranceCodeApplication;\n"
                ),
                "path": "src/pages/InsuranceCodeApplication.tsx",
                "generated_at": 1716700800000,
            }
        }
    }


class ExternalDescriptionResponse(BaseModel):
    """디스크립션(화면 명세) 조회 응답.

    채팅방의 최신 디스크립션 한 건을 반환합니다.

    - 사용자가 편집한 버전(`edited_content`)이 있으면 그 값을 `content` 로 반환하며 `is_edited=true`.
    - 편집본이 없으면 AI 생성 원본(`content`)을 반환하며 `is_edited=false`.
    - 새로운 AI 재생성이 일어나면 version 이 증가하고 `is_edited` 는 다시 false 로 시작.
    """

    crid: str = Field(
        ...,
        description="채팅방 ID (요청 시 URL의 crid 파라미터와 동일한 값)",
        examples=["5169a302-629f-4759-8568-c0a7849f4439"],
    )
    content: str = Field(
        ...,
        description=(
            "디스크립션 본문 (Markdown). `is_edited=true` 이면 사용자 편집본, 아니면 AI 생성 원본. "
            "헤딩(`##`), 리스트(`-`), 강조(`**`) 등 마크다운 문법 포함."
        ),
    )
    version: int = Field(
        ...,
        description=(
            "디스크립션 버전 번호. 1부터 시작하며, 채팅방에서 디스크립션이 새로 추출될 때마다 "
            "+1 씩 증가. 같은 채팅방에 대해 가장 큰 version 이 최신본."
        ),
        examples=[3],
    )
    is_edited: bool = Field(
        ...,
        description=(
            "사용자 편집본 여부. true 이면 `content` 는 사용자가 편집한 텍스트이고, "
            "false 이면 AI 생성 원본."
        ),
        examples=[True],
    )
    updated_at: int = Field(
        ...,
        description=(
            "해당 버전의 생성 시각 (Unix epoch milliseconds). 편집과 무관하게 "
            "버전이 추가된 시점."
        ),
        examples=[1716700800000],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "crid": "5169a302-629f-4759-8568-c0a7849f4439",
                "content": (
                    "## 화면 개요\n\n"
                    "### ■ 화면명\n"
                    "- 보험사개별코드신청\n\n"
                    "### ■ 메뉴 위치\n"
                    "- 보험사관리 > 코드관리 > 보험사개별코드신청\n\n"
                    "### ■ 화면 목적\n"
                    "- 보험사별로 신청 코드를 등록·관리\n"
                    "- 신청기간 내 유효성 검증\n"
                ),
                "version": 3,
                "is_edited": True,
                "updated_at": 1716700800000,
            }
        }
    }


class ExternalErrorResponse(BaseModel):
    """외부 API 공통 에러 응답.

    HTTP status 별로 `detail` 메시지 포맷이 다르며 본 모델은 그 공통 골격을 정의합니다.

    | status | 상황 | detail 예시 |
    |---|---|---|
    | 401 | `X-API-Key` 헤더 미전송 | `"Missing API key. Provide X-API-Key header."` |
    | 403 | `X-API-Key` 값 불일치 | `"Invalid API key"` |
    | 404 | crid 에 해당하는 데이터 없음 | `"No code found for crid: {crid}"` |
    | 422 | crid path 형식 오류 (UUID 아님) | FastAPI Validation 표준 메시지 |
    | 500 | 서버 내부 오류 (DB 장애 등) | `"Internal server error"` |
    """

    detail: str = Field(
        ...,
        description="에러 사유. 호출자가 디버깅에 활용하도록 사람이 읽을 수 있는 형태로 제공.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {"detail": "No code found for crid: 5169a302-629f-4759-8568-c0a7849f4439"}
        }
    }
