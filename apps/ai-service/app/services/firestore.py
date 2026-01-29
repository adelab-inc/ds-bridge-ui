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

# Default schema key for rooms without one
DEFAULT_SCHEMA_KEY = "exports/default/component-schema.json"


# ============================================================================
# Type Definitions
# ============================================================================


class RoomData(TypedDict, total=False):
    """채팅방 문서 타입"""

    id: str
    storybook_url: str | None
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


class PaginatedMessages(TypedDict):
    """페이지네이션된 메시지 응답"""

    messages: list[MessageData]
    next_cursor: int | None
    has_more: bool
    total_count: int


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
    user_id: str,
    storybook_url: str | None = None,
) -> RoomData:
    """
    새 채팅방 생성

    Args:
        user_id: 사용자 ID
        storybook_url: Storybook URL (참고용, 선택)

    Returns:
        생성된 채팅방 문서 (기본 schema_key 사용)

    Raises:
        FirestoreError: Firestore 작업 실패
    """
    db = get_firestore_client()
    room_id = str(uuid.uuid4())

    room_data: RoomData = {
        "id": room_id,
        "storybook_url": storybook_url,
        "schema_key": DEFAULT_SCHEMA_KEY,
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
        room_data: RoomData = doc.to_dict()  # type: ignore[assignment]
        # 기존 방에 schema_key가 없으면 기본값 설정
        if room_data.get("schema_key") is None:
            room_data["schema_key"] = DEFAULT_SCHEMA_KEY
        return room_data
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

    update_data: dict[str, str | None] = {}
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


@handle_firestore_error("메시지 조회 실패")
async def get_message_by_id(message_id: str) -> MessageData | None:
    """
    메시지 ID로 단일 메시지 조회

    Args:
        message_id: 메시지 ID

    Returns:
        메시지 데이터 또는 None
    """
    db = get_firestore_client()
    doc = await db.collection(CHAT_MESSAGES_COLLECTION).document(message_id).get()

    if doc.exists:
        return doc.to_dict()  # type: ignore[return-value]
    return None


@handle_firestore_error("메시지 조회 실패")
async def get_messages_until(
    room_id: str,
    until_message_id: str,
    limit: int = 50,
) -> list[MessageData]:
    """
    특정 메시지까지의 히스토리 조회 (롤백 기능용)

    Args:
        room_id: 채팅방 ID
        until_message_id: 이 메시지까지 조회 (포함)
        limit: 최대 조회 개수

    Returns:
        메시지 목록 (오래된 순)
    """
    # 먼저 타겟 메시지 조회
    target_message = await get_message_by_id(until_message_id)
    if target_message is None:
        return []

    # room_id 검증
    if target_message.get("room_id") != room_id:
        return []

    target_timestamp = target_message.get("answer_created_at")

    db = get_firestore_client()
    query = (
        db.collection(CHAT_MESSAGES_COLLECTION)
        .where("room_id", "==", room_id)
        .where("answer_created_at", "<=", target_timestamp)
        .order_by("answer_created_at")
        .limit(limit)
    )

    docs = query.stream()
    return [doc.to_dict() async for doc in docs]  # type: ignore[misc]


@handle_firestore_error("메시지 페이지네이션 조회 실패")
async def get_messages_paginated(
    room_id: str,
    limit: int = 20,
    cursor: int | None = None,
    order: str = "desc",
) -> PaginatedMessages:
    """
    채팅방의 메시지 목록 페이지네이션 조회

    Args:
        room_id: 채팅방 ID
        limit: 페이지당 메시지 수 (기본 20, 최대 100)
        cursor: 페이지네이션 커서 (answer_created_at timestamp)
        order: 정렬 순서 ("asc" 또는 "desc", 기본 "desc" - 최신순)

    Returns:
        PaginatedMessages: 메시지 목록, 다음 커서, 더 있는지 여부, 총 개수
    """
    from google.cloud.firestore import Query

    db = get_firestore_client()
    limit = min(limit, 100)  # 최대 100개로 제한

    # 총 개수 조회 (Firestore count aggregation - 문서를 가져오지 않고 개수만 조회)
    count_query = db.collection(CHAT_MESSAGES_COLLECTION).where("room_id", "==", room_id)
    count_result = await count_query.count().get()
    total_count = count_result[0][0].value if count_result else 0

    # 정렬 방향 설정
    direction = Query.DESCENDING if order == "desc" else Query.ASCENDING

    # 기본 쿼리
    query = (
        db.collection(CHAT_MESSAGES_COLLECTION)
        .where("room_id", "==", room_id)
        .order_by("answer_created_at", direction=direction)
    )

    # 커서가 있으면 해당 시점 이후부터 조회
    if cursor is not None:
        if order == "desc":
            query = query.where("answer_created_at", "<", cursor)
        else:
            query = query.where("answer_created_at", ">", cursor)

    # limit + 1로 조회하여 다음 페이지 존재 여부 확인
    query = query.limit(limit + 1)

    docs = [doc.to_dict() async for doc in query.stream()]
    has_more = len(docs) > limit
    messages = docs[:limit]  # 실제 반환할 메시지

    # 다음 커서 설정
    next_cursor = None
    if has_more and messages:
        next_cursor = messages[-1]["answer_created_at"]

    return PaginatedMessages(
        messages=messages,  # type: ignore[typeddict-item]
        next_cursor=next_cursor,
        has_more=has_more,
        total_count=total_count,
    )


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
