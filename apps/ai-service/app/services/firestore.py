import logging
import uuid
from datetime import datetime, timezone

from firebase_admin import firestore

from app.services.firebase_storage import init_firebase

logger = logging.getLogger(__name__)

# ============================================================================
# Firestore Client
# ============================================================================

_firestore_client = None


def get_firestore_client():
    """Firestore 클라이언트 반환 (싱글톤)"""
    global _firestore_client

    if _firestore_client is None:
        init_firebase()
        _firestore_client = firestore.client()
        logger.info("Firestore client initialized")

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
    """
    db = get_firestore_client()
    room_id = str(uuid.uuid4())

    room_data = {
        "id": room_id,
        "storybook_url": storybook_url,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    db.collection(CHAT_ROOMS_COLLECTION).document(room_id).set(room_data)
    logger.info("Chat room created: %s", room_id)

    return room_data


async def get_chat_room(room_id: str) -> dict | None:
    """
    채팅방 조회

    Args:
        room_id: 채팅방 ID

    Returns:
        채팅방 문서 또는 None
    """
    db = get_firestore_client()
    doc = db.collection(CHAT_ROOMS_COLLECTION).document(room_id).get()

    if doc.exists:
        return doc.to_dict()
    return None


# ============================================================================
# Chat Messages Operations
# ============================================================================


async def create_chat_message(
    room_id: str,
    msg_type: str,
    content: str = "",
    path: str = "",
    text: str = "",
    question_created_at: str | None = None,
    answer_completed: bool = False,
) -> dict:
    """
    새 채팅 메시지 생성

    Args:
        room_id: 채팅방 ID
        msg_type: 메시지 타입 (text, code, done, error)
        content: React 코드 내용
        path: 파일 경로
        text: 메시지 텍스트
        question_created_at: 질문 생성 시간
        answer_completed: 응답 완료 여부

    Returns:
        생성된 메시지 문서
    """
    db = get_firestore_client()
    message_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    message_data = {
        "id": message_id,
        "type": msg_type,
        "content": content,
        "path": path,
        "text": text,
        "room_id": room_id,
        "question_created_at": question_created_at or now,
        "answer_created_at": now,
        "answer_completed": answer_completed,
    }

    db.collection(CHAT_MESSAGES_COLLECTION).document(message_id).set(message_data)
    logger.debug("Chat message created: %s (type: %s)", message_id, msg_type)

    return message_data


async def get_messages_by_room(room_id: str, limit: int = 100) -> list[dict]:
    """
    채팅방의 메시지 목록 조회

    Args:
        room_id: 채팅방 ID
        limit: 최대 조회 개수

    Returns:
        메시지 목록
    """
    db = get_firestore_client()
    docs = (
        db.collection(CHAT_MESSAGES_COLLECTION)
        .where("room_id", "==", room_id)
        .order_by("answer_created_at")
        .limit(limit)
        .stream()
    )

    return [doc.to_dict() for doc in docs]
