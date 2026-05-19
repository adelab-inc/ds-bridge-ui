"""외부 파트너용 read-only API (sub-app)

런타임 허브에서 생성된 디자인 코드와 디스크립션을 외부 시스템(보험사 백오피스 등)이
crid(=room_id)로 조회할 수 있도록 노출합니다.

## 마운트 구조
- 본 모듈은 별도 FastAPI sub-app(`external_app`)으로 노출됩니다.
- main.py에서 `app.mount("/external", external_app)`으로 마운트됩니다.
- 결과:
  - 외부 파트너용 스웨거: `https://{host}/external/docs`
  - 외부 파트너용 OpenAPI JSON: `https://{host}/external/openapi.json`
  - 실제 호출 URL: `/external/code/{crid}`, `/external/description/{crid}`
- 메인 `/docs`에는 내부 API만 노출되므로 외부 파트너에게 내부 스펙이 새지 않습니다.

## 인증
- 헤더 `X-API-Key` 필수 (내부 BFF와 헤더 이름 통일)
- 키 값(secret)은 외부 전용으로 분리 발급. 환경변수 `X_EXTERNAL_KEY` 로 관리.
- 내부용 X-API-Key 값으로 본 라우터 호출 불가 (반대도 동일).

## 사용 시나리오
- 외부 시스템이 런타임 허브 URL의 `crid` 파라미터를 추출하여 본 API 호출
- 로컬 환경 또는 사내망 사용 가정 (방화벽 이슈 없음)
"""
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from app.core.auth import verify_external_api_key
from app.schemas.external import (
    ExternalCodeResponse,
    ExternalDescriptionResponse,
    ExternalErrorResponse,
)
from app.services.supabase_db import (
    get_latest_code_message,
    get_latest_description,
)

logger = logging.getLogger(__name__)

# 라우터 레벨 공통 응답 (모든 엔드포인트에 자동 적용)
_COMMON_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {
        "model": ExternalErrorResponse,
        "description": "X-API-Key 헤더 누락",
        "content": {
            "application/json": {
                "example": {"detail": "Missing API key. Provide X-API-Key header."}
            }
        },
    },
    403: {
        "model": ExternalErrorResponse,
        "description": "X-API-Key 값 불일치",
        "content": {
            "application/json": {"example": {"detail": "Invalid API key"}}
        },
    },
    404: {
        "model": ExternalErrorResponse,
        "description": "채팅방에 해당 데이터가 아직 생성되지 않음",
        "content": {
            "application/json": {
                "example": {
                    "detail": "No code found for crid: 5169a302-629f-4759-8568-c0a7849f4439"
                }
            }
        },
    },
    422: {
        "model": ExternalErrorResponse,
        "description": "crid 형식이 UUID 가 아님",
        "content": {
            "application/json": {
                "example": {
                    "detail": "Invalid crid format. Expected UUID, got 'abc-not-uuid'."
                }
            }
        },
    },
    500: {
        "model": ExternalErrorResponse,
        "description": "서버 내부 오류 (DB 장애 등)",
        "content": {
            "application/json": {"example": {"detail": "Internal server error"}}
        },
    },
}

router = APIRouter(
    # prefix는 main.py에서 app.mount("/external", external_app)로 부여 — 중복 방지 위해 여기서는 비움
    tags=["external"],
    dependencies=[Depends(verify_external_api_key)],
    responses=_COMMON_ERROR_RESPONSES,
)


