from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import get_settings

# X-API-Key 헤더 스키마
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


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

    if api_key != settings.x_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    return api_key
