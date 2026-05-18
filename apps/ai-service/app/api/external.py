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
- 헤더 `X-Partner-Key` 필수 (내부 BFF용 `X-API-Key`와 분리)
- 환경변수 `X_PARTNER_KEY`로 발급/회수 관리

## 사용 시나리오
- 외부 시스템이 런타임 허브 URL의 `crid` 파라미터를 추출하여 본 API 호출
- 로컬 환경 또는 사내망 사용 가정 (방화벽 이슈 없음)

⚠️ **현재 STUB 상태**: 응답 스키마 합의용으로 골격만 노출, 실제 구현은 후속.
모든 엔드포인트가 `501 Not Implemented` 반환.
"""
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, status
from fastapi.openapi.utils import get_openapi

from app.core.auth import verify_partner_key
from app.schemas.external import (
    ExternalCodeResponse,
    ExternalDescriptionResponse,
    ExternalErrorResponse,
)

router = APIRouter(
    # prefix는 main.py에서 app.mount("/external", external_app)로 부여 — 중복 방지 위해 여기서는 비움
    tags=["external"],
    dependencies=[Depends(verify_partner_key)],
    responses={
        401: {"model": ExternalErrorResponse, "description": "X-Partner-Key 헤더 누락"},
        403: {"model": ExternalErrorResponse, "description": "X-Partner-Key 값 불일치"},
        404: {"model": ExternalErrorResponse, "description": "리소스 없음"},
        501: {"model": ExternalErrorResponse, "description": "스펙 합의 단계 — 미구현"},
    },
)


@router.get(
    "/code/{crid}",
    response_model=ExternalCodeResponse,
    summary="디자인모드 최종 코드 조회",
    description=(
        "지정한 채팅방(`crid`)에서 가장 최근에 생성된 디자인모드 최종 코드를 반환합니다.\n\n"
        "- `code`: 생성된 TSX 파일 본문 (그대로 사용 가능한 React 컴포넌트)\n"
        "- `path`: 코드가 위치할 파일 경로 (참고용)\n"
        "- `generated_at`: 코드 생성 시각 (Unix epoch ms)\n\n"
        "코드가 없는 채팅방이면 404 반환."
    ),
)
async def get_external_code(
    crid: str = Path(
        ...,
        description="채팅방 ID (런타임 허브 URL의 `crid` 파라미터)",
        examples=["5169a302-629f-4759-8568-c0a7849f4439"],
    ),
) -> ExternalCodeResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="External code API is under specification review. Implementation pending.",
    )


@router.get(
    "/description/{crid}",
    response_model=ExternalDescriptionResponse,
    summary="디스크립션 값 조회",
    description=(
        "지정한 채팅방(`crid`)의 최신 디스크립션을 반환합니다.\n\n"
        "- `content`: 디스크립션 본문(Markdown). 사용자 편집본이 있으면 편집본, 없으면 AI 원본.\n"
        "- `version`: 디스크립션 버전 (변경 시마다 증가)\n"
        "- `is_edited`: 사용자 편집본 여부\n"
        "- `updated_at`: 최종 갱신 시각 (Unix epoch ms)\n\n"
        "디스크립션이 없는 채팅방이면 404 반환."
    ),
)
async def get_external_description(
    crid: str = Path(
        ...,
        description="채팅방 ID (런타임 허브 URL의 `crid` 파라미터)",
        examples=["5169a302-629f-4759-8568-c0a7849f4439"],
    ),
) -> ExternalDescriptionResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="External description API is under specification review. Implementation pending.",
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
        "런타임 허브에서 생성된 디자인 코드와 디스크립션을 `crid`(=room_id)로 조회합니다.\n\n"
        "**인증**: 모든 엔드포인트는 `X-Partner-Key` 헤더가 필요합니다.\n\n"
        "⚠️ 현재 STUB 단계 — 응답 스키마 합의용으로 `501 Not Implemented` 반환."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
external_app.include_router(router)


def _external_openapi() -> dict:
    """External sub-app 전용 OpenAPI 스펙. X-Partner-Key 만 security scheme 으로 노출."""
    if external_app.openapi_schema:
        return external_app.openapi_schema

    schema = get_openapi(
        title=external_app.title,
        version=external_app.version,
        description=external_app.description,
        routes=external_app.routes,
    )

    schema.setdefault("components", {})["securitySchemes"] = {
        "X-Partner-Key": {
            "type": "apiKey",
            "in": "header",
            "name": "X-Partner-Key",
            "description": "외부 파트너 인증 키. 운영 담당자에게 발급 요청 후 안전한 채널로 전달받으세요.",
        }
    }

    for _path, methods in schema.get("paths", {}).items():
        for method in methods.values():
            if isinstance(method, dict):
                method["security"] = [{"X-Partner-Key": []}]

    external_app.openapi_schema = schema
    return external_app.openapi_schema


external_app.openapi = _external_openapi  # type: ignore[method-assign]
