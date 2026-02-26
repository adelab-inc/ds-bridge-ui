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
    anthropic_model: str = "claude-sonnet-4-5"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-pro"
    gemini_thinking_level: str = "low"  # off(비활성), minimal, low, medium, high

    # API Authentication
    x_api_key: str = ""  # X-API-Key 헤더로 인증

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Firebase
    firebase_project_id: str = ""
    firebase_storage_bucket: str = ""

    # Chat Settings
    max_history_count: int = 10  # 대화 컨텍스트에 포함할 최대 메시지 수
    max_image_size_mb: int = 10  # 이미지 업로드 최대 크기 (MB)

    @property
    def max_image_size_bytes(self) -> int:
        """이미지 최대 크기를 바이트로 반환"""
        return self.max_image_size_mb * 1024 * 1024

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
