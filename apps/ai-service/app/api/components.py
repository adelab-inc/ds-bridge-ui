import asyncio
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import verify_api_key
from app.services.figma_simplify import simplify_node
from app.services.supabase_storage import (
    DEFAULT_AG_GRID_SCHEMA_KEY,
    DEFAULT_AG_GRID_TOKENS_KEY,
    fetch_ag_grid_tokens_from_storage,
    fetch_design_tokens_from_storage,
    fetch_schema_from_storage,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)

# 스키마 리로드 시 동시성 보호를 위한 Lock
_reload_lock = asyncio.Lock()


# ============================================================================
# Schema Loading
# ============================================================================


def load_component_schema() -> tuple[dict | None, str | None]:
    """컴포넌트 스키마 JSON 로드 (로컬 파일 fallback)"""
    schema_path = Path(__file__).parent.parent.parent / "component-schema.json"
    if not schema_path.exists():
        logger.warning("Local component-schema.json not found, will use Supabase Storage at runtime")
        return None, None

    with open(schema_path, encoding="utf-8") as f:
        return json.load(f), None


# ============================================================================
# Schema → Prompt Formatting
# ============================================================================

# WHITELIST: Intersection of AI schema (component-schema.json) and UMD bundle exports
# Components that are both in schema AND available at runtime
AVAILABLE_COMPONENTS_WHITELIST = {
    # Basic
    "Button",
    "Icon",
    "IconButton",
    "Link",
    # Display
    "Alert",
    "Badge",
    "Chip",
    "ChipGroup",
    "Dialog",
    "Drawer",
    "Divider",
    "Heading",
    "LoadingSpinner",
    "Tag",
    "TagGroup",
    "Tooltip",
    # Form
    "Checkbox",
    "Field",
    "FieldGroup",
    "Radio",
    "Select",
    "ToggleSwitch",
    "Option",
    "OptionGroup",
    # Navigation
    "Tab",
    "Segment",
    "TreeMenu",
    # Layout / Composite
    "ActionBar",
    "FilterBar",
    "FormGrid",
    "FormGridCell",
    "GridLayout",
    "LabelValue",
    "Popover",
    "RowPattern",
    "RowSlot",
    "SectionColumnProvider",
    "TitleSection",
    # Data
    "DataGrid",
    "AgChartComponent",
    # Provider / Utility
    "Item",
    "ModalStackProvider",
    "SpacingModeProvider",
    "ToastContainer",
    "ToastProvider",
}

# --------------------------------------------------------------------------- #
# Component Visual Guide — 사용 가이드 룩업 테이블
# --------------------------------------------------------------------------- #

# 컴포넌트 + variant → 사용 가이드 (JSON에 없는 도메인 지식)
_USAGE_GUIDELINES: dict[str, dict[str, str]] = {
    "button": {
        "primary": "최종 CTA (가입완료, 신청) — 화면당 0~1개, 진한 파란색 배경 #0033a0 흰 글자",
        "secondary": "주요 액션 (조회, 검색, 저장, 등록, 글쓰기) — 연한 하늘색 배경 #98b3ee",
        "tertiary": "낮은 강조 (엑셀, 인쇄) — 회색 배경",
        "ghost": "텍스트 전용 (초기화, 취소) — 투명 배경, 파란색 글자, 테두리 없음",
        "destructive": "삭제/해지 등 위험 액션 — 빨간색 배경",
        "secondary-destructive": "위험 보조 버튼 — 빨간 배경 연한",
    },
    "iconButton": {
        "ghost": "투명 배경 아이콘",
        "secondary": "연한 배경",
        "tertiary": "회색 배경",
    },
    "alert": {
        "default": "일반 안내",
        "info": "정보",
        "success": "성공",
        "warning": "주의",
        "error": "오류",
    },
}

# Badge/Chip처럼 compoundVariants로 색상이 결정되는 컴포넌트의 명시적 가이드
# format_component_visual_guide()의 variant 단일 클래스 파싱으로는 못 잡으므로 별도 정의
_COMPOUND_VARIANT_GUIDES: dict[str, str] = {
    "badge": (
        "### Badge\n"
        "Props: `type` + `status`/`level` + `appearance` + `label`\n"
        "- type=\"level\": level=\"primary\" | \"neutral\"\n"
        "- type=\"status\": status=\"info\" | \"success\" | \"warning\" | \"error\"\n"
        "- type=\"count\": label={숫자}\n"
        "- type=\"dot\": 점 표시용 (label 없음)\n"
        "- appearance: \"solid\" (진한 배경, 기본) | \"subtle\" (연한 배경)\n"
        "- label: 텍스트 내용 (React.ReactNode)\n"
        "- **색상은 status/level prop이 자동 결정. className으로 색상 지정 금지.**\n"
        "- **prop 이름: `status` (NOT statusVariant), `level` (NOT levelVariant)**\n"
        "- **fill→variant 결정: 레이아웃 JSON의 fill 값 또는 variant 필드를 아래 '컴포넌트 fill→variant 매핑' 섹션과 대조**\n"
    ),
    "chip": (
        "### Chip\n"
        "Props: `variant` + `state` + `size`\n"
        "- variant: \"default\" (배경 있음) | \"ghost\" (배경 없음)\n"
        "- state: \"default\" | \"selected\" (선택됨, 파란 배경) | \"disabled\"\n"
        "- size: \"md\" | \"sm\"\n"
        "- **색상은 state/variant prop이 자동 결정합니다. className에 색상을 직접 지정하지 마세요.**\n"
        "- Figma에서 selected 상태이면 state=\"selected\" 사용\n"
    ),
}


def format_prop_type(prop_type: list | str) -> str:
    """
    prop 타입을 문자열로 포맷
    - list인 경우 enum 값들을 | 로 연결 (전체 표시)
    """
    if isinstance(prop_type, list):
        return " | ".join(f'"{v}"' for v in prop_type)
    return str(prop_type)


# Schema에 누락된 HTML 기반 props 보충 데이터
# 실제 소스: storybook-standalone/packages/ui/src/components/*.tsx
# NOTE: disabled/readOnly HTML 속성은 interaction prop으로 통합됨 (interaction="disabled" / "readonly")
_SCHEMA_SUPPLEMENTS: dict[str, dict[str, dict]] = {
    "Field": {
        "type": {"type": ["text", "email", "password", "number", "date", "tel", "url", "search"], "required": False, "defaultValue": "text"},
        "placeholder": {"type": "string", "required": False},
        "value": {"type": "string", "required": False},
        "onChange": {"type": "(e: ChangeEvent) => void", "required": False},
        "required": {"type": "boolean", "required": False},
        "name": {"type": "string", "required": False},
    },
    "Button": {
        "type": {"type": ["button", "submit", "reset"], "required": False, "defaultValue": "button"},
    },
    "Radio": {
        "name": {"type": "string", "required": False},
        "value": {"type": "string", "required": False},
    },
    "Checkbox": {
        "name": {"type": "string", "required": False},
        "value": {"type": "string", "required": False},
    },
    "Select": {
        "required": {"type": "boolean", "required": False},
    },
}


def _supplement_schema(schema: dict) -> dict:
    """Schema에 누락/변경된 props를 실제 소스 기준으로 교정 (스키마에 있는 컴포넌트만)"""
    components = schema.get("components", {})

    # Badge: 스키마의 statusVariant/levelVariant → 실제 소스는 status/level
    badge_props = components.get("Badge", {}).get("props", {})
    for old, new in [("statusVariant", "status"), ("levelVariant", "level")]:
        if old in badge_props and new not in badge_props:
            badge_props[new] = badge_props.pop(old)
        elif old in badge_props:
            del badge_props[old]
    # Badge: label prop 추가 (스키마에 누락됨)
    if "Badge" in components and "label" not in badge_props:
        badge_props["label"] = {"type": "React.ReactNode", "required": False}

    # Button: 스키마의 variant → 실제 소스는 buttonType, 값 목록도 다름
    btn_props = components.get("Button", {}).get("props", {})
    if "variant" in btn_props:
        del btn_props["variant"]
    btn_props["buttonType"] = {
        "type": ["primary", "secondary", "tertiary", "ghost", "destructive", "ghost-inverse", "secondary-destructive"],
        "required": False,
    }
    # Button: 구버전 icon props 제거 → showStartIcon/startIcon 패턴
    for old_prop in ("leftIcon", "rightIcon", "isLoading", "isDisabled"):
        btn_props.pop(old_prop, None)
    btn_props["label"] = {"type": "React.ReactNode", "required": True}
    btn_props["showStartIcon"] = {"type": "boolean", "required": False}
    btn_props["startIcon"] = {"type": "React.ReactNode", "required": False}
    btn_props["showEndIcon"] = {"type": "boolean", "required": False}
    btn_props["endIcon"] = {"type": "React.ReactNode", "required": False}
    btn_props["interaction"] = {
        "type": ["default", "disabled", "loading"],
        "required": False,
    }

    # IconButton: 스키마에 variant → iconButtonType
    ibtn_props = components.get("IconButton", {}).get("props", {})
    if "variant" in ibtn_props:
        del ibtn_props["variant"]
    ibtn_props["iconButtonType"] = {
        "type": ["primary", "secondary", "tertiary", "ghost", "destructive", "ghost-inverse"],
        "required": False,
    }
    for old_prop in ("leftIcon", "rightIcon", "isLoading", "isDisabled"):
        ibtn_props.pop(old_prop, None)
    ibtn_props["iconOnly"] = {"type": "React.ReactNode", "required": True}
    ibtn_props["interaction"] = {
        "type": ["default", "disabled", "loading"],
        "required": False,
    }

    # DEPRECATED: isDisabled/isReadOnly → interaction prop으로 통합됨 (d537869)
    _PROP_RENAMES = {"isDisabled": "disabled", "isReadOnly": "readOnly"}
    for comp_data in components.values():
        props = comp_data.get("props", {})
        for old_name, new_name in _PROP_RENAMES.items():
            if old_name in props and new_name not in props:
                props[new_name] = props.pop(old_name)
            elif old_name in props and new_name in props:
                del props[old_name]

    for comp_name, extra_props in _SCHEMA_SUPPLEMENTS.items():
        if comp_name in components:
            existing = components[comp_name].get("props", {})
            for prop_name, prop_def in extra_props.items():
                if prop_name not in existing:
                    existing[prop_name] = prop_def
    return schema


def format_component_docs(schema: dict) -> str:
    """
    JSON 스키마를 프롬프트용 컴포넌트 문서로 변환

    출력 형식:
    ### Category

    **ComponentName** `children: ReactNode`
    ├─ propName: "value1" | "value2" (= defaultValue)
    ├─ propName: type [required]
    └─ propName: type
    """
    lines = []
    schema = _supplement_schema(schema)
    components = schema.get("components", {})

    if not components:
        return "No components available."

    # 카테고리별 그룹화 (화이트리스트에 있는 컴포넌트만 포함)
    categories: dict[str, list] = {}
    for comp_name, comp_data in components.items():
        if comp_name not in AVAILABLE_COMPONENTS_WHITELIST:
            continue
        category = comp_data.get("category", "Other")
        categories.setdefault(category, []).append((comp_name, comp_data))

    for category, comps in sorted(categories.items()):
        lines.append(f"### {category}")
        lines.append("")

        for comp_name, comp_data in sorted(comps, key=lambda x: x[0]):
            props = comp_data.get("props", {})
            description = comp_data.get("description", "")

            # children 여부 확인
            has_children = "children" in props
            children_note = " `children`" if has_children else ""

            # 컴포넌트 헤더
            header = f"**{comp_name}**{children_note}"
            if description and len(description) < 50:
                header += f" - {description}"
            lines.append(header)

            # props 포맷팅 (children, 아이콘 보조 prop 제외)
            _HIDDEN_PROPS = {"children", "leftIcon", "rightIcon", "hasIcon"}
            prop_lines = []
            for prop_name, prop_info in props.items():
                if prop_name in _HIDDEN_PROPS:
                    continue

                prop_type = prop_info.get("type", "any")
                required = prop_info.get("required", False)
                default = prop_info.get("defaultValue")

                # 타입 문자열
                type_str = format_prop_type(prop_type)

                # 라인 구성
                line = f"  ├─ {prop_name}: {type_str}"

                if required:
                    line += " [required]"
                elif default is not None:
                    # default 값 포맷팅
                    if isinstance(default, str):
                        line += f' (= "{default}")'
                    elif isinstance(default, bool):
                        line += f" (= {str(default).lower()})"
                    else:
                        line += f" (= {default})"

                prop_lines.append(line)

            # 마지막 줄은 └─ 로 변경
            if prop_lines:
                prop_lines[-1] = prop_lines[-1].replace("├─", "└─")
                lines.extend(prop_lines)

            lines.append("")

    return "\n".join(lines)


def get_available_components_note(schema: dict) -> str:
    """사용 가능한 컴포넌트 목록 문자열 생성 (화이트리스트만)"""
    components = schema.get("components", {})
    names = sorted(name for name in components.keys() if name in AVAILABLE_COMPONENTS_WHITELIST)
    return f"**Available Components ({len(names)}):** {', '.join(names)}\n\n"


def _build_component_color_mapping(colors: dict[str, str]) -> str:
    """디자인 토큰의 컴포넌트 색상에서 fill hex → variant 매핑 테이블을 동적 생성.

    토큰 키 패턴: {component}-{variant_info}-{property}
    예: badge-status-warning-subtle-bg → component=Badge, status=warning, appearance=subtle

    Returns:
        프롬프트에 포함할 매핑 테이블 문자열
    """
    import re

    # 매핑 대상 컴포넌트 접두사
    _COMP_PREFIXES = ("badge-", "chip-", "tag-", "alert-")

    # bg 토큰만 수집 (fill 매칭용 — text 토큰은 제외)
    # {hex_value: {component, variant_props}} 형태로 정리
    mapping_lines: list[str] = []
    # 컴포넌트별 그룹핑
    comp_groups: dict[str, list[str]] = {}

    for token_name in sorted(colors.keys()):
        if not any(token_name.startswith(p) for p in _COMP_PREFIXES):
            continue

        hex_val = colors[token_name]

        # bg 토큰에서 variant 정보 추출
        # 예: badge-status-warning-subtle-bg → parts: [badge, status, warning, subtle, bg]
        # 예: badge-primary-solid-bg → parts: [badge, primary, solid, bg]
        # 예: chip-status-info-subtle-bg → parts: [chip, status, info, subtle, bg]
        parts = token_name.split("-")
        if len(parts) < 3:
            continue

        comp = parts[0]  # badge, chip, tag, alert
        prop_suffix = parts[-1]  # bg, text

        # bg 토큰 → fill 매핑, text 토큰 → 참고용
        middle = parts[1:-1]  # status/warning/subtle 등

        if comp not in comp_groups:
            comp_groups[comp] = []
        comp_groups[comp].append(f"    `{hex_val}` ({token_name}) → {'/'.join(middle)}")

    if not comp_groups:
        return ""

    lines: list[str] = []
    for comp, entries in sorted(comp_groups.items()):
        lines.append(f"  **{comp.capitalize()}**:")
        for entry in entries:
            lines.append(entry)

    return "\n".join(lines)


