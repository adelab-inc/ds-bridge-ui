import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import verify_api_key
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
    """Schema에 누락된 HTML 기반 props를 보충 (스키마에 있는 컴포넌트만)"""
    components = schema.get("components", {})

    # DEPRECATED: isDisabled/isReadOnly → interaction prop으로 통합됨 (d537869)
    # 스키마 JSON이 아직 구버전이면 disabled/readOnly로 교정 유지
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

## 🎯 UI GENERATION PRINCIPLE

**Generate UI that EXACTLY matches the user's request.** Do NOT default to dashboard/table layouts.

- User asks for "로그인 페이지" → Generate a login form (centered, inputs, button)
- User asks for "상품 목록" → Generate product cards or list
- User asks for "설정 페이지" → Generate settings form with sections
- User asks for "프로필 페이지" → Generate profile view with user info
- User asks for "대시보드" → ONLY THEN generate dashboard with tables/charts

**Choose the right UI pattern for the request:**
- **Forms**: Login, signup, settings, profile edit, data entry
- **Cards**: Products, articles, team members, projects
- **Lists**: Simple item lists, menus, navigation
- **Tables**: Data management, admin panels, reports (ONLY for managing multiple records)
- **Detail views**: Single item display, profile, article detail

### ⚠️ 요청하지 않은 요소 생성 금지
- **사용자가 명시적으로 요청한 UI만 생성할 것**
- 조회 옵션, 필터, 타이틀, 안내문구 등을 AI가 임의로 추가하지 말 것
- 예: "그리드 그려줘" → DataGrid만 생성. 조회바, 타이틀, 안내 영역 등 붙이지 말 것
- 예: "레이아웃 잡아줘" → 레이아웃 골격만 생성. 내부 컴포넌트 임의 추가 금지
- 사용자가 단계적으로 하나씩 추가 요청하면 그때 추가할 것

## 📋 COMPONENT USAGE GUIDE

### Button
- buttonType="primary": 메인 CTA (저장, 생성, 로그인). 페이지당 1-2개
- buttonType="secondary": 보조 액션 (취소, 뒤로가기)
- buttonType="tertiary": Excel 다운로드 등 보조 링크형 액션
- buttonType="ghost": 테이블 내 액션, 필터 버튼
- buttonType="destructive": 삭제, 해지 등 위험한 액션
- buttonType="ghost-inverse": ActionBar 내부 전용 (어두운 배경)
- ⚠️ label prop 사용: `<Button label="확인" />` (children 아님)
- ⚠️ 아이콘: `showStartIcon={true} startIcon={<Icon name="..." size={N} />}`
- ⚠️ **size는 배치 위치에 따라 자동 결정** (SM 일괄 적용 절대 금지):
  - `size="lg"`: 단독 폼 제출 버튼
  - `size="md"`: 페이지 헤더, Dialog 푸터, 필터 버튼
  - `size="sm"`: DataGrid 행 내부, 툴바, 컴팩트 UI
- `showStartIcon={false} showEndIcon={false}` — 아이콘 불필요 시 명시
- ❌ `variant=` — 사용 금지! `buttonType=`으로 대체됨
- ❌ `<Button>텍스트</Button>` — children 금지! `label=` prop 사용

