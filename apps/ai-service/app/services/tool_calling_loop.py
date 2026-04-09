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
_PREFETCH_TIMEOUT = 60


async def _fetch_with_timeout(coro, label: str, timeout: float = 55.0):
    """개별 Figma 호출에 타임아웃 적용. 실패 시 None 반환."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except TimeoutError:
        logger.warning(f"Figma {label} timeout after {timeout}s")
        return None
    except Exception as e:
        logger.warning(f"Figma {label} error: {type(e).__name__}: {e}")
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
            if node_id:
                # Case A: node_id 있음 → 3개 모두 병렬
                page_result, detail_result, image_result = await asyncio.gather(
                    _fetch_with_timeout(
                        fetch_page_structure(file_key, node_id, max_retries=1),
                        "page_structure",
                    ),
                    _fetch_with_timeout(
                        fetch_node_detail(file_key, node_id, max_retries=1),
                        "node_detail",
                    ),
                    _fetch_with_timeout(
                        export_node_image(file_key, node_id, scale=0.5, image_format="jpg", max_retries=1),
                        "screenshot",
                    ),
                    return_exceptions=True,
                )

                # page_structure 결과 처리
                if page_result and not isinstance(page_result, Exception):
                    prefetch_info = json.dumps(
                        page_result, ensure_ascii=False, separators=(",", ":"),
                    )

                # node_detail 결과 처리
                if detail_result and not isinstance(detail_result, Exception):
                    node_details[node_id] = json.dumps(
                        detail_result, ensure_ascii=False, separators=(",", ":"),
                    )

                # screenshot 결과 처리
                if image_result and not isinstance(image_result, Exception):
                    screenshot_base64, screenshot_media_type = image_result

            else:
                # Case B: node_id 없음 → page_structure 먼저, 나머지 병렬
                page_result = await _fetch_with_timeout(
                    fetch_page_structure(file_key, node_id, max_retries=1),
                    "page_structure",
                )
                page_structure = page_result if page_result else {"frames": []}
                prefetch_info = json.dumps(
                    page_structure, ensure_ascii=False, separators=(",", ":"),
                )

                # page_structure에서 node_id 추출
                frames = page_structure.get("frames", [])
                target_node_id = frames[0].get("node_id") if frames else None

                if target_node_id:
                    detail_result, image_result = await asyncio.gather(
                        _fetch_with_timeout(
                            fetch_node_detail(file_key, target_node_id, max_retries=1),
                            "node_detail",
                        ),
                        _fetch_with_timeout(
                            export_node_image(file_key, target_node_id, scale=0.5, image_format="jpg", max_retries=1),
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
        "\n## 중요: Figma 기반 코드 생성 규칙\n"
        "1. 위 Figma 디자인 데이터"
        + ("와 스크린샷" if screenshot_base64 else "")
        + "를 분석하여 React 코드를 생성하세요.\n"
        "2. 페이지 이름, 컴포넌트 구성, 텍스트 내용은 반드시 Figma 데이터에서 추출하세요.\n"
        "3. 시스템 프롬프트의 layouts 섹션은 레이아웃 '패턴 참고용'일 뿐, Figma 디자인의 실제 내용과 무관합니다. "
        "layouts 섹션의 페이지명이나 데이터를 Figma 결과물에 사용하지 마세요.\n"
        "4. Figma 노드의 name, characters(텍스트) 필드를 정확히 반영하세요.\n"
        "\n### 레이아웃 필드 매핑\n"
        '- layout: "column" = flex-direction: column, "row" = flex-direction: row\n'
        "- gap: children 사이 간격 (px)\n"
        '- padding: CSS shorthand (예: "0 24" = 상하 0, 좌우 24)\n'
        "- w/h: 노드의 너비/높이 (px)\n"
        "\n### 시각 속성 매핑 (매우 중요)\n"
        "- fill: 배경색/텍스트색. 디자인 토큰명(예: 'primary/500')이면 해당 토큰 사용, hex 폴백이면 가장 가까운 디자인 시스템 색상으로 매핑\n"
        "- stroke + borderWidth: 테두리 색상 및 두께\n"
        "- borderRadius: 모서리 둥글기 (px)\n"
        "- opacity: 투명도 (0~1)\n"
        "- boxShadow: 그림자 효과\n"
        "- fill 값이 '/' 포함 시 디자인 토큰 경로 (예: 'neutral/100' → 시스템의 해당 토큰 사용)\n"
        "- fill 값이 '#' 시작 시 hex 폴백 → 디자인 시스템에서 가장 가까운 색상 토큰으로 매핑\n"
        "\n### 컴포넌트 매핑 (매우 중요)\n"
        "- type=INSTANCE인 노드의 component 필드가 실제 디자인 시스템 컴포넌트명입니다.\n"
        "- component 필드의 값을 시스템 프롬프트의 컴포넌트 목록에서 찾아 정확히 매핑하세요.\n"
        '  예: component="Button" → <Button>, component="TextField" → <TextField>\n'
        "- variant 필드는 컴포넌트의 props로 매핑하세요.\n"
        '  예: variant={"size":"sm","type":"tertiary"} → <Button size="sm" variant="tertiary">\n'
        "- fill 색상 토큰으로 컴포넌트의 color/variant prop을 결정하세요.\n"
        "\n### 절대 금지 규칙\n"
        "- Figma 데이터에 없는 UI 요소를 임의로 추가하지 마세요. (예: 체크박스 컬럼이 Figma에 없으면 DataGrid에 checkbox 넣지 마세요)\n"
        "- Figma 노드 트리에 존재하는 컴포넌트/요소만 코드에 포함하세요.\n"
        "- 뱃지/칩 색상은 반드시 Figma의 fill 값을 따르세요. 임의로 색상을 지정하지 마세요.\n"
        "- 필드 타입(Select vs TextField vs SearchField 등)은 Figma의 component 필드를 정확히 따르세요.\n"
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