def format_design_tokens(tokens: dict | None) -> str:
    """
    디자인 토큰을 시스템 프롬프트용 문자열로 포맷팅

    Args:
        tokens: 디자인 토큰 dict (Firebase에서 로드) 또는 None

    Returns:
        포맷팅된 디자인 토큰 문자열
    """
    if not tokens:
        # 토큰이 없으면 기본 하드코딩 값 사용
        return DEFAULT_DESIGN_TOKENS_SECTION

    design_tokens = tokens.get("designTokens", tokens)
    colors = design_tokens.get("colors", {})
    font_size = design_tokens.get("fontSize", {})
    font_weight = design_tokens.get("fontWeight", {})

    # 주요 색상을 토큰에서 추출하여 ready-to-use Tailwind 클래스로 매핑
    def c(token: str, fallback: str = "#000") -> str:
        return colors.get(token, fallback)

    # 시맨틱 색상 매핑 테이블 생성
    color_table_lines = []
    color_map = [
        # (용도, Tailwind text class, Tailwind bg class, 토큰명)
        ("Primary Text (제목, 라벨, 본문)", f"text-[{c('text-primary', '#212529')}]", f"—", "text-primary"),
        ("Secondary Text (보조 텍스트)", f"text-[{c('text-secondary', '#495057')}]", f"—", "text-secondary"),
        ("Tertiary Text (플레이스홀더)", f"text-[{c('text-tertiary', '#6c757d')}]", f"—", "text-tertiary"),
        ("Brand/Accent (링크, 선택 상태)", f"text-[{c('text-accent', '#0033a0')}]", f"bg-[{c('bg-accent', '#0033a0')}]", "text-accent / bg-accent"),
        ("Surface (카드, 패널)", f"—", f"bg-[{c('bg-surface', '#ffffff')}]", "bg-surface"),
        ("Canvas (페이지 배경)", f"—", f"bg-[{c('bg-canvas', '#f4f6f8')}]", "bg-canvas"),
        ("Selection (선택 배경)", f"—", f"bg-[{c('bg-selection', '#ecf0fa')}]", "bg-selection"),
        ("Border Default", f"border-[{c('border-default', '#dee2e6')}]", f"—", "border-default"),
        ("Border Strong", f"border-[{c('border-strong', '#ced4da')}]", f"—", "border-strong"),
        ("Success (완료, 정상)", f"text-[{c('text-semantic-on-success', '#1e4620')}]", f"bg-[{c('bg-semantic-success-subtle', '#e6efe6')}]", "semantic-success"),
        ("Error (실패, 오류)", f"text-[{c('text-semantic-on-error', '#5f2120')}]", f"bg-[{c('bg-semantic-error-subtle', '#fae6e6')}]", "semantic-error"),
        ("Warning (대기, 주의)", f"text-[{c('text-semantic-on-warning', '#663c00')}]", f"bg-[{c('bg-semantic-warning-subtle', '#fdede1')}]", "semantic-warning"),
        ("Info (진행중, 접수)", f"text-[{c('text-semantic-on-info', '#014361')}]", f"bg-[{c('bg-semantic-info-subtle', '#e1f1f9')}]", "semantic-info"),
        ("Disabled", f"text-[{c('text-disabled', '#9da4ab')}]", f"bg-[{c('bg-disabled-on-light', '#eceff3')}]", "disabled"),
        ("Subtle (구분선 배경)", f"—", f"bg-[{c('bg-subtle', '#eceff3')}]", "bg-subtle"),
        ("Gray 50 (가장 연한 회색)", f"—", f"bg-[{c('neutral-gray-50', '#f9fafb')}]", "neutral-gray-50"),
        ("Gray 100 (연한 회색)", f"—", f"bg-[{c('neutral-gray-100', '#f4f6f8')}]", "neutral-gray-100"),
        ("Gray 200", f"—", f"bg-[{c('neutral-gray-200', '#e9ecef')}]", "neutral-gray-200"),
        ("Gray 300", f"border-[{c('neutral-gray-300', '#dee2e6')}]", f"bg-[{c('neutral-gray-300', '#dee2e6')}]", "neutral-gray-300"),
        ("Gray 700 (진한 텍스트)", f"text-[{c('neutral-gray-700', '#495057')}]", f"—", "neutral-gray-700"),
        ("Gray 900 (가장 진한 텍스트)", f"text-[{c('neutral-gray-900', '#212529')}]", f"—", "neutral-gray-900"),
    ]
    for usage, text_cls, bg_cls, token in color_map:
        color_table_lines.append(f"  | {usage} | `{text_cls}` | `{bg_cls}` | {token} |")
    color_table = "\n".join(color_table_lines)

    # 상태 배지/강조용 강한 시맨틱 색상 (배경이 진한 경우)
    strong_semantic = f"""  - Success 강조: `text-white bg-[{c('bg-semantic-success', '#2e7d32')}]`
  - Error 강조: `text-white bg-[{c('bg-semantic-error', '#d32f2f')}]`
  - Warning 강조: `text-white bg-[{c('bg-semantic-warning', '#ed6c02')}]`
  - Info 강조: `text-white bg-[{c('bg-semantic-info', '#0288d1')}]`"""

    # brand 색상 팔레트
    brand_colors = f"""  - Brand Primary: `bg-[{c('brand-primary', '#0033a0')}]` / `text-[{c('brand-primary', '#0033a0')}]`
  - Brand Hover: `bg-[{c('brand-primary-hover', '#154cc1')}]`
  - Brand Pressed: `bg-[{c('brand-primary-pressed', '#002480')}]`"""

    # 컴포넌트별 색상 토큰 → fill hex ↔ variant 매핑 테이블 동적 생성
    comp_color_section = _build_component_color_mapping(colors)

    # 폰트 크기/두께 추출 (Mapping to smaller tokens for better density)
    # Page Title (h1) -> Use Heading LG token
    heading_xl = font_size.get("typography-heading-lg-bold", ["24px", {}])
    heading_xl_weight = font_weight.get("typography-heading-lg-bold", 700)

    # Section Title (h2) -> Use Heading MD token
    heading_lg = font_size.get("typography-heading-md-semibold", ["20px", {}])
    heading_lg_weight = font_weight.get("typography-heading-md-semibold", 600)

    # Subsection (h3) -> Use Body LG Medium token
    heading_md = font_size.get("typography-body-lg-medium", ["18px", {}])
    heading_md_weight = font_weight.get("typography-body-lg-medium", 500)

    # Form Label -> Use Label SM token
    form_label_md = font_size.get("typography-form-label-sm-medium", ["14px", {}])
    form_label_weight = font_weight.get("typography-form-label-sm-medium", 500)

    body_md = font_size.get("typography-body-md-regular", ["16px", {}])
    helper_text = font_size.get("typography-form-helper-text-md-regular", ["14px", {}])

    return f"""## 🎨 DESIGN STANDARDS (CRITICAL - USE TAILWIND CLASSES)
- **Typography (MUST FOLLOW EXACT TOKENS)**:
  - Font Family: `font-['Pretendard',sans-serif]` (applied globally)
  - **Page Title (h1)**: `className="text-2xl font-bold text-[#212529]"` ({heading_xl[0]}, {heading_xl_weight})
  - **Section Title (h2)**: `className="text-xl font-semibold text-[#212529]"` ({heading_lg[0]}, {heading_lg_weight})
  - **Subsection (h3)**: `className="text-lg font-medium text-[#212529]"` ({heading_md[0]}, {heading_md_weight})
  - **Form Label**: `className="text-sm font-medium text-[#212529]"` ({form_label_md[0]}, {form_label_weight})
  - **Body Text**: `className="text-base font-normal text-[#212529]"` ({body_md[0]}, 400)
  - **Helper Text**: `className="text-sm font-normal text-[#495057]"` ({helper_text[0]}, 400)
- **Colors (MUST use exact token hex values below — NEVER guess or invent hex codes)**:

  | 용도 | Text Class | BG Class | Token |
  |------|-----------|----------|-------|
{color_table}

  **⚠️ 위 테이블에 없는 hex 코드를 절대 사용하지 마세요. 연한 회색이 필요하면 neutral-gray-50/100 토큰을 쓰세요.**
  **🚨 Text Class 컬럼의 hex는 텍스트 전용, BG Class 컬럼의 hex는 배경 전용. 교차 사용 절대 금지!**
  **흔한 실수: `text-[#2e7d32]` ❌ → `text-[#1e4620]` ✅ | `text-[#d32f2f]` ❌ → `text-[#5f2120]` ✅ | `text-[#ed6c02]` ❌ → `text-[#663c00]` ✅**

  **시맨틱 텍스트 색상 빠른 참조** (초록/빨강/주황 텍스트가 필요할 때):
  - 성공/양수/정상 텍스트 → `text-[#1e4620]` ✅ (❌ `text-[#2e7d32]` 절대 금지)
  - 실패/음수/오류 텍스트 → `text-[#5f2120]` ✅ (❌ `text-[#d32f2f]` 절대 금지)
  - 경고/보류 텍스트 → `text-[#663c00]` ✅ (❌ `text-[#ed6c02]` 절대 금지)

  **상태 강조 (진한 배경 + 흰 텍스트)**:
{strong_semantic}

  **브랜드 색상**:
{brand_colors}

  **🚨 컴포넌트 fill→variant 매핑** (레이아웃 JSON의 fill hex 값으로 컴포넌트 variant를 결정할 때 이 테이블 참조):
{comp_color_section}

- **Visuals**:
  - **Shadows**: `shadow-sm`
  - **Borders**: `border border-[#dee2e6]`
  - **Radius**: `rounded-lg` (inputs, buttons), `rounded-xl` (cards)
- **Gap/Spacing (Tailwind Classes)**:
  - **xs**: `gap-1` (4px) - 태그 그룹, 아이콘-라벨 (xs)
  - **sm**: `gap-2` (8px) - 컨트롤 그룹, 아이콘-라벨 (md), 콘텐츠 (sm)
  - **md**: `gap-3` (12px) - 필터바, 탭 그룹, 콘텐츠 (md), 폼 그룹 (y)
  - **lg**: `gap-4` (16px) - 다이얼로그, 콘텐츠 (lg), 폼 그룹 (x)
  - **xl**: `gap-6` (24px) - 섹션 간격, 아티클 아이템, 콘텐츠 (xl)
  - **사용 예시**:
    - 버튼/아이콘 간격: `gap-2` (sm)
    - 폼 필드 간격: `gap-4` (lg)
    - 카드/섹션 간격: `gap-6` (xl)
    - 그리드: `gap-x-4 gap-y-6` (col: lg, row: xl)
    - 패딩: `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px), `p-8` (32px), `p-12` (48px)

"""


