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


def _strip_title_frame_buttons(node: dict) -> None:
    """Title FRAME 내부의 Button INSTANCE를 JSON에서 제거 (in-place).

    페이지 템플릿의 기본 슬롯 버튼(신계약등록2/3, 이미지시스템 등)이
    모든 페이지에 동일하게 나타나므로 AI 프롬프트에서 제거한다.
    """
    ntype = node.get("type", "")
    name = node.get("name", "")

    if ntype == "FRAME" and name.lower() == "title":
        # Title FRAME의 children에서 Button INSTANCE 제거
        children = node.get("children", [])
        node["children"] = [
            c for c in children
            if not (
                isinstance(c, dict)
                and c.get("type") == "INSTANCE"
                and (c.get("component", "") or c.get("name", "")).lower() == "button"
            )
        ]
        # 남은 children의 하위도 재귀 처리 (중첩 FRAME 안의 Button)
        for child in node["children"]:
            if isinstance(child, dict):
                _strip_title_buttons_recursive(child)
        return

    for child in node.get("children", []):
        if isinstance(child, dict):
            _strip_title_frame_buttons(child)


def _strip_title_buttons_recursive(node: dict) -> None:
    """Title FRAME 하위의 모든 Button INSTANCE를 재귀적으로 제거."""
    children = node.get("children", [])
    node["children"] = [
        c for c in children
        if not (
            isinstance(c, dict)
            and c.get("type") == "INSTANCE"
            and (c.get("component", "") or c.get("name", "")).lower() == "button"
        )
    ]
    for child in node["children"]:
        if isinstance(child, dict):
            _strip_title_buttons_recursive(child)


async def _save_usage_map_background(usage_map: dict, room_id: str) -> None:
    """컴포넌트 사용 패턴을 Supabase에 비동기 저장 (fire-and-forget)."""
    try:
        from app.services.supabase_storage import save_component_usage_map
        await save_component_usage_map(usage_map)
        logger.info("Component usage map saved", extra={"room_id": room_id})
    except Exception as e:
        logger.warning(f"Failed to save usage map: {e}", extra={"room_id": room_id})


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
                        export_node_image(file_key, node_id, scale=1, image_format="png", max_retries=1),
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
                            export_node_image(file_key, target_node_id, scale=1, image_format="png", max_retries=1),
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
        # Title FRAME 내부 Button 제거 (페이지 템플릿 기본 슬롯 콘텐츠)
        try:
            detail_dict_raw = json.loads(detail_json)
            _strip_title_frame_buttons(detail_dict_raw)
            detail_json = json.dumps(detail_dict_raw, ensure_ascii=False, separators=(",", ":"))
            node_details[nid] = detail_json  # 인벤토리에서도 stripped 데이터 사용
        except (json.JSONDecodeError, TypeError):
            pass
        figma_context += f"\n- 노드({nid}) 레이아웃:\n```json\n{detail_json}\n```\n"

    figma_context += (
        "\n## ⚠️ Figma 모드 — 아래 규칙이 시스템 프롬프트의 일반 규칙보다 우선합니다\n"
        "1. "
        + ("**스크린샷이 최우선 기준.** 스크린샷을 보고 픽셀 단위로 동일하게 재현하세요. JSON은 보조 참고용.\n" if screenshot_base64 else "Figma 데이터가 절대적 기준.\n")
        + "2. **Page wrapper(header, nav, sidebar, footer, logo, 검색창) 생성 금지.** "
        "Figma 트리 최상위 노드부터 바로 시작하세요. Visual Standards의 Page/Container 템플릿은 무시.\n"
        "3. **Mock Data**: Figma에 보이는 텍스트·행 수를 그대로 반영. 시스템 프롬프트의 10건 이상 규칙은 Figma 모드에서 무시.\n"
        "4. 아래 인벤토리의 JSX를 props/variant 참고용으로 사용. Figma에 보이는 UI는 자유롭게 생성.\n"
        "   - **TitleSection children에 신계약등록2/3·이미지시스템 버튼 금지** (매 페이지 반복 템플릿 슬롯이므로 제외됨).\n"
        "5. name/characters(텍스트) 필드를 정확히 반영.\n"
        "6. **calendar 아이콘 Select → Field 변환**: 인벤토리에서 calendar 아이콘이 달린 Select는 "
        "날짜 입력 필드입니다. `<Field startIcon={<Icon name=\"calendar\" />}>` 로 변환하세요. Select 드롭다운 금지.\n"
        "7. **FilterBar**: DataGrid 위에 검색/필터용 Select·Field가 있으면(조회형 RP-1) "
        "`<FilterBar mode=\"compact\" onReset={() => {}} onSearch={() => {}} actionSpan={N}>`로 감싸세요.\n"
        "   - Figma 레이아웃을 따름. **필드가 한 줄이면 한 줄로 배치.** "
        "각 필드 `<div className=\"col-span-N\">`로 래핑. Figma w(너비)가 넓으면 col-span-2, 좁으면 col-span-1.\n"
        "   - **필드 col-span 합 + actionSpan = 12** (한 행). actionSpan은 최소 2.\n"
        "   - 초기화(tertiary)/조회(primary) 버튼은 FilterBar가 자동 렌더링하므로 **별도 Button 배치 금지**.\n"
        "\n### Figma 필드 → Tailwind 매핑\n"
        '- layout: "column"→flex-col, "row"→flex-row | gap/padding: px÷4=Tailwind (12→gap-3, 24→gap-6)\n'
        "- w/h: 고정→w-[Npx], FILL→w-full | borderRadius: 4→rounded, 8→rounded-lg, 9999→rounded-full\n"
        "- fill: FRAME→bg-[hex] | stroke→border-[hex] | opacity: ×100 (0.5→opacity-50)\n"
    )

    # 컴포넌트 인벤토리 (recency bias 활용 — figma_context 맨 마지막에 배치)
    from app.api.components import extract_component_usage_summary, extract_component_usage_map

    for detail_json in node_details.values():
        try:
            detail_dict = json.loads(detail_json)
            usage_summary = extract_component_usage_summary(detail_dict)
            if usage_summary:
                figma_context += f"\n{usage_summary}\n"
                logger.info("Component inventory:\n%s", usage_summary)

            # 컴포넌트 사용 패턴을 Supabase에 비동기 저장 (텍스트 모드에서 참조용)
            usage_map = extract_component_usage_map(detail_dict)
            if usage_map:
                asyncio.create_task(_save_usage_map_background(usage_map, room_id))
        except (json.JSONDecodeError, TypeError):
            pass

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
