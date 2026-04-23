from functools import lru_cache
from typing import Literal

from pydantic import model_validator
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
    gemini_model: str = "gemini-3-flash-preview"
    gemini_thinking_level: str = "off"  # off(비활성), minimal, low, medium, high

    # API Authentication
    x_api_key: str = ""  # X-API-Key 헤더로 인증

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Supabase Storage Bucket Names
    storage_bucket_uploads: str = "user-uploads"
    storage_bucket_exports: str = "exports"

    # Figma
    figma_personal_access_token: str = ""
    figma_design_system_url: str = ""  # 기본 디자인시스템 Figma URL (키워드 감지 시 폴백)

    # Chat Settings
    max_history_count: int = 10  # 대화 컨텍스트에 포함할 최대 메시지 수
    max_image_size_mb: int = 10  # 이미지 업로드 최대 크기 (MB)

    # Code Validation (Stage 4)
    enable_validation: bool = False       # 기본 off, 단계적 롤아웃
    validation_timeout_ms: int = 200      # validator 자체 타임아웃

    # Code Repair (Stage 5)
    enable_repair: bool = False           # Repair 루프 (ENABLE_VALIDATION=True 전제)

    # Message Condensing
    condense_threshold: int = 7000        # 이 길이 초과 시 경량 모델로 메시지 압축

    @model_validator(mode="after")
    def _validate_supabase(self) -> "Settings":
        """Supabase 필수 환경변수 검증 (빈 문자열이면 서버 시작 시 즉시 실패)"""
        if not self.supabase_url:
            raise ValueError("SUPABASE_URL 환경변수가 설정되지 않았습니다")
        if not self.supabase_service_role_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다")
        return self

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