def format_ag_grid_component_docs(schema: dict | None) -> str:
    """
    AG Grid 컴포넌트 스키마를 프롬프트용 문서로 변환

    Args:
        schema: AG Grid 컴포넌트 스키마 dict 또는 None
                (단일 컴포넌트 구조: componentName, props 등이 최상위에 있음)

    Returns:
        포맷팅된 AG Grid 컴포넌트 문서 문자열
    """
    if not schema:
        return ""

    # AG Grid 스키마는 단일 컴포넌트 구조
    description = schema.get("description", "")
    props = schema.get("props", {})

    if not props:
        return ""

    lines = ["## 📊 AG Grid Component (DataGrid)"]
    lines.append("")
    lines.append(f"**DataGrid** - {description}" if description else "**DataGrid**")
    lines.append("")

    # Import 가이드 (가이드 문서 기준으로 고정)
    lines.append("### Required Imports")
    lines.append("```tsx")
    lines.append("// 기본 사용")
    lines.append("import { DataGrid } from '@aplus/ui';")
    lines.append("import { ColDef } from 'ag-grid-community';")
    lines.append("")
    lines.append("// 셀 렌더러가 필요한 경우")
    lines.append("import { DataGrid, CheckboxCellRenderer, ImageCellRenderer } from '@aplus/ui';")
    lines.append("")
    lines.append("// 컬럼 타입 또는 유틸리티가 필요한 경우")
    lines.append("import { DataGrid, COLUMN_TYPES, AgGridUtils } from '@aplus/ui';")
    lines.append("```")
    lines.append("")

    # 테마 설정
    lines.append("### Theme")
    lines.append("- DataGrid has `aplusGridTheme` built-in. **NO separate theme import needed.**")
    lines.append("- ❌ `import { dsRuntimeTheme } from '@/themes/agGridTheme'` — DOES NOT EXIST")
    lines.append("- ❌ `<AgGridReact theme={dsRuntimeTheme} />` — WRONG, use `<DataGrid />` instead")
    lines.append("- ✅ `<DataGrid rowData={data} columnDefs={cols} height={400} />` — theme auto-applied")
    lines.append("")

    # Props 문서
    lines.append("### Props")
    prop_lines = []
    for prop_name, prop_info in props.items():
        prop_type = prop_info.get("type", "any")
        required = prop_info.get("required", False)
        default = prop_info.get("defaultValue", prop_info.get("default"))
        prop_desc = prop_info.get("description", "")

        type_str = format_prop_type(prop_type)
        line = f"  ├─ {prop_name}: {type_str}"

        if required:
            line += " [required]"
        elif default is not None:
            if isinstance(default, str):
                line += f' (= "{default}")'
            elif isinstance(default, bool):
                line += f" (= {str(default).lower()})"
            else:
                line += f" (= {default})"

        if prop_desc:
            line += f" - {prop_desc[:50]}"

        prop_lines.append(line)

    if prop_lines:
        prop_lines[-1] = prop_lines[-1].replace("├─", "└─")
        lines.extend(prop_lines)

    lines.append("")

    # COLUMN_TYPES
    lines.append("### Predefined Column Types (COLUMN_TYPES)")
    lines.append("Spread these into ColDef for common column formats:")
    lines.append("  ├─ `COLUMN_TYPES.numberColumn` - 우측 정렬, agNumberColumnFilter, width: 130")
    lines.append("  ├─ `COLUMN_TYPES.dateColumn` - agDateColumnFilter, agDateCellEditor, width: 150")
    lines.append("  ├─ `COLUMN_TYPES.currencyColumn` - 우측 정렬, KRW 포맷, width: 150")
    lines.append("  └─ `COLUMN_TYPES.percentColumn` - 우측 정렬, % 접미사, width: 130")
    lines.append("")
    lines.append("```tsx")
    lines.append("const columnDefs: ColDef[] = [")
    lines.append("  { field: 'name', headerName: '이름', flex: 1 },")
    lines.append("  { field: 'age', headerName: '나이', ...COLUMN_TYPES.numberColumn },")
    lines.append("  { field: 'joinDate', headerName: '입사일', ...COLUMN_TYPES.dateColumn },")
    lines.append("  { field: 'salary', headerName: '급여', ...COLUMN_TYPES.currencyColumn },")
    lines.append("  { field: 'rate', headerName: '달성률', ...COLUMN_TYPES.percentColumn },")
    lines.append("];")
    lines.append("```")
    lines.append("")

    # 셀 렌더러
    lines.append("### Cell Renderers")
    lines.append("cellRenderer에 화살표 함수로 React 컴포넌트를 직접 렌더링할 수 있습니다.")
    lines.append("디자인 시스템의 Button 컴포넌트를 사용하면 variant, size 등을 자유롭게 지정할 수 있습니다.")
    lines.append("")
    lines.append("- **CheckboxCellRenderer**: Checkbox in cell. `cellRendererParams: { onCheckboxChange: (data, checked) => ... }`")
    lines.append("- **ImageCellRenderer**: Thumbnail image from field value (30x30)")
    lines.append("")
    lines.append("**Action Button Column Pattern (e.g., '상세', '수정', '삭제'):**")
    lines.append("```tsx")
    lines.append("// ✅ Button 컴포넌트를 cellRenderer 화살표 함수로 직접 사용")
    lines.append("{")
    lines.append("  headerName: '상세',  // 버튼 용도에 따라 '수정', '삭제', '보기' 등으로 변경")
    lines.append("  width: 100,")
    lines.append("  cellRenderer: (params: any) => (")
    lines.append("    <Button buttonType=\"ghost\" size=\"sm\" label=\"상세\" showStartIcon={false} showEndIcon={false} onClick={() => {")
    lines.append("      setSelectedItem(params.data);")
    lines.append("      setIsDetailOpen(true);")
    lines.append("    }} />")
    lines.append("  )")
    lines.append("}")
    lines.append("")
    lines.append("// ❌ ButtonCellRenderer 사용 금지 — 디자인 시스템 미적용, 색상/크기 커스터마이징 불가")
    lines.append("// cellRenderer: ButtonCellRenderer")
    lines.append("```")
    lines.append("")

    # Checkbox 패턴
    lines.append("**Checkbox Column Pattern:**")
    lines.append("⚠️ `onCheckboxChange`에서 반드시 rowData 상태를 업데이트해야 합니다. 안 하면 체크 즉시 해제됩니다.")
    lines.append("```tsx")
    lines.append("const [rowData, setRowData] = useState(initialData);")
    lines.append("")
    lines.append("const columnDefs: ColDef[] = [")
    lines.append("  {")
    lines.append("    field: 'isActive',")
    lines.append("    headerName: '활성',")
    lines.append("    width: 80,")
    lines.append("    cellRenderer: CheckboxCellRenderer,")
    lines.append("    cellRendererParams: {")
    lines.append("      onCheckboxChange: (data: any, checked: boolean) => {")
    lines.append("        setRowData(prev => prev.map(row =>")
    lines.append("          row.id === data.id ? { ...row, isActive: checked } : row")
    lines.append("        ));")
    lines.append("      }")
    lines.append("    }")
    lines.append("  },")
    lines.append("  // ... 나머지 컬럼")
    lines.append("];")
    lines.append("```")
    lines.append("")

    # AgGridUtils
    lines.append("### AgGridUtils")
    lines.append("Store `GridApi` from `onGridReady` event, then use:")
    lines.append("  ├─ `AgGridUtils.exportToCsv(gridApi, 'filename.csv')` - CSV 내보내기")
    lines.append("  ├─ `AgGridUtils.exportToExcel(gridApi, 'filename.xlsx')` - Excel 내보내기")
    lines.append("  ├─ `AgGridUtils.getSelectedRows(gridApi)` - 선택된 행")
    lines.append("  ├─ `AgGridUtils.selectAll(gridApi)` / `deselectAll(gridApi)` - 전체 선택/해제")
    lines.append("  └─ `AgGridUtils.autoSizeAllColumns(gridApi)` - 컬럼 자동 크기")
    lines.append("")

    # 사용 예시
    lines.append("### Usage Example (Basic)")
    lines.append("```tsx")
    lines.append("import { DataGrid, COLUMN_TYPES } from '@aplus/ui';")
    lines.append("import { ColDef } from 'ag-grid-community';")
    lines.append("")
    lines.append("const columnDefs: ColDef[] = [")
    lines.append("  { field: 'name', headerName: '이름', flex: 1 },")
    lines.append("  { field: 'email', headerName: '이메일', flex: 2 },")
    lines.append("  { field: 'salary', headerName: '급여', ...COLUMN_TYPES.currencyColumn },")
    lines.append("  { field: 'status', headerName: '상태', width: 100 },")
    lines.append("];")
    lines.append("")
    lines.append("<DataGrid rowData={rowData} columnDefs={columnDefs} height={400} pagination paginationPageSize={10} />")
    lines.append("```")
    lines.append("")
    lines.append("### Usage Example (Complex - Many Columns + Action Button)")
    lines.append("```tsx")
    lines.append("import { DataGrid, COLUMN_TYPES } from '@aplus/ui';")
    lines.append("import { Button } from '@/components';")
    lines.append("")
    lines.append("// For grouped headers, use headerName prefix instead of column groups")
    lines.append("const columnDefs: ColDef[] = [")
    lines.append("  { field: 'empNo', headerName: '사번', width: 100 },")
    lines.append("  { field: 'name', headerName: '성명', width: 120 },")
    lines.append("  { field: 'dept', headerName: '[인사] 부서', flex: 1 },")
    lines.append("  { field: 'position', headerName: '[인사] 직급', width: 100 },")
    lines.append("  { field: 'joinDate', headerName: '[인사] 입사일', ...COLUMN_TYPES.dateColumn },")
    lines.append("  { field: 'baseSalary', headerName: '[급여] 기본급', ...COLUMN_TYPES.currencyColumn },")
    lines.append("  { field: 'bonus', headerName: '[급여] 상여금', ...COLUMN_TYPES.currencyColumn },")
    lines.append("  { field: 'status', headerName: '상태', width: 100,")
    lines.append("    valueFormatter: (params) => params.value === 'active' ? '재직' : '퇴직' },")
    lines.append("  // Action button — Button 컴포넌트를 cellRenderer로 직접 사용")
    lines.append("  { headerName: '상세', width: 100,")
    lines.append("    cellRenderer: (params: any) => (")
    lines.append("      <Button buttonType=\"ghost\" size=\"sm\" label=\"상세\" showStartIcon={false} showEndIcon={false} onClick={() => { setSelectedItem(params.data); setIsDetailOpen(true); }} />")
    lines.append("    ) },")
    lines.append("];")
    lines.append("")
    lines.append("<DataGrid rowData={rowData} columnDefs={columnDefs} height={600} pagination paginationPageSize={20} />")
    lines.append("```")
    lines.append("")

    # columnDefs 안전 규칙
    lines.append("### ⚠️ CRITICAL: columnDefs Rules (VIOLATION = SILENT GRID FAILURE)")
    lines.append("AG Grid will **silently fail to render** (empty container, no error) if columnDefs are invalid.")
    lines.append("")
    lines.append("**1. FLAT columnDefs ONLY — NO column groups:**")
    lines.append("- ❌ `{ headerName: '인사정보', children: [{ field: 'name' }, { field: 'dept' }] }` — GRID DIES SILENTLY")
    lines.append("- ❌ `marryChildren: true` — NOT SUPPORTED")
    lines.append("- ✅ Use flat columns: `{ field: 'name', headerName: '이름' }, { field: 'dept', headerName: '부서' }`")
    lines.append("- To visually group headers, use `headerName` prefix: `'[인사] 이름'`, `'[인사] 부서'`")
    lines.append("")
    lines.append("**2. cellRenderer — 화살표 함수 또는 named component 사용:**")
    lines.append("- ✅ `cellRenderer: (params) => <Button buttonType=\"ghost\" size=\"sm\" label=\"상세\" showStartIcon={false} showEndIcon={false} />` — 디자인 시스템 Button 직접 사용")
    lines.append("- ✅ `cellRenderer: CheckboxCellRenderer` — Named component from @aplus/ui")
    lines.append("- ✅ `cellRenderer: ImageCellRenderer` — Named component from @aplus/ui")
    lines.append("- ❌ `cellRenderer: ButtonCellRenderer` — 사용 금지 (디자인 시스템 미적용, 파란색 하드코딩)")
    lines.append("- For simple text formatting, use `valueFormatter`: `valueFormatter: (params) => params.value ? '활성' : '비활성'`")
    lines.append("")
    lines.append("**3. pinned 사용 금지:**")
    lines.append("- ❌ `pinned: 'left'`, `pinned: 'right'` — 틀 고정 사용하지 마세요")
    lines.append("")
    lines.append("**4. rowData — 반드시 useState 또는 useMemo로 관리:**")
    lines.append("- ❌ `const rowData = [...]` — 리렌더 시 새 배열 생성 → 체크박스 선택 해제, 스크롤 초기화 등 발생")
    lines.append("- ✅ `const [rowData, setRowData] = useState([...])` — 참조 유지되어 그리드 상태 보존")
    lines.append("")

    # 체크박스 선택 패턴 (AG Grid v34 API) — 강화된 지시
    lines.append("### 🚨 CRITICAL: Checkbox Selection Pattern (AG Grid v34)")
    lines.append("이 프로젝트는 AG Grid v34를 사용합니다. 체크박스 행 선택 시 **반드시 아래 규칙을 따르세요.**")
    lines.append("")
    lines.append("#### 🚫 절대 사용 금지 (RUNTIME ERROR 발생):")
    lines.append("- `rowSelection=\"multiple\"` — 문자열 형태는 v34에서 **삭제됨**, 런타임 에러 발생")
    lines.append("- `rowSelection=\"single\"` — 문자열 형태는 v34에서 **삭제됨**, 런타임 에러 발생")
    lines.append("- `suppressRowClickSelection` — v34에서 **삭제됨**, prop 자체가 존재하지 않음")
    lines.append("- `headerCheckboxSelection: true` in columnDefs — v34에서 **삭제됨**, rowSelection.headerCheckbox로 대체")
    lines.append("")
    lines.append("#### ✅ 유일한 올바른 방법:")
    lines.append("```tsx")
    lines.append("// ⚠️ rowData는 반드시 useState로")
    lines.append("const [rowData] = useState([...initialData]);")
    lines.append("")
    lines.append("// ✅ 체크박스를 원하는 컬럼 위치에 배치 가능 (checkboxSelection: true)")
    lines.append("const columnDefs: ColDef[] = [")
    lines.append("  { field: 'name', headerName: '이름' },")
    lines.append("  { field: 'dept', headerName: '부서', checkboxSelection: true },  // 체크박스가 부서 컬럼에 표시")
    lines.append("  { field: 'age', headerName: '나이' },")
    lines.append("];")
    lines.append("")
    lines.append("// ✅ 다중 선택 + 체크박스로만 선택 (행 클릭으로 선택 안 됨)")
    lines.append("<DataGrid")
    lines.append("  rowData={rowData}")
    lines.append("  columnDefs={columnDefs}")
    lines.append("  rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false }}")
    lines.append("  onSelectionChanged={handleSelectionChanged}")
    lines.append("/>")
    lines.append("")
    lines.append("// ✅ 단일 선택 + 체크박스로만 선택")
    lines.append("<DataGrid")
    lines.append("  rowData={rowData}")
    lines.append("  columnDefs={columnDefs}")
    lines.append("  rowSelection={{ mode: 'singleRow', checkboxes: true, enableClickSelection: false }}")
    lines.append("/>")
    lines.append("")
    lines.append("// ✅ 체크박스 없이 행 클릭으로 선택")
    lines.append("<DataGrid")
    lines.append("  rowData={rowData}")
    lines.append("  columnDefs={columnDefs}")
    lines.append("  rowSelection={{ mode: 'multiRow', enableClickSelection: true }}")
    lines.append("/>")
    lines.append("```")
    lines.append("")
    lines.append("**요약: rowSelection은 반드시 객체 `{{ }}` 형태로 작성. 문자열 금지. suppressRowClickSelection 금지. 체크박스 위치는 columnDefs에서 checkboxSelection: true로 원하는 컬럼에 배치 가능. pinned 사용 금지.**")
    lines.append("")

    # 이벤트 핸들러
    lines.append("### Event Handlers")
    lines.append("DataGrid는 AG Grid 이벤트를 props로 직접 전달할 수 있습니다:")
    lines.append("- `onCellClicked` — 셀 클릭 시 (event.data로 행 데이터 접근)")
    lines.append("- `onRowSelected` — 행 선택/해제 시")
    lines.append("- `onSelectionChanged` — 선택 상태 변경 시 (전체 선택된 행 조회)")
    lines.append("- `onCellValueChanged` — 셀 값 편집 완료 시")
    lines.append("- `onGridReady` — 그리드 초기화 완료 시 (GridApi 저장용)")
    lines.append("")

    # 금지 사항
    lines.append("### ⚠️ DO NOT")
    lines.append("- ❌ `import { AgGridReact } from 'ag-grid-react'` — Use `DataGrid` from `@aplus/ui`")
    lines.append("- ❌ `import { dsRuntimeTheme } from '@/themes/agGridTheme'` — Does NOT exist")
    lines.append("- ❌ `<div style={{ height: 500 }}><DataGrid ... /></div>` — Use `height` prop instead")
    lines.append("- ❌ `style={{ '--ag-header-background-color': 'red' }}` — Do NOT override theme tokens")
    lines.append("")

    return "\n".join(lines)


def format_ag_grid_tokens(tokens: dict | None) -> str:
    """
    AG Grid 토큰을 시스템 프롬프트용 문자열로 포맷팅 (전체 JSON 포함)

    Args:
        tokens: AG Grid 토큰 dict 또는 None

    Returns:
        포맷팅된 AG Grid 토큰 문자열
    """
    if not tokens:
        return ""

    # agGrid 키 아래에 토큰이 있음
    grid_tokens = tokens.get("agGrid", tokens)
    if not grid_tokens:
        return ""

    # 전체 토큰을 JSON으로 포함
    tokens_json = json.dumps(grid_tokens, ensure_ascii=False, indent=2)

    return f"""### AG Grid Styling Tokens

When user requests a specific AG Grid token, look up the EXACT value below.

```json
{tokens_json}
```

"""


def format_component_definitions(definitions: dict | None) -> str:
    """
    컴포넌트 정의에서 default variant 값만 추출하여 프롬프트용 문자열로 포맷팅.
    전체 CSS 클래스 덤프 대신 AI가 필요한 정보(기본값)만 전달하여 토큰 절감.

    Args:
        definitions: 컴포넌트 정의 dict (Firebase에서 로드) 또는 None

    Returns:
        포맷팅된 기본값 테이블 문자열
    """
    if not definitions:
        return ""

    # definitions key(camelCase) → 화이트리스트 name(PascalCase) 매핑
    lines = ["## Component Default Values", ""]
    for def_name, d in definitions.items():
        if "." in def_name:
            continue  # sub-component 스킵
        pascal_name = def_name[0].upper() + def_name[1:]
        if pascal_name not in AVAILABLE_COMPONENTS_WHITELIST:
            continue

        defaults = d.get("defaultVariants", {})
        if not defaults:
            continue

        # boolean false/true, "mode" 같은 내부 전용 제외
        useful = {k: v for k, v in defaults.items()
                  if k != "mode" and not isinstance(v, bool)}
        if not useful:
            continue

        parts = ", ".join(f'{k}="{v}"' for k, v in useful.items())
        lines.append(f"- **{pascal_name}**: {parts}")

    if len(lines) <= 2:
        return ""

    lines.append("")
    return "\n".join(lines) + "\n"


def _extract_color_info(classes: str) -> tuple[str, str, str] | None:
    """
    Tailwind 클래스 문자열에서 (색상 유형, 토큰명, 설명 접미사) 추출.

    반환:
      ("배경", "bg-accent", "accent 배경")         ← bg-bg-accent
      ("배경", "alert-info-bg", "alert-info 배경")  ← bg-alert-info-bg
      ("테두리", "border-accent", "accent 테두리")  ← outline-border-accent
    """
    for cls in classes.split():
        if cls.startswith("bg-"):
            token = cls[3:]  # "bg-bg-accent" → "bg-accent"
            # 토큰명에서 readable 이름 추출
            name = token
            if name.startswith("bg-"):
                name = name[3:]  # "bg-accent" → "accent"
            elif name.startswith("semantic-"):
                parts = name.split("-")
                name = parts[1] if len(parts) > 1 else name  # "semantic-info-subtle" → "info"
            elif name.endswith("-bg"):
                name = name[:-3]  # "alert-info-bg" → "alert-info"
            return ("배경", token, f"{name} 배경")
        if cls.startswith("outline-border-"):
            token = cls[8:]  # "outline-border-accent" → "border-accent"
            name = token[7:] if token.startswith("border-") else token
            return ("테두리", token, f"{name} 테두리")
    return None





def format_component_visual_guide(
    definitions: dict | None,
    design_tokens: dict | None,
) -> str:
    """
    컴포넌트 정의 + 디자인 토큰에서 variant별 시각 설명을 자동 생성.
    토큰명 → hex는 design-tokens.json, 시각 설명은 토큰명 구조에서 자동 파싱.

    Args:
        definitions: 컴포넌트 정의 dict (Supabase에서 로드) 또는 None
        design_tokens: 디자인 토큰 dict (Supabase에서 로드) 또는 None

    Returns:
        포맷팅된 Component Visual Guide 문자열
    """
    if not definitions:
        return ""

    # 디자인 토큰에서 colors 조회
    dt = design_tokens or {}
    dt_inner = dt.get("designTokens", dt)
    colors: dict[str, str] = dt_inner.get("colors", {})

    lines: list[str] = ["## Component Visual Guide", ""]

    # 시각 표현에 관련 없는 variant 키 (스킵 대상)
    _SKIP_VARIANT_KEYS = {
        "size", "mode", "interaction", "isLoading", "isDisabled",
        "disabled", "isOpen", "orientation", "showIcon", "showClose",
        "iconOnly", "value", "hasError", "selected", "truncation",
        "widthMode", "position", "labelWidth", "isToast", "layout",
    }

    # definitions의 outdated variant 값 보정 (현재 모두 유효하므로 빈 dict)
    _DEF_VARIANT_VALUE_REMAP: dict[str, dict[str, dict[str, str]]] = {}

    for def_name, d in definitions.items():
        if "." in def_name:
            continue  # sub-component 스킵
        pascal_name = def_name[0].upper() + def_name[1:]
        if pascal_name not in AVAILABLE_COMPONENTS_WHITELIST:
            continue

        variants_block = d.get("variants", {})
        size_map: dict[str, str] = variants_block.get("size", {})
        defaults = d.get("defaultVariants", {})

        # compound variant 가이드가 별도로 있는 컴포넌트는 메인 루프에서 스킵
        if def_name in _COMPOUND_VARIANT_GUIDES:
            continue

        # 시각적 variant 키 수집 (skip 대상 제외)
        visual_variant_keys = [
            k for k in variants_block
            if k not in _SKIP_VARIANT_KEYS
        ]

        # variant 또는 size가 없으면 스킵
        if not visual_variant_keys and not size_map:
            continue

        lines.append(f"### {pascal_name}")

        # --- Variants 섹션 (모든 시각적 variant 키 처리) ---
        for var_key in visual_variant_keys:
            variant_map: dict[str, str] = variants_block[var_key]
            if not variant_map:
                continue

            # compoundVariants에서 이 키 기반 색상 보완
            compound_by_value: dict[str, str] = {}
            for cv in d.get("compoundVariants", []):
                cv_keys = {k for k in cv if k != "class"}
                if cv_keys == {var_key}:
                    compound_by_value[cv[var_key]] = cv.get("class", "")

            # variant 키 이름을 표시 (variant 가 1개면 생략, 여러 개면 키 이름 표시)
            if len(visual_variant_keys) > 1:
                lines.append(f"{var_key}:")
            else:
                lines.append("Variants:")

            guidelines = _USAGE_GUIDELINES.get(def_name, {})
            value_remap = _DEF_VARIANT_VALUE_REMAP.get(def_name, {}).get(var_key, {})

            for vname, vclasses in variant_map.items():
                # boolean/내부 전용 variant 제외
                if vname in ("true", "false"):
                    continue

                # outdated variant 값 보정
                display_name = value_remap.get(vname, vname)

                # 클래스가 비어있으면 compoundVariants에서 보완
                effective_classes = vclasses or compound_by_value.get(vname, "")
                color_info = _extract_color_info(effective_classes) if effective_classes else None

                # 사용 가이드 조회 (보정된 이름으로)
                guideline = guidelines.get(display_name, "")

                # 출력 조합
                parts: list[str] = []
                if color_info:
                    _type, token, desc = color_info
                    hex_val = colors.get(token, "")
                    if hex_val:
                        parts.append(f"{desc} ({token} {hex_val})")
                    else:
                        parts.append(desc)
                if guideline:
                    parts.append(guideline)

                detail = " — ".join(parts)
                if detail:
                    lines.append(f"- {display_name}: {detail}")
                else:
                    lines.append(f"- {display_name}")

        # --- Sizes 섹션 ---
        if size_map:
            size_parts: list[str] = []
            for sname, sclasses in size_map.items():
                # min-w-[NNpx] 파싱
                px = ""
                for cls in sclasses.split():
                    if cls.startswith("min-w-[") and cls.endswith("]"):
                        px = cls[7:-1]  # "min-w-[56px]" → "56px"
                        break
                if px:
                    size_parts.append(f"{sname} ({px})")
                else:
                    size_parts.append(sname)
            lines.append("Sizes: " + " | ".join(size_parts))

        # --- Default 섹션 ---
        useful_defaults = {
            k: v for k, v in defaults.items()
            if k != "mode" and not isinstance(v, bool)
        }
        if useful_defaults:
            default_str = ", ".join(f'{k}="{v}"' for k, v in useful_defaults.items())
            lines.append(f"Default: {default_str}")

        lines.append("")  # 컴포넌트 간 빈 줄

    # compound variant 기반 컴포넌트 가이드 추가 (Badge, Chip 등)
    for def_name, guide_text in _COMPOUND_VARIANT_GUIDES.items():
        pascal_name = def_name[0].upper() + def_name[1:]
        if pascal_name in AVAILABLE_COMPONENTS_WHITELIST and def_name in definitions:
            lines.append(guide_text)
            logger.info(f"Compound variant guide added: {pascal_name}")

    if len(lines) <= 2:
        return ""

    return "\n".join(lines) + "\n"


