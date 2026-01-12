import logging
import time
import uuid

from firebase_admin import firestore

from app.services.firebase_storage import init_firebase


def get_timestamp_ms() -> str:
    """현재 시간을 밀리초 단위 timestamp 문자열로 반환"""
    return str(int(time.time() * 1000))

logger = logging.getLogger(__name__)


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
# Firestore Client
# ============================================================================

_firestore_client = None


def get_firestore_client():
    """Firestore 클라이언트 반환 (싱글톤)"""
    global _firestore_client

    if _firestore_client is None:
        try:
            init_firebase()
            _firestore_client = firestore.client()
            logger.info("Firestore client initialized")
        except Exception as e:
            logger.error("Failed to initialize Firestore client: %s", str(e))
            raise FirestoreError(f"Firestore 초기화 실패: {str(e)}") from e

    return _firestore_client


# ============================================================================
# Collection Names
# ============================================================================

CHAT_ROOMS_COLLECTION = "chat_rooms"
CHAT_MESSAGES_COLLECTION = "chat_messages"


# ============================================================================
# Chat Rooms Operations
# ============================================================================


async def create_chat_room(storybook_url: str, user_id: str) -> dict:
    """
    새 채팅방 생성

    Args:
        storybook_url: Storybook URL
        user_id: 사용자 ID

    Returns:
        생성된 채팅방 문서

    Raises:
        FirestoreError: Firestore 작업 실패
    """
    try:
        db = get_firestore_client()
        room_id = str(uuid.uuid4())

        room_data = {
            "id": room_id,
            "storybook_url": storybook_url,
            "user_id": user_id,
            "created_at": get_timestamp_ms(),
        }

        db.collection(CHAT_ROOMS_COLLECTION).document(room_id).set(room_data)
        logger.info("Chat room created: %s", room_id)

        return room_data
    except FirestoreError:
        raise
    except Exception as e:
        logger.error("Failed to create chat room: %s", str(e))
        raise FirestoreError(f"채팅방 생성 실패: {str(e)}") from e


async def get_chat_room(room_id: str) -> dict | None:
    """
    채팅방 조회

    Args:
        room_id: 채팅방 ID

    Returns:
        채팅방 문서 또는 None

    Raises:
        FirestoreError: Firestore 작업 실패
    """
    try:
        db = get_firestore_client()
        doc = db.collection(CHAT_ROOMS_COLLECTION).document(room_id).get()

        if doc.exists:
            return doc.to_dict()
        return None
    except FirestoreError:
        raise
    except Exception as e:
        logger.error("Failed to get chat room %s: %s", room_id, str(e))
        raise FirestoreError(f"채팅방 조회 실패: {str(e)}") from e


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


# ============================================================================
# Chat Messages Operations
# ============================================================================


async def create_chat_message(
    room_id: str,
    text: str = "",
    content: str = "",
    path: str = "",
    question_created_at: str | None = None,
    status: str = "DONE",
) -> dict:
    """
    새 채팅 메시지 생성

    Args:
        room_id: 채팅방 ID
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
    try:
        db = get_firestore_client()
        message_id = str(uuid.uuid4())
        now = get_timestamp_ms()

        message_data = {
            "id": message_id,
            "text": text,
            "content": content,
            "path": path,
            "room_id": room_id,
            "question_created_at": question_created_at or now,
            "answer_created_at": now,
            "status": status,
        }

        db.collection(CHAT_MESSAGES_COLLECTION).document(message_id).set(message_data)
        logger.debug("Chat message created: %s", message_id)

        return message_data
    except FirestoreError:
        raise
    except Exception as e:
        logger.error("Failed to create chat message: %s", str(e))
        raise FirestoreError(f"메시지 저장 실패: {str(e)}") from e


async def get_messages_by_room(room_id: str, limit: int = 100) -> list[dict]:
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
    try:
        db = get_firestore_client()
        docs = (
            db.collection(CHAT_MESSAGES_COLLECTION)
            .where("room_id", "==", room_id)
            .order_by("answer_created_at")
            .limit(limit)
            .stream()
        )

        return [doc.to_dict() for doc in docs]
    except FirestoreError:
        raise
    except Exception as e:
        logger.error("Failed to get messages for room %s: %s", room_id, str(e))
        raise FirestoreError(f"메시지 조회 실패: {str(e)}") from e


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
    try:
        db = get_firestore_client()

        update_data = {"answer_created_at": get_timestamp_ms()}
        if text is not None:
            update_data["text"] = text
        if content is not None:
            update_data["content"] = content
        if path is not None:
            update_data["path"] = path
        if status is not None:
            update_data["status"] = status

        db.collection(CHAT_MESSAGES_COLLECTION).document(message_id).update(update_data)
        logger.debug("Chat message updated: %s", message_id)
    except FirestoreError:
        raise
    except Exception as e:
        logger.error("Failed to update chat message %s: %s", message_id, str(e))
        raise FirestoreError(f"메시지 업데이트 실패: {str(e)}") from e
