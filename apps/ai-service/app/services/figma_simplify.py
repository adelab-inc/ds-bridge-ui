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
    # raw Figma 노이즈 키
    "scrollBehavior",
    "interactions",
    "complexStrokeProperties",
    "background",
    "backgroundColor",
    "layoutWrap",
    "targetAspectRatio",
    "layoutGrids",
    "booleanOperation",
    "characterStyleOverrides",
    "styleOverrideTable",
    "componentPropertyReferences",
    "cornerSmoothing",
    "exposedInstances",
    "isExposedInstance",
    "layoutVersion",
    "lineIndentations",
    "lineTypes",
    "strokesIncludedInLayout",
    "style",
    "individualStrokeWeights",
    # grid 관련 (AG Grid 컴포넌트로 대체)
    "gridChildHorizontalAlign",
    "gridChildVerticalAlign",
    "gridColumnAnchorIndex",
    "gridColumnCount",
    "gridColumnGap",
    "gridColumnSpan",
    "gridColumnsSizing",
    "gridRowAnchorIndex",
    "gridRowCount",
    "gridRowGap",
    "gridRowSpan",
    "gridRowsSizing",
}

_LAYOUT_MODE_MAP = {"VERTICAL": "column", "HORIZONTAL": "row", "GRID": "grid"}
_DEFAULT_VALUES = {"False", "false", "default", "None", "none", "hover", "pressed"}
# State는 Chip 등에서 selected/disabled 구분에 필요하므로 제외
_STATE_PROPS = {"Focus", "Interaction", "Hover", "Pressed", "Active"}
_TEXT_CONTENT_KEYS = {"label", "title", "text", "placeholder", "value"}

_FIGMA_ID_RE = re.compile(r"^\d+:\d+$")



# 컴포넌트별 Figma variant key → DS prop 매핑
# Figma에서 내려오는 key(소문자)를 DS 컴포넌트 prop 이름으로 치환
_VARIANT_PROP_REMAP: dict[str, dict[str, str]] = {
    "button": {"type": "buttonType", "state": ""},
    "iconbutton": {"type": "iconButtonType", "state": ""},
    "badge": {
        "status variant": "status",
        "level variant": "level",
    },
    "chip": {},  # state, type 그대로 유지
    "alert": {"variant": "type"},
    "field": {"display": "isDisplay"},
    "select": {},
    "tag": {},
}

# 컴포넌트별 Figma variant VALUE → DS prop VALUE 매핑
# 스키마/Figma에서 쓰는 이름이 실제 컴포넌트와 다를 때 값 변환
# Figma variant 값 → DS prop 값 매핑
_VARIANT_VALUE_REMAP: dict[str, dict[str, dict[str, str]]] = {
    "button": {
        "buttonType": {"outline": "secondary"},
    },
}

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