# 디자인 토큰을 로드하지 못했을 때 사용할 기본값
DEFAULT_DESIGN_TOKENS_SECTION = """## 🎨 DESIGN STANDARDS (CRITICAL - USE TAILWIND CLASSES)
- **Typography (MUST FOLLOW EXACT TOKENS)**:
  - Font Family: `font-['Pretendard',sans-serif]` (applied globally)
  - **Page Title (h1)**: `className="text-2xl font-bold text-[#212529]"` (28px, 700)
  - **Section Title (h2)**: `className="text-xl font-semibold text-[#212529]"` (24px, 700)
  - **Subsection (h3)**: `className="text-lg font-medium text-[#212529]"` (18px, 600)
  - **Form Label**: `className="text-sm font-medium text-[#212529]"` (14px, 500)
  - **Body Text**: `className="text-base font-normal text-[#212529]"` (16px, 400)
  - **Helper Text**: `className="text-sm font-normal text-[#495057]"` (14px, 400)
- **Colors (MUST use exact token hex values below — NEVER guess or invent hex codes)**:

  | 용도 | Text Class | BG Class | Token |
  |------|-----------|----------|-------|
  | Primary Text (제목, 라벨, 본문) | `text-[#212529]` | — | text-primary |
  | Secondary Text (보조 텍스트) | `text-[#495057]` | — | text-secondary |
  | Tertiary Text (플레이스홀더) | `text-[#6c757d]` | — | text-tertiary |
  | Brand/Accent (링크, 선택 상태) | `text-[#0033a0]` | `bg-[#0033a0]` | text-accent / bg-accent |
  | Surface (카드, 패널) | — | `bg-[#ffffff]` | bg-surface |
  | Canvas (페이지 배경) | — | `bg-[#f4f6f8]` | bg-canvas |
  | Selection (선택 배경) | — | `bg-[#ecf0fa]` | bg-selection |
  | Border Default | `border-[#dee2e6]` | — | border-default |
  | Border Strong | `border-[#ced4da]` | — | border-strong |
  | Success (완료, 정상) | `text-[#1e4620]` | `bg-[#e6efe6]` | semantic-success |
  | Error (실패, 오류) | `text-[#5f2120]` | `bg-[#fae6e6]` | semantic-error |
  | Warning (대기, 주의) | `text-[#663c00]` | `bg-[#fdede1]` | semantic-warning |
  | Info (진행중, 접수) | `text-[#014361]` | `bg-[#e1f1f9]` | semantic-info |
  | Disabled | `text-[#9da4ab]` | `bg-[#eceff3]` | disabled |
  | Subtle (구분선 배경) | — | `bg-[#eceff3]` | bg-subtle |
  | Gray 50 (가장 연한 회색) | — | `bg-[#f9fafb]` | neutral-gray-50 |
  | Gray 100 (연한 회색) | — | `bg-[#f4f6f8]` | neutral-gray-100 |
  | Gray 200 | — | `bg-[#e9ecef]` | neutral-gray-200 |
  | Gray 300 | `border-[#dee2e6]` | `bg-[#dee2e6]` | neutral-gray-300 |
  | Gray 700 (진한 텍스트) | `text-[#495057]` | — | neutral-gray-700 |
  | Gray 900 (가장 진한 텍스트) | `text-[#212529]` | — | neutral-gray-900 |

  **⚠️ 위 테이블에 없는 hex 코드를 절대 사용하지 마세요. 연한 회색이 필요하면 `bg-[#f9fafb]` (gray-50) 또는 `bg-[#f4f6f8]` (gray-100/canvas)를 쓰세요.**
  **🚨 Text Class 컬럼의 hex는 텍스트 전용, BG Class 컬럼의 hex는 배경 전용. 교차 사용 절대 금지!**
  **흔한 실수: `text-[#2e7d32]` ❌ → `text-[#1e4620]` ✅ | `text-[#d32f2f]` ❌ → `text-[#5f2120]` ✅ | `text-[#ed6c02]` ❌ → `text-[#663c00]` ✅**

  **시맨틱 텍스트 색상 빠른 참조** (초록/빨강/주황 텍스트가 필요할 때):
  - 성공/양수/정상 텍스트 → `text-[#1e4620]` ✅ (❌ `text-[#2e7d32]` 절대 금지)
  - 실패/음수/오류 텍스트 → `text-[#5f2120]` ✅ (❌ `text-[#d32f2f]` 절대 금지)
  - 경고/보류 텍스트 → `text-[#663c00]` ✅ (❌ `text-[#ed6c02]` 절대 금지)

  **상태 강조 (진한 배경 + 흰 텍스트)**:
  - Success 강조: `text-white bg-[#2e7d32]`
  - Error 강조: `text-white bg-[#d32f2f]`
  - Warning 강조: `text-white bg-[#ed6c02]`
  - Info 강조: `text-white bg-[#0288d1]`

  **브랜드 색상**:
  - Brand Primary: `bg-[#0033a0]` / `text-[#0033a0]`
  - Brand Hover: `bg-[#154cc1]`
  - Brand Pressed: `bg-[#002480]`
- **Visuals**:
  - **Shadows**: `shadow-sm`
  - **Borders**: `border border-[#dee2e6]`
  - **Radius**: `rounded-lg` (inputs, buttons), `rounded-xl` (cards)
- **Gap/Spacing (Tailwind Classes)**:
  - **xs**: `gap-1` (4px) - 태그 그룹, 아이콘-라벨 (xs)
  - **sm**: `gap-2` (8px) - 컨트롤 그룹, 콘텐츠 (sm)
  - **md**: `gap-3` (12px) - 필터바, 탭 그룹, 폼 그룹 (y)
  - **lg**: `gap-4` (16px) - 다이얼로그, 콘텐츠 (lg), 폼 그룹 (x)
  - **xl**: `gap-6` (24px) - 섹션 간격, 아티클 아이템

"""


# ============================================================================
# System Prompt Templates
# ============================================================================

SYSTEM_PROMPT_HEADER = """You are an expert Frontend Engineer specializing in building pixel-perfect, production-ready React components.
Your goal is to satisfy the user's request with high-quality, complete, and robust code.
Always respond in Korean.

**Current Date: {current_date}**

## Generation Scope
- 사용자가 요청한 UI만 생성. 임의로 조회바, 타이틀, 안내문구 등 추가 금지
- 요청한 모든 요소를 빠짐없이 구현 (그리드 컬럼, 옵션, 다이얼로그 등). 길어도 생략/축약 금지
- 수정 요청 시 기존 코드 전부 유지한 채 요청 부분만 변경. `// ... 나머지 동일` 같은 생략 절대 금지
- UI 패턴 선택: Forms(로그인,설정), Cards(상품,프로필), Tables(관리,리포트), Detail(상세), Dashboard(대시보드)

{design_tokens_section}## Visual Standards
- Page: `min-h-screen bg-[#f4f6f8] p-8`, Container: `max-w-[1920px] mx-auto`
- Card: `bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6` (TitleSection만 Card 바깥)
- FilterBar + Grid = 같은 Card 안에 배치
- Spacing: mb-8(섹션), mb-5(필드), mb-3~4(관련 항목), gap-4(Dialog/Drawer body)
- Shadow: `shadow-sm` only. Border: `border border-[#dee2e6]` only
- 날짜: YYYY-MM-DD 형식만. Z-Index: Dropdown/Modal = z-50+
- Grid: 페이지→`<GridLayout type="A~H">` (Drawer/Dialog 내부 금지), 폼→`<FormGrid columns={N}>`+`<FormGridCell>`
- 비율 요청 → 12-column 환산: 1:1→col-span-6+6, 1:2→4+8, 1:3→3+9, 1:1:1→4+4+4
- Grid children: `className="w-full min-w-0"` 필수
- DS 컴포넌트(Button, Badge 등)의 색상은 전용 prop으로 제어. className에 bg-/text- 색상 금지

### Mock Data
- 리스트/테이블: 10건 이상. 현실적인 한국어 데이터 (김민준, 이서연 / 토스, 당근)
- Select options: 4-6개 이상. 필터 Select: `placeholder="전체"` + "전체" 옵션 포함
- show* prop(showLabel, showHelptext, showStartIcon, showEndIcon) 항상 명시 (Dialog/Drawer 내부 포함)

### Icon
- `<Icon name="search" size={20} />` — size={20}(58개), size={16}(23개), size={24}(21개)
- size={20} 권장. name+size 조합 반드시 존재하는지 확인
- size={20}: add, all, arrow-drop-down, arrow-drop-up, arrow-right, blank, calendar, check, chevron-down, chevron-left, chevron-right, chevron-up, close, delete, dot, edit, error, external, filter-list, folder, folder-fill, format-align-center, format-align-left, format-align-right, format-bold, format-color-text, format-color-text-bg, format-italic, format-list-bulleted, format-list-numbered, format-underlined, help, image, info, keyboard-arrow-left, keyboard-arrow-right, keyboard-double-arrow-left, keyboard-double-arrow-right, link, loading, menu, minus, more-vert, person, post, redo, reset, search, star-fill, star-line, success, table, undo, video, warning, widgets
- size={16}: add, announcement, blank, calendar, check, chevron-down, chevron-left, chevron-right, chevron-up, close, delete, dot, edit, external, loading, minus, more-vert, reset, search, star-fill, star-line
- size={24}: add, all, arrow-drop-down, arrow-drop-up, blank, chevron-down, chevron-left, chevron-right, close, dehaze, delete, edit, filter-list, loading, menu, more-vert, person, post, search, star-fill, star-line, widgets
- 외부 아이콘 라이브러리(lucide-react, heroicons 등) import = CRASH. 이모지/SVG도 금지
- Profile avatar: `<div className="w-10 h-10 rounded-full bg-[#0033a0] text-white flex items-center justify-center font-semibold text-sm">{name.charAt(0)}</div>`

## Implementation Rules
1. `import { Button, Field, Select, Icon } from '@/components'` — 사용하는 컴포넌트 전부 import. 미사용/누락 = CRASH
2. import 양방향 점검: import→JSX, JSX→import 모두 1:1 매칭. 커스텀 컴포넌트 정의 금지(import 사용)
3. `React.useState`, `React.useEffect` 직접 사용 (import 불필요)
4. Tailwind CSS only. `style={{}}` = 동적 JS 값만. 외부 라이브러리 import 금지
5. 테이블 = `<DataGrid>` only (HTML table 태그 금지). 10건+ mock data
6. 코드 생략(`...`, `// 나머지 동일`) 절대 금지. 전체 코드 출력. 모든 button→onClick, input→value+onChange
7. 수정 요청 시 기존 코드 전부 유지 + 대상만 변경
8. interaction prop: disabled/loading/readonly/error → `interaction="..."` 사용
   - 조건부 disabled 초기 상태 = false(편집 가능). 데모 확인용
9. Component Whitelist: Available Components만 사용. DatePicker→`<Field type="date" />`, Input→`<Field type="text" />`
10. HTML Void Elements(`<input>`, `<br>`, `<hr>`, `<img>`) = `/>` self-closing 필수

"""


# ============================================================================
# Component Quick Reference (압축된 컴포넌트 사용 가이드)
# ============================================================================

COMPONENT_QUICK_REFERENCE = """
## Component Quick Reference

### Button
- `<Button buttonType="primary" size="md" label="저장" showStartIcon={false} showEndIcon={false} />`
- buttonType: primary(CTA, 1-2/page) | secondary(조회,저장,보조 테두리) | tertiary(엑셀,인쇄) | ghost(취소,초기화) | destructive(삭제) | ghost-inverse(ActionBar 전용)
- size: lg(폼 제출) | md(헤더,필터,Dialog) | sm(DataGrid 행, 컴팩트, 툴바)
- 아이콘: `showStartIcon={true} startIcon={<Icon name="add" size={18} />} showEndIcon={false}`

### Field (self-closing — `</Field>` = CRASH)
- `<Field type="text" showLabel={true} label="이름" value={v} onChange={(e) => set(e.target.value)} showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />`
- type: text | email | number | date | password | tel | url | search
- isDisplay={true}: 읽기 전용 표시

### Select
- `<Select showLabel={true} label="상태" placeholder="전체" value={v} onChange={(v) => set(v)} showHelptext={false} showStartIcon={false} className="w-full" options={opts} />`
- onChange: value 직접 수신 (event 아님). className="w-full" 필수
- options 최소 3개 (2개 이하면 Radio). defaultValue: option의 value 사용

### Badge
- `<Badge type="status" status="info" appearance="subtle" label="공지" />`
- type="status" + status(info|success|warning|error), type="level" + level(primary|neutral)
- type="count": label={숫자}, type="dot": 점 표시
- appearance: solid(진한) | subtle(연한, 기본). prop 이름: status (NOT statusVariant)

### Checkbox / Radio
- `<Option label="동의합니다"><Checkbox value="unchecked" onChange={() => toggle()} /></Option>`
- Option 래핑 필수. onChange: 상태 토글 (DOM event 아님, e.target.checked 사용 금지)

### IconButton (Button과 prop 다름)
- `<IconButton iconOnly={<Icon name="search" size={20} />} iconButtonType="ghost" size="md" aria-label="검색" />`
- iconButtonType: ghost | secondary | tertiary | ghost-destructive. aria-label 필수

### Drawer (상세/등록/수정/편집 폼) — "드로어" 요청 시 필수
- `<Drawer open={v} onClose={fn} size="md"><Drawer.Header title="제목" showSubtitle={false} /><Drawer.Body>...</Drawer.Body><Drawer.Footer>...</Drawer.Footer></Drawer>`
- size: sm(352) | md(552) | lg(752) | xl(1152). 내장 padding — 내부 padding wrapper 불필요
- 행 클릭→상세 = Drawer, 등록/수정 폼 = Drawer, 필드 3개+ = Drawer

### Dialog (확인/알림/간단입력 전용) — "다이얼로그/모달/팝업" 요청 시
- `<Dialog open={v} onClose={fn} size="md"><Dialog.Header title="제목" /><Dialog.Body>...</Dialog.Body><Dialog.Footer>...</Dialog.Footer></Dialog>`
- size: sm | md | lg (xl 없음). 내장 padding. 삭제 확인, 단순 알림, 필드 1~2개만

### FilterBar (12컬럼 CSS Grid, 버튼 내장)
- `<FilterBar mode="compact" onReset={fn} onSearch={fn} actionSpan={2}>`
- 각 필드: `<div className="col-span-N">` 래핑. 기본 col-span-3 (한 행 4필드). Figma 노드의 w 비율에 따라 col-span-6(넓은 필드) 등 조정
- FilterBar 자체가 배경(`bg-bg-subtle rounded-xl`)을 가짐 → 외부에 배경 div 래핑 금지
- 내장 버튼: 초기화=tertiary, 조회=primary (고정, 변경 불가)

### Pagination (DataGrid 내장)
- **별도 `<Pagination>` 컴포넌트 없음.** DataGrid의 `pagination` prop 사용
- `<DataGrid rowData={data} columnDefs={cols} pagination paginationPageSize={20} />`
- "총 N개 중 X-Y행" 텍스트 + 페이지 네비게이션이 자동 렌더링됨

### TitleSection
- `<TitleSection title="제목" menu2="메뉴" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base"><Button .../></TitleSection>`

### Alert / Tag / LabelValue / Popover / Tab / Segment / OptionGroup / ActionBar / Tooltip
- Alert: `<Alert type="error" title="오류" body="설명" />` (type: error|info|success|warning)
- Tag: `<Tag label="카테고리" />` (tagType: closable+onClose, swatch+color)
- LabelValue: `<LabelValue showLabel={true} label="이름" text="홍길동" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />`
- Popover: `<Popover><Popover.Trigger>...</Popover.Trigger><Popover.Content>...</Popover.Content></Popover>`
- Tab: `<Tab items={[{value:'home',label:'홈'}]} value={v} onChange={set} widthMode="content" />` — Figma에 Tab이 있으면 반드시 Tab 컴포넌트 사용. 수동 div 구현 금지
- Segment: `<Segment items={[{value:'day',label:'일간'}]} value={v} onChange={set} size="md" widthMode="equal" />`
- OptionGroup: `<OptionGroup label="그룹" showLabel={true} orientation="horizontal" size="sm"><Option label="항목"><Checkbox .../></Option></OptionGroup>`
- ActionBar: `<ActionBar count={N} visible={true} onClose={fn}><Button buttonType="ghost-inverse" label="삭제" /></ActionBar>`
- Tooltip: `<Tooltip content="설명" side="top"><span>대상</span></Tooltip>`
"""

