import logging
import secrets

import jwt
from fastapi import Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from jwt import PyJWKClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# X-API-Key 헤더 스키마
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Supabase JWKS 클라이언트 (공개키 캐싱). 최초 1회 fetch 후 재사용.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Supabase JWKS(공개키) 클라이언트 — 사용자 토큰(ES256) 서명 검증용."""
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{get_settings().supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


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

    검증 방식: Supabase JWKS(공개키, ES256/P-256)로 서명 검증 → 별도 시크릿 불필요.
    (이 프로젝트는 비대칭 ES256 서명. 레거시 HS256 시크릿은 쓰지 않는다.)

    - `JWT_VERIFY_ENABLED=false`(기본, 개발/롤아웃 전) → None 반환(검증 비활성).
      호출부는 소유권 검증을 스킵한다(기존 동작 유지 → 무중단 롤아웃용 마스터 스위치).
    - True → 토큰 필수. 누락/위조/만료/sub 없음이면 401.

    반환된 uid 는 `chat_rooms.user_id`(방 생성 시 Supabase uid 로 저장됨)와 직접 비교 가능.
    """
    settings = get_settings()

    # 마스터 스위치 OFF → 검증 비활성 (프로덕션에서 FE 준비 후 켤 것)
    if not settings.jwt_verify_enabled:
        return None

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요합니다. Authorization: Bearer <token> 헤더를 보내세요.",
        )

    token = authorization[len("Bearer "):].strip()
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as e:
        logger.warning("JWT 검증 실패", extra={"error": f"{type(e).__name__}: {e}"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 토큰입니다.",
        ) from e
    except Exception as e:
        # JWKS fetch 실패 등 → 보안상 fail-closed (검증 불가 시 거부)
        logger.error("JWKS 키 조회 실패", extra={"error": f"{type(e).__name__}: {e}"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 검증에 실패했습니다.",
        ) from e

    uid = payload.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에 사용자 식별자(sub)가 없습니다.",
        )
    return uid
