import json
import logging
from functools import lru_cache
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, storage

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# 로컬 개발용 서비스 계정 키 경로
SERVICE_ACCOUNT_KEY_PATH = Path(__file__).parent.parent.parent / "service-account-key.json"

# ============================================================================
# Firebase Initialization
# ============================================================================

_firebase_initialized = False


def init_firebase() -> None:
    """Firebase Admin SDK 초기화"""
    global _firebase_initialized

    if _firebase_initialized:
        return

    settings = get_settings()

    try:
        # 이미 초기화된 경우 스킵
        firebase_admin.get_app()
        _firebase_initialized = True
        return
    except ValueError:
        pass

    # 로컬: 서비스 계정 키 파일 사용
    # Cloud Run: 기본 자격증명 사용 (GCP 서비스 계정)
    if SERVICE_ACCOUNT_KEY_PATH.exists():
        cred = credentials.Certificate(str(SERVICE_ACCOUNT_KEY_PATH))
        firebase_admin.initialize_app(cred, {"storageBucket": settings.firebase_storage_bucket})
        logger.info("Firebase initialized with service account key")
    else:
        firebase_admin.initialize_app(options={"storageBucket": settings.firebase_storage_bucket})
        logger.info("Firebase initialized with default credentials (Cloud Run)")

    _firebase_initialized = True
    logger.info("Firebase initialized with bucket: %s", settings.firebase_storage_bucket)


# ============================================================================
# Schema Cache (LRU with max size)
# ============================================================================

MAX_CACHE_SIZE = 10  # 최대 캐시 항목 수
_schema_cache: dict[str, dict] = {}


def clear_schema_cache() -> None:
    """스키마 캐시 초기화"""
    global _schema_cache
    _schema_cache = {}
    logger.info("Schema cache cleared")


def _evict_oldest_cache() -> None:
    """캐시가 최대 크기를 초과하면 가장 오래된 항목 제거"""
    while len(_schema_cache) >= MAX_CACHE_SIZE:
        oldest_key = next(iter(_schema_cache))
        del _schema_cache[oldest_key]
        logger.debug("Cache evicted: %s", oldest_key)


def cleanup_firebase() -> None:
    """Firebase 리소스 정리 (서버 종료 시 호출)"""
    global _firebase_initialized, _schema_cache

    try:
        firebase_admin.delete_app(firebase_admin.get_app())
        logger.info("Firebase app deleted")
    except ValueError:
        pass  # 앱이 없으면 무시

    _firebase_initialized = False
    _schema_cache = {}
    logger.info("Firebase resources cleaned up")


# ============================================================================
# Storage Operations
# ============================================================================


def _validate_schema_key(schema_key: str) -> None:
    """
    schema_key 경로 검증 (경로 순회 공격 방지)

    Raises:
        ValueError: 유효하지 않은 경로
    """
    if not schema_key:
        raise ValueError("schema_key cannot be empty")

    # 경로 순회 공격 방지
    if ".." in schema_key:
        raise ValueError("Invalid schema_key: path traversal not allowed")

    # 절대 경로 차단
    if schema_key.startswith("/"):
        raise ValueError("Invalid schema_key: absolute path not allowed")

    # 허용된 확장자만
    if not schema_key.endswith(".json"):
        raise ValueError("Invalid schema_key: must be a .json file")


async def fetch_schema_from_storage(schema_key: str, use_cache: bool = True) -> dict:
    """
    Firebase Storage에서 컴포넌트 스키마 다운로드

    Args:
        schema_key: Storage 내 파일 경로 (예: "schemas/v1/component-schema.json")
        use_cache: 캐시 사용 여부

    Returns:
        파싱된 스키마 dict

    Raises:
        FileNotFoundError: 파일이 존재하지 않는 경우
        ValueError: JSON 파싱 실패 또는 유효하지 않은 경로
    """
    # 경로 검증
    _validate_schema_key(schema_key)

    # 캐시 확인
    if use_cache and schema_key in _schema_cache:
        logger.debug("Schema cache hit: %s", schema_key)
        return _schema_cache[schema_key]

    # Firebase 초기화
    init_firebase()

    try:
        bucket = storage.bucket()
        blob = bucket.blob(schema_key)

        if not blob.exists():
            raise FileNotFoundError(f"Schema not found in storage: {schema_key}")

        # 다운로드 및 파싱
        content = blob.download_as_string()
        schema = json.loads(content.decode("utf-8"))

        # 캐시 저장 (크기 제한 적용)
        if use_cache:
            _evict_oldest_cache()
            _schema_cache[schema_key] = schema
            logger.info("Schema cached: %s (cache size: %d)", schema_key, len(_schema_cache))

        return schema

    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in schema: {schema_key}") from e
    except Exception as e:
        logger.error("Failed to fetch schema from storage: %s - %s", schema_key, str(e))
        raise