@router.get(
    "/code/{crid}",
    response_model=ExternalCodeResponse,
    summary="디자인모드 최종 코드 조회",
    description=(
        "지정한 채팅방(`crid`)에서 가장 최근에 생성된 디자인모드 최종 코드를 반환합니다.\n\n"
        "**응답 필드**\n"
        "- `code` — 생성된 TSX 파일 본문 (그대로 사용 가능한 React 컴포넌트, UTF-8)\n"
        "- `path` — 코드 파일 경로 (AI 추정값, 참고용)\n"
        "- `generated_at` — 코드 생성 시각 (Unix epoch milliseconds)\n\n"
        "**에러**\n"
        "- `404` — 해당 crid 의 채팅방에 아직 생성된 코드가 없음\n"
        "- `422` — `crid` 가 UUID 형식이 아님\n"
        "- `401`/`403` — 인증 실패 (`X-API-Key` 헤더 누락/불일치)\n"
        "- `500` — 서버 내부 오류"
    ),
    response_description="채팅방의 최신 생성 코드와 메타데이터",
)
async def get_external_code(
    crid: UUID = Path(
        ...,
        description=(
            "채팅방 ID. UUID v4 형식. "
            "런타임 허브 URL 의 `?crid=...` 파라미터와 동일한 값."
        ),
        examples=["5169a302-629f-4759-8568-c0a7849f4439"],
    ),
) -> ExternalCodeResponse:
    crid_str = str(crid)
    message = await get_latest_code_message(crid_str)
    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No code found for crid: {crid_str}",
        )

    return ExternalCodeResponse(
        crid=crid_str,
        code=message.get("content", ""),
        path=message.get("path", ""),
        generated_at=message.get("answer_created_at", 0),
    )


@router.get(
    "/description/{crid}",
    response_model=ExternalDescriptionResponse,
    summary="디스크립션 값 조회",
    description=(
        "지정한 채팅방(`crid`)의 최신 디스크립션을 반환합니다.\n\n"
        "**응답 필드**\n"
        "- `content` — 디스크립션 본문(Markdown). 편집본 있으면 그것, 없으면 AI 원본.\n"
        "- `version` — 디스크립션 버전 (1부터 시작, 새 추출 시마다 +1)\n"
        "- `is_edited` — 사용자 편집본 여부\n"
        "- `updated_at` — 해당 버전 생성 시각 (Unix epoch milliseconds)\n\n"
        "**에러**\n"
        "- `404` — 해당 crid 의 채팅방에 아직 추출된 디스크립션이 없음\n"
        "- `422` — `crid` 가 UUID 형식이 아님\n"
        "- `401`/`403` — 인증 실패 (`X-API-Key` 헤더 누락/불일치)\n"
        "- `500` — 서버 내부 오류"
    ),
    response_description="채팅방의 최신 디스크립션과 버전 정보",
)
async def get_external_description(
    crid: UUID = Path(
        ...,
        description=(
            "채팅방 ID. UUID v4 형식. "
            "런타임 허브 URL 의 `?crid=...` 파라미터와 동일한 값."
        ),
        examples=["5169a302-629f-4759-8568-c0a7849f4439"],
    ),
) -> ExternalDescriptionResponse:
    crid_str = str(crid)
    record = await get_latest_description(crid_str)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No description found for crid: {crid_str}",
        )

    edited = record.get("edited_content")
    is_edited = bool(edited)
    content = edited if is_edited else record.get("content", "")

    return ExternalDescriptionResponse(
        crid=crid_str,
        content=content,
        version=record.get("version", 0),
        is_edited=is_edited,
        updated_at=record.get("created_at", 0),
    )


# ============================================================================
# Sub-app — 외부 파트너 전용 스웨거 격리
# ============================================================================
# 메인 ai-service `/docs` 에는 내부 API(rooms·chat·description·components)만 노출되도록
# 외부 라우터는 별도 sub-app 으로 분리합니다.
# main.py 에서 `app.mount("/external", external_app)` 로 마운트합니다.

