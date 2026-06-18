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
    # 헤더 이름은 외부/내부 모두 X-API-Key 로 통일. 값(secret)만 분리해서 발급.
    x_api_key: str = ""           # 내부 BFF/관리자용 X-API-Key 값
    x_external_key: str = ""      # 외부 파트너용 X-API-Key 값 (/external/* 라우터 전용)

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # 사용자 JWT 검증 ON/OFF 스위치 (무중단 롤아웃용 마스터 스위치).
    # True 면 보호 엔드포인트(방/메시지 삭제)에서 Supabase 사용자 토큰을 검증해 소유권을 강제한다.
    # 토큰은 Supabase JWKS(공개키, ES256)로 검증하므로 별도 시크릿이 필요 없다
    # (이 프로젝트는 비대칭 ES256/P-256 서명. JWKS = {SUPABASE_URL}/auth/v1/.well-known/jwks.json).
    # 켜기 전 FE/BFF가 Authorization: Bearer 토큰을 forward 하도록 먼저 배포할 것.
    jwt_verify_enabled: bool = False

    # Supabase Storage Bucket Names
    storage_bucket_uploads: str = "user-uploads"
    storage_bucket_exports: str = "exports"

    # Figma
    figma_personal_access_token: str = ""
    figma_design_system_url: str = ""  # 기본 디자인시스템 Figma URL (키워드 감지 시 폴백)
    # 인스턴스당 동시 Figma API 호출 상한 (429 방지 vs 멀티유저 동시성 트레이드오프).
    # 3은 멀티유저 시 prefetch 큐잉이 심해 상향(측정상 5요청 동시 시 prefetch 31~89초).
    figma_concurrency: int = 6

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
