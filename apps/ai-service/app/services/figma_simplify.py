"""Figma 노드를 AI-friendly compact JSON으로 간소화.

Framelink MCP의 데이터 압축 기법을 참고하여:
- Figma 내부 키(id, pluginData 등) 제거
- layoutMode → CSS 용어(row/column) 매핑
- padding → CSS shorthand
- componentName → component + variant 분리
- componentProps → 노이즈(icon ID, state, Show*) 제거, 텍스트 승격
"""

from __future__ import annotations

import re

_STRIP_KEYS = {
    "id",
    "pluginData",
    "sharedPluginData",
    "documentationLinks",
    "boundVariables",
    "absoluteRenderBounds",
    "constraints",
    "blendMode",
    "clipsContent",
    "locked",
    "exportSettings",
    "transitionNodeID",
    "reactions",
    "isMask",
    "preserveRatio",
    "overrides",
    "componentId",
    "summary",
}

_LAYOUT_MODE_MAP = {"VERTICAL": "column", "HORIZONTAL": "row", "GRID": "grid"}
_DEFAULT_VALUES = {"False", "false", "default", "None", "none"}
_STATE_PROPS = {"Focus", "Interaction", "Hover", "Pressed", "Active", "State"}
_TEXT_CONTENT_KEYS = {"label", "title", "text", "placeholder", "value"}

_FIGMA_ID_RE = re.compile(r"^\d+:\d+$")


def padding_shorthand(padding: dict) -> str | None:
    """padding 객체를 CSS shorthand 문자열로 변환.

    >>> padding_shorthand({"top": 0, "right": 24, "bottom": 0, "left": 24})
    '0 24'
    >>> padding_shorthand({"top": 16, "right": 16, "bottom": 16, "left": 16})
    '16'
    >>> padding_shorthand({"top": 0, "right": 0, "bottom": 0, "left": 0})
    """
    t = padding.get("top", 0)
    r = padding.get("right", 0)
    b = padding.get("bottom", 0)
    l_ = padding.get("left", 0)

    if t == 0 and r == 0 and b == 0 and l_ == 0:
        return None

    if t == r == b == l_:
        return str(t)
    if t == b and r == l_:
        return f"{t} {r}"
    if r == l_:
        return f"{t} {r} {b}"
    return f"{t} {r} {b} {l_}"


def parse_component_name(component_name: str) -> tuple[str | None, dict]:
    """componentName에서 기본 컴포넌트명과 의미 있는 variant를 파싱.

    >>> parse_component_name("Size=sm, Type=tertiary, Disabled=False, Focus=False, Interaction=default")
    (None, {'size': 'sm', 'type': 'tertiary'})
    >>> parse_component_name("header")
    ('header', {})
    """
    if "=" not in component_name:
        return component_name, {}

    variant: dict = {}
    for pair in component_name.split(","):
        pair = pair.strip()
        if "=" not in pair:
            continue
        key, val = pair.split("=", 1)
        key = key.strip()
        val = val.strip()

        if key in _STATE_PROPS:
            continue
        if val in _DEFAULT_VALUES:
            continue

        variant[key.lower()] = val

    return None, variant


def simplify_component_props(props: dict) -> dict:
    """componentProps에서 노이즈를 제거하고 유용한 값만 반환.

    - #nodeId suffix 키: 값이 Figma ID 패턴이면 제거 (icon 참조)
    - Show * boolean 토글 → 제거
    - state/default props → 제거
    - 텍스트 콘텐츠 → 소문자 키로 반환
    """
    cleaned: dict = {}
    text_values: dict = {}

    for key, value in props.items():
        if "#" in key:
            base_key = key.split("#")[0].strip()

            if base_key.lower().startswith("show ") or base_key.lower().startswith("show_"):
                continue

            if isinstance(value, str) and _FIGMA_ID_RE.match(value):
                continue

            if base_key.lower() in _TEXT_CONTENT_KEYS:
                text_values[base_key.lower()] = value
            continue

        if key in _STATE_PROPS:
            continue
        if isinstance(value, str) and value in _DEFAULT_VALUES:
            continue
        if isinstance(value, bool):
            continue

        if key.lower() in _TEXT_CONTENT_KEYS:
            text_values[key.lower()] = value
        else:
            cleaned[key.lower()] = value

    cleaned.update(text_values)
    return cleaned


def simplify_node(node: dict, depth: int = 0, max_depth: int = 8) -> dict | None:
    """Figma 노드를 AI-friendly compact JSON으로 변환.

    - 불필요한 키 제거
    - layoutMode → layout (CSS 용어)
    - itemSpacing → gap
    - padding → CSS shorthand
    - componentName → component + variant + 텍스트 승격
    - size → w/h 간소화
    - children 재귀 처리
    """
    if depth > max_depth:
        return None

    out: dict = {}

    for key, value in node.items():
        if key in _STRIP_KEYS:
            continue

        if key == "layoutMode":
            mapped = _LAYOUT_MODE_MAP.get(value)
            if mapped:
                out["layout"] = mapped
            continue

        if key == "itemSpacing":
            if value and value != 0:
                out["gap"] = value
            continue

        if key == "padding":
            if isinstance(value, dict):
                shorthand = padding_shorthand(value)
                if shorthand:
                    out["padding"] = shorthand
            continue

        if key == "componentName":
            comp_name, variant = parse_component_name(value)
            if comp_name:
                out["component"] = comp_name
            if variant:
                out["variant"] = variant
            continue

        if key == "componentProps":
            if isinstance(value, dict):
                simplified = simplify_component_props(value)
                for tk in list(_TEXT_CONTENT_KEYS):
                    if tk in simplified:
                        out[tk] = simplified.pop(tk)
                if simplified:
                    if "variant" in out:
                        out["variant"].update(simplified)
                    else:
                        out["variant"] = simplified
            continue

        if key == "size":
            if isinstance(value, dict):
                w = value.get("width")
                h = value.get("height")
                if w:
                    out["w"] = w
                if h:
                    out["h"] = h
            continue

        if key == "children" and isinstance(value, list):
            children = []
            for child in value:
                if isinstance(child, dict):
                    c = simplify_node(child, depth + 1, max_depth)
                    if c is not None:
                        children.append(c)
            if children:
                out["children"] = children
            continue

        out[key] = value

    return out