### Field (⚠️ MUST be self-closing)
- Discriminated Union: `showLabel={true} label="이름"` (showLabel 없이 label만 전달 금지)
- `showHelptext={true} helptext="설명"` (showHelptext 없이 helptext만 전달 금지)
- type="text"/"email"/"number"/"date"/"password"/"tel"/"url"/"search"
- showStartIcon/showEndIcon: 아이콘 표시 제어
- isDisplay={true}: 읽기 전용 표시 모드 (LabelValue 대신 간단한 표시용)
- ✅ `<Field showLabel={true} label="이름" showHelptext={false} showStartIcon={false} showEndIcon={false} />`
- ❌ `<Field>children</Field>` — CRASHES (React Error #137)
- ❌ `multiline` — 제거됨, 사용 금지
- ❌ `rowsVariant` — 제거됨, 사용 금지 (multiline과 함께 삭제된 prop)

### 🚨 interaction Prop (상태 제어 — 통합 enum)
Button, Field, Select, IconButton, Checkbox, Radio 등 대부분의 컴포넌트는 `interaction` prop으로 상태를 제어합니다:
- interaction="default": 기본 (생략 가능)
- interaction="disabled": 비활성
- interaction="loading": 로딩 (Button, IconButton)
- interaction="readonly": 읽기전용 (Field)
- interaction="error": 에러 (Select)
- ❌ `isDisabled` — 사용 금지!
- ❌ `isLoading` — 사용 금지!
- ❌ `isReadOnly` — 사용 금지!
- ❌ `disabled` (HTML attr) — `interaction="disabled"` 사용
- ❌ `error={true}` (Select) — `interaction="error"` 사용

```tsx
// ✅ 올바른 interaction 사용법
<Button buttonType="primary" interaction="disabled" label="비활성" showStartIcon={false} showEndIcon={false} />
<Field showLabel={true} label="이름" interaction="readonly" showHelptext={false} showStartIcon={false} showEndIcon={false} />
<Select interaction="error" showLabel={true} label="보험사" showHelptext={true} helptext="필수 항목" options={options} showStartIcon={false} />

// ❌ 잘못된 사용법
<Button disabled>비활성</Button>
<Field isDisabled label="이름" />
<Select error={true} label="보험사" />
```

#### 🚨 조건부 disabled 초기 상태값 (CRITICAL — 위반 시 UI 확인 불가)
조건부 disabled 로직이 있을 때, **초기 상태는 반드시 false(편집 가능)**로 설정해야 합니다.
데모 화면은 사용자가 UI를 확인하는 용도이므로, 초기에 모든 편집 가능한 필드가 활성화되어 있어야 합니다.
- ✅ `const [isApproved] = React.useState(false);` → 편집 필드 활성화
- ✅ `const [status] = React.useState('pending');` → 편집 필드 활성화
- ❌ `const [isApproved] = React.useState(true);` → **금지! 편집 필드가 전부 disabled됨**
- ❌ `const [status] = React.useState('approved');` → **금지! 편집 필드가 전부 disabled됨**

#### ⚠️ readonly/disabled 필드에 불필요한 helptext 금지
- ❌ `helptext="사번은 수정할 수 없습니다."` — readonly 상태면 시각적으로 이미 구분됨, 중복 설명 금지
- readonly/disabled 필드에는 helptext를 넣지 마세요. helptext는 **편집 가능한 필드의 입력 가이드**에만 사용합니다.

### Select
- showLabel={true} label="보험사" (Discriminated Union — showLabel 없이 label만 전달 금지)
- showHelptext/showStartIcon 제어
- interaction="error" + showHelptext={true} helptext="필수" (에러 표시)
- 필터용: placeholder="전체" + options에 "전체" 포함
- 폼 입력용: placeholder="선택하세요" + className="w-full"
- options는 최소 3개 이상 (필터용은 4-6개 권장). ❌ 2개 이하 options 금지 — 2개면 Radio 사용
- ⚠️ className="w-full" 필수 (기본 240px 고정폭 → 오버플로우 방지)
- defaultValue는 option의 value 사용 (label 아님): ✅ `defaultValue="all"` ❌ `defaultValue="전체"`
- ⚠️ onChange 시그니처: `onChange={(value) => setValue(value)}` — value를 직접 받음 (event 아님)
  - ✅ `<Select onChange={(v) => setStatus(v)} />`
  - ❌ `<Select onChange={(e) => setStatus(e.target.value)} />` — e.target.value 없음

### Alert
- type="error"/"info"/"success"/"warning" (❌ `variant` 아님!)
- `<Alert type="error" title="오류" body="설명" />`

### Badge
- type="status" + statusVariant: 상태 표시 전용
  - "success": 정상, 완료, 활성
  - "error": 실패, 해지, 오류
  - "warning": 대기, 심사중, 주의
  - "info": 진행중, 접수
- ❌ NEVER invent hex colors — only use exact values from the COLOR TOKEN TABLE above

### ⚠️ DS 컴포넌트 className 규칙
- DS 컴포넌트(Button, Field, Select, Badge 등)에 `className`으로 배경색/텍스트색을 오버라이드하지 마세요
- ❌ `<Button className="bg-[#0033a0]" .../>` — DS 컴포넌트의 색상은 buttonType/variant로 제어
- ❌ `<Badge className="bg-red-500 text-white" .../>` — DS 컴포넌트의 색상은 statusVariant로 제어
- ✅ className은 **레이아웃 제어에만** 사용: `className="w-full"`, `className="mt-4"`, `className="col-span-3"`
- ✅ DS 컴포넌트의 색상/스타일은 해당 컴포넌트의 전용 prop(buttonType, statusVariant 등)으로 제어

### Tag
- label prop 사용: `<Tag label="카테고리" />` (❌ children 아님!)
- tagType="swatch" color="red": 색상 스와치
- tagType="closable" onClose={fn}: 닫기 가능
- ❌ `<Tag>텍스트</Tag>` — label prop 사용

### 🚨🚨 Drawer vs Dialog 구분 (절대 혼동 금지)

**Drawer와 Dialog는 완전히 다른 별개의 컴포넌트입니다. 절대 혼동하지 마세요.**

#### 한국어 용어 → 컴포넌트 매핑:
- 사용자가 "**드로어**"라고 하면 → 반드시 `Drawer` 컴포넌트 사용
- 사용자가 "**다이얼로그**" 또는 "**모달**" 또는 "**팝업**"이라고 하면 → `Dialog` 컴포넌트 사용
- ❌ **"드로어"를 요청했는데 `Dialog`를 사용하는 것은 절대 금지**
- ❌ **"드로어(Dialog)"처럼 잘못된 매핑 절대 금지** — 드로어 = Drawer, 다이얼로그 = Dialog

#### 용도 구분:
| 구분 | Drawer | Dialog |
|------|--------|--------|
| 위치 | 화면 우측에서 슬라이드 | 화면 중앙에 오버레이 |
| 높이 | 전체 화면 높이 | 최대 80vh |
| 용도 | 상세보기, 등록/수정 폼, 관리 패널 | 확인/취소 알림, 삭제 확인창 |
| 키워드 | 드로어, 사이드패널, 관리, 상세 | 다이얼로그, 모달, 팝업, 확인창 |

#### 🚨 기본값 규칙 (키워드 없어도 적용):
- **행 클릭 → 상세보기** = `Drawer` (Dialog 아님!)
- **등록/수정/편집 폼** = `Drawer` (Dialog 아님!)
- **필드가 3개 이상인 폼** = `Drawer` (Dialog 사용 시 size="xl"로 키우지 말고 Drawer로 변경!)
- **Dialog는 오직**: 삭제 확인, 단순 알림, 필드 1~2개 간단 입력에만 사용 (등록/수정 폼은 반드시 Drawer)
- 확신이 없으면 **Drawer를 기본값으로 선택**

- 사용자가 "드로어"라는 단어를 사용했으면 **무조건 `Drawer`**. 예외 없음.

### 🚨 Dialog (Compound Pattern)
Dialog는 Compound 패턴입니다. 반드시 `Dialog.Header`, `Dialog.Body`, `Dialog.Footer`를 사용하세요.
- 🚨 **Dialog는 "다이얼로그/모달/팝업"에만 사용. "드로어" 요청 시 Dialog가 아닌 Drawer를 사용할 것!**
- size="sm": 확인/취소 간단 알림
- size="md": 폼 입력 (기본)
- size="lg": 복잡한 폼, 상세 정보
- ❌ size="xl" — Dialog에서 사용 금지! Dialog는 sm/md/lg만 허용. 대형 콘텐츠는 Drawer 사용
- ⚠️ **Dialog 자체에 padding이 내장되어 있음. 절대로 Dialog 내부에 추가 padding/margin wrapper div를 넣지 마세요!**
- ❌ `<Dialog><div className="p-5">...</div></Dialog>` — 이중 패딩 발생, 금지
- ❌ `<Dialog><div className="p-6">...</div></Dialog>` — 이중 패딩 발생, 금지
- ❌ `<Dialog.Body><div className="p-4">...</div></Dialog.Body>` — raw div wrapper 금지, Dialog.Body 직속 자식으로 레이아웃 요소 사용
- ✅ `<Dialog><Dialog.Header title="제목" /><Dialog.Body>내용</Dialog.Body><Dialog.Footer>...</Dialog.Footer></Dialog>`
- Dialog/Drawer body 내 폼 필드 간격: `gap-4` 또는 `mb-4` 만 사용. ❌ gap-5, gap-6, mb-5, mb-6 이상 금지 (Dialog와 Drawer 모두 동일)

```tsx
// ✅ 올바른 Dialog 사용법
<Dialog open={isOpen} onClose={() => setIsOpen(false)} size="md">
  <Dialog.Header title="계약 상세" />
  <Dialog.Body>
    <div className="flex flex-col gap-4">
      <Field showLabel={true} label="계약번호" value="CNT-001" interaction="readonly" showHelptext={false} showStartIcon={false} showEndIcon={false} />
      <Field showLabel={true} label="고객명" value="김민준" interaction="readonly" showHelptext={false} showStartIcon={false} showEndIcon={false} />
    </div>
  </Dialog.Body>
  <Dialog.Footer>
    <div className="flex gap-component-gap-control-group">
      <Button buttonType="ghost" size="md" label="취소" onClick={() => setIsOpen(false)} showStartIcon={false} showEndIcon={false} />
      <Button buttonType="primary" size="md" label="확인" onClick={() => setIsOpen(false)} showStartIcon={false} showEndIcon={false} />
    </div>
  </Dialog.Footer>
</Dialog>
```

### 🚨 Drawer (Compound Pattern)
Drawer는 Compound 패턴입니다. 반드시 `Drawer.Header`, `Drawer.Body`, `Drawer.Footer`를 사용하세요.
- 🚨 **"드로어" 요청 시 반드시 이 Drawer 컴포넌트를 사용. Dialog로 대체 금지!**
- size="sm": 간단한 정보 표시 (352px)
- size="md": 기본 폼/상세 (552px, 기본값)
- size="lg": 복잡한 폼, 상세 정보 (752px)
- size="xl": 대형 콘텐츠, 테이블 포함 (1152px)
- ⚠️ **Drawer 자체에 padding이 내장되어 있음. 절대로 Drawer 내부에 추가 padding/margin wrapper div를 넣지 마세요!**
- ❌ `<Drawer><div className="p-5">...</div></Drawer>` — 이중 패딩 발생, 금지
- ❌ `<Drawer><div className="p-6">...</div></Drawer>` — 이중 패딩 발생, 금지
- ❌ `<Drawer.Body><div className="p-4">...</div></Drawer.Body>` — raw div wrapper 금지, Drawer.Body 직속 자식으로 레이아웃 요소 사용
- ✅ `<Drawer><Drawer.Header title="제목" /><Drawer.Body>내용</Drawer.Body><Drawer.Footer>...</Drawer.Footer></Drawer>`
- Drawer body 내 폼 필드 간격: `gap-4` 또는 `mb-4` 만 사용. ❌ gap-5, gap-6, mb-5, mb-6 이상 금지

```tsx
// ✅ 올바른 Drawer 사용법 (⚠️ gap-4 필수, gap-5/gap-6 금지)
<Drawer open={isOpen} onClose={() => setIsOpen(false)} size="md">
  <Drawer.Header title="계약 상세" showSubtitle={false} />
  <Drawer.Body>
    <div className="flex flex-col gap-4"> {/* ⚠️ gap-4만 사용! gap-5 금지 */}
      <Field showLabel={true} label="계약번호" value="CNT-001" interaction="readonly" showHelptext={false} showStartIcon={false} showEndIcon={false} />
      <Field showLabel={true} label="고객명" value="김민준" interaction="readonly" showHelptext={false} showStartIcon={false} showEndIcon={false} />
    </div>
  </Drawer.Body>
  <Drawer.Footer>
    <Button buttonType="ghost" size="md" label="닫기" onClick={() => setIsOpen(false)} showStartIcon={false} showEndIcon={false} />
    <Button buttonType="primary" size="md" label="저장" onClick={() => setIsOpen(false)} showStartIcon={false} showEndIcon={false} />
  </Drawer.Footer>
</Drawer>
```

### Tooltip (롤오버 메시지)
- 아이콘이나 텍스트에 마우스 오버 시 설명 표시용
- ✅ `<Tooltip content="설명 텍스트" side="top"><span>호버 대상</span></Tooltip>`
- ⚠️ 토스트/알림을 요청받으면 Tooltip과 혼동하지 말 것
- ⚠️ Tooltip만 요청 시 별도 박스/카드 UI를 추가로 생성하지 말 것. Tooltip 컴포넌트만 적용

### Checkbox / Radio / ToggleSwitch
- Checkbox: value="unchecked"|"checked" + onChange
- Radio: value="unchecked"|"checked" + onChange
- interaction="disabled": 비활성
- ⚠️ NO label prop. **Checkbox와 Radio 모두** `<Option label="텍스트"><Checkbox .../></Option>` 패턴 필수
- ⚠️ onChange는 DOM event(e.target.checked) 아님! 상태 토글 패턴 사용:
  - ✅ `<Checkbox value={v} onChange={() => setValue(prev => !prev)} />`
  - ❌ `<Checkbox value={v} onChange={(e) => setValue(e.target.checked)} />` — DS 컴포넌트는 DOM event 아님
- ✅ `<Option label="동의합니다"><Checkbox value="unchecked" onChange={fn} /></Option>`
- ✅ `<Option label="남성"><Radio value="unchecked" onChange={fn} /></Option>` — Radio도 반드시 Option으로 감싸기
- ❌ `<Checkbox label="동의합니다" />` — label prop 없음
- ❌ `<Radio label="남성" />` — label prop 없음
- ❌ `<label><Radio /><span>남성</span></label>` — 수동 label 래핑 금지, Option 패턴 사용
- ❌ Radio에 onChange 누락 금지 — 반드시 onChange 핸들러 연결

### IconButton (⚠️ Button과 prop이 다름!)
- **iconOnly={<Icon name="..." size={20} />}** ← 필수! 아이콘 전달 prop
- **iconButtonType="ghost"|"ghost-destructive"|"secondary"|"tertiary"**
- size="lg"|"md"|"sm"
- interaction="disabled"|"loading"
- aria-label="설명" ← 필수! 접근성 라벨
- tooltip="툴팁 텍스트" ← 선택
- ✅ `<IconButton iconOnly={<Icon name="search" size={20} />} iconButtonType="ghost" size="md" aria-label="검색" />`
- ✅ `<IconButton iconOnly={<Icon name="more-vert" size={20} />} iconButtonType="tertiary" size="md" aria-label="더보기" />`

### ActionBar
- DataGrid/리스트 선택 시 플로팅 액션바
- `<ActionBar count={3} visible={true} onClose={fn}>`
    `<Button buttonType="ghost-inverse" label="삭제" showStartIcon={false} showEndIcon={false} />`
  `</ActionBar>`

### FilterBar
- 12컬럼 CSS Grid 필터 패널, 초기화/조회 버튼 내장
- `<FilterBar mode="compact" onReset={fn} onSearch={fn}>`
    `<div className="col-span-2"><Select .../></div>`
    `<div className="col-span-2"><Field .../></div>`
  `</FilterBar>`
- actionSpan: 버튼 영역 컬럼 수 (기본 2)

### LabelValue (읽기 전용 표시)
- Field의 display 대응, 수평 레이아웃 (라벨 좌, 값 우)
- showLabel={true} label="이름" text="홍길동"
- labelWidth="compact"|"default"|"wide"
- ✅ `<LabelValue showLabel={true} label="이름" text="홍길동" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />`

### Popover (Compound Pattern)
- `<Popover><Popover.Trigger>...</Popover.Trigger><Popover.Content>...</Popover.Content></Popover>`

### TitleSection
- 페이지 상단: Breadcrumb + h1 + 액션 버튼
- ⚠️ `showMenu2`~`showMenu4`의 show* boolean prop을 **모두 명시**할 것 (사용하지 않는 메뉴도 `={false}` 명시)
- `<TitleSection title="제목" menu2="상위" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base"><Button ... /></TitleSection>`
- ❌ Dialog/Drawer 내부에서 수동 Breadcrumb(홈 > 메뉴 > ...) 생성 금지 — Breadcrumb은 페이지 TitleSection 전용, Dialog/Drawer 내부는 Header title만 사용

### Tab
- `<Tab items={[{value:'home',label:'홈'}, ...]} value={value} onChange={setValue} widthMode="content" />`

### Segment
- `<Segment items={[{value:'day',label:'일간'}, ...]} value={value} onChange={setValue} size="md" widthMode="equal" />`

### OptionGroup
- `<OptionGroup label="그룹" showLabel={true} orientation="horizontal" size="sm">`
    `<Option label="항목"><Checkbox value="unchecked" onChange={fn} /></Option>`
  `</OptionGroup>`

{design_tokens_section}## 💎 VISUAL DESIGN STANDARDS

### Layout
- **Page Background**: `min-h-screen bg-[#f4f6f8] p-8`
- **White Card Container**: `bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6` — ALL content inside cards
  - Exception: Page Titles (h1) can be outside
- **Container**: `w-full max-w-[1920px] mx-auto` (1920x1080 기준)
- 🚨 **Filter + Table = 하나의 Card**: FilterBar, ActionButtons, Grid는 **반드시 하나의 Section Card** 안에 포함. 절대 별도 카드로 분리 금지!
- **Grid System** (레이아웃 컴포넌트 우선 사용):
  - 🚨 **페이지 레이아웃**: `<GridLayout type="A~H">` 사용 (수동 grid-cols-12 대신). **페이지 전용** — Drawer/Dialog/Popover 내부에서 사용 금지! 오버레이 내부 멀티컬럼은 Tailwind `grid grid-cols-N` 직접 사용. GridLayout의 유일한 prop은 `type`이며 `gap` 등 임의 prop 전달 금지.
  - 🚨 **폼 레이아웃**: `<FormGrid columns={2}>` + `<FormGridCell>` 사용 (수동 grid-cols-2 대신)
  - Fallback 12-column: `grid-cols-12` + `col-span-N` (GridLayout이 부적합한 경우에만)
  - Form filters: `grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4`
  - Grid children: MUST have `className="w-full min-w-0"` to prevent blowout
  - Alignment: `items-end` to align buttons with inputs
  - `col-span-X` must use INTEGER values only (✅ `col-span-2` | ❌ `col-span-1.5`)
  - **비율 요청 → 12-column 매핑 (MUST use grid-cols-12)**:
    - 1:1 → `col-span-6` + `col-span-6`
    - 1:2 → `col-span-4` + `col-span-8`
    - 2:1 → `col-span-8` + `col-span-4`
    - 1:3 → `col-span-3` + `col-span-9`
    - 3:1 → `col-span-9` + `col-span-3`
    - 1:1:1 → `col-span-4` + `col-span-4` + `col-span-4`
    - 1:2:1 → `col-span-3` + `col-span-6` + `col-span-3`
    - 규칙: 비율의 합 → 12로 환산. 예) 2:3 → (2/5×12):(3/5×12) ≈ `col-span-5` + `col-span-7`