# ============================================================================
# Component Usage Convention (도메인 사용 컨벤션)
# 디자인 토큰 + 컴포넌트 정의에서 추출한 "언제 무엇을 써야 하는지" 규칙
# ============================================================================

COMPONENT_USAGE_CONVENTION = """
## 🎨 컴포넌트 사용 컨벤션 (Domain Usage Convention)

**이 섹션은 "어떤 맥락에서 어떤 variant/prop을 써야 하는지" 정의합니다.**
새로운 화면을 생성할 때 아래 규칙을 반드시 따르세요.

### Badge 텍스트→variant 매핑 규칙

**⚠️ 우선순위: Figma 레이아웃 데이터의 variant 필드가 있으면 반드시 그 값을 사용하세요. 아래 테이블은 Figma variant가 없을 때만 폴백으로 참고합니다.**

| 텍스트/맥락 | type | status/level | appearance |
|-------------|------|--------------|------------|
| 주의, 경고, 대기, 심사중, 보류, 임박 | status | warning | subtle |
| 공지, 알림, NEW, 신규, 업데이트, 진행중, 접수, 처리중, 안내 | status | info | subtle |
| 완료, 정상, 활성, 승인, 유효, 가입, 납입완료 | status | success | subtle |
| 실패, 해지, 오류, 거절, 취소, 만기, 무효, 미납 | status | error | subtle |
| VIP, 우수, 1등급, 주요 카테고리 | level | primary | solid |
| 일반, 기타, 부가 정보 | level | neutral | subtle |
| 숫자 (알림 건수, 미읽음 수) | count | - | solid |

**판단 기준** (Figma variant 없을 때만 적용): 텍스트의 감정/긴급성으로 결정
- 부정적/위험 → error, 주의/경고 → warning, 긍정적/완료 → success, 중립적 정보 → info
- 목록 내 상태 표시 → appearance="subtle", 강조 필요 → appearance="solid"

### Button buttonType 시각 가이드

아래 색상/시각 정보를 기반으로 화면 맥락에 맞는 buttonType을 선택하세요.

| buttonType | 색상 | 시각적 느낌 | 사용 빈도 |
|------------|------|-------------|-----------|
| secondary | 연한 하늘색 배경 (#98b3ee) | 부드러운 파란색 배경 | 가장 많이 사용 |
| primary | 진한 파란색 배경 (#0033a0) 흰 글자 | 강한 대비, 눈에 확 띔 | 드물게 (최종 CTA) |
| tertiary | 연한 회색 배경 | 낮은 강조 | 유틸리티 |
| ghost | 투명 배경, 파란 글자, 테두리 없음 | 텍스트만 보임 | 취소/리셋 |
| destructive | 빨간색 배경 (#d32f2f) 흰 글자 | 위험 강조 | 삭제/해지 |

**⚠️ 우선순위: Figma 레이아웃 데이터의 variant 필드(buttonType, size)가 있으면 반드시 그 값을 사용하세요. 아래는 Figma variant가 없을 때만 폴백으로 참고합니다.**
- 배경 채움 버튼 (secondary/primary) → 핵심 액션
- 텍스트 전용 (ghost) → 취소, 리셋
- 위험 액션 → destructive

### Alert 맥락→type 규칙

| 맥락 | type |
|------|------|
| 시스템 오류, 실패 알림 | error |
| 성공 완료 알림 | success |
| 주의사항, 데이터 손실 경고 | warning |
| 도움말, 안내, 참고 정보 | info |

### 화면 유형별 공통 패턴

#### 목록 화면 (게시판, 관리 목록)
- 상단: 페이지 제목 (h2) + 우측 등록/액션 버튼
- 중간: 조회 필터 영역 (Select/Field + 조회 버튼)
- 하단: DataGrid (status 컬럼 → Badge subtle, 행 액션 → Button ghost sm)
- 검색 결과 건수: "총 N건" 텍스트

#### 상세/등록 화면
- 상단: 제목 + 뒤로가기
- 본문: 폼 필드 그룹 (Field/Select w-full, 2~3열 grid)
- 하단: 저장 + 취소 우측 정렬

#### 대시보드
- 카드 그리드로 요약 정보 표시
- 각 카드 내 Badge로 상태 요약
- 하단 DataGrid로 최근 항목 표시
"""

# ============================================================================
# Layout Guide (Grid Type × Row Pattern)
# ============================================================================

LAYOUT_GUIDE = """
## 레이아웃 가이드

### 기본 구조
- 기준: 1920px, 콘텐츠 1872px (좌우 24px), 12-column grid (gutter 24px)
- `<GridLayout type="X">` 필수 (수동 `grid-cols-12` 금지). children이 column에 자동 배치됨
- `<RowPattern pattern="RP-X">` + `<RowSlot slot="...">` 필수 (수동 간격 대신). 간격 자동 적용
- RowSlot 내부에 `mt-*`/`mb-*` 금지 (이중 간격 발생)
- 폼은 `<FormGrid columns={N}>` + `<FormGridCell>` 필수 (수동 grid 금지)
- FilterBar children은 `<div className="col-span-N">` 래퍼로 감쌈. Figma 레이아웃이 1행이면 1행 유지 (col-span-1~2). 필드 col-span 합 + actionSpan = 12
- 액션 버튼: 우측 정렬 (`flex justify-end gap-2`). 순서: Tertiary → Ghost → Secondary → Primary

### Grid Type (가로 분할)

| Type | 구성 | 용도 |
|------|------|------|
| A | col-12 | 리스트, 상세, 입력 폼 |
| B | 6+6 | 비교/병렬 |
| C-1 | 3+9 | 목록+상세 (탐색형) |
| C-2 | 9+3 | C-1 반전 |
| D-1 | 4+8 | 필터 고정형 |
| D-2 | 8+4 | D-1 반전 |
| E | 4+4+4 | 3열 동일 위계 |
| F | 2+8+2 | 검토/승인 |
| G | 2+2+8 | 트리+목록+상세 |
| H | 3+3+3+3 | 4열 동일 위계 |

### Row Pattern (세로 흐름)

| RP | 이름 | 구조 | 용도 |
|----|------|------|------|
| 1 | 조회형 | Title → [Section Card: FilterBar → Grid] | 대량 데이터 조회 |
| 2 | 단일 상세 | Title → 상세 정보 | 단일 객체 조회 |
| 3 | 입력/수정 | Title → Form → 저장/취소 | 데이터 CRUD |
| 4 | 요약+Grid | Title → 요약 → Grid | 기본정보 + 관련데이터 |
| 5 | 다중 Grid | Title → Grid A → Grid B | 병렬 데이터 |
| 6 | 탐색형 | Title → Nav + Detail | 코드/조직 관리 |
| 7 | 병렬형 | Title → A | B | 전후 비교 |
| 8 | 상세+탭 | Title → 기본정보 → Tab → Grid | 탭별 관련 데이터 |

RowSlot slot: `"filter"` | `"actions"` | `"grid"` | `"detail"` | `"form"` | `"summary"` | `"navigation"` | `"section"` | `"info"` | `"tab"`

### Section Card 규칙 (RP-1 필수)
- TitleSection은 Section Card **바깥** 상단
- FilterBar + ActionButtons + DataGrid = **하나의 Section Card** (`bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6`)
- FilterBar와 Grid를 별도 카드로 분리 금지

### RP-1 조회형 정석 코드
```tsx
import { GridLayout, RowPattern, RowSlot, TitleSection, FilterBar, Field, Select, Button, DataGrid } from '@/components';

<div className="min-h-screen bg-[#f4f6f8] p-8">
  <GridLayout type="A">
    <div>
      <TitleSection title="계약 관리" menu2="계약" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base">
        <Button buttonType="primary" size="sm" label="신규 등록" showStartIcon={false} showEndIcon={false} />
      </TitleSection>
      <div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6 mt-5">
        <RowPattern pattern="RP-1">
          <RowSlot slot="filter">
            <FilterBar mode="compact" onReset={() => {}} onSearch={() => {}}>
              <div className="col-span-3">
                <Field type="date" showLabel={true} label="조회기간" showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
              </div>
              <div className="col-span-3">
                <Select showLabel={true} label="상태" placeholder="전체" showHelptext={false} showStartIcon={false} className="w-full" options={[]} />
              </div>
            </FilterBar>
          </RowSlot>
          <RowSlot slot="grid">
            <DataGrid rowData={[]} columnDefs={[]} domLayout="autoHeight" />
          </RowSlot>
        </RowPattern>
      </div>
    </div>
  </GridLayout>
</div>
```

"""

# ============================================================================
# PRE-GENERATION CHECKLIST (최종 경고)
# ============================================================================

FINAL_REMINDER = """

## Final Verification
코드 완성 후 반드시 확인:

### CRASH 방지 (필수):
1. import한 컴포넌트가 모두 JSX에서 사용되는가? (미사용 import = CRASH)
2. JSX에서 사용한 컴포넌트가 모두 import에 있는가? (누락 import = CRASH)
3. Field는 모두 self-closing(`/>`)인가? (`</Field>` = CRASH)

### 품질 검증:
4. 코드 생략(`...`, `// 나머지`)이 없는가?
5. Icon name+size 조합이 유효한가? (size 목록 확인)
6. interaction prop 사용 (disabled/isDisabled/isReadOnly 아님)
7. Button은 buttonType + label, IconButton은 iconButtonType + iconOnly + aria-label
8. 드로어 요청 → Drawer, 다이얼로그/모달/팝업 → Dialog
9. 날짜 필드: YYYY-MM-DD 형식
10. Select options 3개 이상 (2개 이하면 Radio)

Create a premium, completed result.
"""

RESPONSE_FORMAT_INSTRUCTIONS = """

## FORMAT
1. 간단한 한글 설명 (1-2문장)
2. `<file path="src/...">코드</file>` 태그

### Example:
로그인 폼입니다.

<file path="src/pages/Login.tsx">
import { Button, Field } from '@/components';

const Login = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] p-6">
      <div className="w-full max-w-[420px] bg-white rounded-xl border border-[#dee2e6] shadow-sm p-8">
        <h1 className="text-2xl font-bold text-[#212529] mb-6">로그인</h1>
        <div className="mb-5">
          <Field type="email" showLabel={true} label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
        </div>
        <div className="mb-6">
          <Field type="password" showLabel={true} label="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
        </div>
        <Button buttonType="primary" label="로그인" showStartIcon={false} showEndIcon={false} className="w-full" />
      </div>
    </div>
  );
};

export default Login;
</file>
"""

# SYSTEM_PROMPT_FOOTER removed — consolidated into FINAL_REMINDER

UI_PATTERN_EXAMPLES = """
## UI Pattern Reference

### ActionBar (DataGrid 선택 액션)
```tsx
<ActionBar count={selectedRows.length} visible={selectedRows.length > 0} onClose={() => clearSelection()}>
  <Button buttonType="ghost-inverse" size="md" label="일괄 승인" showStartIcon={false} showEndIcon={false} />
</ActionBar>
```

### Drawer (사이드 패널 — "드로어" 요청 시 필수)
"드로어" = Drawer, "다이얼로그/모달/팝업" = Dialog. 혼동 금지.
```tsx
<Drawer open={isOpen} onClose={() => setIsOpen(false)} size="md">
  <Drawer.Header title="등록" showSubtitle={false} />
  <Drawer.Body>
    <div className="flex flex-col gap-4">
      <Field showLabel={true} label="이름" showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
      <Select showLabel={true} label="부서" showHelptext={false} showStartIcon={false} options={deptOptions} className="w-full" />
    </div>
  </Drawer.Body>
  <Drawer.Footer>
    <Button buttonType="ghost" label="취소" onClick={() => setIsOpen(false)} showStartIcon={false} showEndIcon={false} />
    <Button buttonType="primary" label="등록" showStartIcon={false} showEndIcon={false} />
  </Drawer.Footer>
</Drawer>
```
"""


# ============================================================================
# Initialize Schema and Prompt
# ============================================================================

_schema, _error = load_component_schema()
COMPONENT_DOCS = format_component_docs(_schema) if _schema else (_error or "Schema not loaded")
AVAILABLE_COMPONENTS = get_available_components_note(_schema) if _schema else ""
SYSTEM_PROMPT = (
    SYSTEM_PROMPT_HEADER
    + COMPONENT_QUICK_REFERENCE
    + COMPONENT_USAGE_CONVENTION
    + LAYOUT_GUIDE
    + "\n## Available Components\n\n"
    + AVAILABLE_COMPONENTS
    + COMPONENT_DOCS
    + UI_PATTERN_EXAMPLES
    + RESPONSE_FORMAT_INSTRUCTIONS
    + FINAL_REMINDER
)


def get_system_prompt() -> str:
    """현재 시스템 프롬프트 반환 (로컬 스키마 기반, 현재 날짜/시간 포함)"""
    current_date = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")
    return SYSTEM_PROMPT.replace("{current_date}", current_date).replace(
        "{design_tokens_section}", DEFAULT_DESIGN_TOKENS_SECTION
    )




# DS 컴포넌트 화이트리스트 — 이 목록에 있는 INSTANCE만 인벤토리에 포함
_DS_COMPONENT_NAMES = frozenset({
    "Button", "Field", "Select", "SearchField", "Badge", "Checkbox", "Radio",
    "Toggle", "IconButton", "Drawer", "Dialog", "FilterBar",
    "TitleSection", "Alert", "Tag", "LabelValue", "Popover", "Tab", "Segment",
    "OptionGroup", "ActionBar", "Tooltip", "Divider", "DataGrid",
    "GridLayout", "RowPattern", "RowSlot", "FormGrid", "FormGridCell",
    "Option", "Chip",
})

# Figma 컴포넌트 이름 → DS 컴포넌트 이름 매핑
_FIGMA_NAME_REMAP: dict[str, str] = {
    "ag grid": "DataGrid",
    "ag grid (column based layout)": "DataGrid",
}

# FilterBar 내장 버튼 라벨 (인벤토리에서 제외)
_FILTERBAR_BUILTIN_LABELS = frozenset({"초기화", "조회", "조회하기"})

