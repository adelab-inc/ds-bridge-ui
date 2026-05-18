import secrets

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import get_settings

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
