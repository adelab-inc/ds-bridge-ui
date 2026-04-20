"""figma_simplify 모듈 단위 테스트."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.figma_simplify import (
    _dedup_repeated_rows,
    _row_signature,
    padding_shorthand,
    parse_component_name,
    simplify_component_props,
    simplify_node,
)


# ---------------------------------------------------------------------------
# padding_shorthand
# ---------------------------------------------------------------------------

class TestPaddingShorthand:
    def test_all_zero(self):
        assert padding_shorthand({"top": 0, "right": 0, "bottom": 0, "left": 0}) is None

    def test_all_same(self):
        assert padding_shorthand({"top": 16, "right": 16, "bottom": 16, "left": 16}) == "16"

    def test_symmetric(self):
        assert padding_shorthand({"top": 0, "right": 24, "bottom": 0, "left": 24}) == "0 24"

    def test_three_values(self):
        assert padding_shorthand({"top": 10, "right": 20, "bottom": 30, "left": 20}) == "10 20 30"

    def test_four_values(self):
        assert padding_shorthand({"top": 10, "right": 20, "bottom": 30, "left": 40}) == "10 20 30 40"

    def test_partial_zero(self):
        assert padding_shorthand({"top": 20, "right": 24, "bottom": 20, "left": 24}) == "20 24"


# ---------------------------------------------------------------------------
# parse_component_name
# ---------------------------------------------------------------------------

class TestParseComponentName:
    def test_simple_name(self):
        name, variant = parse_component_name("header")
        assert name == "header"
        assert variant == {}

    def test_variant_with_defaults_stripped(self):
        name, variant = parse_component_name(
            "Size=sm, Type=tertiary, Disabled=False, Focus=False, Interaction=default"
        )
        assert name is None
        assert variant == {"size": "sm", "type": "tertiary"}

    def test_all_defaults(self):
        name, variant = parse_component_name("Disabled=False, Focus=False, Interaction=default")
        assert name is None
        assert variant == {}

    def test_meaningful_values_kept(self):
        name, variant = parse_component_name("Size=lg, State=Active, Hover=True")
        assert name is None
        # Hover is _STATE_PROPS → removed, State는 _STATE_PROPS 아님 → 유지
        assert variant == {"size": "lg", "state": "Active"}


# ---------------------------------------------------------------------------
# simplify_component_props
# ---------------------------------------------------------------------------

class TestSimplifyComponentProps:
    def test_icon_ids_removed(self):
        props = {
            "End icon(16)#93:381": "5:2693",
            "Start icon(16)#93:127": "168:3005",
            "Label#307:254": "신계약등록2",
            "Size": "sm",
            "Type": "tertiary",
        }
        result = simplify_component_props(props)
        assert "end icon(16)" not in result
        assert "start icon(16)" not in result
        assert result["label"] == "신계약등록2"
        assert result["size"] == "sm"
        assert result["type"] == "tertiary"

    def test_show_toggles_removed(self):
        props = {
            "Show start icon#307:0": False,
            "Show end icon#307:127": True,
            "Label#307:254": "버튼",
        }
        result = simplify_component_props(props)
        assert "show start icon" not in result
        assert "show end icon" not in result
        assert result["label"] == "버튼"

    def test_state_props_removed(self):
        props = {
            "Focus": "False",
            "Interaction": "default",
            "Disabled": "False",
            "Size": "sm",
        }
        result = simplify_component_props(props)
        assert "Focus" not in result and "focus" not in result
        assert "Interaction" not in result and "interaction" not in result
        assert "Disabled" not in result  # "False" is in _DEFAULT_VALUES
        assert result["size"] == "sm"

    def test_empty_values_removed(self):
        props = {
            "Type": "status",
            "Status Variant": "info",
            "Level Variant": "",
            "Appearance": "subtle",
        }
        result = simplify_component_props(props)
        assert result["type"] == "status"
        assert result["status variant"] == "info"
        assert "level variant" not in result  # 빈 값 제거
        assert result["appearance"] == "subtle"


# ---------------------------------------------------------------------------
# Badge variant preservation
# ---------------------------------------------------------------------------

class TestBadgeVariantPreservation:
    """Badge INSTANCE의 variant가 simplify_node를 통과해도 보존되는지 확인."""

    def test_status_badge_variant(self):
        """NEW 배지: type=status, status=info, appearance=subtle."""
        node = {
            "name": "Badge",
            "type": "INSTANCE",
            "componentName": "Type=status, Status Variant=info, Level Variant=, Appearance=subtle",
        }
        result = simplify_node(node, depth=1)
        assert result["variant"]["type"] == "status"
        assert result["variant"]["status"] == "info"
        assert result["variant"]["appearance"] == "subtle"
        assert "level" not in result["variant"]  # 빈 값은 제거

    def test_level_badge_variant(self):
        """공지 배지: type=level, level=primary, appearance=subtle."""
        node = {
            "name": "Badge",
            "type": "INSTANCE",
            "componentName": "Type=level, Status Variant=, Level Variant=primary, Appearance=subtle",
        }
        result = simplify_node(node, depth=1)
        assert result["variant"]["type"] == "level"
        assert result["variant"]["level"] == "primary"
        assert result["variant"]["appearance"] == "subtle"
        assert "status" not in result["variant"]  # 빈 값은 제거

    def test_badge_variant_via_component_props(self):
        """componentProps 경로로 Badge variant가 보존되는지 확인."""
        node = {
            "name": "Badge",
            "type": "INSTANCE",
            "component": "Badge",
            "componentProps": {
                "Type": "status",
                "Status Variant": "info",
                "Level Variant": "",
                "Appearance": "subtle",
                "Label#123:456": "NEW",
            },
        }
        result = simplify_node(node, depth=1)
        assert result["label"] == "NEW"
        assert result["variant"]["type"] == "status"
        assert result["variant"]["status"] == "info"
        assert result["variant"]["appearance"] == "subtle"
        assert "level" not in result["variant"]

    def test_badge_render_hint(self):
        """Badge INSTANCE에 ⚠️_RENDER 힌트가 추가되는지 확인."""
        node = {
            "name": "Badge",
            "type": "INSTANCE",
            "component": "Badge",
            "componentProps": {
                "Type": "status",
                "Status Variant": "info",
            },
        }
        result = simplify_node(node, depth=1)
        assert "⚠️_RENDER" in result
        assert "<Badge>" in result["⚠️_RENDER"]


# ---------------------------------------------------------------------------
# Badge 2중 INSTANCE variant 병합
# ---------------------------------------------------------------------------

class TestBadge2LevelMerge:
    """부모 Badge + 자식 Badge → variant/label 병합."""

    def test_merge_same_component(self):
        """부모 Badge(type=level) + 자식 Badge(level=primary, appearance=subtle) → 단일 Badge."""
        node = {
            "name": "Badge",
            "type": "INSTANCE",
            "component": "Badge",
            "variant": {"type": "level"},
            "children": [
                {
                    "name": "Badge",
                    "type": "INSTANCE",
                    "component": "Badge",
                    "variant": {"level": "primary", "appearance": "subtle"},
                    "label": "공지",
                }
            ],
        }
        result = simplify_node(node, depth=1)
        assert result["variant"]["type"] == "level"
        assert result["variant"]["level"] == "primary"
        assert result["variant"]["appearance"] == "subtle"
        assert result["label"] == "공지"
        assert "children" not in result

    def test_no_merge_different_component(self):
        """부모와 자식이 다른 컴포넌트면 병합하지 않음."""
        node = {
            "name": "Card",
            "type": "INSTANCE",
            "component": "Card",
            "variant": {"size": "lg"},
            "children": [
                {
                    "name": "Badge",
                    "type": "INSTANCE",
                    "component": "Badge",
                    "variant": {"type": "status"},
                }
            ],
        }
        result = simplify_node(node, depth=1)
        assert "children" in result
        assert len(result["children"]) == 1

    def test_merge_preserves_other_children(self):
        """같은 컴포넌트 자식은 병합, 다른 자식은 유지."""
        node = {
            "name": "Badge",
            "type": "INSTANCE",
            "component": "Badge",
            "variant": {"type": "level"},
            "children": [
                {
                    "name": "Badge",
                    "type": "INSTANCE",
                    "component": "Badge",
                    "variant": {"level": "primary"},
                    "label": "공지",
                },
                {
                    "name": "Icon",
                    "type": "INSTANCE",
                    "component": "Icon",
                    "variant": {"name": "check"},
                },
            ],
        }
        result = simplify_node(node, depth=1)
        assert result["variant"]["level"] == "primary"
        assert result["label"] == "공지"
        assert "children" in result
        assert len(result["children"]) == 1
        assert result["children"][0]["component"] == "Icon"


# ---------------------------------------------------------------------------
# 반복 행 중복 제거
# ---------------------------------------------------------------------------

class TestDedupRepeatedRows:
    """_dedup_repeated_rows: 구조 동일한 형제 3개 이상이면 첫 번째만 유지."""

    def test_no_dedup_under_threshold(self):
        """2개 이하는 중복 제거 안 함."""
        children = [
            {"type": "FRAME", "component": "Row"},
            {"type": "FRAME", "component": "Row"},
        ]
        result = _dedup_repeated_rows(children)
        assert len(result) == 2

    def test_dedup_three_identical(self):
        """동일 구조 3개 → 첫 번째만 유지 + _repeatedRows=3."""
        children = [
            {"type": "FRAME", "children": [{"type": "INSTANCE", "component": "Badge"}]},
            {"type": "FRAME", "children": [{"type": "INSTANCE", "component": "Badge"}]},
            {"type": "FRAME", "children": [{"type": "INSTANCE", "component": "Badge"}]},
        ]
        result = _dedup_repeated_rows(children)
        assert len(result) == 1
        assert result[0]["_repeatedRows"] == 3

    def test_dedup_preserves_header(self):
        """헤더(다른 구조) + 데이터행(같은 구조 4개) → 헤더 + 첫 데이터행만."""
        header = {"type": "FRAME", "children": [{"type": "TEXT", "component": ""}]}
        data_row = {"type": "FRAME", "children": [{"type": "INSTANCE", "component": "Badge"}]}
        children = [header, data_row, data_row.copy(), data_row.copy(), data_row.copy()]
        result = _dedup_repeated_rows(children)
        assert len(result) == 2
        assert "_repeatedRows" not in result[0]
        assert result[1]["_repeatedRows"] == 4

    def test_signature_ignores_values(self):
        """구조는 같지만 값이 다른 행도 동일 시그니처."""
        sig1 = _row_signature({"type": "FRAME", "children": [{"type": "INSTANCE", "component": "Badge"}]})
        sig2 = _row_signature({"type": "FRAME", "children": [{"type": "INSTANCE", "component": "Badge", "label": "다름"}]})
        assert sig1 == sig2


# ---------------------------------------------------------------------------
# simplify_node
# ---------------------------------------------------------------------------

class TestSimplifyNode:
    def test_layout_mode_mapping(self):
        node = {"name": "page", "type": "FRAME", "layoutMode": "VERTICAL"}
        result = simplify_node(node)
        assert result["layout"] == "column"
        assert "layoutMode" not in result

    def test_horizontal_mapping(self):
        node = {"name": "row", "type": "FRAME", "layoutMode": "HORIZONTAL"}
        result = simplify_node(node)
        assert result["layout"] == "row"

    def test_grid_mapping(self):
        node = {"name": "grid", "type": "FRAME", "layoutMode": "GRID"}
        result = simplify_node(node)
        assert result["layout"] == "grid"

    def test_item_spacing_to_gap(self):
        node = {"name": "x", "type": "FRAME", "itemSpacing": 20}
        result = simplify_node(node)
        assert result["gap"] == 20
        assert "itemSpacing" not in result

    def test_zero_spacing_omitted(self):
        node = {"name": "x", "type": "FRAME", "itemSpacing": 0}
        result = simplify_node(node)
        assert "gap" not in result

    def test_padding_shorthand(self):
        node = {
            "name": "x",
            "type": "FRAME",
            "padding": {"top": 0, "right": 24, "bottom": 0, "left": 24},
        }
        result = simplify_node(node)
        assert result["padding"] == "0 24"

    def test_zero_padding_omitted(self):
        node = {
            "name": "x",
            "type": "FRAME",
            "padding": {"top": 0, "right": 0, "bottom": 0, "left": 0},
        }
        result = simplify_node(node)
        assert "padding" not in result

    def test_strip_keys_removed(self):
        node = {
            "name": "x",
            "type": "FRAME",
            "id": "123:456",
            "pluginData": {},
            "fills": [],
            "strokes": [],
            "effects": [],
            "blendMode": "NORMAL",
        }
        result = simplify_node(node)
        assert result == {"name": "x", "type": "FRAME"}

    def test_characters_preserved(self):
        node = {"name": "text", "type": "TEXT", "characters": "안녕하세요"}
        result = simplify_node(node)
        assert result["characters"] == "안녕하세요"

    def test_size_root_preserved(self):
        node = {"name": "root", "type": "FRAME", "size": {"width": 1920, "height": 1080}}
        result = simplify_node(node, depth=0)
        assert result["w"] == 1920
        assert result["h"] == 1080

    def test_size_child_only_fill(self):
        node = {"name": "child", "type": "FRAME", "size": {"width": 500, "height": "FILL"}}
        result = simplify_node(node, depth=1)
        assert result["w"] == 500  # 모든 깊이에서 w 보존 (col-span 계산용)
        assert result["h"] == "FILL"

    def test_size_child_fixed_removed(self):
        node = {"name": "child", "type": "FRAME", "size": {"width": 200, "height": 100}}
        result = simplify_node(node, depth=1)
        assert result["w"] == 200  # 모든 깊이에서 w 보존
        assert result["h"] == 100

    def test_component_name_parsed(self):
        node = {
            "name": "Button",
            "type": "INSTANCE",
            "componentName": "Size=sm, Type=tertiary, Disabled=False, Focus=False, Interaction=default",
            "componentProps": {
                "Label#307:254": "신계약등록2",
                "End icon(16)#93:381": "5:2693",
                "Show start icon#307:0": False,
                "Size": "sm",
                "Type": "tertiary",
                "Disabled": "False",
                "Focus": "False",
                "Interaction": "default",
            },
            "size": {"width": 93, "height": 32},
        }
        result = simplify_node(node, depth=1)
        assert result["name"] == "Button"
        assert result["type"] == "INSTANCE"
        assert result["variant"] == {"size": "sm", "buttonType": "tertiary"}
        assert result["label"] == "신계약등록2"
        assert "componentName" not in result
        assert "componentProps" not in result

    def test_depth_limit(self):
        node = {
            "name": "deep",
            "type": "FRAME",
            "children": [{"name": "child", "type": "FRAME"}],
        }
        # depth > max_depth 이면 None 반환
        result = simplify_node(node, depth=9, max_depth=8)
        assert result is None

    def test_at_max_depth_still_works(self):
        node = {"name": "edge", "type": "FRAME"}
        result = simplify_node(node, depth=8, max_depth=8)
        assert result is not None
        assert result["name"] == "edge"

    def test_children_recursive(self):
        node = {
            "name": "parent",
            "type": "FRAME",
            "layoutMode": "VERTICAL",
            "children": [
                {
                    "name": "child1",
                    "type": "FRAME",
                    "layoutMode": "HORIZONTAL",
                    "itemSpacing": 10,
                },
                {
                    "name": "child2",
                    "type": "TEXT",
                    "characters": "hello",
                },
            ],
        }
        result = simplify_node(node)
        assert result["layout"] == "column"
        assert len(result["children"]) == 2
        assert result["children"][0]["layout"] == "row"
        assert result["children"][0]["gap"] == 10
        assert result["children"][1]["characters"] == "hello"


# ---------------------------------------------------------------------------
# 통합: 샘플 레이아웃으로 압축률 검증
# ---------------------------------------------------------------------------

class TestCompression:
    @pytest.fixture()
    def sample_layout(self):
        path = Path(__file__).resolve().parent.parent / "layout" / "3985-55609.compact.json"
        if not path.exists():
            pytest.skip("샘플 레이아웃 파일 없음")
        with open(path) as f:
            return json.load(f)

    def test_compression_ratio(self, sample_layout):
        raw_layout = sample_layout.get("layout", {})
        original = json.dumps(raw_layout, ensure_ascii=False, separators=(",", ":"))
        simplified = simplify_node(raw_layout)
        compressed = json.dumps(simplified, ensure_ascii=False, separators=(",", ":"))

        original_size = len(original.encode("utf-8"))
        compressed_size = len(compressed.encode("utf-8"))
        ratio = 1 - compressed_size / original_size

        print(f"\n원본: {original_size} bytes → 압축: {compressed_size} bytes ({ratio:.0%} 절감)")
        assert ratio >= 0.40, f"압축률 {ratio:.0%}이 40% 미만"

    def test_text_preserved(self, sample_layout):
        """원본의 characters/텍스트가 간소화 후에도 보존되는지 확인."""
        raw_layout = sample_layout.get("layout", {})

        def collect_texts(node: dict) -> set[str]:
            texts = set()
            if "characters" in node:
                texts.add(node["characters"])
            for child in node.get("children", []):
                texts.update(collect_texts(child))
            return texts

        def collect_simplified_texts(node: dict) -> set[str]:
            texts = set()
            if "characters" in node:
                texts.add(node["characters"])
            for key in ("label", "title", "text", "placeholder"):
                if key in node:
                    texts.add(node[key])
            for child in node.get("children", []):
                texts.update(collect_simplified_texts(child))
            return texts

        original_texts = collect_texts(raw_layout)
        simplified = simplify_node(raw_layout)
        simplified_texts = collect_simplified_texts(simplified)

        missing = original_texts - simplified_texts
        assert not missing, f"텍스트 누락: {missing}"
