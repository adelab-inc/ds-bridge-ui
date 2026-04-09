"""Figma 디자인 → React 코드 스트리밍 생성 모듈.

Figma 데이터를 병렬 prefetch한 뒤, 단일 스트리밍 호출로 React 코드를 생성한다.
멀티턴 tool calling 대신 모든 데이터를 한 번에 수집하여 즉시 스트리밍하므로
첫 chunk가 빠르게 도달하여 타임아웃을 방지한다.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator

from app.services.ai_provider import AIProvider
from app.services.broadcast import broadcast_event
from app.services.figma_api import (
    export_node_image,
    fetch_node_detail,
    fetch_page_structure,
    parse_figma_url,
)
from app.schemas.chat import ImageContent, Message

logger = logging.getLogger(__name__)

# Figma prefetch 전체 타임아웃 (초) — 이 시간 안에 못 가져오면 가진 데이터로 진행
_PREFETCH_TIMEOUT = 15


async def _fetch_with_timeout(coro, label: str, timeout: float = 10.0):
    """개별 Figma 호출에 타임아웃 적용. 실패 시 None 반환."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except Exception as e:
        logger.warning(f"Figma {label} failed/timeout", extra={"error": str(e)})
        return None


async def run_figma_tool_calling_loop(
    *,
    room_id: str,
    provider: AIProvider,
    system_prompt: str,
    user_message: str,
    figma_url: str,
) -> AsyncGenerator[str, None]:
    """Figma 데이터 prefetch 후 단일 스트리밍으로 React 코드 생성.

    1. Prefetch: 페이지 구조 + 노드 상세 + 스크린샷 (최대 15초, 실패 시 스킵)
    2. Stream: 가용 데이터를 프롬프트에 포함하여 단일 스트리밍 호출

    Yields:
        스트리밍 텍스트 청크
    """
    t_start = time.monotonic()
    file_key, node_id = parse_figma_url(figma_url)

    await broadcast_event(room_id, "chunk", {
        "type": "status",
        "text": "Figma 디자인 데이터 로드 중...",
    })

    # ------------------------------------------------------------------
    # Prefetch (전체 15초 타임아웃 — 실패해도 가진 데이터로 진행)
    # ------------------------------------------------------------------
    prefetch_info = ""
    node_details: dict[str, str] = {}
    screenshot_base64 = ""
    screenshot_media_type = ""

    try:
        async with asyncio.timeout(_PREFETCH_TIMEOUT):
            # Phase 1: 페이지 구조
            page_result = await _fetch_with_timeout(
                fetch_page_structure(file_key, node_id),
                "page_structure",
            )
            page_structure = page_result if page_result else {"frames": []}
            prefetch_info = json.dumps(page_structure, ensure_ascii=False, separators=(",", ":"))

            # Phase 2: 노드 상세 + 스크린샷 (병렬, 개별 타임아웃)
            frames = page_structure.get("frames", [])
            target_node_id = node_id
            if not target_node_id and frames:
                target_node_id = frames[0].get("node_id")

            if target_node_id:
                # 노드 상세 (필수) + 스크린샷 (선택) 병렬
                detail_result, image_result = await asyncio.gather(
                    _fetch_with_timeout(
                        fetch_node_detail(file_key, target_node_id),
                        "node_detail",
                    ),
                    _fetch_with_timeout(
                        export_node_image(file_key, target_node_id, scale=1.0),
                        "screenshot",
                    ),
                    return_exceptions=True,
                )

                if detail_result and not isinstance(detail_result, Exception):
                    node_details[target_node_id] = json.dumps(
                        detail_result, ensure_ascii=False, separators=(",", ":"),
                    )

                if image_result and not isinstance(image_result, Exception):
                    screenshot_base64, screenshot_media_type = image_result

    except TimeoutError:
        logger.warning("Figma prefetch global timeout", extra={
            "room_id": room_id,
            "elapsed_s": round(time.monotonic() - t_start, 2),
        })

    t_prefetch = time.monotonic()
    logger.info("Figma prefetch done", extra={
        "room_id": room_id,
        "elapsed_s": round(t_prefetch - t_start, 2),
        "has_page_structure": bool(prefetch_info),
        "nodes_fetched": len(node_details),
        "has_screenshot": bool(screenshot_base64),
    })

    # ------------------------------------------------------------------
    # 시스템 프롬프트에 Figma 컨텍스트 추가
    # ------------------------------------------------------------------
    figma_context = f"\n\n## Figma 디자인 정보\n- URL: {figma_url}\n- File Key: {file_key}\n"

    if prefetch_info:
        figma_context += f"- 페이지 구조:\n```json\n{prefetch_info}\n```\n"

    for nid, detail_json in node_details.items():
        figma_context += f"\n- 노드({nid}) 레이아웃:\n```json\n{detail_json}\n```\n"

    figma_context += (
        "\n위 Figma 디자인 데이터"
        + ("와 스크린샷" if screenshot_base64 else "")
        + "를 분석하여 React 코드를 생성하세요."
    )

    full_system_prompt = system_prompt + figma_context

    # ------------------------------------------------------------------
    # 단일 스트리밍 호출 (thinking OFF)
    # ------------------------------------------------------------------
    await broadcast_event(room_id, "chunk", {
        "type": "status",
        "text": "React 코드 생성 중...",
    })

    messages = [
        Message(role="system", content=full_system_prompt),
        Message(role="user", content=user_message),
    ]

    first_chunk = True

    if screenshot_base64 and screenshot_media_type:
        images = [ImageContent(media_type=screenshot_media_type, data=screenshot_base64)]
        supports_vision = type(provider).chat_vision_stream is not AIProvider.chat_vision_stream
        if supports_vision:
            async for chunk in provider.chat_vision_stream(messages, images, disable_thinking=True):
                if first_chunk:
                    logger.info("First chunk received", extra={
                        "room_id": room_id,
                        "total_elapsed_s": round(time.monotonic() - t_start, 2),
                    })
                    first_chunk = False
                yield chunk
            return

    # 스크린샷 없거나 vision 미지원 → 텍스트 전용
    async for chunk in provider.chat_stream(messages, disable_thinking=True):
        if first_chunk:
            logger.info("First chunk received", extra={
                "room_id": room_id,
                "total_elapsed_s": round(time.monotonic() - t_start, 2),
            })
            first_chunk = False
        yield chunk