# ============================================================================
# Design Tokens
# ============================================================================

DEFAULT_DESIGN_TOKENS_KEY = "exports/default/design-tokens.json"
DEFAULT_AG_GRID_SCHEMA_KEY = "exports/default/ag-grid-component.storybook.json"
DEFAULT_AG_GRID_TOKENS_KEY = "exports/default/ag-grid-tokens.json"

_design_tokens_cache: dict | None = None
_ag_grid_tokens_cache: dict | None = None


async def fetch_design_tokens_from_storage(
    tokens_key: str = DEFAULT_DESIGN_TOKENS_KEY,
) -> dict | None:
    """
    Firebase Storage에서 디자인 토큰 다운로드

    Args:
        tokens_key: Storage 내 파일 경로 (기본: "exports/design-tokens.json")

    Returns:
        파싱된 디자인 토큰 dict 또는 None (파일이 없는 경우)
    """
    global _design_tokens_cache

    # 캐시 확인
    if _design_tokens_cache is not None:
        logger.debug("Design tokens cache hit")
        return _design_tokens_cache

    # Firebase 초기화
    init_firebase()

    try:
        bucket = storage.bucket()
        blob = bucket.blob(tokens_key)

        if not blob.exists():
            logger.warning("Design tokens not found in storage: %s", tokens_key)
            return None

        # 다운로드 및 파싱
        content = blob.download_as_string()
        tokens = json.loads(content.decode("utf-8"))

        # 캐시 저장
        _design_tokens_cache = tokens
        logger.info("Design tokens loaded and cached from: %s", tokens_key)

        return tokens

    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in design tokens: %s - %s", tokens_key, str(e))
        return None
    except Exception as e:
        logger.error("Failed to fetch design tokens: %s - %s", tokens_key, str(e))
        return None


async def fetch_ag_grid_tokens_from_storage(
    tokens_key: str = DEFAULT_AG_GRID_TOKENS_KEY,
) -> dict | None:
    """
    Firebase Storage에서 AG Grid 토큰 다운로드

    Args:
        tokens_key: Storage 내 파일 경로 (기본: "exports/ag-grid-tokens.json")

    Returns:
        파싱된 AG Grid 토큰 dict 또는 None (파일이 없는 경우)
    """
    global _ag_grid_tokens_cache

    # 캐시 확인
    if _ag_grid_tokens_cache is not None:
        logger.debug("AG Grid tokens cache hit")
        return _ag_grid_tokens_cache

    # Firebase 초기화
    init_firebase()

    try:
        bucket = storage.bucket()
        blob = bucket.blob(tokens_key)

        if not blob.exists():
            logger.warning("AG Grid tokens not found in storage: %s", tokens_key)
            return None

        # 다운로드 및 파싱
        content = blob.download_as_string()
        tokens = json.loads(content.decode("utf-8"))

        # 캐시 저장
        _ag_grid_tokens_cache = tokens
        logger.info("AG Grid tokens loaded and cached from: %s", tokens_key)

        return tokens

    except json.JSONDecodeError as e:
        logger.error("Invalid JSON in AG Grid tokens: %s - %s", tokens_key, str(e))
        return None
    except Exception as e:
        logger.error("Failed to fetch AG Grid tokens: %s - %s", tokens_key, str(e))
        return None


async def upload_schema_to_storage(schema_key: str, schema_data: dict) -> str:
    """
    Firebase Storage에 스키마 업로드

    Args:
        schema_key: Storage 내 파일 경로 (예: "schemas/storybook/my-schema.json")
        schema_data: 업로드할 스키마 dict

    Returns:
        업로드된 파일의 public URL 또는 gs:// 경로

    Raises:
        ValueError: 유효하지 않은 경로
    """
    # 경로 검증
    _validate_schema_key(schema_key)

    # Firebase 초기화
    init_firebase()

    try:
        bucket = storage.bucket()
        blob = bucket.blob(schema_key)

        # JSON으로 직렬화하여 업로드
        content = json.dumps(schema_data, ensure_ascii=False, indent=2)
        blob.upload_from_string(content, content_type="application/json")

        logger.info("Schema uploaded: %s", schema_key)

        # 캐시 업데이트
        _evict_oldest_cache()
        _schema_cache[schema_key] = schema_data

        return schema_key

    except Exception as e:
        logger.error("Failed to upload schema to storage: %s - %s", schema_key, str(e))
        raise