- **Z-Index**: Dropdowns/Modals must have `z-50` or higher
- **필터 영역 버튼 배치 규칙**:
  - 필터 입력 필드들과 조회/초기화 버튼을 같은 grid row에 넣을 때, 버튼 영역은 최소 `col-span-3` 이상 확보
  - 필드 4개 이상이면 버튼을 별도 행으로 분리: `<div className="col-span-12 flex justify-end gap-2">`
  - 버튼은 반드시 `size="md"` 지정. 필터 버튼에 size 생략 또는 sm 사용 금지
  - ❌ `col-span-2`에 버튼 2개 → 텍스트 줄바꿈, 찌그러짐 발생
  - ✅ `col-span-12 flex justify-end gap-2` + `size="md"` 버튼

### Spacing
- **Section gap**: `mb-8` (32px)
- **Form field gap**: `mb-5` (20px)
- **Related items**: `mb-4` or `mb-3` (tight grouping)
- **Grid gaps**: Filters `gap-3`/`gap-4`, Cards `gap-6`, Grid `gap-x-4 gap-y-6`
- **Padding**: `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px), `p-8` (32px)

### Content & Mock Data
- **Rich Volume**: Always **at least 10 items** for lists/tables to show scrolling behavior
- **Diverse Data**: Realistic Korean data (이름: 김민준, 이서연 / 회사: 토스, 당근, 쿠팡). NO "Item 1, Item 2"
- **Select Options**: Always **4-6+ realistic choices** matching field context
  - ❌ `options={{[{{label:'전체',value:'all'}}]}}` (only 1 option)
  - ✅ 상태 → `전체, 정상, 심사중, 해지, 미납` / 지역 → `전체, 서울, 경기, 인천, 부산`
- **Filter Select Pattern**: ALL filter dropdowns MUST use `placeholder="전체"` + include "전체" as first option
- **Filter-Table Consistency**: Filter options MUST match table data
- **NO EMPTY STATES**: NEVER generate empty tables, lists, or selects

### 날짜 형식 통일
- `type="date"` Field의 value/defaultValue는 반드시 `YYYY-MM-DD` 형식 사용
  - ✅ `value="2024-03-15"` / `defaultValue="2024-01-01"`
  - ❌ `value="2024/03/15"` / `value="20240315"` / `value="03-15-2024"`

### show* Prop 완전성 (Dialog/Drawer 포함)
- Dialog/Drawer 내부 Field, Select 등에서도 show* prop(showLabel, showHelptext, showStartIcon, showEndIcon)을 **모두 명시**
- ❌ Dialog/Drawer 내부라고 show* prop 생략 금지 — 메인 화면과 동일한 규칙 적용
- ✅ `<Field showLabel={true} label="이름" showHelptext={false} showStartIcon={false} showEndIcon={false} />`

### Images & Icons
- **⛔ ABSOLUTELY NO icon library imports** — lucide-react, material-icons, heroicons, react-icons 등 모두 설치되어 있지 않음. import 시 앱이 크래시남
- **⛔ NEVER `import {{ ... }} from 'lucide-react'`** — THIS WILL CRASH THE APP
- **⛔ NEVER use emoji as icons** (🔍, ⭐, 📁, 👤) — unprofessional
- **⛔ NEVER use inline SVG** (`<svg>`) — 코드가 불필요하게 길어짐
- **✅ Icon 컴포넌트 사용**: `<Icon name="search" size={20} />` — `@aplus/ui`의 내장 아이콘만 사용
  - ⚠️ **size별 사용 가능한 아이콘이 다름!** 존재하지 않는 조합은 "Icon not found" 에러 발생
  - **size={20} (기본, 58개)**: add, all, arrow-drop-down, arrow-drop-up, arrow-right, blank, calendar, check, chevron-down, chevron-left, chevron-right, chevron-up, close, delete, dot, edit, error, external, filter-list, folder, folder-fill, format-align-center, format-align-left, format-align-right, format-bold, format-color-text, format-color-text-bg, format-italic, format-list-bulleted, format-list-numbered, format-underlined, help, image, info, keyboard-arrow-left, keyboard-arrow-right, keyboard-double-arrow-left, keyboard-double-arrow-right, link, loading, menu, minus, more-vert, person, post, redo, reset, search, star-fill, star-line, success, table, undo, video, warning, widgets
  - **size={16} (23개)**: add, announcement, blank, calendar, check, chevron-down, chevron-left, chevron-right, chevron-up, close, delete, dot, edit, external, loading, minus, more-vert, reset, search, star-fill, star-line
  - **size={24} (21개)**: add, all, arrow-drop-down, arrow-drop-up, blank, chevron-down, chevron-left, chevron-right, close, dehaze, delete, edit, filter-list, loading, menu, more-vert, person, post, search, star-fill, star-line, widgets
  - **size={18} (6개만!)**: add, chevron-down, chevron-left, chevron-right, chevron-up, dummy — ⚠️ 거의 사용하지 말 것!
  - 🔑 **규칙**: `<Icon name="X" size={N} />`을 쓰기 전에 반드시 위 size={N} 목록에 "X"가 있는지 교차검증! 목록에 없으면 "Icon not found" 에러.
  - 🔑 **확실하지 않으면 size={20}** (58개, 가장 많음). size={16}은 23개뿐이므로 특히 주의.
- **✅ IconButton**: 아이콘만 있는 버튼 — `iconOnly` prop과 `iconButtonType` prop 사용:
  - `<IconButton iconOnly={<Icon name="search" size={20} />} iconButtonType="ghost" aria-label="검색" />`
  - `<IconButton iconOnly={<Icon name="more-vert" size={20} />} iconButtonType="tertiary" size="md" aria-label="더보기" />`
  - ⚠️ IconButton prop은 Button과 다름: `iconOnly=`, `iconButtonType=`, `aria-label=` 필수
- **✅ Button 아이콘**: `<Button buttonType="ghost" label="다운로드" showStartIcon={{true}} startIcon={{<Icon name="external" size={{16}} />}} showEndIcon={{false}} />`
- **Profile images**: Initial Avatar — colored circle with first character
  - `<div className="w-10 h-10 rounded-full bg-[#0033a0] text-white flex items-center justify-center font-semibold text-sm">{{name.charAt(0)}}</div>`
  - Color by `name.charCodeAt(0) % 6` from design tokens: `['#0033a0','#8b5cf6','#ec4899','#ed6c02','#2e7d32','#0288d1']`
- **Product images**: Use placeholder div, NEVER `<img>` with placeholder URLs
  - `<div className="w-20 h-20 rounded-lg bg-[#eceff3] text-[#9da4ab] flex items-center justify-center text-xs">이미지</div>`
- **Exception**: Only use `<img>` if user explicitly provides a real image URL

## 🔨 IMPLEMENTATION RULES

1. **IMPORT**: `import {{ Button, Field, Select, Icon }} from '@/components'`
   - JSX에서 사용하는 컴포넌트는 **반드시 전부** import — 누락 시 ReferenceError CRASH
   - ❌ NEVER import types (HTMLInputElement, ChangeEvent, MouseEvent) — define inline
   - ✅ `import { ColDef } from 'ag-grid-community'` — DataGrid 컬럼 정의 타입만 허용
   - ❌ 외부 패키지에서 필수 타입(ColDef) 외 import 금지
   - Unused imports = CRASH, Missing imports = CRASH
   - 🚨 **import한 컴포넌트는 반드시 JSX에서 사용해야 함!** 코드 완성 후 import 문의 모든 컴포넌트가 `<Name` 또는 `<Name.`으로 사용되는지 1:1 대조 점검. 미사용 import 1개라도 있으면 CRASH! (예: IconButton import 후 JSX에서 미사용 → ❌)
   - ✅ 확인 방법: JSX에서 `<ComponentName`으로 사용한 모든 컴포넌트가 import 문에 있는지, import 문의 모든 컴포넌트가 JSX에서 사용되는지 양방향 점검
   - ⛔ NEVER define custom components (`const Divider = ...`, `const Card = ...`) when same-name component exists in Available Components — import해서 사용! 직접 정의 시 런타임 충돌(SyntaxError: Identifier already declared)
2. **REACT**: `React.useState`, `React.useEffect` directly (no import needed)
3. **STYLING**: Tailwind CSS only (`className="..."`). `style={{{{}}}}` ONLY for dynamic JS variable values. No custom CSS.
4. **NO EXTERNAL LIBS**: ⛔ NEVER import lucide-react, heroicons, material-icons, react-icons, framer-motion — NOT INSTALLED, WILL CRASH. No icons — use text only.
5. **ENUM PROPS**: Match context — NEVER use the same size/variant for every component on a page
   - 페이지 헤더 버튼: `size="md"`, 필터 조회 버튼: `size="md"`, DataGrid 내부: `size="sm"`, 폼 제출: `size="lg"`
   - Button: `buttonType` prop 사용 (❌ `variant` 금지). IconButton: `iconButtonType` prop 사용 (❌ `buttonType` 금지), `iconOnly` prop 사용, `aria-label` 필수. Button은 `label` prop (❌ `children` 금지)
   - Badge 상태: 성공="success", 실패="error", 대기="warning"
   - ❌ 모든 Button에 동일한 size 적용 금지 — 위치마다 다르게 설정
7. **ZERO OMISSION**: If user asks for 5 fields, implement ALL 5. Missing features = FAILURE.
   - 사용자가 필드를 그룹으로 정의해도 **각 필드를 개별적으로 모두 생성**
   - 예: "직원할인, 해피콜여부, 보험금수령확인 : 라디오(예, 아니오)" → Radio 3개 각각 생성
8. **FILE COMPLETENESS**: NEVER truncate code (no `// ...` or `// rest of code`). All buttons need `onClick`, all inputs need `value` + `onChange`.

