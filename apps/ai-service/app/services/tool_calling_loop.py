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
                # Case A: node_id 있음 → 3개 태스크 동시 시작, 빠른 것부터 결과 저장
                # ⚠️ gather를 쓰면 느린 태스크(node_detail)가 글로벌 타임아웃을
                # 유발해 이미 완료된 page_structure 결과까지 유실됨
                screenshot_task = asyncio.create_task(
                    _fetch_with_timeout(
                        export_node_image(file_key, node_id, scale=1, image_format="png", max_retries=2),
                        "screenshot",
                    )
                )
                page_task = asyncio.create_task(
                    _fetch_with_timeout(
                        fetch_page_structure(file_key, node_id, max_retries=2),
                        "page_structure",
                    )
                )
                detail_task = asyncio.create_task(
                    _fetch_with_timeout(
                        fetch_node_detail(file_key, node_id, max_depth=12, max_retries=2),
                        "node_detail",
                    )
                )

                # page_structure 먼저 대기 (depth=2, 보통 빠름) → 즉시 저장
                page_result = await page_task
                if page_result and not isinstance(page_result, Exception):
                    prefetch_info = json.dumps(
                        page_result, ensure_ascii=False, separators=(",", ":"),
                    )

                # 스크린샷: page_structure보다 빠르거나 비슷 → 즉시 대기
                try:
                    image_result = await screenshot_task
                    if image_result and not isinstance(image_result, Exception):
                        screenshot_base64, screenshot_media_type = image_result
                except Exception:
                    logger.warning("Screenshot task failed after structure data ready")

                # node_detail 대기 (depth=12, 느릴 수 있음) → 글로벌 타임아웃 시 스킵
                detail_result = await detail_task
                if detail_result and not isinstance(detail_result, Exception):
                    node_details[node_id] = json.dumps(
                        detail_result, ensure_ascii=False, separators=(",", ":"),
                    )

            else:
                # Case B: node_id 없음 → page_structure 먼저, 나머지 병렬
                page_result = await _fetch_with_timeout(
                    fetch_page_structure(file_key, node_id, max_retries=2),
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
                    screenshot_task = asyncio.create_task(
                        _fetch_with_timeout(
                            export_node_image(file_key, target_node_id, scale=1, image_format="png", max_retries=2),
                            "screenshot",
                        )
                    )
                    detail_result = await _fetch_with_timeout(
                        fetch_node_detail(file_key, target_node_id, max_depth=12, max_retries=2),
                        "node_detail",
                    )

                    if detail_result and not isinstance(detail_result, Exception):
                        node_details[target_node_id] = json.dumps(
                            detail_result, ensure_ascii=False, separators=(",", ":"),
                        )

                    # 스크린샷: node_detail 완료 후 추가 대기
                    try:
                        image_result = await screenshot_task
                        if image_result and not isinstance(image_result, Exception):
                            screenshot_base64, screenshot_media_type = image_result
                    except Exception:
                        logger.warning("Screenshot task failed after structure data ready")

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

        # AI에게 보낼 JSON에서 _y, _x 좌표 제거 (분석용 메타데이터)
        def _strip_coords(node: dict) -> None:
            node.pop("_y", None)
            node.pop("_x", None)
            node.pop("_w", None)
            node.pop("_h", None)
            for child in node.get("children", []):
                if isinstance(child, dict):
                    _strip_coords(child)

        try:
            clean_dict = json.loads(detail_json)
            _strip_coords(clean_dict)
            clean_json = json.dumps(clean_dict, ensure_ascii=False, separators=(",", ":"))
        except (json.JSONDecodeError, TypeError):
            clean_json = detail_json
        figma_context += f"\n- 노드({nid}) 레이아웃:\n```json\n{clean_json}\n```\n"
        logger.info("Figma node %s simplified JSON (len=%d)", nid, len(detail_json))
        # 디버그: INSTANCE 컴포넌트 variant 요약 로깅
        def _extract_instances(node: dict) -> list[str]:
            results = []
            if node.get("type") == "INSTANCE":
                comp = node.get("component", node.get("name", "?"))
                variant = node.get("variant", {})
                label = node.get("label", "")
                info = f"  {comp}: variant={variant}"
                if label:
                    info += f' label="{label}"'
                results.append(info)
            for c in node.get("children", []):
                if isinstance(c, dict):
                    results.extend(_extract_instances(c))
            return results
        try:
            instances = _extract_instances(json.loads(detail_json))
            if instances:
                logger.info("Figma INSTANCE variants:\n%s", "\n".join(instances))
        except Exception:
            pass
        # 디버그: Figma 트리 구조 로깅 (type, layout, children count/types)
        def _tree_structure(node: dict, depth: int = 0, max_depth: int = 5) -> list[str]:
            if depth > max_depth or not isinstance(node, dict):
                return []
            indent = "  " * depth
            ntype = node.get("type", "?")
            name = node.get("name", "")
            layout = node.get("layout", "")
            w = node.get("w", "")
            grid_hint = node.get("gridHint", "")
            comp = node.get("component", "")
            label = node.get("label", "")
            children = node.get("children", [])
            child_types = {}
            for c in children:
                if isinstance(c, dict):
                    ct = c.get("type", "?")
                    child_types[ct] = child_types.get(ct, 0) + 1
            child_summary = ", ".join(f"{v}×{k}" for k, v in child_types.items()) if child_types else ""
            parts = [f"{indent}{ntype}"]
            if name:
                parts[0] += f' "{name}"'
            if comp:
                parts[0] += f" ({comp})"
            if layout:
                parts[0] += f" [{layout}]"
            if w:
                parts[0] += f" w={w}"
            if label:
                parts[0] += f' label="{label}"'
            if grid_hint:
                parts[0] += f" gridHint={grid_hint}"
            if child_summary:
                parts[0] += f" → {child_summary}"
            lines = parts
            for c in children:
                if isinstance(c, dict):
                    lines.extend(_tree_structure(c, depth + 1, max_depth))
            return lines
        try:
            tree_lines = _tree_structure(json.loads(detail_json))
            if tree_lines:
                logger.info("Figma tree structure:\n%s", "\n".join(tree_lines))
        except Exception:
            pass
        # 디버그: 모든 FRAME의 gap/padding 요약 로깅
        def _extract_layout_summary(node: dict, path: str = "") -> list[str]:
            results = []
            name = node.get("name", "?")
            cur_path = f"{path}/{name}" if path else name
            gap = node.get("gap")
            padding = node.get("padding")
            layout = node.get("layout")
            h = node.get("h")
            grid_hint = node.get("gridHint")
            if gap or padding or grid_hint:
                parts = [cur_path]
                if layout:
                    parts.append(f"layout={layout}")
                if gap:
                    parts.append(f"gap={gap}")
                if padding:
                    parts.append(f"padding={padding}")
                if h:
                    parts.append(f"h={h}")
                if grid_hint:
                    parts.append(f"gridHint={grid_hint}")
                results.append(" | ".join(parts))
            for child in node.get("children", []):
                if isinstance(child, dict):
                    results.extend(_extract_layout_summary(child, cur_path))
            return results
        try:
            summary_lines = _extract_layout_summary(json.loads(detail_json))
            if summary_lines:
                logger.info("Figma layout summary:\n%s", "\n".join(summary_lines))
        except Exception:
            pass

    # 그리드 레이아웃 자동 분석 힌트 생성
    from app.services.figma_simplify import analyze_grid_hints, analyze_grid_layout_type

    for nid, detail_json in node_details.items():
        try:
            detail_dict = json.loads(detail_json)

            # 1) GridLayout type 자동 감지 (페이지 전체 레이아웃)
            layout_hint = analyze_grid_layout_type(detail_dict)
            if layout_hint:
                figma_context += layout_hint
                logger.info("GridLayout type hint for node %s:\n%s", nid, layout_hint)

            # 2) 폼 필드 그리드 분석 (FormGrid/grid-cols)
            grid_hints = analyze_grid_hints(detail_dict)
            if grid_hints:
                figma_context += grid_hints
                logger.info("Grid layout hints for node %s:\n%s", nid, grid_hints)
            else:
                logger.info("No grid hints detected for node %s", nid)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("Grid hint analysis failed for node %s: %s", nid, e)

    # Figma 모드 고유 규칙 (일반 규칙은 SYSTEM_PROMPT_HEADER/QUICK_REFERENCE 참조)
    figma_context += (
        "\n## Figma 디자인 우선 규칙\n"
        "1. INSTANCE `⚠️_RENDER` 필드를 그대로 매핑. "
        + ("스크린샷은 색상·간격 참고용, 컴포넌트 종류는 JSON 기준.\n" if screenshot_base64 else "Figma JSON이 절대적 기준.\n")
        + "2. Figma 노드의 name, characters(텍스트), 자식 수를 정확히 반영\n"
        "3. gap/padding은 JSON 값 그대로 변환 (gap:16→gap-4, 8→2). JSON에 없으면 추가 금지\n"
        "4. Figma에 없는 요소 추가 금지: 배경 래퍼, 임의 margin, Page wrapper(header/nav/footer)\n"
        "5. **hex 색상 하드코딩 절대 금지**: Figma JSON의 fill/stroke 값(#495057, #212529 등)을 text-[#xxx]로 변환하지 마세요. "
        "DS 컴포넌트는 자체 색상 토큰이 있으므로 className에 색상을 지정하지 않습니다. "
        "커스텀 영역도 Tailwind 시맨틱 클래스(text-gray-600 등)를 사용하세요.\n"
        "\n### Figma→Tailwind 변환\n"
        "- layout: column→flex-col, row→flex-row | justify: center→justify-center, space-between→justify-between\n"
        "- hSizing: fill→w-full, hug→w-auto | gap/padding: 4→1, 8→2, 12→3, 16→4, 20→5, 24→6, 32→8\n"
        "- GridLayout type: w 비율 기준 (6:6→B, 3:9→C, 4:4:4→E, 3:3:3:3→H)\n"
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

    # Figma 모드 최종 체크 (FINAL_REMINDER와 중복 제거)
    figma_context += (
        "\n## Figma 모드 최종 체크\n"
        "- ⚠️_RENDER 필드 준수 (Field↔Select 혼동 금지)\n"
        "- JSON에 없는 요소 제거 (배경 래퍼, 임의 margin, false 기본값 prop)\n"
        "- **text-[#xxx], bg-[#xxx] 등 hex 색상 임의값 사용 금지** — DS 토큰 또는 Tailwind 시맨틱 클래스 사용\n"
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
            async for chunk in provider.chat_vision_stream(messages, images):
                if first_chunk:
                    logger.info("First chunk received", extra={
                        "room_id": room_id,
                        "total_elapsed_s": round(time.monotonic() - t_start, 2),
                    })
                    first_chunk = False
                yield chunk
            return

    # 스크린샷 없거나 vision 미지원 → 텍스트 전용
    async for chunk in provider.chat_stream(messages):
        if first_chunk:
            logger.info("First chunk received", extra={
                "room_id": room_id,
                "total_elapsed_s": round(time.monotonic() - t_start, 2),
            })
            first_chunk = False
        yield chunk
