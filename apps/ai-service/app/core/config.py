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
    # ⚠️ "off"는 thinking을 끄지 못한다 — thinking_config 미전달 시 Gemini 3은 기본
    #    dynamic thinking(ON)으로 동작해 thinking 토큰이 폭주(정상 ~2k → 60k+)할 수 있다.
    #    실제로 줄이려면 "minimal"/"low" 처럼 명시 레벨을 줘야 한다.
    #    기본 minimal — 응답 속도 우선 + thinking 폭주 위험 최소화.
    #    (복잡 화면에서 코드 품질이 떨어지면 "low"로 상향)
    gemini_thinking_level: str = "minimal"  # off(=실효 없음, dynamic ON), minimal, low, medium, high
    # 출력 토큰 상한. thinking 폭주는 thinking_level=minimal 이 막으므로(이게 1차 가드),
    # 이 값은 "정상 코드 재출력"을 위한 천장 역할만 한다.
    # ⚠️ 16384는 너무 낮았다 — 누적 편집으로 커진 대형 파일(예: ~115KB ≈ 40k 출력토큰)을
    #    매 수정마다 "전체 재출력"하다 16384에서 잘려 MAX_TOKENS→no-code 회귀 발생(room f94ab53f).
    #    minimal로 thinking이 ~0이라 천장을 올려도 폭주는 재발하지 않으므로 모델 한도로 상향.
    #    (근본 해법은 전체 재출력 → diff/부분수정으로 출력량 자체를 줄이는 것)
    gemini_max_output_tokens: int = 65536
    # 코드(<file>) 0건 생성 시 재생성 횟수 (간헐적 thinking 폭주 → no-code 완화). 0이면 재시도 없음.
    gemini_nocode_max_retries: int = 1
    # diff(search/replace) 부분 편집 — 대형 파일 수정 시 변경분만 출력
    gemini_diff_edit_enabled: bool = False  # 마스터 스위치(무중단 롤아웃, 기본 off)
    gemini_diff_edit_threshold_chars: int = 3000  # base 코드 len(content) 초과 시 diff 적용. 낮출수록 더 많은 편집이 diff(출력↓=빠름), 실패 시 풀출력 폴백

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