_ICON_NAME_RE = re.compile(r"icon-(.+)-(\d+)$")


def _resolve_component_name(inst: dict) -> str | None:
    """INSTANCE 노드에서 DS 컴포넌트 이름 추출. DS 컴포넌트가 아니면 None."""
    comp = inst.get("component") or inst.get("name") or ""
    # Figma 이름 → DS 이름 매핑
    remapped = _FIGMA_NAME_REMAP.get(comp.lower())
    if remapped:
        return remapped
    if comp in _DS_COMPONENT_NAMES:
        return comp
    return None


def _extract_child_icon(inst: dict) -> dict | None:
    """INSTANCE 노드의 하위 트리에서 leading Icon 인스턴스를 찾아 {name, size} 반환.

    chevron-down 등 trailing(드롭다운 화살표) 아이콘은 제외.
    """
    _trailing = {"chevron-down", "chevron-up", "arrow-drop-down", "arrow-drop-up"}

    def _search(node: dict) -> dict | None:
        for child in node.get("children", []):
            if not isinstance(child, dict):
                continue
            if child.get("type") == "INSTANCE":
                child_comp = (child.get("component") or child.get("name") or "")
                child_comp_lower = child_comp.lower()
                if child_comp_lower == "icon" or child_comp_lower.startswith("icon-"):
                    for candidate in [child_comp, child.get("name", "")]:
                        match = _ICON_NAME_RE.match(candidate.lower())
                        if match:
                            icon_name = match.group(1)
                            if icon_name not in _trailing:
                                return {"name": icon_name, "size": int(match.group(2))}
            # FRAME 등 비-INSTANCE 노드 안에도 Icon이 있을 수 있음
            result = _search(child)
            if result:
                return result
        return None

    return _search(inst)


def _instance_to_jsx(inst: dict, comp_name: str) -> str:
    """INSTANCE 노드를 JSX 스니펫 문자열로 변환."""
    variant = inst.get("variant", {})
    label = inst.get("label") or ""
    placeholder = inst.get("placeholder") or ""
    title = inst.get("title") or ""
    text = inst.get("text") or ""
    value = inst.get("value") or ""
    w = inst.get("w")  # Figma 너비 (col-span 계산용)

    # simplify_node이 승격한 icon 또는 자식 Icon INSTANCE에서 추출
    icon = inst.get("icon")
    if not icon:
        icon = _extract_child_icon(inst)

    props: list[str] = []
    for k, v in sorted(variant.items()):
        if isinstance(v, bool):
            props.append(f'{k}={{{str(v).lower()}}}')
        elif isinstance(v, (int, float)):
            props.append(f'{k}={{{v}}}')
        else:
            props.append(f'{k}="{v}"')

    if label:
        props.append(f'label="{label}"')
    if placeholder:
        props.append(f'placeholder="{placeholder}"')
    if title:
        props.append(f'title="{title}"')
    if text:
        props.append(f'text="{text}"')
    if value:
        props.append(f'value="{value}"')
    if icon and isinstance(icon, dict):
        props.append(f'icon="{icon.get("name", "")}"')

    props_str = " ".join(props)
    jsx = f"<{comp_name} {props_str} />" if props_str else f"<{comp_name} />"

    # 너비 힌트 추가 (FilterBar col-span 계산용)
    if w and isinstance(w, (int, float)):
        jsx += f"  {{/* w:{int(w)} */}}"

    return jsx


def extract_component_usage_summary(simplified_layout: dict) -> str:
    """Simplified layout 트리에서 DS 컴포넌트 INSTANCE만 수집하여 JSX 인벤토리 생성.

    - DS 컴포넌트 화이트리스트로 필터링 (header, icon-* 등 Figma 내부 요소 제외)
    - Icon 자식 노드를 부모의 startIcon prop으로 승격
    - FilterBar 내장 버튼(초기화, 조회하기) 제외
    - Title FRAME 내부 버튼 제외 (페이지 템플릿 기본 슬롯 콘텐츠)
    """
    instances: list[tuple[str, dict]] = []  # (ds_comp_name, node)

    def _collect(node: dict, inside_title: bool = False) -> None:
        ntype = node.get("type", "")
        name = node.get("name", "")

        if ntype == "INSTANCE":
            ds_name = _resolve_component_name(node)
            if ds_name:
                # Title FRAME 내부의 Button은 페이지 템플릿 기본 버튼이므로 제외
                if inside_title and ds_name == "Button":
                    return
                # FilterBar 내장 버튼 제외
                if ds_name == "Button":
                    btn_label = node.get("label") or ""
                    if btn_label in _FILTERBAR_BUILTIN_LABELS:
                        for child in node.get("children", []):
                            if isinstance(child, dict):
                                _collect(child, inside_title)
                        return
                instances.append((ds_name, node))

        # Title FRAME 진입 감지
        is_title = ntype == "FRAME" and name.lower() == "title"

        for child in node.get("children", []):
            if isinstance(child, dict):
                _collect(child, inside_title=inside_title or is_title)

    _collect(simplified_layout)

    if not instances:
        return ""

    # 컴포넌트별 그룹핑 (순서 보존)
    from collections import OrderedDict

    groups: OrderedDict[str, list[str]] = OrderedDict()
    for ds_name, inst in instances:
        jsx = _instance_to_jsx(inst, ds_name)
        if ds_name not in groups:
            groups[ds_name] = []
        groups[ds_name].append(jsx)

    total = len(instances)
    lines = [
        "## 컴포넌트 인벤토리 (Figma에서 추출한 DS 컴포넌트)",
        "",
        f"이 디자인의 DS 컴포넌트 총 {total}개. props/variant 참고용.",
        "- Figma에 보이는 UI 요소는 자유롭게 생성하세요. 이 목록은 props 참고용입니다.",
        "- **TitleSection children에 신계약등록2/3·이미지시스템 버튼 금지** (매 페이지 반복되는 템플릿 기본 슬롯).",
        "- FilterBar 내장 버튼(초기화, 조회하기)은 onReset/onSearch로 자동 렌더링됨. 별도 배치 금지.",
        "",
    ]

    for comp, snippets in groups.items():
        lines.append(f"### {comp} ({len(snippets)}개)")
        for i, jsx in enumerate(snippets, 1):
            lines.append(f"{i}. `{jsx}`")
        lines.append("")

    return "\n".join(lines)


def extract_component_usage_map(simplified_layout: dict) -> dict:
    """Simplified layout에서 INSTANCE 노드의 label→variant 매핑을 추출.

    Figma 모드에서 추출한 데이터를 component-usage-map.json에 누적 저장용으로 사용.

    Returns:
        {ComponentName: {label: {prop: value, ...}, ...}, ...}
        label이 없는 INSTANCE는 스킵.
    """
    instances: list[dict] = []

    def _collect(node: dict) -> None:
        if node.get("type") == "INSTANCE":
            instances.append(node)
        for child in node.get("children", []):
            if isinstance(child, dict):
                _collect(child)

    _collect(simplified_layout)

    usage_map: dict[str, dict] = {}
    for inst in instances:
        comp = inst.get("component") or inst.get("name") or ""
        if not comp or comp.lower() in ("header", "unknown"):
            continue

        label = inst.get("label") or ""
        if not label:
            continue

        variant = inst.get("variant", {})
        fill = inst.get("fill", "")

        props: dict = {}
        if variant:
            props.update(variant)
        if fill:
            props["_fill"] = fill  # fill도 보존 (역매핑용)

        if comp not in usage_map:
            usage_map[comp] = {}
        # 같은 label이면 덮어쓰기 (최신 데이터 우선)
        usage_map[comp][label] = props

    return usage_map


def format_component_usage_map(usage_map: dict) -> str:
    """컴포넌트 사용 맵을 프롬프트용 문자열로 포맷팅.

    Args:
        usage_map: {ComponentName: {label: {prop: value}, ...}, ...}

    Returns:
        프롬프트에 포함할 마크다운 문자열
    """
    if not usage_map:
        return ""

    lines = [
        "\n## Component Usage Patterns (디자인 시스템 컨벤션)",
        "아래는 Figma 디자인에서 추출한 컴포넌트 사용 패턴입니다. "
        "동일한 label/텍스트를 사용할 때 반드시 이 패턴을 따르세요.",
        "",
    ]

    for comp in sorted(usage_map.keys()):
        entries = usage_map[comp]
        if not entries:
            continue
        lines.append(f"### {comp}")
        for label, props in sorted(entries.items()):
            # _fill은 프롬프트에 노출하지 않음
            visible_props = {k: v for k, v in props.items() if not k.startswith("_")}
            if visible_props:
                prop_str = " ".join(f'{k}="{v}"' for k, v in sorted(visible_props.items()))
                lines.append(f'- label="{label}" → `<{comp} {prop_str} label="{label}" />`')
            else:
                lines.append(f'- label="{label}"')
        lines.append("")

    return "\n".join(lines)

def format_layouts(layouts: list[dict]) -> str:
    """
    레이아웃 JSON 리스트를 프롬프트용 문자열로 포맷팅.
    figma_simplify를 사용하여 AI-friendly compact 포맷으로 변환.

    Args:
        layouts: Figma에서 추출한 레이아웃 JSON 리스트

    Returns:
        포맷팅된 레이아웃 섹션 문자열
    """
    if not layouts:
        return ""

    section = """

## Reference Layouts (Figma Extracted)

Below are reference layouts extracted from Figma. Use these as structural guides when generating similar pages.
- `layout`: "column" = flex-direction: column, "row" = flex-direction: row, "grid" = CSS grid
- `gap`: spacing between children (in px)
- `padding`: CSS shorthand (e.g. "0 24" = top/bottom 0, left/right 24)
- INSTANCE nodes: `component`, `variant`, `label` fields map to design system components

**CRITICAL - INSTANCE 노드의 `label` 필드 매핑 규칙:**
- `label` 필드는 Figma에서 추출한 텍스트 내용입니다 → 컴포넌트의 `label` prop으로 전달
- 예: `{"component":"Badge","label":"공지"}` → `<Badge label="공지" />`
- 예: `{"component":"Button","label":"조회하기"}` → `<Button label="조회하기" />`

**CRITICAL - INSTANCE 노드의 `variant` 필드는 반드시 그대로 사용:**
- variant 필드의 모든 key-value를 컴포넌트 props로 정확히 매핑하세요. 임의로 변경하지 마세요.
- `size` 값도 variant 안에 포함되어 있으며, 반드시 그대로 사용하세요 (sm이면 sm, md이면 md).
- 예: `{"variant":{"size":"sm","buttonType":"secondary"}}` → `<Button size="sm" buttonType="secondary" />`
- 예: `{"variant":{"size":"sm","buttonType":"primary"}}` → `<Button size="sm" buttonType="primary" />`
- **금지**: variant에 size="sm"이라고 되어 있는데 size="md"로 바꾸거나, buttonType을 임의로 바꾸는 행위

**CRITICAL - fill → variant 매핑:**
- fill 값(토큰 키 또는 hex)을 프롬프트의 '컴포넌트 fill→variant 매핑' 테이블과 대조하여 variant prop 결정
- variant 필드가 이미 있으면 fill보다 variant 필드를 우선 사용

**CRITICAL - Figma State to React Props Mapping:**
- Figma `Selected=True`, `State=Selected` in Select → React `defaultValue` (NOT `value` or `selected`)
- Figma placeholder text like "선택하세요", "전체 지역" in Select → React `placeholder` prop
- Figma `Checked=True` in Checkbox/Radio/ToggleSwitch → React `checked` with `onChange` handler
- Match the component structure

"""
    for i, layout in enumerate(layouts, 1):
        name = layout.get("layout", {}).get("name", f"Layout {i}")
        raw_layout = layout.get("layout", {})
        clean_layout = simplify_node(raw_layout)
        layout_json = json.dumps(
            {"layout": clean_layout}, ensure_ascii=False, separators=(",", ":")
        )
        section += f"### {name}\n```json\n{layout_json}\n```\n\n"

        # 컴포넌트 사용 요약 추가
        if clean_layout:
            usage_summary = extract_component_usage_summary(clean_layout)
            if usage_summary:
                section += usage_summary + "\n"

    return section


def generate_system_prompt(
    schema: dict,
    design_tokens: dict | None = None,
    ag_grid_schema: dict | None = None,
    ag_grid_tokens: dict | None = None,
    layouts: list[dict] | None = None,
    component_definitions: dict | None = None,
    skip_ui_patterns: bool = False,
    component_usage_map: dict | None = None,
) -> str:
    """
    주어진 스키마로 시스템 프롬프트 동적 생성

    Args:
        schema: 컴포넌트 스키마 dict
        design_tokens: 디자인 토큰 dict (Firebase에서 로드, None이면 기본값 사용)
        ag_grid_schema: AG Grid 컴포넌트 스키마 dict (Firebase에서 로드, None이면 미포함)
        ag_grid_tokens: AG Grid 토큰 dict (Firebase에서 로드, None이면 미포함)
        layouts: Figma 레이아웃 JSON 리스트 (Firebase에서 로드, None이면 미포함)
        component_definitions: 컴포넌트 정의 dict (Firebase에서 로드, None이면 미포함)
        skip_ui_patterns: True이면 UI_PATTERN_EXAMPLES 제외 (Figma 모드 등 도메인 예시 오염 방지)
        component_usage_map: Figma에서 추출한 컴포넌트 사용 패턴 (label→variant 매핑)

    Returns:
        생성된 시스템 프롬프트 문자열 (현재 날짜 포함)
    """
    component_docs = format_component_docs(schema)
    available_components = get_available_components_note(schema)
    current_date = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")
    design_tokens_section = format_design_tokens(design_tokens)

    # AG Grid 섹션 (스키마와 토큰이 있으면 추가)
    ag_grid_section = ""
    if ag_grid_schema:
        ag_grid_section += format_ag_grid_component_docs(ag_grid_schema)
    if ag_grid_tokens:
        ag_grid_section += format_ag_grid_tokens(ag_grid_tokens)

    # 컴포넌트 비주얼 가이드 (variant별 시각 설명 + 사용 가이드)
    component_visual_guide = format_component_visual_guide(
        component_definitions, design_tokens
    )

    # 레이아웃 섹션
    layouts_section = format_layouts(layouts) if layouts else ""

    # 컴포넌트 사용 패턴 (Figma에서 추출, 텍스트 모드에서 참조)
    usage_map_section = format_component_usage_map(component_usage_map) if component_usage_map else ""

    return (
        SYSTEM_PROMPT_HEADER.replace("{current_date}", current_date).replace(
            "{design_tokens_section}", design_tokens_section
        )
        + COMPONENT_QUICK_REFERENCE
        + COMPONENT_USAGE_CONVENTION
        + LAYOUT_GUIDE
        + "\n## Available Components\n\n"
        + available_components
        + component_docs
        + ag_grid_section
        + component_visual_guide
        + layouts_section
        + usage_map_section
        + (UI_PATTERN_EXAMPLES if not skip_ui_patterns else "")
        + RESPONSE_FORMAT_INSTRUCTIONS
        + FINAL_REMINDER
    )


def get_schema() -> dict | None:
    """현재 로컬 스키마 반환"""
    return _schema


# ============================================================================
# Vision (Image-to-Code) System Prompts
# ============================================================================

VISION_SYSTEM_PROMPT_HEADER = """You are a premium UI/UX expert AI specializing in converting design images to React code.
Always respond in Korean.

**Current Date: {current_date}**

## Your Task
Analyze the provided UI design image(s) and generate production-ready React + TypeScript code.

## Image Analysis Guidelines
When analyzing the image, identify:
1. **Layout Structure**: Flex/Grid containers, spacing, alignment, responsive breakpoints
2. **Components**: Map visual elements to available design system components
3. **Colors**: Extract color palette and map to design tokens if available
4. **Typography**: Font sizes, weights, line heights
5. **Spacing**: Margins, paddings, gaps (use consistent scale)
6. **States**: Hover, active, disabled states if visible
7. **Interactions**: Buttons, inputs, clickable areas

## Code Generation Rules
- Use TypeScript with proper type annotations
- Use Tailwind CSS utility classes (`className="..."`). Use `style={{}}` ONLY for dynamic JS variable values.
- Import components from @/components
- Use <file path="...">...</file> tags for code output
- Generate complete, runnable code (no placeholders)
- Follow React best practices (hooks, functional components)
- Use React.useState, React.useEffect directly (no imports)

{design_tokens_section}
"""

