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
        firebase_admin.initialize_app(cred, {
            "storageBucket": settings.firebase_storage_bucket
        })
        logger.info("Firebase initialized with service account key")
    else:
        firebase_admin.initialize_app(options={
            "storageBucket": settings.firebase_storage_bucket
        })
        logger.info("Firebase initialized with default credentials (Cloud Run)")

    _firebase_initialized = True
    logger.info("Firebase initialized with bucket: %s", settings.firebase_storage_bucket)


# ============================================================================
# Schema Cache
# ============================================================================

_schema_cache: dict[str, dict] = {}


def clear_schema_cache() -> None:
    """스키마 캐시 초기화"""
    global _schema_cache
    _schema_cache = {}
    logger.info("Schema cache cleared")


# ============================================================================
# Storage Operations
# ============================================================================


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
        ValueError: JSON 파싱 실패
    """
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

        # 캐시 저장
        if use_cache:
            _schema_cache[schema_key] = schema
            logger.info("Schema cached: %s", schema_key)

        return schema

    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in schema: {schema_key}") from e
    except Exception as e:
        logger.error("Failed to fetch schema from storage: %s - %s", schema_key, str(e))
        raise


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
