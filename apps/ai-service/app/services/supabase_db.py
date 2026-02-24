import asyncio
import logging
import time
import uuid
from collections.abc import Callable, Coroutine
from functools import wraps
from typing import Any, Literal, ParamSpec, TypedDict, TypeVar

from supabase import acreate_client, AsyncClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Default schema key for rooms without one
DEFAULT_SCHEMA_KEY = "exports/default/component-schema.json"


# ============================================================================
# Type Definitions
# ============================================================================

# 메시지 상태 타입
MessageStatus = Literal["GENERATING", "DONE", "ERROR"]


class RoomData(TypedDict, total=False):
    """채팅방 문서 타입"""

    id: str
    storybook_url: str | None
    schema_key: str | None
    user_id: str
    created_at: int


class MessageData(TypedDict, total=False):
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
    image_urls: list[str]  # Vision 모드에서 사용된 이미지 URL 목록


class PaginatedMessages(TypedDict):
    """페이지네이션된 메시지 응답"""

    messages: list[MessageData]
    next_cursor: int | None
    has_more: bool
    total_count: int


def get_timestamp_ms() -> int:
    """현재 시간을 밀리초 단위 timestamp로 반환"""
    return int(time.time() * 1000)


# ============================================================================
# Custom Exceptions
# ============================================================================


class DatabaseError(Exception):
    """데이터베이스 작업 실패 예외"""

    pass


class RoomNotFoundError(Exception):
    """채팅방을 찾을 수 없음"""

    pass


# ============================================================================
# Error Handling Decorator
# ============================================================================

P = ParamSpec("P")
T = TypeVar("T")


def handle_db_error(
    error_message: str,
) -> Callable[[Callable[P, Coroutine[Any, Any, T]]], Callable[P, Coroutine[Any, Any, T]]]:
    """
    데이터베이스 작업의 예외를 일관되게 처리하는 데코레이터

    Args:
        error_message: 에러 발생 시 사용할 메시지

    Usage:
        @handle_db_error("채팅방 생성 실패")
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
            except (DatabaseError, RoomNotFoundError):
                raise
            except Exception as e:
                logger.error(error_message, extra={"error": str(e)})
                raise DatabaseError(f"{error_message}: {str(e)}") from e

        return wrapper

    return decorator


# ============================================================================
# Async Supabase Client
# ============================================================================

_supabase_client: AsyncClient | None = None


async def get_supabase_client() -> AsyncClient:
    """비동기 Supabase 클라이언트 반환 (싱글톤)"""
    global _supabase_client

    if _supabase_client is None:
        settings = get_settings()

        try:
            _supabase_client = await acreate_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
            logger.info("Supabase client initialized", extra={"url": settings.supabase_url})
        except Exception as e:
            logger.error("Supabase initialization failed", extra={"error": str(e)})
            raise DatabaseError(f"Supabase 초기화 실패: {str(e)}") from e

    return _supabase_client


async def close_supabase_client() -> None:
    """Supabase 클라이언트 정리 (서버 종료 시 호출)"""
    global _supabase_client

    if _supabase_client is not None:
        _supabase_client = None
        logger.info("Supabase client closed")


# ============================================================================
# Sort Order Type
# ============================================================================

SortOrder = Literal["asc", "desc"]


# ============================================================================
# Chat Rooms Operations
# ============================================================================


@handle_db_error("채팅방 생성 실패")
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
        DatabaseError: DB 작업 실패
    """
    client = await get_supabase_client()
    room_id = str(uuid.uuid4())

    room_data: RoomData = {
        "id": room_id,
        "storybook_url": storybook_url,
        "schema_key": DEFAULT_SCHEMA_KEY,
        "user_id": user_id,
        "created_at": get_timestamp_ms(),
    }

    await client.table("chat_rooms").insert(room_data).execute()
    logger.info("Chat room created", extra={"room_id": room_id, "user_id": user_id})

    return room_data


