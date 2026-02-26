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


async def broadcast_event(
    room_id: str,
    event_type: str,
    payload: dict[str, Any],
    *,
    max_retries: int = 3,
    base_delay: float = 0.5,
) -> None:
    """Supabase Realtime broadcast 이벤트 발행 (재시도 포함).

    Args:
        room_id: 채팅방 ID
        event_type: 이벤트 이름 (e.g. "ai_response")
        payload: 이벤트 데이터
        max_retries: 최대 재시도 횟수 (기본 3)
        base_delay: 재시도 간 기본 대기 시간(초), 지수 백오프 적용
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

    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            response = await client.post("/broadcast", json=body)
            response.raise_for_status()
            return
        except httpx.HTTPStatusError as e:
            last_error = e
            if e.response.status_code < 500:
                logger.error(
                    "Broadcast HTTP error (non-retryable)",
                    extra={"room_id": room_id, "status": e.response.status_code, "body": e.response.text},
                )
                raise
            logger.warning(
                "Broadcast HTTP error (retrying)",
                extra={"room_id": room_id, "status": e.response.status_code, "attempt": attempt + 1},
            )
        except httpx.RequestError as e:
            last_error = e
            logger.warning(
                "Broadcast request error (retrying)",
                extra={"room_id": room_id, "error": str(e), "attempt": attempt + 1},
            )

        if attempt < max_retries - 1:
            delay = base_delay * (2 ** attempt)
            await asyncio.sleep(delay)

    logger.error(
        "Broadcast failed after retries",
        extra={"room_id": room_id, "event_type": event_type, "max_retries": max_retries},
    )
    raise last_error  # type: ignore[misc]


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