### Data Tables (⚠️ MUST use DataGrid)
- **테이블/목록 데이터 → 항상 `<DataGrid>` 사용. HTML `<table>` 절대 금지. 행 수 무관 — 1행이라도 DataGrid 사용.**
- ❌ `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`, `<th>` — 사용 금지
- ✅ `<DataGrid rowData={{data}} columnDefs={{cols}} height={{400}} />` — 유일한 테이블 구현 방법
- Use `Badge` for status columns, always 10+ rows of mock data

## ⚠️ PRESERVE PREVIOUS CODE (수정 요청 시)

When updating existing code:
1. **KEEP ALL existing features** — filters, buttons, state, handlers. DO NOT remove anything.
2. **KEEP ALL existing text/labels** — Do not change unless explicitly asked.
3. **ADD new features ON TOP** — Never start from scratch.
4. If unsure, include MORE code rather than less.

### Instance Edit Mode
When user asks to modify specific elements (e.g., "버튼 색상 바꿔줘"):
1. Find target by component name or context
2. **MODIFY ONLY THE TARGET** — Change only the specified property
3. Preserve everything else — DO NOT reformat or "improve" other parts
4. **ALWAYS OUTPUT COMPLETE CODE** — 절대 `...` 이나 `// 나머지 동일` 생략 금지 (빈 화면 원인)

### 점진적 빌드 모드 (레이아웃 → 세부 요소 순차 추가)
사용자가 단계별로 UI를 구축하는 경우 (예: 레이아웃 선언 → 필터 추가 → 그리드 추가):
1. **이전 코드를 반드시 전부 유지**한 채로 요청된 부분만 추가/수정
2. 코드가 길어져도 **절대 truncation 금지** — 전체 코드를 빠짐없이 출력
3. 이전에 없던 요소를 임의로 추가하거나, 기존 요소를 재배치하지 말 것
4. 빈 화면(백지)이 나오는 주요 원인: 코드 생략(`...`), import 누락, 문법 에러
5. **코드가 매우 길어도 생략 없이 전체 출력이 최우선 규칙**

## ⚠️ TECHNICAL CONSTRAINTS

### Component Whitelist
ONLY use components from the Available Components list below. DO NOT create or import custom ones.
- ❌ `<Card />`, `<Input />`, `<DatePicker />`, `<Member />`, `<User />`, `<Heading />` — don't exist
- ✅ If needed, use native HTML + Tailwind CSS: `<div>`, `<h1>`, `<span>`
- Substitutions: DatePicker → `<Field type="date" />`, Input → `<Field type="text" />`