@handle_db_error("채팅방 조회 실패")
async def get_chat_room(room_id: str) -> RoomData | None:
    """
    채팅방 조회

    Args:
        room_id: 채팅방 ID

    Returns:
        채팅방 문서 또는 None

    Raises:
        DatabaseError: DB 작업 실패
    """
    client = await get_supabase_client()
    result = await client.table("chat_rooms").select("*").eq("id", room_id).maybe_single().execute()

    if result and result.data:
        room_data: RoomData = result.data  # type: ignore[assignment]
        # 기존 방에 schema_key가 없으면 기본값 설정
        if room_data.get("schema_key") is None:
            room_data["schema_key"] = DEFAULT_SCHEMA_KEY
        return room_data
    return None


@handle_db_error("채팅방 업데이트 실패")
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
        schema_key: Storage 스키마 경로 (선택)

    Returns:
        업데이트된 채팅방 문서

    Raises:
        RoomNotFoundError: 채팅방을 찾을 수 없음
        DatabaseError: DB 작업 실패
    """
    # 먼저 존재 여부 확인
    room = await get_chat_room(room_id)
    if room is None:
        raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {room_id}")

    client = await get_supabase_client()

    update_data: dict[str, str | None] = {}
    if storybook_url is not None:
        update_data["storybook_url"] = storybook_url
    if schema_key is not None:
        update_data["schema_key"] = schema_key

    if update_data:
        await client.table("chat_rooms").update(update_data).eq("id", room_id).execute()
        logger.info("Chat room updated", extra={"room_id": room_id, "fields": list(update_data.keys())})

    # 업데이트된 문서 반환
    updated_room = await get_chat_room(room_id)
    return updated_room  # type: ignore[return-value]


# ============================================================================
# Chat Messages Operations
# ============================================================================


@handle_db_error("메시지 저장 실패")
async def create_chat_message(
    room_id: str,
    question: str = "",
    text: str = "",
    content: str = "",
    path: str = "",
    question_created_at: int | None = None,
    status: MessageStatus = "DONE",
    image_urls: list[str] | None = None,
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
        image_urls: Vision 모드에서 사용된 이미지 URL 목록

    Returns:
        생성된 메시지 문서

    Raises:
        DatabaseError: DB 작업 실패
    """
    client = await get_supabase_client()
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

    # 이미지 URL이 있으면 추가
    if image_urls:
        message_data["image_urls"] = image_urls

    await client.table("chat_messages").insert(message_data).execute()
    logger.debug("Chat message created", extra={"message_id": message_id, "room_id": room_id})

    return message_data


@handle_db_error("메시지 조회 실패")
async def get_messages_by_room(room_id: str, limit: int = 100) -> list[MessageData]:
    """
    채팅방의 메시지 목록 조회

    Args:
        room_id: 채팅방 ID
        limit: 최대 조회 개수

    Returns:
        메시지 목록

    Raises:
        DatabaseError: DB 작업 실패
    """
    client = await get_supabase_client()
    result = await (
        client.table("chat_messages")
        .select("*")
        .eq("room_id", room_id)
        .order("answer_created_at")
        .limit(limit)
        .execute()
    )
    return result.data  # type: ignore[return-value]


@handle_db_error("메시지 조회 실패")
async def get_message_by_id(message_id: str) -> MessageData | None:
    """
    메시지 ID로 단일 메시지 조회

    Args:
        message_id: 메시지 ID

    Returns:
        메시지 데이터 또는 None
    """
    client = await get_supabase_client()
    result = await (
        client.table("chat_messages")
        .select("*")
        .eq("id", message_id)
        .maybe_single()
        .execute()
    )
    return result.data  # type: ignore[return-value]


@handle_db_error("메시지 조회 실패")
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

    client = await get_supabase_client()
    result = await (
        client.table("chat_messages")
        .select("*")
        .eq("room_id", room_id)
        .lte("answer_created_at", target_timestamp)
        .order("answer_created_at")
        .limit(limit)
        .execute()
    )
    return result.data  # type: ignore[return-value]