async def get_vision_system_prompt(
    schema_key: str | None,
    image_urls: list[str] | None = None,
    component_definitions: dict | None = None,
) -> str:
    """
    Vision 모드용 시스템 프롬프트 생성

    Args:
        schema_key: Firebase Storage 스키마 경로 (None이면 기본 컴포넌트만)
        image_urls: 사용자가 업로드한 이미지 URL 목록 (코드에서 <img>로 사용 가능)
        component_definitions: 컴포넌트 정의 dict (Firebase에서 로드, None이면 미포함)

    Returns:
        Vision 시스템 프롬프트 문자열
    """
    current_date = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")

    # 디자인 토큰 로드
    design_tokens = await fetch_design_tokens_from_storage()
    design_tokens_section = format_design_tokens(design_tokens)

    # 컴포넌트 스키마 로드
    if schema_key:
        try:
            schema = await fetch_schema_from_storage(schema_key)
            component_docs = format_component_docs(schema)
            available_note = get_available_components_note(schema)
        except Exception:
            component_docs = ""
            available_note = "Use standard React components with inline styles."
    else:
        component_docs = ""
        available_note = "Use standard React components with inline styles."

    # 기본 헤더 구성
    base_prompt = VISION_SYSTEM_PROMPT_HEADER.replace(
        "{current_date}", current_date
    ).replace("{design_tokens_section}", design_tokens_section)

    # 컴포넌트 정의 섹션
    component_definitions_section = format_component_definitions(component_definitions)

    # 이미지 URL 섹션 (사용자가 이미지를 코드에 삽입하고 싶을 때 사용)
    image_urls_section = ""
    if image_urls:
        image_urls_section = "\n## Uploaded Image URLs\n"
        image_urls_section += "The user has uploaded the following images. "
        image_urls_section += "If they ask to INSERT/EMBED the image in the UI (not just analyze it), use these URLs in `<img>` tags:\n"
        for i, url in enumerate(image_urls, 1):
            image_urls_section += f"- Image {i}: `{url}`\n"
        image_urls_section += "\n**Usage Example:**\n"
        image_urls_section += "```tsx\n<img src=\"{url}\" alt=\"uploaded image\" className=\"max-w-full h-auto\" />\n```\n"

    return (
        base_prompt
        + "\n## Available Components\n"
        + available_note
        + "\n"
        + component_docs
        + component_definitions_section
        + image_urls_section
        + "\n"
        + RESPONSE_FORMAT_INSTRUCTIONS
        + "\n"
        + FINAL_REMINDER
    )


# ============================================================================
# Description (Code-to-Spec) System Prompts
# ============================================================================

