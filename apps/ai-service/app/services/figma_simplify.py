"""Figma 노드를 AI-friendly compact JSON으로 간소화.

Framelink MCP의 데이터 압축 기법을 참고하여:
- Figma 내부 키(id, pluginData 등) 제거
- layoutMode → CSS 용어(row/column) 매핑
- padding → CSS shorthand
- fills/strokes → CSS hex 색상으로 변환
- componentName → component + variant 분리
- componentId → component_map으로 실제 컴포넌트명 매핑
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
    "absoluteBoundingBox",
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
    "summary",
    "strokeAlign",
    "strokeMiterAngle",
    "strokeCap",
    "strokeJoin",
    "layoutAlign",
    "layoutGrow",
    "layoutSizingHorizontal",
    "layoutSizingVertical",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "primaryAxisSizingMode",
    "counterAxisSizingMode",
    "counterAxisAlignContent",
}

_LAYOUT_MODE_MAP = {"VERTICAL": "column", "HORIZONTAL": "row", "GRID": "grid"}
_DEFAULT_VALUES = {"False", "false", "default", "None", "none"}
_STATE_PROPS = {"Focus", "Interaction", "Hover", "Pressed", "Active", "State"}
_TEXT_CONTENT_KEYS = {"label", "title", "text", "placeholder", "value"}

_FIGMA_ID_RE = re.compile(r"^\d+:\d+$")


def _rgba_to_hex(color: dict, opacity: float = 1.0) -> str:
    """Figma RGBA (0~1 float) → CSS hex 색상.

    >>> _rgba_to_hex({"r": 1.0, "g": 0.0, "b": 0.0, "a": 1.0})
    '#FF0000'
    >>> _rgba_to_hex({"r": 0.0, "g": 0.0, "b": 0.0, "a": 0.5})
    'rgba(0,0,0,0.5)'
    """
    r = round(color.get("r", 0) * 255)
    g = round(color.get("g", 0) * 255)
    b = round(color.get("b", 0) * 255)
    a = color.get("a", 1.0) * opacity

    if a < 1.0:
        return f"rgba({r},{g},{b},{round(a, 2)})"
    return f"#{r:02X}{g:02X}{b:02X}"


def simplify_fills(fills: list) -> str | None:
    """fills 배열에서 첫 번째 visible SOLID fill의 색상을 hex로 변환."""
    for fill in fills:
        if not isinstance(fill, dict):
            continue
        if fill.get("visible") is False:
            continue
        if fill.get("type") != "SOLID":
            continue
        color = fill.get("color")
        if color:
            return _rgba_to_hex(color, fill.get("opacity", 1.0))
    return None


def simplify_strokes(strokes: list) -> str | None:
    """strokes 배열에서 첫 번째 visible SOLID stroke의 색상을 hex로 변환."""
    for stroke in strokes:
        if not isinstance(stroke, dict):
            continue
        if stroke.get("visible") is False:
            continue
        if stroke.get("type") != "SOLID":
            continue
        color = stroke.get("color")
        if color:
            return _rgba_to_hex(color, stroke.get("opacity", 1.0))
    return None


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


def simplify_node(
    node: dict,
    depth: int = 0,
    max_depth: int = 8,
    component_map: dict[str, str] | None = None,
    style_map: dict[str, str] | None = None,
) -> dict | None:
    """Figma 노드를 AI-friendly compact JSON으로 변환.

    - 불필요한 키 제거
    - layoutMode → layout (CSS 용어)
    - itemSpacing → gap
    - padding → CSS shorthand
    - fills → fill (디자인 토큰명 우선, 없으면 hex 폴백)
    - strokes → stroke (디자인 토큰명 우선, 없으면 hex 폴백)
    - cornerRadius / rectangleCornerRadii → borderRadius
    - componentId → component (component_map으로 이름 매핑)
    - componentName → component + variant + 텍스트 승격
    - size → w/h 간소화
    - children 재귀 처리

    Args:
        component_map: {componentId: componentName} 매핑 딕셔너리
        style_map: {styleId: styleName} 매핑 딕셔너리 (디자인 토큰 이름)
    """
    if depth > max_depth:
        return None

    out: dict = {}

    # styles 참조 (디자인 토큰 이름 해석용)
    node_styles = node.get("styles", {})

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

        # fills → 디자인 토큰명 우선, 없으면 hex 폴백
        if key == "fills" and isinstance(value, list):
            fill_style_id = node_styles.get("fill") or node_styles.get("fills")
            if fill_style_id and style_map and fill_style_id in style_map:
                out["fill"] = style_map[fill_style_id]
            else:
                hex_color = simplify_fills(value)
                if hex_color:
                    out["fill"] = hex_color
            continue

        # strokes → 디자인 토큰명 우선, 없으면 hex 폴백
        if key == "strokes" and isinstance(value, list):
            stroke_style_id = node_styles.get("stroke") or node_styles.get("strokes")
            if stroke_style_id and style_map and stroke_style_id in style_map:
                out["stroke"] = style_map[stroke_style_id]
            else:
                hex_color = simplify_strokes(value)
                if hex_color:
                    out["stroke"] = hex_color
            continue

        if key == "strokeWeight":
            if value and value > 0:
                out["borderWidth"] = value
            continue

        # cornerRadius → borderRadius
        if key == "cornerRadius":
            if value and value > 0:
                out["borderRadius"] = value
            continue

        if key == "rectangleCornerRadii":
            if isinstance(value, list) and any(v > 0 for v in value):
                if len(set(value)) == 1:
                    out["borderRadius"] = value[0]
                else:
                    out["borderRadius"] = " ".join(str(v) for v in value)
            continue

        # effects → boxShadow (간소화)
        if key == "effects" and isinstance(value, list):
            effect_style_id = node_styles.get("effect")
            if effect_style_id and style_map and effect_style_id in style_map:
                out["boxShadow"] = style_map[effect_style_id]
            else:
                for effect in value:
                    if not isinstance(effect, dict):
                        continue
                    if effect.get("visible") is False:
                        continue
                    if effect.get("type") == "DROP_SHADOW":
                        offset = effect.get("offset", {})
                        color = effect.get("color", {})
                        radius = effect.get("radius", 0)
                        out["boxShadow"] = f"{offset.get('x', 0)}px {offset.get('y', 0)}px {radius}px {_rgba_to_hex(color)}"
                        break
            continue

        # opacity
        if key == "opacity":
            if isinstance(value, (int, float)) and value < 1.0:
                out["opacity"] = round(value, 2)
            continue

        # styles 참조 자체는 이미 위에서 처리했으므로 스킵
        if key == "styles":
            continue

        # componentId → component_map으로 이름 매핑
        if key == "componentId":
            if component_map and value in component_map:
                out["component"] = component_map[value]
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
                    c = simplify_node(child, depth + 1, max_depth, component_map, style_map)
                    if c is not None:
                        children.append(c)
            if children:
                out["children"] = children
            continue

        out[key] = value

    return out