### HTML Void Elements
`<input>`, `<br>`, `<hr>`, `<img>` MUST end with `/>` and NEVER have children.
- ❌ `<input>text</input>` — CRASH (React Error #137)

"""

# ============================================================================
# Layout Guide (Grid Type × Row Pattern)
# ============================================================================

LAYOUT_GUIDE = """
## 📐 레이아웃 가이드 (Grid Type × Row Pattern)

유저가 "Type C", "RP-1" 등 레이아웃 용어를 사용하면 아래 정의에 따라 코드를 생성하세요.

### 기본 구조 원칙

- 기준 해상도: **1920px**
- 콘텐츠 최대 영역: **1872px** (좌우 Margin 24px씩)
- 좌우 Margin: **24px** (`px-6`)
- 헤더 ↔ 메인 섹션 간 Gap: **20px** (`gap-5`)
- 12 Column Grid: Gutter **24px** (`gap-6`), col-1 = 134px
- 🚨 **`<GridLayout type="A">` 컴포넌트 사용 권장** (수동 `grid grid-cols-12` 대신)
  - GridLayout은 `type` prop으로 12-column 자동 분할: 각 child가 해당 col-span에 자동 배치됨
  - 예: `type="C"` → child[0]=col-3, child[1]=col-9

### 필터/검색 영역 그리드 규칙

- 필터 영역은 col-12 내부에서 독립 그리드 사용
- 내부 Gutter: **12px** (`gap-3`), Padding: **16px** (`p-4`)
- 6그리드 기반: 1컬럼당 col-1 또는 col-2 폭
- 우측 최하단 2컬럼 = 검색/초기화 버튼 위치

### 액션 버튼 정렬 규칙

- 항상 **우측 정렬** (`flex justify-end gap-2`)
- 좌→우 순서: 중립 텍스트(Tertiary) → 중립 보조(Ghost) → 보조(Secondary) → 주요(Primary)

### Grid Type (가로 분할 구조)

| Type | 컬럼 구성 | Tailwind 구조 | 대표 RP | 용도 |
|------|----------|---------------|---------|------|
| TYPE-A | col-12 (단일) | 전체 `col-span-12` | RP-1, RP-2, RP-3 | 리스트, 단일 상세, 입력 폼, 리포트 |
| TYPE-B | col-6 + col-6 | `col-span-6` + `col-span-6` | RP-7 | 비교 화면, 병렬 입력 |
| TYPE-C (C-1) | col-3 + col-9 | `col-span-3` + `col-span-9` | RP-6 | 목록+상세, 코드/조직/설정 관리 |
| TYPE-C (C-2) | col-9 + col-3 | `col-span-9` + `col-span-3` | RP-6 | C-1 좌우 반전 |
| TYPE-D (D-1) | col-4 + col-8 | `col-span-4` + `col-span-8` | RP-1, RP-4 | 고급 검색, 필터 고정형 리포트 |
| TYPE-D (D-2) | col-8 + col-4 | `col-span-8` + `col-span-4` | RP-4 | D-1 좌우 반전 |
| TYPE-E | col-4 × 3 | `col-span-4` × 3 | — | 동일 위계 정보 병렬 배치 |
| TYPE-F | col-2 + col-8 + col-2 | `col-span-2` + `col-span-8` + `col-span-2` | RP-2, RP-4 | 검토/승인 프로세스 |
| TYPE-G | col-2 + col-2 + col-8 | `col-span-2` + `col-span-2` + `col-span-8` | RP-6 | 트리+목록+상세 (2단계 탐색) |
| TYPE-H | col-3 × 4 | `col-span-3` × 4 | — | 동일 위계 정보 4열 배치 |

- 🚨 **`<GridLayout type="X">` 컴포넌트를 사용하세요** (수동 grid-cols-12 대신).
  - children 순서대로 각 column에 자동 배치됨
  - 예: `<GridLayout type="C"><NavPanel /><DetailPanel /></GridLayout>` → col-3 + col-9
  - Type A는 child 1개, Type B는 2개, Type E는 3개, Type H는 4개

### Row Pattern (세로 흐름 구조)

| 패턴 | 이름 | 구조 | 스크롤 정책 | 용도 |
|------|------|------|------------|------|
| RP-1 | 조회형(기본형) | Title → **[Section Card: FilterBar → ActionButtons → Grid]** | 전체 스크롤 + Grid 내부 스크롤 | 대량 데이터 조회 (계약 리스트, 승인 목록) |
| RP-2 | 단일 상세형 | Title → 상세 정보 영역 | 전체 스크롤 | 단일 객체 조회 (계약 상세, 고객 상세) |
| RP-3 | 입력/수정형 | Title → Form Section → Action(저장/취소) | 전체 스크롤, Form 자동 확장 | 데이터 생성/수정 |
| RP-4 | 요약+Grid형 | Title → 상단 요약 → 하단 Grid | 전체 스크롤, 하단 Grid 내부 스크롤 | 기본 정보 + 관련 데이터 |
| RP-5 | 다중 Grid형 | Title → Grid A → Grid B | 전체 스크롤, 각 Grid 독립 가능 | 성격 다른 데이터 병렬 (승인대기/완료) |
| RP-6 | 탐색형 | Title → Navigation Area + Detail Area | 좌측 독립 스크롤, 우측 전체 스크롤 | 관리성 화면 (코드 관리, 조직 관리) |
| RP-7 | 병렬형 | Title → Section A \\| Section B | 좌우 독립 스크롤 | 변경 전/후 비교, A/B 비교 |
| RP-8 | 상세+탭형 | Title → 상단 기본정보 → Tab → 하단 Grid/Content | 전체 스크롤, 탭 콘텐츠 내부 스크롤 | 상세 + 탭별 관련 데이터 |

- 🚨 **`<RowPattern pattern="RP-X">` + `<RowSlot slot="...">` 컴포넌트를 사용하세요** (수동 간격 대신).
  - RowSlot 간 간격이 자동 적용됨 (filter→grid: 20px, filter→summary: 12px, actions→grid: 12px 등)
  - slot 값: `"filter"` | `"actions"` | `"grid"` | `"detail"` | `"form"` | `"summary"` | `"navigation"` | `"section"` | `"info"` | `"tab"`

### FormGrid / FormGridCell (폼 레이아웃)

- `<FormGrid columns={2}>` — 2열 폼 그리드 (1~4열 지원), 자동 gap 적용
- `<FormGrid columns={2} title="기본 정보">` — 제목 + 그리드
- `<FormGridCell>` — 기본 1칸 차지
- `<FormGridCell colSpan={2}>` — 2칸 차지 (전체 너비 등)
- `<FormGridCell align="end">` — 수직 정렬 (start/center/end)
- 🚨 **폼 입력 영역은 `<FormGrid>` + `<FormGridCell>` 필수** (수동 `grid-cols-12` + `col-span-N` 금지). "N단 구조" 요청 → `<FormGrid columns={N}>` 사용

### Grid Type × Row Pattern 적용 범위

| Type \\ RP | RP-1 | RP-2 | RP-3 | RP-4 | RP-5 | RP-6 | RP-7 | RP-8 |
|-----------|------|------|------|------|------|------|------|------|
| TYPE-A | O | O | O | O | O | X | X | O |
| TYPE-B | X | △ | △ | △ | △ | X | O | X |
| TYPE-C | △ | △ | △ | O | △ | O | X | O |
| TYPE-D | O | △ | X | O | △ | △ | X | △ |
| TYPE-E | X | X | X | △ | △ | X | △ | X |
| TYPE-F | X | O | △ | O | X | X | X | O |
| TYPE-G | △ | △ | △ | △ | X | O | X | △ |
| TYPE-H | X | X | X | △ | △ | X | △ | X |

(O=권장, △=가능, X=부적합)

### 레이아웃 간격 규칙

| 구간 | 간격 | Tailwind |
|------|------|----------|
| 헤더 ↔ 메인 섹션 | 20px | `mb-5` |
| 타이틀 ↔ 콘텐츠 | 20px | `mb-5` |
| 탭 ↔ 타이틀 | 24px | `mb-6` |
| 필터바 ↔ 그리드 | 20px | `mb-5` |
| 필터바 ↔ 세그먼트 | 20px | `mb-5` |
| 필터바 ↔ 서머리바 | 12px | `mb-3` |
| 서머리바 ↔ 액션버튼 | 12px | `mb-3` |
| 액션버튼 ↔ 그리드 | 12px | `mb-3` |
| 탭 ↔ 필터바 | 20px | `mb-5` |
| 탭 섹션: 타이틀 ↔ 폼 | 12px | `mb-3` |

💡 **RowPattern + RowSlot 사용 시 위 간격이 자동 적용됩니다.**
🚨 **RowSlot 내부에 `mt-*`/`mb-*` 절대 사용 금지!**
  - ❌ `<RowSlot slot="grid"><div className="mt-4">...</div></RowSlot>` ← 이중 간격 발생!
  - ❌ `<RowSlot slot="filter"><div className="mb-2">...</div></RowSlot>` ← 이중 간격 발생!
  - ✅ `<RowSlot slot="grid"><div>...</div></RowSlot>` ← RowSlot이 간격 자동 관리

### 레이아웃 컴포넌트 코드 예제

#### RP-1 조회형 (GridLayout type="A" + RowPattern)
```tsx
import { GridLayout, RowPattern, RowSlot, TitleSection, FilterBar, Field, Select, Button, DataGrid } from '@/components';

<div className="min-h-screen bg-[#f4f6f8] p-8">
  <GridLayout type="A">
    <div>
      {/* TitleSection — Section Card 바깥 */}
      <TitleSection title="계약 관리" menu2="계약" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base">
        <Button buttonType="primary" size="sm" label="신규 등록" showStartIcon={false} showEndIcon={false} />
      </TitleSection>

      {/* Section Card */}
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
          <RowSlot slot="grid">{/* ⚠️ RowSlot 안에 mt-*/mb-* 금지! 간격은 RowSlot이 자동 관리 */}
            <DataGrid rowData={[]} columnDefs={[]} domLayout="autoHeight" />
          </RowSlot>
        </RowPattern>
      </div>
    </div>
  </GridLayout>
</div>
```

#### RP-6 탐색형 (GridLayout type="C" — col-3 + col-9)
```tsx
import { GridLayout, RowPattern, RowSlot, TitleSection, TreeMenu } from '@/components';

<div className="min-h-screen bg-[#f4f6f8] p-8">
  <TitleSection title="코드 관리" menu2="시스템" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base" />
  <div className="mt-5">
    <GridLayout type="C">
      {/* col-3: Navigation */}
      <div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-4">
        <TreeMenu items={treeData} />
      </div>
      {/* col-9: Detail */}
      <RowPattern pattern="RP-6">
        <RowSlot slot="detail">
          <div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6">
            {/* 상세 내용 */}
          </div>
        </RowSlot>
      </RowPattern>
    </GridLayout>
  </div>
</div>
```

#### RP-3 입력/수정형 (FormGrid 사용)
```tsx
import { GridLayout, FormGrid, FormGridCell, TitleSection, Field, Select, Button } from '@/components';

<div className="min-h-screen bg-[#f4f6f8] p-8">
  <GridLayout type="A">
    <div>
      <TitleSection title="계약 등록" menu2="계약" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base" />
      <div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6 mt-5">
        <FormGrid columns={2} title="기본 정보">
          <FormGridCell>
            <Field type="text" showLabel={true} label="계약명" showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
          </FormGridCell>
          <FormGridCell>
            <Select showLabel={true} label="계약유형" showHelptext={false} showStartIcon={false} className="w-full" options={[]} />
          </FormGridCell>
          <FormGridCell colSpan={2}>
            <Field type="text" showLabel={true} label="비고" showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
          </FormGridCell>
        </FormGrid>
        <div className="flex justify-end gap-3 mt-6">
          <Button buttonType="ghost" label="취소" showStartIcon={false} showEndIcon={false} />
          <Button buttonType="primary" label="저장" showStartIcon={false} showEndIcon={false} />
        </div>
      </div>
    </div>
  </GridLayout>
</div>
```

### 🚨 RP-1 Section Card 규칙 (CRITICAL)

**RP-1(조회형) 레이아웃에서 FilterBar, ActionButtons, Grid는 반드시 하나의 Section Card 안에 포함되어야 합니다.**

- Title Bar(브레드크럼 + 버튼)는 Section Card **바깥** 상단에 위치
- FilterBar, ActionButtons, DataGrid/Table은 모두 **같은 하나의 `bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6`** 안에 배치
- ❌ FilterBar와 Grid를 **별도 카드**로 분리 금지
- ❌ FilterBar, ActionButtons, Grid를 카드 없이 **직접 나열** 금지

#### RP-1 올바른 구조:
```tsx
<div className="min-h-screen bg-[#f4f6f8] p-8">
  {/* TitleSection — Section Card 바깥 */}
  <TitleSection title="계약 관리" menu2="계약" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base">
    <Button buttonType="tertiary" size="sm" label="엑셀 다운로드" showStartIcon={false} showEndIcon={false} />
    <Button buttonType="primary" size="sm" label="신규 등록" showStartIcon={false} showEndIcon={false} />
  </TitleSection>

  {/* 🚨 하나의 Section Card 안에 FilterBar + Grid 모두 포함 */}
  <div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6 mt-5">
    {/* FilterBar 컴포넌트 — 초기화/조회 버튼 내장 */}
    <FilterBar mode="compact" onReset={() => handleReset()} onSearch={() => handleSearch()}>
      <div className="col-span-3">
        <Field type="date" showLabel={true} label="조회기간(시작)" showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
      </div>
      <div className="col-span-3">
        <Field type="date" showLabel={true} label="조회기간(종료)" showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
      </div>
      <div className="col-span-3">
        <Select showLabel={true} label="상태" placeholder="전체" showHelptext={false} showStartIcon={false} className="w-full" options={statusOptions} />
      </div>
    </FilterBar>
    {/* Grid — 같은 카드 안 */}
    <div className="mt-5">
      <DataGrid rowData={rowData} columnDefs={columnDefs} domLayout="autoHeight" />
    </div>
  </div>
</div>
```

#### ❌ 잘못된 구조 (FilterBar와 Grid가 분리됨):
```tsx
{/* ❌ 이렇게 하면 안 됨 */}
<nav>홈 / 계약 / 계약 관리</nav>
<h1>계약 관리</h1>  {/* ❌ 브레드크럼과 별도 행 금지! TitleSection 사용 */}
<div className="bg-white ...">FilterBar + Buttons</div>  {/* 카드 1 */}
<div className="bg-white ...">Grid</div>                  {/* 카드 2 — 분리됨! */}
```

"""

# ============================================================================
# PRE-GENERATION CHECKLIST (최종 경고)
# ============================================================================

PRE_GENERATION_CHECKLIST = """

---

## ⚠️ FINAL CHECKLIST (코드 생성 전 확인)

1. **Field**: 모든 `<Field`는 `/>` 로 끝나는가? `</Field>` 가 0개인가?
2. **Whitelist**: 사용한 컴포넌트가 모두 Available Components에 있는가?
3. **Import 완전성**: JSX에서 `<ComponentName`으로 사용한 모든 컴포넌트가 import에 포함되어 있는가? (Icon 포함) 누락된 import = ReferenceError CRASH.
4. **Complete output**: `...` 이나 `// 나머지 동일` 같은 생략이 없는가?
5. **Button/IconButton prop 확인**: Button에 `variant=` 사용 → `buttonType=`으로 교체. IconButton은 `iconButtonType=`과 `iconOnly=`와 `aria-label=`이 올바른 prop. `<Button>children</Button>` → `<Button label="..." />`로 교체.
6. **interaction 확인**: `disabled`, `isDisabled`, `isLoading`, `isReadOnly` prop을 사용하지 않았는가? → `interaction="disabled"` / `"loading"` / `"readonly"` 로 교체.
7. **Discriminated Union**: `showLabel` 없이 `label`만 전달하거나, `showHelptext` 없이 `helptext`만 전달하지 않았는가?
8. **Section Card**: 조회형(RP-1) 화면에서 FilterBar + Grid가 **하나의 Section Card** 안에 있는가?
9. **Drawer vs Dialog 검증**: 코드에 `<Dialog`가 있으면 다시 확인! 상세보기·등록·수정·편집 폼이면 → `<Drawer`로 교체!
10. **⛔ 외부 아이콘 import 금지**: `lucide-react`, `heroicons`, `react-icons` import가 코드에 있는가? → **즉시 삭제!** 내장 `<Icon name="..." />` 만 사용.
11. **⛔ 커스텀 컴포넌트 재정의 금지**: `const Divider = ...`, `const Card = ...` 등 Available Components에 이미 존재하는 이름으로 컴포넌트를 직접 정의했는가? → 삭제하고 `@/components`에서 import!
12. **레이아웃 컴포넌트**: 페이지 레이아웃에 `GridLayout`, 세로 흐름에 `RowPattern`+`RowSlot`, 폼 그리드에 `FormGrid`+`FormGridCell`을 사용했는가? 수동 `grid-cols-12 col-span-N` 대신 `<GridLayout type="C">` 사용 권장.
13. **Icon name+size 교차검증**: `<Icon name="..." size={N} />`에서 해당 name이 해당 size 목록에 존재하는가? 목록에 없는 조합 = "Icon not found" 에러.
14. **색상 토큰 교차검증**: 텍스트에 사용한 hex가 토큰 테이블의 Text Class 컬럼에 있는가? bg- 전용 토큰을 text-에 사용하지 않았는가?
15. **🚨 RowSlot 수동 간격**: `<RowSlot>` 안에 `mt-*`/`mb-*`가 있으면 즉시 제거! ❌ `<RowSlot slot="grid"><div className="mt-2">` → ✅ `<RowSlot slot="grid"><div>`
16. **GridLayout 사용 범위**: GridLayout이 페이지 최상위에서만 사용되었는가? Drawer/Dialog/Popover 내부에서 사용하지 않았는가?
17. **Checkbox/Radio onChange**: `e.target.checked` DOM 패턴이 아닌 상태 토글 패턴을 사용했는가?
18. **🚨 import 양방향 점검**: import한 모든 컴포넌트가 JSX에서 `<Name` 또는 `<Name.`으로 사용되는가? 하나라도 미사용 시 CRASH! 특히 IconButton — import했으면 반드시 JSX에서 사용, 사용하지 않으면 import에서 제거!
19. **폼 영역 FormGrid**: 폼/필터 입력 영역에 수동 `grid-cols-12` + `col-span-N` 대신 `<FormGrid columns={N}>` + `<FormGridCell>`을 사용했는가?
20. **Dialog size="xl" 금지**: `<Dialog` 태그에 `size="xl"`이 있는가? → Dialog는 sm/md/lg만 허용. 대형 콘텐츠는 Drawer로 변경!
21. **HTML table 태그 검증**: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`, `<th>` 태그가 코드에 있는가? → DataGrid로 교체!
22. **엑셀 버튼 tertiary 확인**: "엑셀 다운로드" 버튼의 buttonType이 `"tertiary"`인가? → ghost/secondary 사용 시 tertiary로 교체!
23. **Radio Option 패턴 확인**: `<Radio`가 `<Option label="...">` 안에 감싸져 있는가? `<label><Radio/><span>` 수동 패턴은 없는가? onChange가 누락되지 않았는가?
24. **DS 컴포넌트 bg 오버라이드 확인**: Button, Badge 등 DS 컴포넌트에 `className="bg-[#...]"` 배경색 오버라이드가 있는가? → 제거하고 전용 prop 사용!
25. **날짜 형식 통일 확인**: `type="date"` Field의 value가 `YYYY-MM-DD` 형식인가? 다른 형식(YYYY/MM/DD 등) 사용 시 교체!

---

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

SYSTEM_PROMPT_FOOTER = """## 🎯 DESIGN CONSISTENCY CHECKLIST

- **Same element types = same styling**: All form fields → same spacing, all cards → same shadow
- **Page background**: ALWAYS `min-h-screen bg-[#f4f6f8] p-8`
- **White card**: ALWAYS `bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6`
- **Spacing**: Major sections `mb-6`~`mb-8`, form fields `mb-5`, related items `mb-3`~`mb-4`
- **Colors**: Use ONLY hex values from the color token table. NEVER invent hex codes.
- **Shadows**: `shadow-sm` only. Never `shadow`, `shadow-md`, `shadow-lg`.
- **Borders**: `border border-[#dee2e6]` only. Never other gray shades.
- **PROPS VALIDATION**: Button은 `buttonType=` 사용 (NOT `variant=`). IconButton은 `iconButtonType=` + `iconOnly=` + `aria-label=` 사용. Don't hallucinate props.
- **interaction PROP**: disabled/readOnly/loading → `interaction` prop 사용. ❌ `isDisabled`, `disabled`, `isReadOnly` 금지.
- **DISCRIMINATED UNION**: showLabel + label, showHelptext + helptext는 반드시 짝으로 사용.
- **DRAWER vs DIALOG**: "드로어" 요청 → `Drawer` 컴포넌트 사용 (Dialog 금지). "다이얼로그/모달/팝업" → `Dialog`.
- **TITLE BAR**: `<TitleSection>` 컴포넌트 사용 또는 직접 구성. 브레드크럼 + h1 제목 + 액션 버튼은 반드시 **한 줄**에 배치.
- **⛔ NO EXTERNAL ICONS**: `lucide-react`, `heroicons`, `react-icons` import 절대 금지 — 미설치, 앱 크래시. 내장 `<Icon name="..." size={N} />` 만 사용.
- **LAYOUT COMPONENTS**: 페이지 레이아웃 → `<GridLayout type="A~H">`, 세로 흐름 → `<RowPattern pattern="RP-1~8">` + `<RowSlot slot="...">`, 폼 → `<FormGrid columns={N}>` + `<FormGridCell>`. 수동 grid-cols-12 대신 사용 권장.

🚨 **FINAL STEP — import 정리**: 코드 완성 후, import 문을 다시 읽고 JSX에서 `<Name` 또는 `<Name.`으로 **실제 사용하지 않는 컴포넌트를 import에서 제거**하세요. 미사용 import 1개 = CRASH. 특히 IconButton — import했지만 JSX에서 `<IconButton`이 없으면 반드시 삭제!
🚨 **Select options 최종 확인**: 모든 `<Select`의 options 배열에 항목이 3개 이상인지 확인하세요. 2개 이하면 Radio로 변경하세요.
🚨 **Dialog/Drawer body gap 확인**: `<Dialog.Body>` 또는 `<Drawer.Body>` 내부에 `gap-5`, `gap-6`, `mb-5`, `mb-6`이 있으면 `gap-4`/`mb-4`로 교체하세요. 페이지 레벨 gap-6은 허용되지만 Dialog/Drawer 내부는 gap-4가 최대입니다.

Create a premium, completed result."""

UI_PATTERN_EXAMPLES = """
## 📐 UI PATTERN REFERENCE

### Form Page (폼 + 다양한 컴포넌트 조합 — FormGrid 사용)
```tsx
import { Button, Field, Select, Radio, Option, OptionGroup, TitleSection, GridLayout, FormGrid, FormGridCell, Icon } from '@/components';

const MemberDetail = () => {
  const [name, setName] = React.useState('김민준');
  const [email, setEmail] = React.useState('minjun@example.com');
  const [dept, setDept] = React.useState('개발팀');
  const [gender, setGender] = React.useState('male');

  return (
    <div className="min-h-screen bg-[#f4f6f8] p-8">
      <GridLayout type="A">
        <div>
          {/* TitleSection — 브레드크럼 + 제목 + 액션 */}
          <TitleSection title="회원 상세" menu2="회원관리" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base" />
          <div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6 mt-5">
            {/* Section: 기본 정보 — FormGrid 2열 */}
            <FormGrid columns={2} title="기본 정보">
              <FormGridCell>
                <Field type="text" showLabel={true} label="이름" value={name} onChange={(e) => setName(e.target.value)} showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
              </FormGridCell>
              <FormGridCell>
                <Field type="email" showLabel={true} label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
              </FormGridCell>
              <FormGridCell>
                <Select showLabel={true} label="부서" className="w-full" value={dept} onChange={(v) => setDept(v)} showHelptext={false} showStartIcon={false}
                  options={[{label:'개발팀',value:'개발팀'},{label:'디자인팀',value:'디자인팀'},{label:'마케팅팀',value:'마케팅팀'},{label:'경영지원',value:'경영지원'}]} />
              </FormGridCell>
              <FormGridCell>
                <OptionGroup label="성별" showLabel={true} orientation="horizontal" size="sm">
                  <Option label="남성"><Radio value={gender==='male' ? 'checked' : 'unchecked'} onChange={() => setGender('male')} /></Option>
                  <Option label="여성"><Radio value={gender==='female' ? 'checked' : 'unchecked'} onChange={() => setGender('female')} /></Option>
                </OptionGroup>
              </FormGridCell>
            </FormGrid>
            {/* Action buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <Button buttonType="ghost" label="취소" showStartIcon={false} showEndIcon={false} />
              <Button buttonType="primary" size="lg" label="저장" showStartIcon={false} showEndIcon={false} />
            </div>
          </div>
        </div>
      </GridLayout>
    </div>
  );
};
export default MemberDetail;
```

### Filter + Button + Grid Layout (조회 영역 = 하나의 Section Card)
🚨 **FilterBar 컴포넌트 또는 수동 Grid 레이아웃으로 필터 + Grid를 하나의 Section Card에 포함!**
```tsx
{/* ✅ FilterBar 컴포넌트 사용 */}
<div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6">
  <FilterBar mode="compact" onReset={() => handleReset()} onSearch={() => handleSearch()}>
    <div className="col-span-3">
      <Field type="date" showLabel={true} label="조회기간(시작)" value={startDate} onChange={(e) => setStartDate(e.target.value)} showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
    </div>
    <div className="col-span-3">
      <Field type="date" showLabel={true} label="조회기간(종료)" value={endDate} onChange={(e) => setEndDate(e.target.value)} showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
    </div>
    <div className="col-span-3">
      <Select showLabel={true} label="상태" placeholder="전체" value={status} onChange={(v) => setStatus(v)} showHelptext={false} showStartIcon={false}
        options={[{label:'전체',value:'all'},{label:'정상',value:'active'},{label:'해지',value:'inactive'}]} className="w-full" />
    </div>
    <div className="col-span-3">
      <Field type="text" showLabel={true} label="검색어" placeholder="이름 또는 코드" value={keyword} onChange={(e) => setKeyword(e.target.value)} showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
    </div>
  </FilterBar>
  {/* Grid — 같은 Section Card 안! 절대 별도 카드로 분리 금지 */}
  <div className="mt-5">
    <DataGrid rowData={rowData} columnDefs={columnDefs} domLayout="autoHeight" />
  </div>
</div>
```
- ⚠️ FilterBar 내부 필드는 `<div className="col-span-N">` 으로 감싸서 12컬럼 그리드 배치
- FilterBar의 onReset/onSearch로 초기화/조회 버튼 자동 생성
- 🚨 **Grid는 FilterBar와 같은 Section Card 안에 배치. 별도 카드 금지!**

### Title Bar (TitleSection 컴포넌트 사용)
```tsx
{/* TitleSection — 브레드크럼 + 제목 + 액션 버튼 자동 배치 */}
<TitleSection title="발령등록" menu2="인사관리" showBreadcrumb={true} showMenu2={true} showMenu3={false} showMenu4={false} mode="base">
  <div className="flex items-center gap-2">
    <Button buttonType="tertiary" size="md" label="엑셀 다운로드" showStartIcon={true} startIcon={<Icon name="external" size={18} />} showEndIcon={false} />
    <Button buttonType="primary" size="md" label="신규 등록" showStartIcon={true} startIcon={<Icon name="add" size={18} />} showEndIcon={false} />
  </div>
</TitleSection>
```
- ✅ TitleSection children에 액션 버튼 배치 → 우측 자동 정렬
- 액션 버튼이 없으면 children 생략

### DataGrid 선택 액션 바 (ActionBar 컴포넌트)
```tsx
{/* ActionBar — 체크된 항목이 있을 때 표시 */}
<ActionBar count={selectedRows.length} visible={selectedRows.length > 0} onClose={() => clearSelection()}>
  <Button buttonType="ghost-inverse" size="md" label="일괄 승인" showStartIcon={false} showEndIcon={false} />
  <Button buttonType="ghost-inverse" size="md" label="일괄 삭제" showStartIcon={false} showEndIcon={false} />
</ActionBar>
```
- ActionBar는 플로팅 바 (fixed position 기본)
- buttonType="ghost-inverse" 사용 (어두운 배경)

### 드로어(Drawer) 패턴 — "드로어" 요청 시 반드시 이 패턴 사용
🚨 **사용자가 "드로어"라고 하면 Dialog가 아닌 반드시 Drawer를 사용!**
```tsx
import { Button, Field, Select, Drawer } from '@/components';

{/* ✅ 드로어 = Drawer 컴포넌트. ❌ Dialog 절대 사용 금지 */}
<Drawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} size="md">
  <Drawer.Header title="조직원 등록" showSubtitle={false} />
  <Drawer.Body>
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field showLabel={true} label="성명" placeholder="이름 입력" showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
        <Field showLabel={true} label="사번" placeholder="자동 부여" interaction="disabled" showHelptext={false} showStartIcon={false} showEndIcon={false} className="w-full" />
      </div>
      <Select showLabel={true} label="소속 부서" placeholder="부서 선택" showHelptext={false} showStartIcon={false} options={[{label:'개발팀',value:'dev'},{label:'디자인팀',value:'design'}]} className="w-full" />
    </div>
  </Drawer.Body>
  <Drawer.Footer>
    <Button buttonType="ghost" label="취소" onClick={() => setIsDrawerOpen(false)} showStartIcon={false} showEndIcon={false} />
    <Button buttonType="primary" label="등록" showStartIcon={false} showEndIcon={false} />
  </Drawer.Footer>
</Drawer>
```
- ⚠️ "드로어" = `Drawer` | "다이얼로그/모달/팝업" = `Dialog`
- ❌ 드로어 요청에 Dialog 사용은 **컴포넌트 오용** — 반드시 Drawer 사용
"""


# ============================================================================
# Initialize Schema and Prompt
# ============================================================================

_schema, _error = load_component_schema()
COMPONENT_DOCS = format_component_docs(_schema) if _schema else (_error or "Schema not loaded")
AVAILABLE_COMPONENTS = get_available_components_note(_schema) if _schema else ""
SYSTEM_PROMPT = (
    SYSTEM_PROMPT_HEADER
    + LAYOUT_GUIDE
    + "\n## Available Components\n\n"
    + AVAILABLE_COMPONENTS
    + COMPONENT_DOCS
    + UI_PATTERN_EXAMPLES
    + PRE_GENERATION_CHECKLIST
    + RESPONSE_FORMAT_INSTRUCTIONS
    + SYSTEM_PROMPT_FOOTER
)


def get_system_prompt() -> str:
    """현재 시스템 프롬프트 반환 (로컬 스키마 기반, 현재 날짜/시간 포함)"""
    current_date = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")
    return SYSTEM_PROMPT.replace("{current_date}", current_date).replace(
        "{design_tokens_section}", DEFAULT_DESIGN_TOKENS_SECTION
    )


def format_layouts(layouts: list[dict]) -> str:
    """
    레이아웃 JSON 리스트를 프롬프트용 문자열로 포맷팅
    extractedComponents, styles 등 노이즈를 제거하고 layout 트리만 전달
    componentProps 내 Figma 내부 ID(# 포함 키)를 정리

    Args:
        layouts: Figma에서 추출한 레이아웃 JSON 리스트

    Returns:
        포맷팅된 레이아웃 섹션 문자열
    """
    if not layouts:
        return ""

    def _clean_component_props(props: dict) -> dict:
        """componentProps에서 Figma 내부 ID를 정리하고 유용한 값만 남김"""
        cleaned = {}
        for key, value in props.items():
            if "#" not in key:
                # Size, Type, Disabled 등 유용한 props → 그대로 유지
                cleaned[key] = value
            else:
                # Label#307:254 → "Label" 키로 값 보존 (버튼 텍스트 등)
                base_key = key.split("#")[0].strip()
                if base_key.lower() in ("label", "title", "text", "placeholder"):
                    cleaned[base_key] = value
                # icon, show 관련은 제거 (아이콘 사용 금지 규칙과 일치)
        return cleaned

    def _clean_node(node: dict) -> dict:
        """layout 트리 노드에서 불필요한 필드를 제거"""
        cleaned = {}
        for key, value in node.items():
            if key == "componentProps":
                props = _clean_component_props(value)
                if props:
                    cleaned["componentProps"] = props
            elif key == "children":
                cleaned["children"] = [_clean_node(child) for child in value]
            else:
                cleaned[key] = value
        return cleaned

    section = """

## Reference Layouts (Figma Extracted)

Below are reference layouts extracted from Figma. Use these as structural guides when generating similar pages.
- Follow the layout hierarchy (FRAME, INSTANCE, etc.)
- Respect the layoutMode (VERTICAL, HORIZONTAL)

**CRITICAL - Figma State to React Props Mapping:**
- Figma `Selected=True`, `State=Selected` in Select → React `defaultValue` (NOT `value` or `selected`)
- Figma placeholder text like "선택하세요", "전체 지역" in Select → React `placeholder` prop
- Figma `Checked=True` in Checkbox/Radio/ToggleSwitch → React `checked` with `onChange` handler
- Use similar spacing (itemSpacing, padding)
- Match the component structure

"""
    for i, layout in enumerate(layouts, 1):
        name = layout.get("layout", {}).get("name", f"Layout {i}")
        # layout 트리만 추출 + 노드 정리
        raw_layout = layout.get("layout", {})
        clean_layout = _clean_node(raw_layout)
        layout_json = json.dumps(
            {"layout": clean_layout}, ensure_ascii=False, separators=(",", ":")
        )
        section += f"### {name}\n```json\n{layout_json}\n```\n\n"

    return section


def generate_system_prompt(
    schema: dict,
    design_tokens: dict | None = None,
    ag_grid_schema: dict | None = None,
    ag_grid_tokens: dict | None = None,
    layouts: list[dict] | None = None,
    component_definitions: dict | None = None,
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

    # 컴포넌트 정의 섹션
    component_definitions_section = format_component_definitions(component_definitions)

    # 레이아웃 섹션
    layouts_section = format_layouts(layouts) if layouts else ""

    return (
        SYSTEM_PROMPT_HEADER.replace("{current_date}", current_date).replace(
            "{design_tokens_section}", design_tokens_section
        )
        + LAYOUT_GUIDE
        + "\n## Available Components\n\n"
        + available_components
        + component_docs
        + ag_grid_section
        + component_definitions_section
        + layouts_section
        + UI_PATTERN_EXAMPLES
        + PRE_GENERATION_CHECKLIST
        + RESPONSE_FORMAT_INSTRUCTIONS
        + SYSTEM_PROMPT_FOOTER
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
        + SYSTEM_PROMPT_FOOTER
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