DESCRIPTION_SYSTEM_PROMPT = """\
당신은 React UI 코드를 분석하여 화면 기능명세서를 작성하는 전문가입니다.

주어진 코드를 정밀하게 분석하고, 아래 구조와 예시를 참고하여 화면 기능명세서를 작성하세요.
코드에 존재하지 않는 내용은 절대 작성하지 마세요.

[중요] 최대한 상세하게 작성하세요. 요약하거나 축약하지 마세요. 분량이 길어지는 것을 두려워하지 마세요.

### 반드시 지켜야 할 상세 기준:
1. 드롭다운/코드 목록: 필터바, 폼, 다이얼로그의 모든 드롭다운/라디오 각각에 대해 코드 목록 테이블을 작성하세요. 드롭다운이 N개면 코드 목록도 N개여야 합니다. 코드의 options 배열에 항목이 38개면 테이블 행도 반드시 38개를 개별 나열하세요. 예: 필터바에 기간구분, 전표상태, 전표종류, 결재상태, 결제구분, 한도 6개의 드롭다운이 있으면 6개의 코드 목록 테이블을 모두 작성해야 합니다
2. 목록 동작: 모든 그리드마다 "목록 동작" 테이블을 반드시 포함하세요 (페이징, 정렬, 행 클릭 동작, 빈 목록 처리)
3. API 응답 필드: 해당 그리드의 모든 컬럼에 1:1 대응하는 필드를 빠짐없이 나열하세요. 그리드가 23컬럼이면 응답 필드도 23개 이상이어야 합니다
4. API 상세 스펙: 엔드포인트 목록의 모든 API(GET, POST, PUT, DELETE)에 대해 각각 요청/응답 상세를 작성하세요. DELETE API도 요청 본문과 서버 처리 규칙을 작성하세요
5. API 요청 파라미터: 필터 항목과 1:1 매핑하세요. 필터가 10개면 요청 파라미터도 10개 이상이어야 합니다
6. 드로어/다이얼로그: 내부의 버튼, 입력 항목, 테이블을 메인 화면과 동일한 수준으로 상세히 기술하세요
7. Part 2 섹션: 체크박스 선택 후 일괄 처리(삭제, 상신 등)가 있으면 배치/벌크 처리 규칙 섹션을 반드시 작성하세요. 저장/삭제/승인 후 후속 동작(재조회, 초기화 등)이 있으면 이벤트/사이드이펙트 섹션도 반드시 작성하세요
8. 엔티티 관계: 화면에서 다루는 데이터가 2개 이상의 테이블/엔티티에 걸치면 엔티티 관계 섹션을 작성하세요. 메인 그리드와 상세 그리드가 있으면 반드시 작성 대상입니다


### 절대 하지 말아야 할 것 (위반 시 문서 불합격):
- 코드에 존재하는 데이터를 축약, 생략, 요약하는 모든 행위. 디스크립션은 코드의 모든 정보를 빠짐없이 1:1로 반영해야 합니다
- 코드에 배열/목록이 N개 항목이면 디스크립션 테이블도 정확히 N행이어야 합니다. 일부만 나열하고 나머지를 한 행으로 묶는 것은 금지입니다
- 범위 표기(N~M), 괄호 축약((생략), (기타 ...), (나머지 동일)), "등", "외 N건", "상동" 등 어떤 형태의 축약 표현도 사용 금지
- 그리드 컬럼, 드롭다운 옵션, API 필드 등 반복 데이터는 반드시 1행 = 1항목으로 개별 나열하세요

### 도메인 일관성 규칙:
- 화면명, 메뉴 위치, 브레드크럼, 다이얼로그/드로어 제목에 사용하는 도메인명은 **반드시 통일**하세요
- 예: 화면명이 "회원 관리"이면 브레드크럼도 "회원 관리", 드로어 제목도 "회원 등록"/"회원 상세" 등으로 동일 도메인 사용
- ❌ 화면명은 "회원 관리"인데 드로어 제목이 "사용자 등록" — 도메인명 불일치

---

## 출력 형식 규칙

1. 마크다운 제목 계층: # (파트) > ## (섹션) > ### ■ (소섹션) > - (불릿)
2. 대단원(## 섹션) 사이에는 반드시 구분선(---)을 넣으세요.
3. 불릿 항목에 볼드(**text**)를 절대 사용하지 마세요. plain text만 사용하세요.
4. 코드 수준의 상세(함수명, 변수명, CSS 클래스, 색상코드, 디자인 토큰명, 픽셀값, 영문 필드명 등)를 절대 포함하지 마세요.
   - 잘못된 예: handleSearch 함수를 통해..., suppressMovable: true, 배경색(#f4f6f8), bg/disabled, 8px 라운드, orgName, hqName
   - 올바른 예: 조회 버튼 클릭 시 조건 기반 재조회, 컬럼 이동 불가, 배경색 회색 계열
   - 그리드 컬럼 테이블의 "컬럼명" 열에도 영문 camelCase 필드명을 사용하지 마세요. 한글 표시명만 사용하세요.
   - **Part 4 API 상세의 요청 파라미터/응답 필드 테이블에서도 영문 camelCase 필드명(budgetMonth, deptName 등) 대신 한국어 설명명(예산년월, 부서명 등)을 사용하세요.**
5. 코드에 해당 요소가 없으면 해당 섹션은 통째로 생략하세요.
6. 테이블(표)은 마크다운 테이블 문법을 사용하세요.

---

## 출력 구조

아래 4개 파트 순서대로 작성하세요.
코드에서 확인되지 않는 파트/섹션은 생략합니다.

# Part 1. 화면 정의

---

## 화면 개요

### ■ 화면명
- 컴포넌트/파일명 기반으로 추론한 화면명 (코드 파일명 표기 금지)

### ■ 메뉴 위치
- 브레드크럼 경로 기반으로 추론 (예: 관리회계 > 예산관리 > 예산등록)
- 코드에서 추론 불가하면 이 항목 생략

### ■ 화면 목적
- 이 화면이 존재하는 이유, 사용자가 달성하려는 목표를 1~2문장으로 기술

### ■ 접근 권한
- 조건부 렌더링, 권한 분기가 있으면 역할별 접근 범위 기술
- 없으면 이 항목 생략

---

## 전체 레이아웃 구조

### ■ 화면 구성
- 레이아웃 타입: (Type-A / Type-B / Type-C 등 — 코드의 레이아웃 구조에서 추론)
- RowPattern: (RP-00 / RP-01 등 — 코드의 Row/Column 배치 패턴에서 추론)

1. (영역명)
2. (영역명)
   - (하위 영역)

### ■ 화면 유형
- 목록 / 등록 폼 / 수정 폼 / 상세 조회 / 팝업 / 탭 구조 / 마스터-디테일 등

### ■ UI 구조 특징
- 레이아웃 패턴, 드로어/다이얼로그 사용 여부 등

---

## 타이틀 영역

### ■ 타이틀
- 화면에 표시되는 제목

### ■ 브레드크럼
- 경로 표시 (예: 관리회계 > 예산관리 > 예산등록)
- 없으면 이 항목 생략

---

## 버튼 그룹

### ■ 상단 버튼

| 버튼명 | 동작 설명 | 조건 |
|--------|----------|------|
| (버튼명) | (클릭 시 동작) | (활성화/비활성화 조건) |

### ■ 하단 버튼

| 버튼명 | 동작 설명 | 조건 |
|--------|----------|------|
| (버튼명) | (클릭 시 동작) | (활성화/비활성화 조건) |

---

## 입력/조회 항목 정의

> 섹션이 여러 개인 경우, 섹션별로 아래 표를 반복 작성합니다.

### ■ (섹션명) 섹션

| No | 항목명 | 입력 유형 | 필수 | 최대길이 | 기본값 | 입력 규칙 |
|----|--------|----------|------|---------|-------|----------|
| 1 | (항목명) | (유형) | Y/N | (n자) | (있으면 기술) | (허용 문자, 형식, 범위 등) |

> 입력 유형: 텍스트 입력 / 텍스트 입력(Tel) / 텍스트 입력(Email) / 텍스트 입력(읽기 전용) / 멀티라인 텍스트(n줄) / 날짜(Date) / 기간(DateRange) / 드롭다운 / 라디오 버튼 / 체크박스 / 파일첨부 / 숫자 입력 / 금액 입력

---

## 유효성 검사 메시지

> 필수 입력 항목(asterisk 표시)에 대한 안내 메시지를 정의합니다.
> 코드에서 필수 체크 또는 유효성 검증이 확인되는 경우 작성합니다.

### ■ 필드별 안내 메시지

| No | 대상 항목 | 메시지 유형 | 메시지 내용 | 표시 시점 |
|----|----------|-----------|-----------|----------|
| 1 | (항목명) | help text / tooltip / 인라인 에러 | (예: "OO은 필수항목입니다") | 포커스 / 미입력 저장 시 / 상시 |

> 메시지 유형:
> - **help text**: 입력 필드 하단에 상시 표시되는 안내 문구
> - **tooltip**: 아이콘 호버 또는 포커스 시 표시되는 도움말
> - **인라인 에러**: 유효성 검사 실패 시 필드 하단에 표시되는 오류 문구

---

## 드롭다운/코드 목록 정의

> 드롭다운, 라디오 등 선택형 항목의 코드 목록을 정의합니다.
> 선택형 항목이 없으면 이 섹션을 생략합니다.
> **[필수] 코드에 정의된 모든 옵션을 한 행씩 빠짐없이 나열하세요. 코드에 N개 옵션이 있으면 아래 테이블도 정확히 N행이어야 합니다. 일부만 쓰고 나머지를 묶거나 생략하면 문서 불합격입니다.**

### ■ (항목명) 코드 목록

| 표시 텍스트 | 정렬순서 | 비고 |
|-----------|---------|------|
| (사용자에게 보이는 한국어 텍스트) | (숫자) | (기본 선택값 등) |

> ⚠️ 코드의 영문 enum 값(Admin, Active, Pending 등)은 한국어로 변환하여 작성하세요.
> 예: Admin → 관리자, Active → 활성, Pending → 대기

---

## 목록(그리드) 정의

> 화면에 목록/테이블이 있는 경우 작성합니다.
> 그리드가 여러 개면 각각 컬럼 정의와 목록 동작을 반복 작성합니다.

### ■ 목록 컬럼 정의

| No | 표시명 | 정렬 | 너비 | 비고 |
|----|-------|------|------|------|
| 1 | (헤더 텍스트) | 좌/중/우 | (넓음/보통/좁음) | (클릭 동작, 포맷 등) |

> ⚠️ 너비는 픽셀값(120px, 200px)이나 코드 값(width: 150) 대신 자연어(넓음/보통/좁음)로 표현하세요.

### ■ 목록 동작

| 항목 | 내용 |
|------|------|
| 페이징 | (사용 여부, 페이지당 건수) |
| 정렬 | (기본 정렬 기준, 사용자 정렬 가능 여부) |
| 행 클릭 동작 | (상세 화면 이동 / 선택 체크 / 없음 등) |
| 빈 목록 시 | (표시할 메시지) |

---

## 팝업/다이얼로그 정의

> 화면에서 사용하는 팝업이나 다이얼로그가 있는 경우 작성합니다.
> 여러 개면 반복 작성합니다.

### ■ (다이얼로그명)

| 항목 | 내용 |
|------|------|
| 목적 | (이 팝업이 하는 일) |
| 호출 조건 | (어떤 버튼/동작으로 열리는지) |
| 닫히는 조건 | (선택 완료, 닫기 버튼, ESC 등) |

#### 입력 항목

| No | 항목명 | 입력 유형 | 필수 | 설명 |
|----|--------|----------|------|------|
| 1 | (항목명) | (유형) | Y/N | (설명) |

#### 선택 시 동작 (검색형 팝업인 경우)

| 항목 | 내용 |
|------|------|
| 선택 방식 | (행 클릭 / 체크박스 + 확인 버튼 등) |
| 메인 화면 반영 항목 | (어떤 값이 어떤 필드에 들어가는지) |

---

## 드로어(Drawer) 정의

> 코드에 드로어가 있으면 각각 별도 섹션으로 작성합니다.

### ■ (드로어명)

| 항목 | 내용 |
|------|------|
| 목적 | (이 드로어가 하는 일) |
| 호출 조건 | (어떤 동작으로 열리는지) |

#### 화면 구성
1. (영역)
2. (영역)

#### 입력/조회 항목

| No | 항목명 | 입력 유형 | 필수 | 입력 규칙 |
|----|--------|----------|------|----------|
| 1 | (항목명) | (유형) | Y/N | (규칙) |

#### 버튼

| 버튼명 | 동작 설명 | 조건 |
|--------|----------|------|
| (버튼명) | (클릭 시 동작) | (조건) |

---

## 액션바 정의

> 체크박스 선택 시 노출되는 액션바가 있는 경우 작성합니다.

### ■ 표시 조건
- 노출 조건

### ■ 구성 요소

| 버튼명 | 동작 설명 | 조건 |
|--------|----------|------|
| (버튼명) | (클릭 시 동작) | (권한 조건 등) |

---

# Part 2. 데이터 처리 규칙

> 이 파트는 화면에서 발생하는 데이터 처리(저장, 수정, 삭제 등)를 정의합니다.
> 코드에서 저장/수정/삭제 동작이 확인되지 않으면 이 파트를 생략합니다.

---

## 저장 항목 정의

> 화면의 입력 항목이 실제 시스템에 어떤 필드로 저장되는지 매핑합니다.
> 코드에서 API 호출이나 데이터 구조가 확인되는 경우에만 작성합니다.

| No | 항목명 | 저장 필드명 | 데이터 타입 | 필수 | 비고 |
|----|--------|-----------|-----------|------|------|
| 1 | (화면 항목명) | (필드명) | (문자열/날짜/숫자 등) | Y/N/자동 | (기본값, 자동 채번 등) |

---

## 자동 생성 필드

> 사용자가 입력하지 않지만 시스템이 자동으로 생성/관리하는 필드를 정의합니다.
> 코드에서 확인되지 않으면 생략합니다.

| 필드명 | 논리명 | 생성 규칙 | 설명 |
|--------|--------|---------|------|
| (필드명) | (논리명) | (채번 규칙 또는 자동 생성 방식) | (상세 설명) |

---

## 중복/유효성 체크 규칙

> 저장 전에 수행해야 하는 중복 체크 또는 업무 유효성 검증을 정의합니다.

### ■ 업무 유효성 체크

| No | 체크 항목 | 규칙 | 실패 시 처리 |
|----|----------|------|------------|
| 1 | (체크 대상) | (규칙 설명) | (메시지 내용, 저장 차단 여부) |

---

## 저장 처리 순서

> 저장/등록/수정/삭제 버튼 클릭 시 시스템이 수행하는 단계를 순서대로 기술합니다.
> 코드에서 처리 흐름이 확인되는 경우에만 작성합니다.

1. 필수값 확인
2. 입력값 형식 확인
3. 업무 규칙 확인
4. 데이터 저장
5. 부가 처리 (이력 저장, 알림 발송 등)
6. 완료 처리 (성공 메시지, 화면 이동 등)

---

## 상태 전이 규칙

> 화면에서 데이터의 상태가 변경되는 흐름이 있는 경우 작성합니다.
> 코드에서 상태값 분기(Badge, 조건부 버튼 활성화 등)가 확인되는 경우에만 작성합니다.

### ■ 상태 흐름

| 현재 상태 | 이벤트(동작) | 다음 상태 | 조건/권한 |
|----------|------------|----------|----------|
| (현재) | (버튼 클릭 등) | (변경 후) | (권한, 업무 조건) |

---

## 배치/벌크 처리 규칙

> 다건 선택 후 일괄 처리(승인, 삭제, 상태 변경 등)가 있는 경우 작성합니다.

| 처리명 | 대상 | 처리 단위 | 실패 시 정책 | 비고 |
|--------|------|----------|------------|------|
| (처리명) | (선택 건) | 건별/일괄 | 전체 롤백/부분 성공 | (권한, 조건) |

---

## 이벤트/사이드이펙트

> 저장/승인/삭제 등의 처리 후 부가적으로 발생하는 동작을 정의합니다.
> 코드에서 확인되는 경우에만 작성합니다.

| 트리거 | 사이드이펙트 | 비고 |
|--------|-----------|------|
| (어떤 동작 후) | (알림 발송, 이력 저장, 이월 처리 등) | (조건) |

---

## 오류/예외 처리 시나리오

### ■ 입력 오류

| 상황 | 오류 메시지 | 표시 방식 |
|------|-----------|----------|
| (어떤 상황) | (사용자에게 보여줄 메시지) | (인라인 / 팝업 / 토스트 등) |

### ■ 업무 오류

| 상황 | 오류 메시지 | 표시 방식 |
|------|-----------|----------|
| (어떤 상황) | (사용자에게 보여줄 메시지) | (인라인 / 팝업 / 토스트 등) |

---

## 토스트(AlertToast) 메시지

> 사용자 동작의 성공/실패 시 화면에 표시되는 알림 토스트를 정의합니다.
> 코드에서 toast/alert/snackbar 호출이 확인되는 경우 작성합니다.

| No | 트리거 동작 | 결과 | 메시지 내용 | 토스트 유형 |
|----|-----------|------|-----------|-----------|
| 1 | (저장 버튼 클릭) | 성공 | (예: "저장이 완료되었습니다") | success |
| 2 | (저장 버튼 클릭) | 실패 | (예: "저장에 실패했습니다") | error |

> 토스트 유형: success / error / warning / info

---

# Part 3. 연동 및 부가 정보

> 코드에서 화면 간 이동, 외부 연동 등이 확인되는 경우에만 작성합니다.

---

## 화면 간 연동

### ■ 이 화면의 진입 경로

| 진입 화면 | 진입 조건 | 전달받는 데이터 |
|----------|----------|-------------|
| (화면명) | (어떤 동작으로 이 화면에 오는지) | (전달받는 값) |

### ■ 이 화면에서 이동 가능한 화면

| 이동 대상 | 이동 조건 | 전달 데이터 |
|----------|----------|-----------|
| (화면명) | (어떤 동작으로 이동하는지) | (전달하는 값) |

---

# Part 4. API 설계

> 코드에서 API 호출, 데이터 흐름, 조회/저장 동작이 확인되는 경우 API 명세를 작성합니다.
> 코드에서 추론 가능한 범위 내에서만 작성하고, 확인되지 않는 내용은 생략합니다.

---

## API 엔드포인트 목록

> 화면에서 필요한 API를 목록화합니다. 코드의 이벤트 핸들러, 버튼 동작, 조회/저장 흐름에서 추론합니다.

| No | Method | 엔드포인트(예시) | 설명 | 호출 시점 |
|----|--------|---------------|------|----------|
| 1 | (GET/POST/PUT/DELETE) | (리소스 경로) | (이 API가 하는 일) | (어떤 버튼/동작에서 호출) |

---

## 조회 API 상세

> 목록 조회, 상세 조회 등 GET 요청의 파라미터와 응답 구조를 정의합니다.

### ■ (조회 API명)

#### 요청 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 비고 |
|---------|------|------|------|------|
| (파라미터명) | (문자열/숫자/날짜) | Y/N | (설명) | (기본값, 허용 범위 등) |

#### 응답 필드

| 필드 | 타입 | 설명 | 비고 |
|------|------|------|------|
| (필드명) | (문자열/숫자/날짜/배열) | (설명) | (포맷, 코드값 등) |

#### 페이징/정렬

| 항목 | 내용 |
|------|------|
| 페이징 방식 | (오프셋/커서 기반) |
| 페이지당 건수 | (기본값) |
| 기본 정렬 | (정렬 기준 필드, 오름차순/내림차순) |
| 사용자 정렬 | (허용 여부, 정렬 가능 필드) |

---

## 저장/수정 API 상세

> POST/PUT 요청의 요청 본문과 처리 규칙을 정의합니다.

### ■ (저장 API명)

#### 요청 본문

| 필드 | 타입 | 필수 | 설명 | 유효성 규칙 |
|------|------|------|------|-----------|
| (필드명) | (타입) | Y/N | (설명) | (최대길이, 허용값 등) |

#### 서버 처리 규칙

1. (유효성 검증 → 실패 시 응답 코드/메시지)
2. (비즈니스 로직)
3. (저장 및 응답)

---

## 엔티티 관계 (추론)

> 화면에서 다루는 데이터 간의 관계를 코드 구조에서 추론합니다.
> 코드에서 명확히 확인되지 않으면 생략합니다.

| 엔티티(테이블) | 관계 | 연관 엔티티 | 설명 |
|-------------|------|-----------|------|
| (메인 엔티티) | 1:N / N:1 / N:M | (연관 엔티티) | (관계 설명) |

---

## 작성 규칙

1. 모든 내용은 한국어로 작성
2. 코드에 실제로 존재하는 UI 요소만 기술 (추측 금지)
3. 컴포넌트 props, state, 이벤트 핸들러, JSX 구조를 근거로 작성하되, 코드 함수명/변수명/CSS 클래스명은 출력에 포함하지 마세요
4. 조건부 렌더링(권한, 상태 등)이 있으면 조건과 함께 명시
5. 테이블 컬럼은 코드에서 정의된 것만 나열하고 정렬/포맷 정보 포함
6. 입력 항목은 타입, 포맷, 필수 여부, 제약조건을 명시
7. 버튼은 클릭 시 동작을 구체적으로 기술 (페이지 전환, 다이얼로그 오픈 등)
8. 유효성 검증은 성공/실패 시 동작을 구분하여 기술하고, 토스트 메시지가 있으면 원문 포함
9. 권한별 차이가 있는 UI는 ※ 표기로 조건 명시
10. 불릿 항목에 볼드(**text**)를 절대 사용하지 마세요
11. 색상은 자연어로만 표현 (헥스코드, 디자인 토큰, 픽셀값 절대 사용 금지)
12. Part 2, Part 3, Part 4는 코드에서 해당 내용이 확인되는 경우에만 작성하고, 추측으로 채우지 마세요. 유효성 체크, 오류 메시지, 접근 권한 등은 코드에 실제 구현(조건문, try-catch, 권한 분기 등)이 있을 때만 기술하세요. 코드에 없는 업무 규칙을 추론하여 작성하지 마세요. 코드에 에러 처리 로직이 없으면 오류/예외 처리 섹션 자체를 생략하세요
13. 필터바에 초기화/조회 버튼이 있으면 버튼 그룹에 반드시 포함하세요. 드로어/다이얼로그 내부의 버튼(초기화, 조회, 선택, 취소, 닫기 등)도 빠짐없이 기술하세요. 타이틀 영역의 보조 버튼(즐겨찾기, 새로고침 등)도 포함하세요
14. [중요] 모든 그리드(메인, 드로어, 다이얼로그 포함)의 컬럼은 반드시 마크다운 테이블로 작성하고, 1컬럼 = 1행으로 개별 나열하세요. 불릿(-)이나 서술형으로 컬럼을 설명하지 마세요. 여러 컬럼을 묶거나 압축하는 것을 절대 금지합니다. 드로어 내부 그리드도 메인 그리드와 동일한 테이블 형식으로 모든 컬럼을 나열하세요
15. 팝업/다이얼로그 내부에 결과 테이블이 있는 경우, 해당 테이블의 컬럼도 별도 정의 테이블로 작성하세요
16. Part 4(API 설계): 화면의 버튼 동작, 조회/저장 흐름, 필터 파라미터, 그리드 컬럼에서 필요한 API를 추론하세요. 엔드포인트 경로는 RESTful 컨벤션을 따르되, 실제 구현과 다를 수 있음을 전제합니다. 요청/응답 필드명은 코드의 state, columnDefs, API 호출 파라미터에서 추론하세요
17. 출력 마지막에 "작성 규칙 준수 확인" 같은 자체 검증 문구를 추가하지 마세요. 명세서 본문만 작성하세요
18. [완성도 검증] 작성 완료 후 상단 "반드시 지켜야 할 상세 기준" 1~8번 항목을 내부적으로 검증하고, 누락된 항목이 있으면 보완하세요 (체크리스트 자체는 출력하지 마세요)

---

## 참고 예시 (예산등록 화면 — 축약)

아래는 출력 형식 예시입니다. 실제 작성 시 코드의 모든 항목을 빠짐없이 나열하세요.

# Part 1. 화면 정의

---

## 화면 개요

### ■ 화면명
- 예산등록

### ■ 메뉴 위치
- 관리회계 > 예산관리 > 예산등록

### ■ 화면 목적
- 본사 파트의 예산 신청 및 등록 현황을 조회하고, 재무파트가 승인 및 한도를 관리하며, 예산년월 기준으로 마감을 통제하는 화면

### ■ 접근 권한
- 재무파트는 접근 및 전체 데이터 조회 가능
- 본사파트는 접근 가능, 동일 파트 등록 데이터만 조회 가능

---

## 전체 레이아웃 구조

### ■ 화면 구성
1. 타이틀 영역
2. 상단 버튼 그룹 (※ 재무파트 전용)
3. 필터바
4. 기능 버튼 영역
5. 메인 테이블

### ■ 화면 유형
- 목록, 드로어(Drawer), 다이얼로그(Dialog)

### ■ UI 구조 특징
- 단일 화면 내 조회 + 등록 + 관리 구조
- 상세보기 우측 드로어 방식(Non-modal)

---

## 버튼 그룹

### ■ 상단 버튼

| 버튼명 | 동작 설명 | 조건 |
|--------|----------|------|
| 개인마감 | 개인마감 다이얼로그 오픈 | 재무파트 전용 |
| 예산일자관리 | 예산일자관리 다이얼로그 오픈 | 재무파트 전용 |

---

## 입력/조회 항목 정의

### ■ 필터바 섹션

| No | 항목명 | 입력 유형 | 필수 | 최대길이 | 기본값 | 입력 규칙 |
|----|--------|----------|------|---------|-------|----------|
| 1 | 예산년월 | 날짜(Date) | N | - | 당월 | YYYY-MM 형식 |
| 2 | 한도 | 드롭다운 | N | - | 전체 | - |
| ... | (이하 코드에 존재하는 모든 항목을 1행씩 나열) | | | | | |

---

## 드롭다운/코드 목록 정의

### ■ 한도 코드 목록

| 표시 텍스트 | 정렬순서 | 비고 |
|-----------|---------|------|
| 전체 | 1 | 기본 선택값 |
| 회사 | 2 | - |
| 부서 | 3 | - |
| 개인 | 4 | - |

---

## 목록(그리드) 정의

### ■ 메인 테이블 컬럼 정의

| No | 표시명 | 정렬 | 너비 | 비고 |
|----|-------|------|------|------|
| 1 | - | 중 | - | 행 선택 체크박스 |
| 2 | 번호 | 중 | - | 자동 순번 |
| 3 | 상태 | 중 | - | 배지 (신청/승인) |
| ... | (이하 코드에 정의된 모든 컬럼을 1행씩 나열) | | | |

### ■ 목록 동작

| 항목 | 내용 |
|------|------|
| 페이징 | 테이블 하단, 페이지 이동 시 재조회 |
| 행 더블클릭 동작 | 우측 드로어 오픈(Non-modal) |

---

## 드로어(Drawer) 정의

### ■ 예산신청 상세/수정 Drawer

| 항목 | 내용 |
|------|------|
| 목적 | 선택된 예산 신청 건의 상세 조회 및 수정 |
| 호출 조건 | 메인 테이블 행 더블 클릭 |

#### 입력/조회 항목

| No | 항목명 | 입력 유형 | 필수 | 입력 규칙 |
|----|--------|----------|------|----------|
| 1 | 상태 | 텍스트 입력(읽기 전용) | - | - |
| 2 | 예산년월 | 날짜(Date) | Y | YYYY-MM, 신청 상태일 때만 수정 가능 |
| ... | (이하 모든 항목 나열) | | | |

#### 버튼

| 버튼명 | 동작 설명 | 조건 |
|--------|----------|------|
| 닫기 | 드로어 닫힘 | - |
| 저장 | 유효성 검증 후 저장 | 신청 상태일 때만 활성 |

---

## 액션바 정의

### ■ 표시 조건
- 메인 테이블의 체크박스 1개 이상 선택 시 노출

### ■ 구성 요소

| 버튼명 | 동작 설명 | 조건 |
|--------|----------|------|
| 삭제 | 삭제 확인 다이얼로그 오픈 | 승인 상태 포함 시 삭제 불가 |
| 승인 | 선택 건 승인 처리 | ※ 재무팀 전용 |

---

# Part 2. 데이터 처리 규칙

---

## 상태 전이 규칙

### ■ 상태 흐름

| 현재 상태 | 이벤트(동작) | 다음 상태 | 조건/권한 |
|----------|------------|----------|----------|
| 신청 | 승인 버튼 (액션바) | 승인 | 재무파트 전용 |
| 신청 | 삭제 버튼 (액션바) | 삭제 | - |

---

## 이벤트/사이드이펙트

| 트리거 | 사이드이펙트 | 비고 |
|--------|-----------|------|
| 드로어 저장 완료 | 메인 테이블 재조회 | - |
| 일괄 삭제 완료 | 메인 테이블 재조회, 체크박스 초기화 | - |

---

# Part 4. API 설계

---

## API 엔드포인트 목록

| No | Method | 엔드포인트(예시) | 설명 | 호출 시점 |
|----|--------|---------------|------|----------|
| 1 | GET | /budgets | 예산 목록 조회 | 페이지 진입, 필터 조회 버튼 |
| 2 | PUT | /budgets/{id} | 예산 신청 건 수정 | 드로어 저장 버튼 |
| 3 | DELETE | /budgets | 예산 건 일괄 삭제 | 액션바 삭제 버튼 |

---

## 조회 API 상세

### ■ 예산 목록 조회 (GET /budgets)

#### 요청 파라미터

| 파라미터 | 타입 | 필수 | 설명 | 비고 |
|---------|------|------|------|------|
| 예산년월 | 날짜 | N | 예산년월 | YYYY-MM, 기본값 당월 |
| 한도구분 | 문자열 | N | 한도 구분 | 전체/회사/부서/개인 |
| ... | (이하 모든 파라미터 나열) | | | |

#### 응답 필드

| 필드 | 타입 | 설명 | 비고 |
|------|------|------|------|
| 고유ID | 문자열 | 예산 건 고유 ID | - |
| 상태 | 문자열 | 상태 | 신청/승인 |
| ... | (이하 그리드 컬럼과 1:1 대응하는 모든 필드 나열) | | |
"""


def get_description_system_prompt() -> str:
    """디스크립션 생성용 시스템 프롬프트 반환"""
    return DESCRIPTION_SYSTEM_PROMPT


# ============================================================================