def _normalize_token_path(figma_name: str) -> str:
    """Figma 스타일 경로를 디자인 토큰 키 형식으로 변환.

    >>> _normalize_token_path("color/role/badge/primary/subtle/bg")
    'badge-primary-subtle-bg'
    >>> _normalize_token_path("color/role/bg/canvas")
    'bg-canvas'
    >>> _normalize_token_path("color/neutral/100")
    'neutral-100'
    >>> _normalize_token_path("effect/shadow/sm")
    'shadow-sm'
    """
    for prefix in ("color/role/", "color/", "effect/"):
        if figma_name.startswith(prefix):
            figma_name = figma_name[len(prefix):]
            break
    return figma_name.replace("/", "-")

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

        # paddingTop/Right/Bottom/Left → CSS shorthand
        if key in ("paddingTop", "paddingRight", "paddingBottom", "paddingLeft"):
            # 모든 개별 padding이 수집된 후 처리하기 위해 임시 저장
            if "_pad" not in out:
                out["_pad"] = {}
            out["_pad"][key] = value
            continue

        # fills → 디자인 토큰명 우선, 없으면 hex 폴백
        if key == "fills" and isinstance(value, list):
            fill_style_id = node_styles.get("fill") or node_styles.get("fills")
            if fill_style_id and style_map and fill_style_id in style_map:
                out["fill"] = _normalize_token_path(style_map[fill_style_id])
            else:
                hex_color = simplify_fills(value)
                if hex_color:
                    out["fill"] = hex_color
            continue

        # strokes → 디자인 토큰명 우선, 없으면 hex 폴백
        if key == "strokes" and isinstance(value, list):
            stroke_style_id = node_styles.get("stroke") or node_styles.get("strokes")
            if stroke_style_id and style_map and stroke_style_id in style_map:
                out["stroke"] = _normalize_token_path(style_map[stroke_style_id])
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
                out["boxShadow"] = _normalize_token_path(style_map[effect_style_id])
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

        # componentId → component_map으로 이름 매핑 + variant 파싱
        if key == "componentId":
            if component_map and value in component_map:
                mapped_name = component_map[value]
                if "=" in mapped_name:
                    # component_map name이 variant 문자열인 경우 파싱
                    comp_name, variant = parse_component_name(mapped_name)
                    if variant:
                        out["variant"] = variant
                    if comp_name:
                        out["component"] = comp_name
                    # comp_name이 None이면 name 필드를 component로 승격
                    elif "name" in out:
                        out["component"] = out["name"]
                else:
                    out["component"] = mapped_name
            continue

        if key == "componentName":
            comp_name, variant = parse_component_name(value)
            if comp_name:
                out["component"] = comp_name
            if variant:
                out["variant"] = variant
            continue

        # componentProperties: raw Figma 형식 {key: {value, type}} → flatten 후 처리
        if key == "componentProperties":
            if isinstance(value, dict):
                flattened: dict = {}
                for prop_key, prop_data in value.items():
                    if isinstance(prop_data, dict):
                        flattened[prop_key] = prop_data.get("value", "")
                    else:
                        flattened[prop_key] = prop_data
                simplified = simplify_component_props(flattened)
                for tk in list(_TEXT_CONTENT_KEYS):
                    if tk in simplified:
                        out[tk] = simplified.pop(tk)
                if simplified:
                    if "variant" in out:
                        out["variant"].update(simplified)
                    else:
                        out["variant"] = simplified
            continue

        # component 키 (legacy — componentName/componentId가 없는 경우)
        if key == "component":
            if isinstance(value, str) and "=" in value:
                comp_name, variant = parse_component_name(value)
                if variant:
                    out["variant"] = variant
                if comp_name:
                    out["component"] = comp_name
                elif "name" in out:
                    out["component"] = out["name"]
            else:
                out["component"] = value
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

    # 개별 padding → CSS shorthand 변환
    if "_pad" in out:
        pad = out.pop("_pad")
        top = pad.get("paddingTop", 0)
        right = pad.get("paddingRight", 0)
        bottom = pad.get("paddingBottom", 0)
        left = pad.get("paddingLeft", 0)
        if any(v > 0 for v in (top, right, bottom, left)):
            shorthand = padding_shorthand(
                {"top": top, "right": right, "bottom": bottom, "left": left}
            )
            if shorthand and "padding" not in out:
                out["padding"] = shorthand

    # visible=False인 노드는 제거
    if out.get("visible") is False:
        return None
    out.pop("visible", None)

    # component 이름 정규화: "Select/Select" → "Select", "Tab/Item" → "Tab"
    if "component" in out and isinstance(out["component"], str) and "/" in out["component"]:
        # 계층 이름에서 첫 번째 의미 있는 세그먼트 사용 (보통 컴포넌트 이름)
        out["component"] = out["component"].split("/")[0]

    # INSTANCE 노드의 variant key를 DS prop 이름으로 치환 + 값 소문자화 + 값 리매핑
    if out.get("type") == "INSTANCE" and "variant" in out and isinstance(out["variant"], dict):
        comp_name = (out.get("component") or out.get("name") or "").lower()
        remap = _VARIANT_PROP_REMAP.get(comp_name)
        value_remap = _VARIANT_VALUE_REMAP.get(comp_name, {})
        if remap:
            remapped: dict = {}
            for k, v in out["variant"].items():
                new_key = remap.get(k, k)
                if new_key:  # 빈 문자열이면 해당 키 삭제 (Figma 내부 상태)
                    new_val = v.lower() if isinstance(v, str) else v
                    # 값 리매핑 (outline→ghost 등)
                    key_remap = value_remap.get(new_key, {})
                    new_val = key_remap.get(new_val, new_val) if isinstance(new_val, str) else new_val
                    remapped[new_key] = new_val
            out["variant"] = remapped
        else:
            # remap 없어도 variant 값은 소문자로 통일 (Figma PascalCase → DS lowercase)
            out["variant"] = {
                k: v.lower() if isinstance(v, str) else v
                for k, v in out["variant"].items()
            }

    # IconButton/Button의 자식 Icon을 icon 필드로 승격 (children에서 제거)
    if out.get("type") == "INSTANCE":
        comp_lower = (out.get("component") or out.get("name") or "").lower()
        if comp_lower in ("iconbutton", "button") and "children" in out:
            for i, child in enumerate(out["children"]):
                if not isinstance(child, dict):
                    continue
                child_name = (child.get("component") or child.get("name") or "").lower()
                # Icon 컴포넌트: "icon-edit-16", "icon-search-20" 등 패턴 매칭
                if child.get("type") == "INSTANCE" and (
                    child_name == "icon"
                    or child_name.startswith("icon-")
                    or child_name.startswith("icon_")
                ):
                    icon_name = child.get("name", "")
                    # icon-edit-16 → name="edit", size=16
                    icon_size = 20
                    match = re.match(r"icon-(.+)-(\d+)$", icon_name)
                    if match:
                        icon_name = match.group(1)
                        icon_size = int(match.group(2))
                    out["icon"] = {"name": icon_name, "size": icon_size}
                    out["children"].pop(i)
                    break
            if not out["children"]:
                del out["children"]

    return out
