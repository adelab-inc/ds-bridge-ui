from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # 정의되지 않은 환경 변수 무시
    )

    # AI Provider
    ai_provider: Literal["openai", "anthropic", "gemini"] = "openai"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # API Authentication
    x_api_key: str = ""  # X-API-Key 헤더로 인증

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Firebase
    firebase_storage_bucket: str = ""
    firebase_service_account_key: str = ""  # 서비스 계정 JSON 경로 (로컬용)

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
