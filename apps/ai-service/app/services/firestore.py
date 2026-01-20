import logging
import time
import uuid
from collections.abc import Callable, Coroutine
from functools import wraps
from pathlib import Path
from typing import Any, ParamSpec, TypedDict, TypeVar

from google.cloud.firestore import AsyncClient
from google.oauth2 import service_account

from app.core.config import get_settings

logger = logging.getLogger(__name__)


# ============================================================================
# Type Definitions
# ============================================================================


class RoomData(TypedDict):
    """채팅방 문서 타입"""

    id: str
    storybook_url: str
    schema_key: str | None
    user_id: str
    created_at: int


class MessageData(TypedDict):
    """채팅 메시지 문서 타입"""

    id: str
    question: str
    text: str
    content: str
    path: str
    room_id: str
    question_created_at: int
    answer_created_at: int
    status: str

# 로컬 개발용 서비스 계정 키 경로
SERVICE_ACCOUNT_KEY_PATH = Path(__file__).parent.parent.parent / "service-account-key.json"


def get_timestamp_ms() -> int:
    """현재 시간을 밀리초 단위 timestamp로 반환"""
    return int(time.time() * 1000)


# ============================================================================
# Custom Exceptions
# ============================================================================


class FirestoreError(Exception):
    """Firestore 작업 실패 예외"""

    pass


class RoomNotFoundError(Exception):
    """채팅방을 찾을 수 없음"""

    pass


# ============================================================================
# Error Handling Decorator
# ============================================================================

P = ParamSpec("P")
T = TypeVar("T")


def handle_firestore_error(
    error_message: str,
) -> Callable[[Callable[P, Coroutine[Any, Any, T]]], Callable[P, Coroutine[Any, Any, T]]]:
    """
    Firestore 작업의 예외를 일관되게 처리하는 데코레이터

    Args:
        error_message: 에러 발생 시 사용할 메시지

    Usage:
        @handle_firestore_error("채팅방 생성 실패")
        async def create_chat_room(...):
            ...
    """

    def decorator(
        func: Callable[P, Coroutine[Any, Any, T]],
    ) -> Callable[P, Coroutine[Any, Any, T]]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            try:
                return await func(*args, **kwargs)
            except FirestoreError:
                raise
            except Exception as e:
                logger.error("%s: %s", error_message, str(e))
                raise FirestoreError(f"{error_message}: {str(e)}") from e

        return wrapper

    return decorator


# ============================================================================
# Async Firestore Client
# ============================================================================

_firestore_client: AsyncClient | None = None


def get_firestore_client() -> AsyncClient:
    """비동기 Firestore 클라이언트 반환 (싱글톤)"""
    global _firestore_client

    if _firestore_client is None:
        settings = get_settings()
        project_id = settings.firebase_project_id

        try:
            # 로컬: 서비스 계정 키 파일 사용
            # Cloud Run: 기본 자격증명 사용
            if SERVICE_ACCOUNT_KEY_PATH.exists():
                cred = service_account.Credentials.from_service_account_file(
                    str(SERVICE_ACCOUNT_KEY_PATH)
                )
                _firestore_client = AsyncClient(credentials=cred, project=project_id)
                logger.info("Firestore AsyncClient initialized with service account key")
            else:
                _firestore_client = AsyncClient(project=project_id)
                logger.info("Firestore AsyncClient initialized with default credentials")
        except Exception as e:
            logger.error("Failed to initialize Firestore client: %s", str(e))
            raise FirestoreError(f"Firestore 초기화 실패: {str(e)}") from e

    return _firestore_client


async def close_firestore_client() -> None:
    """Firestore 클라이언트 정리 (서버 종료 시 호출)"""
    global _firestore_client

    if _firestore_client is not None:
        _firestore_client.close()
        _firestore_client = None
        logger.info("Firestore AsyncClient closed")


# ============================================================================
# Collection Names
# ============================================================================

CHAT_ROOMS_COLLECTION = "chat_rooms"
CHAT_MESSAGES_COLLECTION = "chat_messages"


# ============================================================================
# Chat Rooms Operations
# ============================================================================


@handle_firestore_error("채팅방 생성 실패")
async def create_chat_room(
    storybook_url: str, user_id: str, schema_key: str | None = None
) -> RoomData:
    """
    새 채팅방 생성

    Args:
        storybook_url: Storybook URL
        user_id: 사용자 ID
        schema_key: Firebase Storage 스키마 경로

    Returns:
        생성된 채팅방 문서

    Raises:
        FirestoreError: Firestore 작업 실패
    """
    db = get_firestore_client()
    room_id = str(uuid.uuid4())

    room_data: RoomData = {
        "id": room_id,
        "storybook_url": storybook_url,
        "schema_key": schema_key,
        "user_id": user_id,
        "created_at": get_timestamp_ms(),
    }

    await db.collection(CHAT_ROOMS_COLLECTION).document(room_id).set(room_data)
    logger.info("Chat room created: %s", room_id)

    return room_data