external_app = FastAPI(
    title="DS-Bridge External API",
    description=(
        "외부 파트너용 read-only API.\n\n"
        "런타임 허브(`ds-bridge-ui-web`)에서 AI 채팅으로 생성된 디자인 코드와 "
        "디스크립션을 `crid`(=room_id)로 조회합니다.\n\n"
        "## 사용 흐름\n"
        "1. 런타임 허브에서 채팅을 통해 코드/디스크립션 생성\n"
        "2. 런타임 허브 URL의 `?crid=<UUID>` 파라미터에서 crid 추출\n"
        "3. 본 API 의 `/code/{crid}` 또는 `/description/{crid}` 호출\n\n"
        "## 인증\n"
        "모든 엔드포인트는 `X-API-Key` 헤더가 필요합니다. 외부 파트너용 키 값은 "
        "내부 BFF 키 값과 별도로 발급되며 운영 담당자로부터 안전 채널로 전달받습니다.\n\n"
        "## 응답 / 에러 규약\n"
        "- `200` — 성공. JSON 페이로드 (각 엔드포인트별 스키마 참조)\n"
        "- `401` — `X-API-Key` 헤더 미전송\n"
        "- `403` — `X-API-Key` 값 불일치\n"
        "- `404` — 채팅방에 해당 데이터가 아직 생성되지 않음\n"
        "- `422` — `crid` 가 UUID 형식이 아님\n"
        "- `500` — 서버 내부 오류\n\n"
        "모든 에러 응답은 `{\"detail\": \"<message>\"}` 형식으로 통일됩니다."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
external_app.include_router(router)


# ============================================================================
# 글로벌 Exception Handler — 모든 에러 응답을 {"detail": ...} 로 통일
# ============================================================================


@external_app.exception_handler(RequestValidationError)
async def _external_validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Pydantic / path param 검증 실패 응답을 호출자 친화적으로 가공.

    기본 FastAPI 동작은 422 + `{"detail": [{...}]}` 배열인데, 외부 파트너 입장에서는
    문자열 한 줄이 더 친절. 첫 에러의 loc/msg 를 조합해서 평탄 detail 로 변환.
    """
    errors = exc.errors()
    if errors:
        first = errors[0]
        loc = ".".join(str(p) for p in first.get("loc", ()) if p not in {"path", "body"})
        msg = first.get("msg", "Invalid request")
        detail = f"{loc}: {msg}" if loc else msg
    else:
        detail = "Invalid request"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": detail},
    )


@external_app.exception_handler(Exception)
async def _external_unhandled_exception_handler(
    request: Request, _exc: Exception
) -> JSONResponse:
    """예상 못한 예외에 대해 500 + 일관된 detail 형태로 응답.

    HTTPException 은 FastAPI 가 먼저 처리하므로 여기 안 옴.
    DB 장애 / 네트워크 오류 / 예측 못한 버그가 주 케이스. 호출자에게 내부 stacktrace
    는 노출하지 않고 서버 로그로만 남김.
    """
    logger.exception(
        "External API unhandled error",
        extra={"path": request.url.path, "method": request.method},
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


def _external_openapi() -> dict:
    """External sub-app 전용 OpenAPI 스펙. X-API-Key 를 security scheme 으로 노출."""
    if external_app.openapi_schema:
        return external_app.openapi_schema

    schema = get_openapi(
        title=external_app.title,
        version=external_app.version,
        description=external_app.description,
        routes=external_app.routes,
    )

    # 마운트 prefix(/external) 를 servers 로 명시 — Swagger UI 의 Try it out 이
    # 자기 자신을 root 로 인식해 /code/{crid} 로 호출하던 404 문제 해결.
    # `/` 로 시작하면 페이지 origin 기준 상대 경로로 합성됨.
    schema["servers"] = [{"url": "/external", "description": "External API base path"}]

    schema.setdefault("components", {})["securitySchemes"] = {
        "X-API-Key": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API 키 인증. 운영 담당자에게 발급 요청 후 안전한 채널로 전달받으세요.",
        }
    }

    for _path, methods in schema.get("paths", {}).items():
        for method in methods.values():
            if isinstance(method, dict):
                method["security"] = [{"X-API-Key": []}]

    external_app.openapi_schema = schema
    return external_app.openapi_schema


external_app.openapi = _external_openapi  # type: ignore[method-assign]
