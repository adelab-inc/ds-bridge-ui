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
    "layoutGrow",
    "primaryAxisSizingMode",
    "counterAxisSizingMode",
    "counterAxisAlignContent",
    # raw Figma 노이즈 키
    "scrollBehavior",
    "interactions",
    "complexStrokeProperties",
    "background",
    "backgroundColor",
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

# analyze_grid_hints에서 폼 필드로 인식할 컴포넌트 키워드
_FORM_FIELD_COMPONENTS = {"field", "select", "searchfield", "datepicker", "daterange"}

_FIGMA_ID_RE = re.compile(r"^\d+:\d+$")



# 컴포넌트별 Figma variant key → DS prop 매핑
# Figma에서 내려오는 key(소문자)를 DS 컴포넌트 prop 이름으로 치환
_VARIANT_PROP_REMAP: dict[str, dict[str, str]] = {
    "button": {"type": "buttonType", "state": ""},
    "iconbutton": {"type": "iconButtonType", "state": ""},
    "badge": {
        "status variant": "status",
        "level variant": "level",
        "style": "appearance",
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
        if not val or val in _DEFAULT_VALUES:
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
        if isinstance(value, str) and (not value or value in _DEFAULT_VALUES):
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

def _row_signature(node: dict) -> str:
    """노드의 구조적 시그니처 생성 (컴포넌트 종류/타입만, 값 무시).

    TEXT 노드는 characters 값을 포함하여 서로 다른 텍스트가 dedup되지 않도록 함.
    INSTANCE 리프 노드는 label/title/text를 포함하여 같은 컴포넌트라도
    다른 텍스트를 가지면 dedup되지 않도록 함 (예: Select "게시글 유형" vs Select "작성기간").
    """
    parts: list[str] = []
    ntype = node.get("type", "")
    comp = node.get("component", "")
    # TEXT 노드는 내용이 다르면 다른 시그니처를 생성 (컬럼 헤더 등 보존)
    if ntype == "TEXT":
        chars = node.get("characters") or node.get("text") or ""
        parts.append(f"{ntype}:{chars}")
    else:
        parts.append(f"{ntype}:{comp}")
        # INSTANCE 리프 노드(children 없음)는 label/title/text로 구분
        # children이 제거된 후에도 서로 다른 폼 필드가 dedup되지 않도록 함
        if ntype == "INSTANCE" and "children" not in node:
            label = node.get("label") or node.get("title") or node.get("text") or ""
            if label:
                parts.append(f"label:{label}")
    for child in node.get("children", []):
        if isinstance(child, dict):
            parts.append(_row_signature(child))
    return "|".join(parts)


def _dedup_repeated_rows(children: list[dict]) -> list[dict]:
    """구조가 동일한 형제 FRAME/INSTANCE가 3개 이상 반복되면 첫 번째만 유지.

    AG Grid 등에서 데이터 행이 반복되어 토큰이 폭발하는 것을 방지.
    반복이 발견되면 첫 행에 `_repeatedRows` 힌트를 추가.
    """
    if len(children) < 3:
        return children

    # 각 child의 구조 시그니처 계산
    sigs = [_row_signature(c) if isinstance(c, dict) else "" for c in children]

    # 연속으로 같은 시그니처가 3개 이상인 그룹 찾기
    result: list[dict] = []
    i = 0
    while i < len(children):
        sig = sigs[i]
        # 연속 같은 시그니처 개수 세기
        j = i + 1
        while j < len(children) and sigs[j] == sig:
            j += 1
        count = j - i

        if count >= 3 and sig:
            # 반복 그룹: 첫 번째만 유지
            first = children[i]
            if isinstance(first, dict):
                first["_repeatedRows"] = count
            result.append(first)
        else:
            # 반복 아님: 전부 유지
            result.extend(children[i:j])
        i = j

    return result


def _extract_grid_columns(node: dict) -> list[str]:
    """DataGrid/AG Grid INSTANCE에서 헤더 행의 컬럼 이름을 추출.

    첫 번째 행(헤더)의 TEXT 노드 characters를 수집하여 리스트로 반환.
    """
    columns: list[str] = []

    def _collect_texts(n: dict) -> None:
        if not isinstance(n, dict):
            return
        if n.get("type") == "TEXT":
            chars = n.get("characters") or n.get("text") or ""
            if chars and chars.strip():
                columns.append(chars.strip())
            return
        for child in n.get("children", []):
            if isinstance(child, dict):
                _collect_texts(child)

    children = node.get("children", [])
    if not children:
        return []

    # 첫 번째 자식(헤더 행)에서만 TEXT 수집
    first_child = children[0] if isinstance(children[0], dict) else None
    if first_child:
        _collect_texts(first_child)

    return columns


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
        # absoluteBoundingBox에서 좌표 + 크기 추출 (strip 전에 처리)
        if key == "absoluteBoundingBox" and isinstance(value, dict):
            y = value.get("y")
            x = value.get("x")
            bbox_w = value.get("width")
            bbox_h = value.get("height")
            if y is not None:
                out["_y"] = round(y)
            if x is not None:
                out["_x"] = round(x)
            # w/h가 아직 안 잡힌 경우(fill/hug sizing) bbox에서 보충
            if bbox_w is not None and isinstance(bbox_w, (int, float)):
                out["_w"] = round(bbox_w)
            if bbox_h is not None and isinstance(bbox_h, (int, float)):
                out["_h"] = round(bbox_h)
            continue

        if key in _STRIP_KEYS:
            continue

        if key == "layoutMode":
            mapped = _LAYOUT_MODE_MAP.get(value)
            if mapped:
                out["layout"] = mapped
            continue

        # primaryAxisAlignItems → justify (CSS justify-content)
        if key == "primaryAxisAlignItems":
            _justify_map = {
                "MIN": "start", "MAX": "end", "CENTER": "center",
                "SPACE_BETWEEN": "space-between",
            }
            mapped = _justify_map.get(value)
            if mapped and mapped != "start":  # start는 기본값이므로 생략
                out["justify"] = mapped
            continue

        # counterAxisAlignItems → align (CSS align-items)
        if key == "counterAxisAlignItems":
            _align_map = {
                "MIN": "start", "MAX": "end", "CENTER": "center",
                "BASELINE": "baseline",
            }
            mapped = _align_map.get(value)
            if mapped and mapped != "start":  # start는 기본값이므로 생략
                out["align"] = mapped
            continue

        # layoutSizingHorizontal → hSizing (fill=w-full, hug=w-auto)
        if key == "layoutSizingHorizontal":
            if isinstance(value, str):
                v = value.lower()
                if v != "fixed":  # fixed는 이미 w 값으로 표현됨
                    out["hSizing"] = v
            continue

        # layoutSizingVertical → vSizing (fill=h-full, hug=h-auto)
        if key == "layoutSizingVertical":
            if isinstance(value, str):
                v = value.lower()
                if v != "fixed":  # fixed는 이미 h 값으로 표현됨
                    out["vSizing"] = v
            continue

        # layoutAlign → selfAlign (부모 cross-axis에서 자신의 정렬)
        if key == "layoutAlign":
            _self_align_map = {"STRETCH": "stretch", "MIN": "start", "MAX": "end", "CENTER": "center"}
            mapped = _self_align_map.get(value)
            if mapped:
                out["selfAlign"] = mapped
            continue

        # layoutWrap → wrap (flex-wrap)
        if key == "layoutWrap":
            if value == "WRAP":
                out["wrap"] = True
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
                # 반복 행 제거: 구조가 동일한 FRAME이 3개 이상이면 첫 번째만 유지
                children = _dedup_repeated_rows(children)
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

    # INSTANCE 노드에 렌더링 지시 삽입: AI가 component를 변경하지 못하도록 데이터 레벨 강제
    if out.get("type") == "INSTANCE" and out.get("component"):
        comp = out["component"]
        out["⚠️_RENDER"] = f"<{comp}> 사용 필수 — 다른 컴포넌트로 변경 절대 금지"

    # FRAME 내부 텍스트 보존: 첫 번째 TEXT child의 characters를 label로 승격
    # (작성기간/소속 같은 FRAME 기반 커스텀 필드의 label 텍스트)
    if out.get("type") == "FRAME" and "children" in out and "label" not in out:
        for child in out["children"]:
            if isinstance(child, dict) and child.get("type") == "TEXT":
                chars = child.get("characters") or child.get("text")
                if chars:
                    out["label"] = chars
                    break

    # Card 패턴 감지: white fill + (stroke 또는 borderRadius) + children 있는 FRAME
    if (
        out.get("type") == "FRAME"
        and "children" in out
        and len(out.get("children", [])) > 0
    ):
        fill_val = out.get("fill", "")
        has_white_fill = False
        if isinstance(fill_val, str):
            hex_clean = fill_val.lstrip("#").lower()
            if len(hex_clean) == 6:
                try:
                    r, g, b = int(hex_clean[0:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16)
                    has_white_fill = r >= 0xF0 and g >= 0xF0 and b >= 0xF0
                except ValueError:
                    pass
        has_border = bool(out.get("stroke"))
        has_radius = bool(out.get("borderRadius"))
        if has_white_fill and (has_border or has_radius):
            out["_cardHint"] = True

    # Row FRAME 그리드 힌트: INSTANCE 자식의 w 비율을 분석하여 인라인 힌트 추가
    if (
        out.get("type") == "FRAME"
        and out.get("layout") == "row"
        and "children" in out
    ):
        instances = [
            c for c in out["children"]
            if isinstance(c, dict) and c.get("type") == "INSTANCE"
        ]
        if len(instances) >= 2:
            widths = []
            for inst in instances:
                w = inst.get("w", 0)
                if isinstance(w, (int, float)):
                    widths.append(round(w) if isinstance(w, float) else w)
                else:
                    widths.append(0)
            positive = [w for w in widths if w > 0]
            if positive:
                min_w = min(positive)
                ratios = [max(1, round(w / min_w)) if w > 0 else 1 for w in widths]
                total = sum(ratios)
                if len(set(ratios)) > 1:
                    # 비균등: col-span 명시
                    labels = [
                        inst.get("label") or inst.get("title") or inst.get("name") or "?"
                        for inst in instances
                    ]
                    parts = [f"{l}:{r}" for l, r in zip(labels, ratios)]
                    out["gridHint"] = f"grid-cols-{total} ({', '.join(parts)})"
                else:
                    out["gridHint"] = f"{len(instances)}cols-equal"

    # INSTANCE 노드 후처리: 아이콘 승격 + 내부 children 제거
    if out.get("type") == "INSTANCE":
        comp_lower = (out.get("component") or out.get("name") or "").lower()

        # IconButton/Button의 자식 Icon을 icon 필드로 승격
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

        # DataGrid/AG Grid: 헤더 행에서 컬럼 이름 추출 (dedup 전에 호출)
        if comp_lower in ("datagrid", "ag grid", "ag grid (column based layout)") and "children" in out:
            columns = _extract_grid_columns(out)
            if columns:
                out["_columns"] = columns

        # INSTANCE children 처리:
        # - children에 INSTANCE가 포함된 복합 컴포넌트(AG Grid, Table 등) → children 유지
        # - children이 SHAPE/TEXT뿐인 리프 컴포넌트(Button, Badge 등) → label 승격 후 제거
        if "children" in out:
            has_nested_instances = any(
                isinstance(c, dict) and c.get("type") == "INSTANCE"
                for c in out["children"]
            )
            if has_nested_instances:
                # 2중 INSTANCE 병합: 부모/자식이 같은 컴포넌트(Badge 등)면
                # 자식 variant/label을 부모로 올리고 자식 제거
                parent_comp = (out.get("component") or "").lower()
                merged_children = []
                did_merge = False
                for child in out["children"]:
                    if (
                        isinstance(child, dict)
                        and child.get("type") == "INSTANCE"
                        and (child.get("component") or "").lower() == parent_comp
                        and parent_comp
                    ):
                        # 자식 variant → 부모 variant에 병합
                        child_variant = child.get("variant", {})
                        if child_variant:
                            parent_variant = out.get("variant", {})
                            parent_variant.update(child_variant)
                            out["variant"] = parent_variant
                        # 자식 label → 부모 승격
                        for lbl_key in ("label", "title", "text"):
                            if lbl_key in child and lbl_key not in out:
                                out[lbl_key] = child[lbl_key]
                        did_merge = True
                    else:
                        merged_children.append(child)

                if did_merge:
                    if merged_children:
                        out["children"] = merged_children
                    else:
                        del out["children"]
            else:
                # 리프 INSTANCE: TEXT label 승격 후 children 제거
                for child in out["children"]:
                    if isinstance(child, dict) and child.get("type") == "TEXT":
                        chars = child.get("characters") or child.get("text")
                        if chars and "label" not in out and "title" not in out and "text" not in out:
                            out["label"] = chars
                del out["children"]

    return out


# ---------------------------------------------------------------------------
# 그리드 레이아웃 자동 분석
# ---------------------------------------------------------------------------

def analyze_grid_hints(root: dict) -> str:
    """Y좌표 기반 그리드 레이아웃 힌트 생성.

    Figma 절대 좌표(_y)로 같은 행의 필드를 그룹핑하고,
    _x로 정렬, w로 폭 비율을 계산합니다.
    JSON 구조(row/column 중첩)에 의존하지 않습니다.
    """
    # 1) 트리에서 모든 INSTANCE(Field) 노드를 수집
    fields: list[dict] = []

    def _collect_fields(node: dict, section: str = "") -> None:
        if not isinstance(node, dict):
            return
        ntype = node.get("type", "")
        comp = (node.get("component") or node.get("name") or "").lower()

        # 폼 필드 INSTANCE 수집 (Field, Select, SearchField, DatePicker 등)
        if ntype == "INSTANCE" and any(fc in comp for fc in _FORM_FIELD_COMPONENTS):
            label = (
                node.get("label") or node.get("title") or node.get("text")
                or node.get("name") or "?"
            )
            y = node.get("_y", 0)
            x = node.get("_x", 0)
            w = node.get("w", 0)
            if isinstance(w, float):
                w = round(w)
            fields.append({"label": label, "y": y, "x": x, "w": w, "section": section})
            return  # INSTANCE는 children이 이미 제거됨

        # Divider로 섹션 구분
        if ntype == "INSTANCE" and "divider" in comp:
            return

        children = node.get("children", [])

        # 자식 중 TEXT를 먼저 탐색해서 섹션 제목 추출
        cur_section = section
        for child in children:
            if isinstance(child, dict) and child.get("type") == "TEXT":
                chars = child.get("characters") or child.get("text") or ""
                if 2 <= len(chars) <= 20:
                    cur_section = chars
                    break

        for child in children:
            if isinstance(child, dict):
                _collect_fields(child, cur_section)

    _collect_fields(root)

    if len(fields) < 2:
        return ""

    # 2) Y좌표로 행 그룹핑 (Y차이 10px 이내 = 같은 행)
    fields.sort(key=lambda f: (f["y"], f["x"]))
    rows: list[list[dict]] = []
    current_row: list[dict] = [fields[0]]
    for f in fields[1:]:
        if abs(f["y"] - current_row[0]["y"]) <= 10:
            current_row.append(f)
        else:
            rows.append(sorted(current_row, key=lambda f: f["x"]))
            current_row = [f]
    if current_row:
        rows.append(sorted(current_row, key=lambda f: f["x"]))

    # 3) 연속된 행들을 섹션으로 그룹핑 (같은 section 이름 기준)
    from itertools import groupby

    def _section_key(row: list[dict]) -> str:
        # 행의 필드들 중 가장 많이 나오는 섹션 이름
        sections = [f["section"] for f in row if f["section"]]
        return sections[0] if sections else ""

    section_outputs: list[str] = []

    for sec_name, sec_rows_iter in groupby(rows, key=_section_key):
        sec_rows = list(sec_rows_iter)
        if not sec_name:
            sec_name = "폼 섹션"

        lines: list[str] = [f"### {sec_name}"]

        # 행별 분석
        row_infos: list[dict] = []
        for row in sec_rows:
            count = len(row)
            widths = [f["w"] for f in row]
            labels = [f["label"] for f in row]
            positive = [w for w in widths if w > 0]
            if positive:
                min_w = min(positive)
                ratios = [max(1, round(w / min_w)) if w > 0 else 1 for w in widths]
            else:
                ratios = [1] * count
            total = sum(ratios)
            uniform = len(set(ratios)) <= 1
            row_infos.append({
                "count": count, "labels": labels, "widths": widths,
                "ratios": ratios, "total_units": total, "uniform": uniform,
            })

        if not row_infos:
            continue

        # 섹션 레벨 결정
        all_totals = [r["total_units"] for r in row_infos]
        base_cols = max(all_totals)
        all_uniform = all(r["uniform"] for r in row_infos)
        all_same_count = len(set(r["count"] for r in row_infos)) == 1

        if all_uniform and all_same_count and row_infos[0]["count"] <= 4:
            n = row_infos[0]["count"]
            lines.append(f'→ `<FormGrid columns={{{n}}} title="{sec_name}">`')
            for i, row in enumerate(row_infos):
                lines.append(f"  행{i+1}: {', '.join(row['labels'])}")
        elif base_cols <= 4:
            lines.append(f'→ `<FormGrid columns={{{base_cols}}} title="{sec_name}">`')
            for i, row in enumerate(row_infos):
                if row["uniform"] and row["count"] == base_cols:
                    lines.append(f"  행{i+1}: {', '.join(row['labels'])}")
                elif row["count"] < base_cols:
                    remaining = base_cols - row["count"]
                    parts = list(row["labels"][:-1])
                    parts.append(f"{row['labels'][-1]}(colSpan={{{remaining + 1}}})")
                    lines.append(f"  행{i+1}: {', '.join(parts)}")
                else:
                    parts = [
                        f"{l}(colSpan={{{r}}})" if r > 1 else l
                        for l, r in zip(row["labels"], row["ratios"])
                    ]
                    lines.append(f"  행{i+1}: {', '.join(parts)}")
        else:
            lines.append(f'→ `<div className="grid grid-cols-{base_cols} gap-x-6 gap-y-4">`')
            for i, row in enumerate(row_infos):
                if row["uniform"] and row["total_units"] == base_cols:
                    lines.append(f"  행{i+1}: {', '.join(row['labels'])}")
                else:
                    scale = base_cols / row["total_units"] if row["total_units"] > 0 else 1
                    scaled = [max(1, round(r * scale)) for r in row["ratios"]]
                    diff = base_cols - sum(scaled)
                    if diff != 0 and scaled:
                        scaled[-1] = max(1, scaled[-1] + diff)
                    parts = [
                        f"{l}(col-span-{s})" if s > 1 else l
                        for l, s in zip(row["labels"], scaled)
                    ]
                    lines.append(f"  행{i+1}: {', '.join(parts)}")

        section_outputs.append("\n".join(lines))

    if not section_outputs:
        return ""
    return (
        "\n## 📐 그리드 레이아웃 분석 (자동 계산 — 반드시 이 컬럼 수와 비율을 따르세요)\n\n"
        + "\n\n".join(section_outputs)
        + "\n"
    )


# ---------------------------------------------------------------------------
# GridLayout type 자동 감지
# ---------------------------------------------------------------------------

# 12-grid 기준 GridLayout type 매핑
_GRID_TYPE_MAP: dict[tuple[int, ...], str] = {
    # 1패널
    (12,): "A",
    # 2패널
    (6, 6): "B",
    (3, 9): "C",
    (9, 3): "C-2",
    (4, 8): "D",
    (8, 4): "D-2",
    # 3패널
    (4, 4, 4): "E",
    (2, 8, 2): "F",
    (2, 2, 8): "G",
    # 4패널
    (3, 3, 3, 3): "H",
}


def _scale_to_12(ratios: list[int]) -> tuple[int, ...]:
    """비율 리스트를 12-grid 기준으로 정규화."""
    total = sum(ratios)
    if total <= 0:
        return (12,)
    scaled = [max(1, round(r * 12 / total)) for r in ratios]
    diff = 12 - sum(scaled)
    if diff != 0 and scaled:
        max_idx = scaled.index(max(scaled))
        scaled[max_idx] = max(1, scaled[max_idx] + diff)
    return tuple(scaled)


def _best_grid_type(ratios: list[int]) -> tuple[str, tuple[int, ...], tuple[int, ...], int]:
    """w 비율 리스트를 12-grid로 환산하고 가장 가까운 GridLayout type을 반환.

    Returns:
        (type_name, matched_pattern, actual_scaled, distance)
        - distance == 0 이면 정확히 매칭됨
        - distance > 0 이면 근사 매칭 (AI에게 경고 필요)
    """
    scaled = _scale_to_12(ratios)
    n = len(scaled)

    # 정확히 매칭
    if scaled in _GRID_TYPE_MAP:
        return _GRID_TYPE_MAP[scaled], scaled, scaled, 0

    # 같은 패널 수 중 가장 가까운 type 찾기 (절대 차이 최소)
    best_type = "A"
    best_dist = float("inf")
    best_pattern: tuple[int, ...] = (12,)
    for pattern, gtype in _GRID_TYPE_MAP.items():
        if len(pattern) != n:
            continue
        dist = sum(abs(a - b) for a, b in zip(scaled, pattern))
        if dist < best_dist:
            best_dist = dist
            best_type = gtype
            best_pattern = pattern

    return best_type, best_pattern, scaled, int(best_dist)


def _candidate_grid_types(scaled: tuple[int, ...], top_k: int = 3) -> list[tuple[str, tuple[int, ...], int]]:
    """scaled 비율에 가까운 상위 K개 GridLayout type을 거리순으로 반환."""
    n = len(scaled)
    candidates: list[tuple[str, tuple[int, ...], int]] = []
    for pattern, gtype in _GRID_TYPE_MAP.items():
        if len(pattern) != n:
            continue
        dist = sum(abs(a - b) for a, b in zip(scaled, pattern))
        candidates.append((gtype, pattern, dist))
    candidates.sort(key=lambda x: x[2])
    return candidates[:top_k]


def _get_numeric_w(node: dict) -> int:
    """노드의 실제 픽셀 너비를 반환. w → _w 순서로 fallback."""
    w = node.get("w")
    if isinstance(w, (int, float)):
        return round(w) if isinstance(w, float) else w
    # w가 'FILL'/None이면 absoluteBoundingBox에서 추출한 _w 사용
    _w = node.get("_w")
    if isinstance(_w, (int, float)):
        return round(_w) if isinstance(_w, float) else _w
    return 0


def _get_numeric_h(node: dict) -> int | str:
    """노드의 실제 높이 반환. h → _h 순서로 fallback. 'FILL' 문자열도 유효."""
    h = node.get("h")
    if h == "FILL" or h == "fill":
        return "FILL"
    if isinstance(h, (int, float)):
        return round(h) if isinstance(h, float) else h
    _h = node.get("_h")
    if isinstance(_h, (int, float)):
        return round(_h) if isinstance(_h, float) else _h
    # hSizing이 fill/hug이면 유의미한 높이로 간주
    vSizing = node.get("vSizing", "")
    if vSizing in ("fill", "hug"):
        return "FILL"
    return 0


def analyze_grid_layout_type(root: dict) -> str:
    """Figma 최상위 구조에서 GridLayout type을 자동 감지.

    Body/Content 영역의 주요 FRAME 자식들의 w 비율을 분석하여
    GridLayout type (A~H)을 결정합니다.
    """
    # Title/header 등 패널이 아닌 영역 이름
    _SKIP_NAMES = {"title", "header", "tab_floor", "tab_floor1", "tab_floor2", "tabbox"}

    def _find_content_panels(node: dict, depth: int = 0) -> list[dict] | None:
        """Body/Content 영역의 병렬 패널들을 찾음."""
        if depth > 5 or not isinstance(node, dict):
            return None

        # Title/header 같은 프레임은 패널 탐색 대상에서 제외
        name_lower = (node.get("name") or "").lower()
        if name_lower in _SKIP_NAMES:
            return None

        children = node.get("children", [])
        if not children:
            return None

        layout = node.get("layout", "")

        if layout == "row":
            # row 레이아웃의 직접 FRAME 자식들이 패널 후보
            frame_children = []
            for c in children:
                if not isinstance(c, dict) or c.get("type") != "FRAME":
                    continue
                w = _get_numeric_w(c)
                if w <= 100:
                    continue
                h = _get_numeric_h(c)
                # h가 유의미한(FILL 또는 100+ px) FRAME만 포함
                if h == "FILL" or (isinstance(h, (int, float)) and h > 100):
                    frame_children.append(c)
            if len(frame_children) >= 2:
                return frame_children

        # 재귀적으로 탐색 (Title/header 제외 후)
        for child in children:
            if isinstance(child, dict):
                result = _find_content_panels(child, depth + 1)
                if result:
                    return result
        return None

    panels = _find_content_panels(root)
    if not panels or len(panels) < 2:
        return ""

    # 패널들의 w 비율 계산
    widths = []
    panel_names = []
    for p in panels:
        widths.append(_get_numeric_w(p))
        name = p.get("name", "")
        # 패널 내부의 주요 컴포넌트 이름도 참고
        if not name or name.startswith("Frame"):
            # 자식에서 의미 있는 이름 찾기
            for child in p.get("children", []):
                if isinstance(child, dict):
                    child_comp = child.get("component") or child.get("name") or ""
                    if child_comp and not child_comp.startswith("Frame"):
                        name = child_comp
                        break
        panel_names.append(name or "패널")

    if all(w == 0 for w in widths):
        return ""

    # 비율 계산
    positive = [w for w in widths if w > 0]
    if not positive:
        return ""

    # widths를 직접 12-grid로 환산 (실제 Figma 픽셀 기반)
    scaled = _scale_to_12([w if w > 0 else 1 for w in widths])
    grid_type, grid_pattern, _, distance = _best_grid_type(list(widths))

    scaled_str = ":".join(str(s) for s in scaled)

    # 정확히 매칭: 기존처럼 type 강제
    if distance == 0:
        panel_desc = " | ".join(
            f"{name}({p}col)" for name, p in zip(panel_names, grid_pattern)
        )
        return (
            f'\n## 📐 GridLayout 자동 감지 (반드시 따르세요)\n'
            f'→ `<GridLayout type="{grid_type}">` ({scaled_str} = {panel_desc})\n'
            f'- Figma w: {widths} → 12-grid: {list(scaled)}\n'
            f'- 각 패널은 GridLayout의 자식 `<div>`로 감싸세요\n'
        )

    # 근사 매칭: 강제하지 않고 실제 비율 + 후보 제시
    candidates = _candidate_grid_types(scaled, top_k=3)
    cand_lines = []
    for gtype, pattern, dist in candidates:
        pat_str = ":".join(str(p) for p in pattern)
        cand_lines.append(f'  - `type="{gtype}"` ({pat_str}) — 차이 {dist}')

    panel_widths = ", ".join(f'{name}={w}px' for name, w in zip(panel_names, widths))

    return (
        f'\n## 📐 Figma 레이아웃 분석 (정확한 매칭 없음 — 주의)\n'
        f'- 실제 Figma 패널 폭: {panel_widths}\n'
        f'- 12-grid 환산: **{scaled_str}** (표준 GridLayout type과 불일치)\n'
        f'- 후보 type (가까운 순):\n'
        + "\n".join(cand_lines) + "\n"
        f'- ⚠️ **실제 비율은 {scaled_str}** — 시맨틱과 시각 비율을 함께 고려해 위 후보 중 하나를 선택하세요. '
        f'"트리+목록+상세"면 G, "균등 3열"이면 E, "검토/승인 중앙강조"면 F가 우선 후보입니다.\n'
    )
