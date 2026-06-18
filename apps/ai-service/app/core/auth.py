import logging
import secrets

import jwt
from fastapi import Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# X-API-Key 헤더 스키마
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str:
    """
    내부용 X-API-Key 검증 의존성

    - X_API_KEY 환경변수가 설정되지 않으면 인증 비활성화 (개발 모드)
    - 설정된 경우 X-API-Key 헤더 필수
    """
    settings = get_settings()

    # API 키가 설정되지 않은 경우 인증 스킵 (개발 모드)
    if not settings.x_api_key:
        return ""

    # API 키가 설정된 경우 검증
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide X-API-Key header.",
        )

    if not secrets.compare_digest(api_key, settings.x_api_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    return api_key


async def verify_external_api_key(api_key: str | None = Security(api_key_header)) -> str:
    """
    외부 파트너용 X-API-Key 검증 의존성

    헤더 이름은 내부와 동일한 X-API-Key 를 사용하지만, 비교 대상 값은 별도 환경변수
    `X_EXTERNAL_KEY` 로 분리되어 있습니다. 즉 외부 파트너에게 발급된 키 값은 내부
    API 호출에 사용할 수 없고, 내부 키 값으로 /external/* 호출도 불가능합니다.

    - X_EXTERNAL_KEY 환경변수가 설정되지 않으면 인증 비활성화 (개발 모드)
    """
    settings = get_settings()

    if not settings.x_external_key:
        return ""

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide X-API-Key header.",
        )

    if not secrets.compare_digest(api_key, settings.x_external_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    return api_key


async def get_current_user_id(
    authorization: str | None = Header(default=None),
) -> str | None:
    """Supabase 사용자 JWT(`Authorization: Bearer <token>`)를 검증해 uid(sub)를 반환.

    제로트러스트: 소유권은 클라가 보낸 값이 아니라 **서명 검증된 토큰의 sub** 로 판단한다.
    BFF가 브라우저의 Supabase access token 을 그대로 forward 하면, FastAPI가 직접 검증한다.

    - `SUPABASE_JWT_SECRET` 미설정(개발 모드) → None 반환(검증 비활성, X-API-Key 패턴과 동일).
      이 경우 호출부는 소유권 검증을 스킵한다(기존 동작 유지 → 무중단 롤아웃용 스위치).
    - 설정 시 → 토큰 필수. 누락/위조/만료/sub 없음이면 401.

    반환된 uid 는 `chat_rooms.user_id`(방 생성 시 Supabase uid 로 저장됨)와 직접 비교 가능.
    """
    settings = get_settings()

    # 개발 모드: 시크릿 미설정이면 검증 비활성 (프로덕션은 반드시 설정할 것)
    if not settings.supabase_jwt_secret:
        return None

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요합니다. Authorization: Bearer <token> 헤더를 보내세요.",
        )

    token = authorization[len("Bearer "):].strip()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as e:
        logger.warning("JWT 검증 실패", extra={"error": f"{type(e).__name__}: {e}"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 토큰입니다.",
        ) from e

    uid = payload.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에 사용자 식별자(sub)가 없습니다.",
        )
    return uid
