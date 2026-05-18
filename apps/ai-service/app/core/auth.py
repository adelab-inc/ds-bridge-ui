import secrets

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import get_settings

# X-API-Key 헤더 스키마 (내부 BFF/관리자용)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# X-Partner-Key 헤더 스키마 (외부 파트너용, /external/* 라우터)
partner_key_header = APIKeyHeader(name="X-Partner-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str:
    """
    API 키 검증 의존성

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


async def verify_partner_key(partner_key: str | None = Security(partner_key_header)) -> str:
    """
    파트너 API 키 검증 의존성 (외부 파트너용)

    - X_PARTNER_KEY 환경변수가 설정되지 않으면 인증 비활성화 (개발 모드)
    - 설정된 경우 X-Partner-Key 헤더 필수
    - 내부용 X-API-Key와 별도로 관리하여 권한·발급·회수 분리
    """
    settings = get_settings()

    if not settings.x_partner_key:
        return ""

    if not partner_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing partner key. Provide X-Partner-Key header.",
        )

    if not secrets.compare_digest(partner_key, settings.x_partner_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid partner key",
        )

    return partner_key