@handle_db_error("메시지 페이지네이션 조회 실패")
async def get_messages_paginated(
    room_id: str,
    limit: int = 20,
    cursor: int | None = None,
    order: SortOrder = "desc",
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
    limit = min(limit, 100)  # 최대 100개로 제한
    client = await get_supabase_client()

    # 병렬 실행: count 쿼리와 데이터 쿼리를 동시에
    async def get_count() -> int:
        result = await (
            client.table("chat_messages")
            .select("id", count="exact")
            .eq("room_id", room_id)
            .limit(1)
            .execute()
        )
        return result.count or 0

    async def get_docs() -> list[dict]:
        query = (
            client.table("chat_messages")
            .select("*")
            .eq("room_id", room_id)
        )

        # 커서가 있으면 해당 시점 이후부터 조회
        if cursor is not None:
            if order == "desc":
                query = query.lt("answer_created_at", cursor)
            else:
                query = query.gt("answer_created_at", cursor)

        query = query.order("answer_created_at", desc=(order == "desc"))

        # limit + 1로 조회하여 다음 페이지 존재 여부 확인
        query = query.limit(limit + 1)

        result = await query.execute()
        return result.data

    total_count, docs = await asyncio.gather(get_count(), get_docs())

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


@handle_db_error("메시지 업데이트 실패")
async def update_chat_message(
    message_id: str,
    text: str | None = None,
    content: str | None = None,
    path: str | None = None,
    status: MessageStatus | None = None,
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
        DatabaseError: DB 작업 실패
    """
    client = await get_supabase_client()

    update_data: dict[str, str | int] = {"answer_created_at": get_timestamp_ms()}
    if text is not None:
        update_data["text"] = text
    if content is not None:
        update_data["content"] = content
    if path is not None:
        update_data["path"] = path
    if status is not None:
        update_data["status"] = status

    await client.table("chat_messages").update(update_data).eq("id", message_id).execute()
    logger.debug("Chat message updated", extra={"message_id": message_id, "fields": list(update_data.keys())})


@handle_db_error("유저별 방 목록 조회 실패")
async def list_rooms_by_user(
    user_id: str,
    limit: int = 50,
    cursor: int | None = None,
) -> dict:
    """
    유저의 채팅방 목록을 최신순으로 조회

    Args:
        user_id: 사용자 ID
        limit: 페이지당 개수 (기본 50, 최대 100)
        cursor: 페이지네이션 커서 (created_at timestamp)

    Returns:
        {"rooms": [...], "next_cursor": int|None, "has_more": bool}
    """
    limit = min(limit, 100)
    client = await get_supabase_client()

    query = client.table("chat_rooms").select("*").eq("user_id", user_id)

    if cursor is not None:
        query = query.lt("created_at", cursor)

    query = query.order("created_at", desc=True).limit(limit + 1)
    result = await query.execute()

    docs = result.data
    has_more = len(docs) > limit
    rooms = docs[:limit]

    next_cursor = None
    if has_more and rooms:
        next_cursor = rooms[-1]["created_at"]

    return {"rooms": rooms, "next_cursor": next_cursor, "has_more": has_more}


@handle_db_error("채팅방 삭제 실패")
async def delete_chat_room(room_id: str) -> bool:
    """
    채팅방 삭제 (CASCADE로 메시지도 함께 삭제됨)

    Args:
        room_id: 채팅방 ID

    Returns:
        True if deleted, False if not found
    """
    client = await get_supabase_client()
    result = await client.table("chat_rooms").delete().eq("id", room_id).execute()
    deleted = len(result.data) > 0
    if deleted:
        logger.info("Chat room deleted", extra={"room_id": room_id})
    return deleted


@handle_db_error("메시지 삭제 실패")
async def delete_chat_message(message_id: str) -> bool:
    """
    개별 메시지 삭제

    Args:
        message_id: 메시지 ID

    Returns:
        True if deleted, False if not found
    """
    client = await get_supabase_client()
    result = await client.table("chat_messages").delete().eq("id", message_id).execute()
    deleted = len(result.data) > 0
    if deleted:
        logger.info("Chat message deleted", extra={"message_id": message_id})
    return deleted