# ============================================================================
# Image Upload/Fetch Operations
# ============================================================================

USER_UPLOADS_PATH = "user_uploads"


def _detect_media_type(data: bytes) -> str:
    """바이트 데이터에서 이미지 타입 자동 감지"""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif data[:3] == b'\xff\xd8\xff':
        return "image/jpeg"
    elif data[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    elif data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return "image/webp"
    else:
        return "image/png"  # 기본값


def _get_extension_from_media_type(media_type: str) -> str:
    """MIME 타입에서 파일 확장자 반환"""
    extensions = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
    }
    return extensions.get(media_type, "png")


async def upload_image_to_storage(
    room_id: str,
    image_data: bytes,
    media_type: str | None = None,
) -> tuple[str, str]:
    """
    Firebase Storage에 이미지 업로드

    Args:
        room_id: 채팅방 ID
        image_data: 이미지 바이트 데이터
        media_type: MIME 타입 (None이면 자동 감지)

    Returns:
        (public_url, storage_path) 튜플
    """
    import time
    import uuid

    # Firebase 초기화
    init_firebase()

    # 미디어 타입 자동 감지
    if media_type is None:
        media_type = _detect_media_type(image_data)

    # 파일 경로 생성: user_uploads/{room_id}/{timestamp}_{uuid}.{ext}
    timestamp = int(time.time() * 1000)
    file_uuid = uuid.uuid4().hex[:8]
    extension = _get_extension_from_media_type(media_type)
    storage_path = f"{USER_UPLOADS_PATH}/{room_id}/{timestamp}_{file_uuid}.{extension}"

    try:
        bucket = storage.bucket()
        blob = bucket.blob(storage_path)

        # 업로드
        blob.upload_from_string(image_data, content_type=media_type)

        # Public URL 생성
        blob.make_public()
        public_url = blob.public_url

        logger.info("Image uploaded: %s (%s)", storage_path, media_type)

        return public_url, storage_path

    except Exception as e:
        logger.error("Failed to upload image: %s - %s", storage_path, str(e))
        raise


async def fetch_image_from_url(url: str) -> tuple[bytes, str]:
    """
    URL에서 이미지 다운로드

    Args:
        url: 이미지 URL (Firebase Storage 또는 외부 URL)

    Returns:
        (image_bytes, media_type) 튜플
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()

            image_data = response.content
            media_type = response.headers.get("content-type", "")

            # Content-Type이 없거나 불명확하면 자동 감지
            if not media_type or not media_type.startswith("image/"):
                media_type = _detect_media_type(image_data)

            logger.debug("Image fetched from URL: %s (%s, %d bytes)", url, media_type, len(image_data))

            return image_data, media_type

    except httpx.HTTPStatusError as e:
        logger.error("Failed to fetch image (HTTP %d): %s", e.response.status_code, url)
        raise
    except Exception as e:
        logger.error("Failed to fetch image: %s - %s", url, str(e))
        raise


async def fetch_image_as_base64(url: str) -> tuple[str, str]:
    """
    URL에서 이미지를 가져와 base64로 변환

    Args:
        url: 이미지 URL

    Returns:
        (base64_data, media_type) 튜플
    """
    import base64

    image_data, media_type = await fetch_image_from_url(url)
    base64_data = base64.b64encode(image_data).decode("utf-8")

    return base64_data, media_type


@lru_cache(maxsize=20)
def get_cached_schema_sync(schema_key: str) -> dict:
    """
    동기 버전 스키마 캐시 (lru_cache 사용)

    Note: 이 함수는 초기 로딩 시에만 사용하고,
          런타임에는 fetch_schema_from_storage 사용 권장
    """
    init_firebase()

    bucket = storage.bucket()
    blob = bucket.blob(schema_key)

    if not blob.exists():
        raise FileNotFoundError(f"Schema not found: {schema_key}")

    content = blob.download_as_string()
    return json.loads(content.decode("utf-8"))
