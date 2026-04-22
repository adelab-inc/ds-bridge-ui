"""Figma REST API 래퍼.

Figma Personal Access Token(PAT) 기반으로 파일/노드/이미지 데이터를 가져온다.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import re
import time
from urllib.parse import unquote, urlparse, parse_qs

import httpx

from app.core.config import get_settings
from app.services.figma_simplify import simplify_component_props, simplify_node

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.figma.com/v1"


class FigmaRateLimitError(Exception):
    """Figma REST API 429 한도 소진 (재시도 이후에도 지속).

    프론트엔드에 전용 모달을 띄우기 위해 broadcast payload에
    `error_code: "figma_rate_limit"`로 전달하는 신호로 사용된다.
    """

# 재시도 설정
_MAX_RETRIES = 3
_BASE_DELAY = 1.0

# Figma API 동시 요청 제한 (429 방지)
_figma_semaphore = asyncio.Semaphore(3)

# 공유 httpx 클라이언트 (커넥션 재사용 → DNS/TLS 핸드셰이크 절약)
_shared_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(
            timeout=httpx.Timeout(50.0, connect=15.0),
            limits=httpx.Limits(max_connections=5, max_keepalive_connections=3),
        )
    return _shared_client


# ---------------------------------------------------------------------------
# URL 파싱
# ---------------------------------------------------------------------------


_FIGMA_URL_PATTERN = re.compile(
    r"https?://(?:www\.)?figma\.com/(?:design|file)/[A-Za-z0-9]+[^\s)\"'>]*"
)

_FIGMA_KEYWORDS = re.compile(r"피그마|figma", re.IGNORECASE)


def extract_figma_url(text: str) -> str | None:
    """메시지 텍스트에서 Figma URL을 자동 감지.

    1. 메시지에 Figma URL이 있으면 그걸 사용
    2. URL은 없지만 '피그마'/'figma' 키워드가 있으면 설정된 기본 URL 사용
    3. 둘 다 없으면 None
    """
    match = _FIGMA_URL_PATTERN.search(text)
    if match:
        return match.group(0)

    # 키워드 감지 → 기본 디자인시스템 URL 폴백
    if _FIGMA_KEYWORDS.search(text):
        default_url = get_settings().figma_design_system_url
        if default_url:
            return default_url

    return None


def parse_figma_url(url: str) -> tuple[str, str | None]:
    """Figma URL에서 (file_key, node_id) 추출.

    지원 URL 형식:
    - https://www.figma.com/design/<file_key>/<title>?node-id=<node_id>
    - https://www.figma.com/file/<file_key>/...
    - https://www.figma.com/design/<file_key>/...

    Returns:
        (file_key, node_id) — node_id는 없으면 None
    """
    parsed = urlparse(url)
    path_parts = [p for p in parsed.path.split("/") if p]

    # /design/<key>/... 또는 /file/<key>/...
    if len(path_parts) < 2 or path_parts[0] not in ("design", "file"):
        raise ValueError(f"Invalid Figma URL: {url}")

    file_key = path_parts[1]

    # node-id 쿼리 파라미터
    qs = parse_qs(parsed.query)
    node_id_raw = qs.get("node-id", [None])[0]

    node_id: str | None = None
    if node_id_raw:
        # URL 인코딩된 경우 디코드 (예: 123%3A456 → 123:456)
        node_id = unquote(node_id_raw).replace("-", ":")

    return file_key, node_id


# ---------------------------------------------------------------------------
# HTTP 클라이언트
# ---------------------------------------------------------------------------


def _get_headers() -> dict[str, str]:
    token = get_settings().figma_personal_access_token
    if not token:
        raise RuntimeError("FIGMA_PERSONAL_ACCESS_TOKEN이 설정되지 않았습니다")
    return {"X-FIGMA-TOKEN": token}


async def _figma_get(path: str, params: dict | None = None, *, max_retries: int | None = None) -> dict:
    """Figma API GET 요청 (세마포어 + 재시도 + 429 백오프)."""
    headers = _get_headers()
    last_error: Exception | None = None
    retries = max_retries if max_retries is not None else _MAX_RETRIES
    client = _get_client()

    async with _figma_semaphore:
        for attempt in range(retries):
            t0 = time.monotonic()
            try:
                resp = await client.get(f"{_BASE_URL}{path}", headers=headers, params=params)

                elapsed = round(time.monotonic() - t0, 2)
                logger.info(f"Figma API {path} responded", extra={
                    "status": resp.status_code,
                    "elapsed_s": elapsed,
                    "attempt": attempt + 1,
                    "size_bytes": len(resp.content),
                })

                if resp.status_code == 429:
                    # 마지막 attempt에서 429면 더 기다리지 말고 rate limit 예외로 종료
                    if attempt >= retries - 1:
                        logger.error(
                            "Figma rate limit exhausted",
                            extra={"path": path, "attempts": retries},
                        )
                        raise FigmaRateLimitError(
                            f"Figma rate limit exhausted after {retries} attempts: {path}"
                        )
                    retry_after = float(resp.headers.get("Retry-After", _BASE_DELAY * (2 ** attempt)))
                    logger.warning("Figma rate limited, retrying", extra={"retry_after": retry_after, "attempt": attempt + 1})
                    await asyncio.sleep(retry_after)
                    continue

                resp.raise_for_status()
                return resp.json()

            except httpx.ConnectTimeout as e:
                last_error = e
                elapsed = round(time.monotonic() - t0, 2)
                logger.error(f"Figma API {path} CONNECT timeout (네트워크 문제)", extra={"elapsed_s": elapsed, "attempt": attempt + 1})
            except httpx.ReadTimeout as e:
                last_error = e
                elapsed = round(time.monotonic() - t0, 2)
                logger.warning(f"Figma API {path} READ timeout (응답 지연)", extra={"elapsed_s": elapsed, "attempt": attempt + 1})
            except httpx.HTTPStatusError as e:
                last_error = e
                elapsed = round(time.monotonic() - t0, 2)
                if e.response.status_code < 500:
                    logger.warning(f"Figma API {path} client error", extra={"status": e.response.status_code, "elapsed_s": elapsed})
                    raise
                logger.warning("Figma API error (retrying)", extra={"status": e.response.status_code, "elapsed_s": elapsed, "attempt": attempt + 1})
            except httpx.RequestError as e:
                last_error = e
                elapsed = round(time.monotonic() - t0, 2)
                logger.warning(f"Figma API {path} request error", extra={"error": str(e), "elapsed_s": elapsed, "attempt": attempt + 1})

            if attempt < retries - 1:
                await asyncio.sleep(_BASE_DELAY * (2 ** attempt))

    raise last_error  # type: ignore[misc]


# ---------------------------------------------------------------------------
# API 함수들
# ---------------------------------------------------------------------------


async def fetch_page_structure(file_key: str, node_id: str | None = None, *, max_retries: int = 3) -> dict:
    """최상위 프레임 목록을 가져온다.

    node_id가 주어지면 해당 노드의 자식 프레임만, 없으면 첫 페이지의 프레임 목록.

    Returns:
        {"frames": [{"name": "...", "node_id": "...", "type": "..."}, ...]}
    """
    if node_id:
        data = await _figma_get(f"/files/{file_key}/nodes", params={"ids": node_id, "depth": "2"}, max_retries=max_retries)
        nodes = data.get("nodes", {})
        target = nodes.get(node_id, {}).get("document", {})
    else:
        data = await _figma_get(f"/files/{file_key}", params={"depth": "2"}, max_retries=max_retries)
        # 첫 번째 페이지
        pages = data.get("document", {}).get("children", [])
        target = pages[0] if pages else {}

    frames = []
    for child in target.get("children", []):
        frames.append({
            "name": child.get("name", ""),
            "node_id": child.get("id", ""),
            "type": child.get("type", ""),
        })

    return {"name": target.get("name", ""), "frames": frames}


async def fetch_node_detail(file_key: str, node_id: str, *, max_depth: int = 8, max_retries: int = 3) -> dict:
    """특정 노드의 compact 레이아웃 JSON을 가져온다.

    Returns:
        compact JSON (ID 제거, characters 보존, componentId→이름 매핑)
    """
    data = await _figma_get(
        f"/files/{file_key}/nodes",
        params={"ids": node_id, "depth": str(max_depth)},
        max_retries=max_retries,
    )
    nodes = data.get("nodes", {})
    node_data = nodes.get(node_id, {})
    document = node_data.get("document", {})

    # componentId → 이름 매핑 (같은 API 응답에서 추출)
    component_map: dict[str, str] = {}
    raw_components = node_data.get("components", {})
    for comp_id, comp_meta in raw_components.items():
        name = comp_meta.get("name", "")
        if name:
            component_map[comp_id] = name

    # styleId → 디자인 토큰 이름 매핑
    style_map: dict[str, str] = {}
    raw_styles = node_data.get("styles", {})
    for style_id, style_meta in raw_styles.items():
        name = style_meta.get("name", "")
        if name:
            style_map[style_id] = name

    if component_map:
        logger.info(f"Component map: {len(component_map)} entries")
    if style_map:
        logger.info(f"Style map: {len(style_map)} entries")

    compact = simplify_node(
        document,
        max_depth=max_depth,
        component_map=component_map,
        style_map=style_map,
    )
    return compact or {}


async def export_node_image(
    file_key: str,
    node_id: str,
    *,
    scale: float = 2.0,
    image_format: str = "png",
    max_retries: int = 3,
) -> tuple[str, str]:
    """노드를 이미지로 export하고 base64로 반환.

    Returns:
        (base64_data, media_type)
    """
    data = await _figma_get(f"/images/{file_key}", params={
        "ids": node_id,
        "format": image_format,
        "scale": str(scale),
    }, max_retries=max_retries)

    images = data.get("images", {})
    image_url = images.get(node_id)

    if not image_url:
        raise ValueError(f"Figma 이미지 export 실패: node_id={node_id}")

    # 이미지 URL에서 다운로드 (공유 클라이언트로 커넥션 재사용)
    client = _get_client()
    resp = await client.get(image_url)
    resp.raise_for_status()

    media_type = f"image/{image_format}" if image_format != "jpg" else "image/jpeg"
    base64_data = base64.b64encode(resp.content).decode("utf-8")
    return base64_data, media_type


async def fetch_component_info(file_key: str, node_id: str) -> dict:
    """컴포넌트 variant/props 정보를 가져온다."""
    data = await _figma_get(f"/files/{file_key}/nodes", params={"ids": node_id})
    nodes = data.get("nodes", {})
    document = nodes.get(node_id, {}).get("document", {})

    result: dict = {
        "name": document.get("name", ""),
        "type": document.get("type", ""),
    }

    # 컴포넌트 props 정보
    if "componentProperties" in document:
        result["componentProperties"] = simplify_component_props(document["componentProperties"])

    # variant 정보 (COMPONENT_SET인 경우)
    if document.get("type") == "COMPONENT_SET":
        variants = []
        for child in document.get("children", []):
            variant = {
                "name": child.get("name", ""),
                "type": child.get("type", ""),
            }
            if "componentProperties" in child:
                variant["componentProperties"] = simplify_component_props(child["componentProperties"])
            variants.append(variant)
        result["variants"] = variants

    return result
