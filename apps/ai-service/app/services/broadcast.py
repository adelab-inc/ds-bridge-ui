"""Supabase Realtime Broadcast 서비스.

Supabase Realtime REST API를 통해 broadcast 이벤트를 발행합니다.
httpx AsyncClient 싱글톤 패턴을 사용합니다.
"""

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_broadcast_client: httpx.AsyncClient | None = None
_active_broadcast_tasks: set[asyncio.Task] = set()


def get_broadcast_client() -> httpx.AsyncClient:
    """httpx AsyncClient 반환 (싱글톤, lazy 초기화)"""
    global _broadcast_client

    if _broadcast_client is None:
        settings = get_settings()
        _broadcast_client = httpx.AsyncClient(
            base_url=f"{settings.supabase_url}/realtime/v1/api",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(10.0),
        )
        logger.info("Broadcast client initialized")

    return _broadcast_client


async def close_broadcast_client() -> None:
    """Broadcast 클라이언트 정리 (서버 종료 시 호출)"""
    global _broadcast_client

    if _broadcast_client is not None:
        await _broadcast_client.aclose()
        _broadcast_client = None
        logger.info("Broadcast client closed")


async def broadcast_event(room_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Supabase Realtime broadcast 이벤트 발행.

    Args:
        room_id: 채팅방 ID
        event_type: 이벤트 이름 (e.g. "ai_response")
        payload: 이벤트 데이터
    """
    client = get_broadcast_client()

    body = {
        "messages": [
            {
                "topic": f"room:{room_id}",
                "event": event_type,
                "payload": payload,
            }
        ]
    }

    try:
        response = await client.post("/broadcast", json=body)
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error(
            "Broadcast HTTP error",
            extra={"room_id": room_id, "status": e.response.status_code, "body": e.response.text},
        )
        raise
    except httpx.RequestError as e:
        logger.error("Broadcast request error", extra={"room_id": room_id, "error": str(e)})
        raise


def track_broadcast_task(task: asyncio.Task) -> None:
    """백그라운드 broadcast 태스크를 추적 (GC 방지)"""
    _active_broadcast_tasks.add(task)
    task.add_done_callback(_active_broadcast_tasks.discard)


async def drain_broadcast_tasks(timeout: float = 30.0) -> None:
    """활성 broadcast 태스크를 대기 후 cancel (서버 종료 시 호출)"""
    if not _active_broadcast_tasks:
        return

    logger.info("Draining broadcast tasks", extra={"count": len(_active_broadcast_tasks)})

    done, pending = await asyncio.wait(_active_broadcast_tasks, timeout=timeout)

    for task in pending:
        task.cancel()
        logger.warning("Cancelled broadcast task", extra={"task": task.get_name()})

    if pending:
        await asyncio.wait(pending, timeout=5.0)

    logger.info("Broadcast tasks drained", extra={"done": len(done), "cancelled": len(pending)})