@handle_firestore_error("채팅방 조회 실패")
async def get_chat_room(room_id: str) -> RoomData | None:
    """
    채팅방 조회

    Args:
        room_id: 채팅방 ID

    Returns:
        채팅방 문서 또는 None

    Raises:
        FirestoreError: Firestore 작업 실패
    """
    db = get_firestore_client()
    doc = await db.collection(CHAT_ROOMS_COLLECTION).document(room_id).get()

    if doc.exists:
        return doc.to_dict()  # type: ignore[return-value]
    return None


async def verify_room_exists(room_id: str) -> bool:
    """
    채팅방 존재 여부 확인

    Args:
        room_id: 채팅방 ID

    Returns:
        존재 여부

    Raises:
        RoomNotFoundError: 채팅방을 찾을 수 없음
        FirestoreError: Firestore 작업 실패
    """
    room = await get_chat_room(room_id)
    if room is None:
        raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {room_id}")
    return True


@handle_firestore_error("채팅방 업데이트 실패")
async def update_chat_room(
    room_id: str,
    storybook_url: str | None = None,
    schema_key: str | None = None,
) -> RoomData:
    """
    채팅방 업데이트

    Args:
        room_id: 채팅방 ID
        storybook_url: Storybook URL (선택)
        schema_key: Firebase Storage 스키마 경로 (선택)

    Returns:
        업데이트된 채팅방 문서

    Raises:
        RoomNotFoundError: 채팅방을 찾을 수 없음
        FirestoreError: Firestore 작업 실패
    """
    # 먼저 존재 여부 확인
    room = await get_chat_room(room_id)
    if room is None:
        raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {room_id}")

    db = get_firestore_client()

    update_data: dict[str, str] = {}
    if storybook_url is not None:
        update_data["storybook_url"] = storybook_url
    if schema_key is not None:
        update_data["schema_key"] = schema_key

    if update_data:
        await db.collection(CHAT_ROOMS_COLLECTION).document(room_id).update(update_data)
        logger.info("Chat room updated: %s", room_id)

    # 업데이트된 문서 반환
    updated_room = await get_chat_room(room_id)
    return updated_room  # type: ignore[return-value]


# ============================================================================
# Chat Messages Operations
# ============================================================================


@handle_firestore_error("메시지 저장 실패")
async def create_chat_message(
    room_id: str,
    question: str = "",
    text: str = "",
    content: str = "",
    path: str = "",
    question_created_at: int | None = None,
    status: str = "DONE",
) -> MessageData:
    """
    새 채팅 메시지 생성

    Args:
        room_id: 채팅방 ID
        question: 사용자 질문
        text: AI 텍스트 응답
        content: React 코드 내용
        path: 파일 경로
        question_created_at: 질문 생성 시간 (ms timestamp)
        status: 응답 상태 ("DONE" | "ERROR")

    Returns:
        생성된 메시지 문서

    Raises:
        FirestoreError: Firestore 작업 실패
    """
    db = get_firestore_client()
    message_id = str(uuid.uuid4())
    now = get_timestamp_ms()

    message_data: MessageData = {
        "id": message_id,
        "question": question,
        "text": text,
        "content": content,
        "path": path,
        "room_id": room_id,
        "question_created_at": question_created_at or now,
        "answer_created_at": now,
        "status": status,
    }

    await db.collection(CHAT_MESSAGES_COLLECTION).document(message_id).set(message_data)
    logger.debug("Chat message created: %s", message_id)

    return message_data


@handle_firestore_error("메시지 조회 실패")
async def get_messages_by_room(room_id: str, limit: int = 100) -> list[MessageData]:
    """
    채팅방의 메시지 목록 조회

    Args:
        room_id: 채팅방 ID
        limit: 최대 조회 개수

    Returns:
        메시지 목록

    Raises:
        FirestoreError: Firestore 작업 실패
    """
    db = get_firestore_client()
    query = (
        db.collection(CHAT_MESSAGES_COLLECTION)
        .where("room_id", "==", room_id)
        .order_by("answer_created_at")
        .limit(limit)
    )

    docs = query.stream()
    return [doc.to_dict() async for doc in docs]  # type: ignore[misc]


@handle_firestore_error("메시지 업데이트 실패")
async def update_chat_message(
    message_id: str,
    text: str | None = None,
    content: str | None = None,
    path: str | None = None,
    status: str | None = None,
) -> None:
    """
    채팅 메시지 업데이트

    Args:
        message_id: 메시지 ID
        text: AI 텍스트 응답
        content: React 코드 내용
        path: 파일 경로
        status: 응답 상태 ("GENERATING" | "DONE" | "ERROR")

    Raises:
        FirestoreError: Firestore 작업 실패
    """
    db = get_firestore_client()

    update_data: dict[str, str | int] = {"answer_created_at": get_timestamp_ms()}
    if text is not None:
        update_data["text"] = text
    if content is not None:
        update_data["content"] = content
    if path is not None:
        update_data["path"] = path
    if status is not None:
        update_data["status"] = status

    await db.collection(CHAT_MESSAGES_COLLECTION).document(message_id).update(update_data)
    logger.debug("Chat message updated: %s", message_id)
