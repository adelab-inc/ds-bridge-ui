import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import verify_api_key
from app.services.firebase_storage import (
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
    """컴포넌트 스키마 JSON 로드"""
    schema_path = Path(__file__).parent.parent.parent / "component-schema.json"
    if not schema_path.exists():
        return None, "No component schema found."

    with open(schema_path, encoding="utf-8") as f:
        return json.load(f), None


# ============================================================================
# Schema → Prompt Formatting
# ============================================================================

# WHITELIST: Intersection of AI schema (component-schema.json) and UMD bundle exports
# Only these 17 components are both in schema AND available at runtime
# NOTE: Option/OptionGroup removed - Select uses `options` prop internally (no separate import needed)
AVAILABLE_COMPONENTS_WHITELIST = {
    # Basic
    "Button",
    "IconButton",
    "Link",
    # Display
    "Alert",
    "Badge",
    "Chip",
    "Dialog",
    "Divider",
    "Tag",
    "Tooltip",
    # Form
    "Checkbox",
    "Field",
    "Radio",
    "Select",  # Use options prop: options={[{label, value}]} - do NOT import Option/OptionGroup
    "ToggleSwitch",
    # Layout
    "Scrollbar",
    # Data (프리뷰 미지원 - UMD 빌드에서 stub 처리됨)
    "DataGrid",
}


def format_prop_type(prop_type: list | str) -> str:
    """
    prop 타입을 문자열로 포맷
    - list인 경우 enum 값들을 | 로 연결 (전체 표시)
    """
    if isinstance(prop_type, list):
        return " | ".join(f'"{v}"' for v in prop_type)
    return str(prop_type)


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

            # props 포맷팅 (children 제외)
            prop_lines = []
            for prop_name, prop_info in props.items():
                if prop_name == "children":
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

    # 주요 색상 추출 (자주 사용되는 것들)
    text_primary = colors.get("text-primary", "#212529")
    text_secondary = colors.get("text-secondary", "#495057")
    text_tertiary = colors.get("text-tertiary", "#6c757d")
    text_accent = colors.get("text-accent", "#0033a0")
    border_default = colors.get("border-default", "#dee2e6")
    bg_surface = colors.get("bg-surface", "#ffffff")
    bg_canvas = colors.get("bg-canvas", "#f4f6f8")
    bg_selection = colors.get("bg-selection", "#ecf0fa")

    # 전체 색상 토큰 JSON (사용자가 토큰 이름으로 요청 시 참조용)
    all_colors_json = json.dumps(colors, ensure_ascii=False, separators=(",", ":"))

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
  - **Page Title (h1)**: `className="text-2xl font-bold text-gray-800"` ({heading_xl[0]}, {heading_xl_weight})
  - **Section Title (h2)**: `className="text-xl font-semibold text-gray-800"` ({heading_lg[0]}, {heading_lg_weight})
  - **Subsection (h3)**: `className="text-lg font-medium text-gray-800"` ({heading_md[0]}, {heading_md_weight})
  - **Form Label**: `className="text-sm font-medium text-gray-800"` ({form_label_md[0]}, {form_label_weight})
  - **Body Text**: `className="text-base font-normal text-gray-800"` ({body_md[0]}, 400)
  - **Helper Text**: `className="text-sm font-normal text-gray-600"` ({helper_text[0]}, 400)
- **Colors (Tailwind Classes)**:
  - **Primary Text**: `text-gray-800` (`{text_primary}` - titles, labels, body)
  - **Secondary Text**: `text-gray-600` (`{text_secondary}` - helper text, descriptions)
  - **Tertiary Text**: `text-gray-500` (`{text_tertiary}` - placeholder, caption)
  - **Brand/Accent**: `text-[#0033a0]` (`{text_accent}` - links, selected state)
  - **Border Default**: `border-gray-300` (`{border_default}`)
  - **Background Surface**: `bg-white` (`{bg_surface}`)
  - **Background Canvas**: `bg-gray-50` (`{bg_canvas}`)
  - **Background Selection**: `bg-blue-50` (`{bg_selection}` - selected state only)
- **Visuals**:
  - **Shadows**: `shadow-sm`
  - **Borders**: `border border-gray-300`
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

## 📋 ALL COLOR TOKENS (REFERENCE)
When user requests a specific token (e.g., "hue-green-500"), look up the EXACT value below. NEVER guess hex values.

```json
{all_colors_json}
```

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
    lines.append("import { DataGrid, ButtonCellRenderer, CheckboxCellRenderer, ImageCellRenderer } from '@aplus/ui';")
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
        default = prop_info.get("default")
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
    lines.append("")
    lines.append("**⚠️ CRITICAL: cellRenderer CANNOT use inline JSX**")
    lines.append("- ❌ WRONG: `cellRenderer: (params) => <Badge>{params.value}</Badge>` (crashes - inline JSX not supported)")
    lines.append("- ❌ WRONG: `cellRenderer: (params) => <Radio checked={...}>Y</Radio>` (crashes - inline JSX not supported)")
    lines.append("- ✅ CORRECT: `cellRenderer: (params) => params.value === 'Y' ? 'Y' : 'N'` (return string/HTML)")
    lines.append("- ✅ CORRECT: `cellRenderer: ButtonCellRenderer` (use predefined cell renderer)")
    lines.append("")
    lines.append("**Available Predefined Cell Renderers:**")
    lines.append("- **ButtonCellRenderer**: `cellRenderer: ButtonCellRenderer, cellRendererParams: { onClick: (data) => ... }`")
    lines.append("- **CheckboxCellRenderer**: `cellRenderer: CheckboxCellRenderer, cellRendererParams: { onCheckboxChange: (data, checked) => ... }`")
    lines.append("- **ImageCellRenderer**: `cellRenderer: ImageCellRenderer` (renders 30x30 image from field value)")
    lines.append("")
    lines.append("**For Badge/Radio/Complex UI in cells:**")
    lines.append("- Use HTML table (`<table>`) instead of DataGrid")
    lines.append("- Or return HTML string: `cellRenderer: (p) => '<span class=\"text-green-600\">Y</span>'`")
    lines.append("- Or use simple text: `cellRenderer: (p) => p.value === 'Y' ? '사용' : '미사용'`")
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
    lines.append("### Usage Example")
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
    lines.append("const rowData = [")
    lines.append("  { name: '김민수', email: 'kim@example.com', salary: 5000000, status: '활성' },")
    lines.append("  { name: '이지은', email: 'lee@example.com', salary: 4500000, status: '비활성' },")
    lines.append("];")
    lines.append("")
    lines.append("<DataGrid")
    lines.append("  rowData={rowData}")
    lines.append("  columnDefs={columnDefs}")
    lines.append("  height={400}")
    lines.append("  pagination")
    lines.append("  paginationPageSize={10}")
    lines.append("/>")
    lines.append("```")
    lines.append("")

    # 금지 사항
    lines.append("### ⚠️ DO NOT")
    lines.append("- ❌ `import { AgGridReact } from 'ag-grid-react'` — Use `DataGrid` from `@aplus/ui`")
    lines.append("- ❌ `import { dsRuntimeTheme } from '@/themes/agGridTheme'` — Does NOT exist")
    lines.append("- ❌ `<div style={{ height: 500 }}><DataGrid ... /></div>` — Use `height` prop instead")
    lines.append("- ❌ `style={{ '--ag-header-background-color': 'red' }}` — Do NOT override theme tokens")
    lines.append("- ❌ `cellRenderer: (params) => <Badge>...</Badge>` — NO inline JSX in cellRenderer")
    lines.append("- ❌ `cellRenderer: (params) => <div><Radio>Y</Radio></div>` — NO inline JSX in cellRenderer")
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
    tokens_json = json.dumps(grid_tokens, ensure_ascii=False, separators=(",", ":"))

    return f"""### AG Grid Styling Tokens

When user requests a specific AG Grid token, look up the EXACT value below.

```json
{tokens_json}
```

"""


def format_component_definitions(definitions: dict | None) -> str:
    """
    컴포넌트 정의(Tailwind CSS variants)를 시스템 프롬프트용 문자열로 포맷팅

    Args:
        definitions: 컴포넌트 정의 dict (Firebase에서 로드) 또는 None

    Returns:
        포맷팅된 컴포넌트 정의 문자열
    """
    if not definitions:
        return ""

    definitions_json = json.dumps(definitions, ensure_ascii=False, separators=(",", ":"))

    return f"""## 🧩 Component Definitions (CSS Variant Structure)
Below are the Tailwind CSS variant definitions for each component. Use these to understand component structure, available variants, and their visual styles.

```json
{definitions_json}
```

"""


# 디자인 토큰을 로드하지 못했을 때 사용할 기본값
DEFAULT_DESIGN_TOKENS_SECTION = """## 🎨 DESIGN STANDARDS (CRITICAL - USE TAILWIND CLASSES)
- **Typography (MUST FOLLOW EXACT TOKENS)**:
  - Font Family: `font-['Pretendard',sans-serif]` (applied globally)
  - **Page Title (h1)**: `className="text-2xl font-bold text-gray-800"` (28px, 700)
  - **Section Title (h2)**: `className="text-xl font-semibold text-gray-800"` (24px, 700)
  - **Subsection (h3)**: `className="text-lg font-medium text-gray-800"` (18px, 600)
  - **Form Label**: `className="text-sm font-medium text-gray-800"` (14px, 500)
  - **Body Text**: `className="text-base font-normal text-gray-800"` (16px, 400)
  - **Helper Text**: `className="text-sm font-normal text-gray-600"` (14px, 400)
- **Colors (Tailwind Classes)**:
  - **Primary Text**: `text-gray-800` (`#212529` - titles, labels, body)
  - **Secondary Text**: `text-gray-600` (`#495057` - helper text, descriptions)
  - **Tertiary Text**: `text-gray-500` (`#6c757d` - placeholder, caption)
  - **Brand/Accent**: `text-[#0033a0]` (links, selected state)
  - **Border Default**: `border-gray-300` (`#dee2e6`)
  - **Background Surface**: `bg-white` (`#ffffff`)
  - **Background Canvas**: `bg-gray-50` (`#f4f6f8`)
  - **Background Selection**: `bg-blue-50` (`#ecf0fa` - selected state only)
- **Visuals**:
  - **Shadows**: `shadow-sm`
  - **Borders**: `border border-gray-300`
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

## ⚠️ CRITICAL: PRESERVE PREVIOUS CODE (HIGHEST PRIORITY)
When updating existing code, you MUST:
1. **KEEP ALL existing features** - filters, buttons, state, handlers. DO NOT remove anything.
2. **KEEP ALL existing text/labels** - Do not change button text, titles, or messages unless explicitly asked.
3. **ADD new features ON TOP of existing code** - Never start from scratch.
4. If unsure, include MORE code rather than less. Missing features = FAILURE.

## 🔧 INSTANCE EDIT MODE (수정 요청 시)
**When user asks to modify/update specific elements (e.g., "버튼 색상 바꿔줘", "이메일 필드 크기 키워줘"):**

1. **FIND THE TARGET**:
   - User mentions specific element → Find by `data-instance-id` or context
   - Example: "submit-btn" → Find `<Button data-instance-id="submit-btn">`
   - If ambiguous, ask user which element they mean

2. **MODIFY ONLY THE TARGET**:
   - Change ONLY the specified property (variant, className, label, etc.)
   - ✅ User: "primary 버튼으로 바꿔" → Change `variant="secondary"` to `variant="primary"`
   - ❌ DO NOT change unrelated props or nearby code

3. **VERIFY THE CHANGE**:
   - After modifying, explain EXACTLY what changed:
     - "submit-btn의 variant를 secondary → primary로 변경했습니다"
   - Include before/after if helpful

4. **PRESERVE EVERYTHING ELSE**:
   - DO NOT reformat code, change spacing, or "improve" other parts
   - DO NOT change other components, state, or handlers
   - ONLY touch the specific element user asked to modify

**Common mistakes to avoid**:
- ❌ User asks to change Button → You regenerate entire page
- ❌ User asks to change color → You also change size, spacing, text
- ❌ User asks to modify one field → You modify all fields
- ✅ Surgical precision: Change ONLY what user asked, nothing else

## 🔥 FATAL RULES (VIOLATION = APP CRASH)

### ⛔ Field Component (React Error #137)
- Field renders `<input>` internally. **ALWAYS self-closing `<Field ... />`**
- ❌ `<Field>text</Field>`, `<Field><input /></Field>`, `<Field>{x}</Field>` → ALL CRASH
- ✅ `<Field type="text" label="이름" />`, `<Field value={v} onChange={fn} />`

### ⛔ Radio/Checkbox (React Error #137)
- Radio/Checkbox pass `{...props}` to internal `<input>`. **Children get spread to `<input>` → CRASH**
- ❌ `<Radio>Y</Radio>`, `<Checkbox>동의</Checkbox>` → CRASH
- ✅ Wrap with `<label>`:
```tsx
<label className="inline-flex items-center gap-2 cursor-pointer">
  <Radio checked={status === 'Y'} onChange={() => setStatus('Y')} />
  <span className="text-sm text-gray-800">Y</span>
</label>
```

### ⛔ Component Whitelist
- ONLY use: Button, Field, Select, Badge, Checkbox, Radio, Dialog, Tag, Chip, Tooltip, Divider, ToggleSwitch, DataGrid, etc.
- ❌ `<Member />`, `<Card />`, `<Input />`, `<DatePicker />` → don't exist. Use `<div>` + Tailwind or `<Field type="date" />`

### ⛔ Import Rules
- ONLY import components you render in JSX. ❌ types, unused components

{design_tokens_section}## 💎 PREMIUM VISUAL STANDARDS
- **Containerization (NO FLOATING TEXT)**:
  - ALL content must be inside a white card: `<div className="bg-white rounded-xl border border-gray-300 shadow-sm p-6">`
  - NEVER place naked text or buttons directly on the gray background.
  - Exception: Page Titles (`h1`) can be outside.
- **Filter + Table Layout (IMPORTANT)**:
  - Filter bar and Table MUST be visually grouped together.
  - Structure: Filters above, then table below with proper spacing (`mb-6`).
  - DO NOT separate filters and table into different cards.
- **Status Styling (USE COMPONENT PROPS - NO CUSTOM COLORS)**:
  - Use `Badge` with `type="status"` for status display. NEVER use plain text.
  - Use `statusVariant` prop: `success`, `info`, `warning`, `error`
  - **NEVER use custom hex colors for status** - the component handles colors internally:
    - ❌ `className="bg-emerald-500"` (WRONG - custom color)
    - ❌ `className="text-green-500"` (WRONG - custom color)
    - ✅ `<Badge type="status" statusVariant="success">` (CORRECT - uses design system colors)
  - Status mapping:
    - Active/정상/완료: `statusVariant="success"`
    - Inactive/대기/진행중: `statusVariant="info"`
    - Warning/심사중/주의: `statusVariant="warning"`
    - Error/해지/실패: `statusVariant="error"`
  - Example: `<Badge type="status" statusVariant="success">정상</Badge>`
- **Empty States**:
  - Center the message with Tailwind: `className="text-center p-12 text-gray-500"`
  - Example: `<div className="text-center p-12 text-gray-500">데이터가 없습니다.</div>`
- **Responsive Layouts (1920x1080 기준)**:
  - **Target Resolution**: 1920x1080 (Full HD). Design for this viewport.
  - **Container**: `className="w-full max-w-[1920px] mx-auto"`.
  - **Page Padding**: `className="p-8"` (32px 양쪽 여백 포함).
  - **Flex**: Use `flex-1` for fluid columns instead of fixed widths.
  - **Mobile-Friendly**: Ensure `flex-wrap` on all horizontal lists.
- **Layout Safety (NO COLLISION)**:
  - **Grid Children**: Direct children of grid MUST have `className="w-full min-w-0"` to prevent blowout.
  - **Select Width Override**: The `Select` component has a fixed `240px` width by default. You **MUST** override this:
    - ✅ `<Select className="w-full" ... />` (Allows shrinking/growing)
    - ❌ `<Select ... />` (Causes overflow/overlap)
  - **Select Default Values**:
    - **Placeholder State**: Do NOT set value or defaultValue when showing placeholder text:
      - ✅ `<Select placeholder="선택하세요" options={...} />`
      - ❌ `<Select defaultValue="선택하세요" options={...} />`
    - **Default Selection**: Use option's `value` (NOT `label`) for `defaultValue`:
      - ✅ `<Select defaultValue="all" options={[{ label: '전체', value: 'all' }, ...]} />`
      - ❌ `<Select defaultValue="전체" options={...} />` (using label - WRONG)
  - **Radio/Checkbox/ToggleSwitch**: See FATAL RULES above. Use `<label>` wrapper, `checked` + `onChange`, NO children.
  - **Inputs**: internal inputs MUST be `className="w-full"`. NEVER use fixed pixels like `w-[300px]` inside a grid.
  - **Z-Index**: Dropdowns/Modals must have `z-50` or higher to float above content.

- **Content & Mock Data (MANDATORY)**:
  - **NO EMPTY STATES**: NEVER generate empty tables, lists, or selects.
  - **Rich Volume**: Always provide **at least 10 items** for lists/tables to show scrolling behavior.
  - **Diverse Data**: Use meaningful, varied data. Do NOT repeat "Item 1, Item 2". Use specific names, diverse dates, and unique statuses.
  - **Realistic Korean Data**: Use real-world examples (names: 김민준, 이서연 / companies: 토스, 당근, 쿠팡).
  - **Rich Detail**: Fill all fields. Don't use "Test 1", "Item 1". Use "프로젝트 알파", "1분기 실적 보고서".
  - **Context-Aware**: If the user asks for a "Project Dashboard", generate "Project A - In Progress", "Team Meeting - 10:00 AM".
  - **Select Options**: ALWAYS populate Select options with **at least 4-6 realistic choices** based on field context:
    - ❌ `options={[{ label: '전체', value: 'all' }]}` (only 1 option)
    - ✅ 상태 필터 → `전체, 정상, 심사중, 해지, 미납` / 지역 필터 → `전체, 서울, 경기, 인천, 부산, 대구`
  - **Filter Select Pattern**: ALL filter dropdowns MUST use `placeholder="전체"` + include "전체" as first option:
    - ✅ `<Select placeholder="전체" options={[{ label: '전체', value: 'all' }, { label: '완료', value: 'completed' }, ...]} />`
    - ❌ `<Select defaultValue="all" options={[...]} />` (shows as selected, not placeholder)
  - **Filter-Table Consistency**: Filter options MUST match table data. If table has "삼성생명, 한화손보" in 보험사 column, filter must include these options.
- **Profile Images (INITIAL AVATAR - NO EMOJI)**:
  - NEVER use emoji (👤, 🧑, 👨) for profile images.
  - Use **Initial Avatar**: Colored circle with first character. Pick color by `name.charCodeAt(0) % 8` from palette: `['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6']`
  - Example: `<div className="w-10 h-10 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-semibold text-sm">{name.charAt(0)}</div>`
- **Images (NO BROKEN IMAGES)**:
  - **NEVER use `<img>` tag with placeholder URLs** - these will show as broken images (X-box):
    - ❌ `<img src="/placeholder.png" />` (file doesn't exist)
    - ❌ `<img src="https://via.placeholder.com/..." />` (external placeholder service)
    - ❌ `<img src="/images/product.jpg" />` (assumed path that doesn't exist)
  - **For thumbnails/product images**: Use a colored placeholder div with an icon or text:
    ```tsx
    <div className="w-20 h-20 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center text-xs">
      이미지
    </div>
    ```
  - **For icons**: Use text symbols or the design system's icon component (if available), NOT image files.
  - **Exception**: Only use `<img>` if the user explicitly provides a real image URL.
- **Void Elements**: `<input>`, `<br>`, `<hr>`, `<img>` MUST be self-closing. NEVER use native `<input>` — use `<Field />`, `<Radio />`, `<Checkbox />`.
- **Non-existent Components**: `DatePicker` → `<Field type="date" />` | `Input` → `<Field />` | `TextArea` → `<Field multiline />`
- **Spacing**:
  - **섹션 간**: `mb-8` (32px)
  - **폼 행 간**: `mb-6` (24px)
- **Responsive Grid System**:
  - **12-Column Grid (for flexible layouts)**:
    - Use `grid-cols-12` as base, then span columns with `col-span-N`
    - **4 items**: `col-span-3` each (3 × 4 = 12) → `<div className="grid grid-cols-12 gap-4"><div className="col-span-3">...</div></div>`
    - **3 items**: `col-span-4` each (4 × 3 = 12)
    - **2 items**: `col-span-6` each (6 × 2 = 12)
    - **Mixed layout**: Combine different spans (e.g., `col-span-8` + `col-span-4` for main + sidebar)
  - **Grid Layout Ratios (CUSTOM PROPORTIONS)**:
    - When user requests ratio layouts (e.g., "3/6/3", "2/8/2", "1/10/1"), convert to col-span
    - **Examples**:
      - "3/6/3 비율로 나눠줘" → `<div className="grid grid-cols-12 gap-4"><div className="col-span-3">...</div><div className="col-span-6">...</div><div className="col-span-3">...</div></div>`
      - "2/8/2 비율" → `col-span-2` + `col-span-8` + `col-span-2` = 12
      - "4/4/4 비율" → `col-span-4` each = 12
      - "1/10/1 비율" → `col-span-1` + `col-span-10` + `col-span-1` = 12
      - "3/9 비율" → `col-span-3` + `col-span-9` = 12
    - **Rule**: Sum of all col-span values MUST equal 12
    - **Validation**: Always check that ratio numbers add up to 12 (e.g., 2+8+2=12 ✅, 3+5+3=11 ❌)
  - **Simple Grid (for equal divisions)**:
    - **4 items**: `grid-cols-4` | **3 items**: `grid-cols-3` | **2 items**: `grid-cols-2`
    - Use this when all items have equal width (simpler than 12-column)
  - **Form Grid (for responsive filters)**: Use `className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"`. Ensures alignment and prevents stretching.
  - **Alignment**: Use `items-end` to align buttons with inputs.
  - **Grid Span Values**: `col-span-X` must use INTEGER values only (✅ `col-span-2` | ❌ `col-span-1.5`)

## 🎯 UI GENERATION PRINCIPLE

**Generate UI that EXACTLY matches the user's request.** Do NOT default to dashboard/table layouts.

- User asks for "로그인 페이지" → Generate a login form (centered, inputs, button)
- User asks for "상품 목록" → Generate product cards or list
- User asks for "설정 페이지" → Generate settings form with sections
- User asks for "프로필 페이지" → Generate profile view with user info
- User asks for "대시보드" → ONLY THEN generate dashboard with tables/charts

**Analyze the user's request carefully and choose the appropriate UI pattern:**
- **Forms**: Login, signup, settings, profile edit, data entry
- **Cards**: Products, articles, team members, projects
- **Lists**: Simple item lists, menus, navigation
- **Tables**: Data management, admin panels, reports (ONLY when listing/managing multiple records)
- **Detail views**: Single item display, profile, article detail

## 🔨 IMPLEMENTATION RULES
1. **MATCH USER INTENT**: Generate the UI type that fits the user's request. Do NOT always default to tables/dashboards.
2. **RICH MOCK DATA**: Generate realistic Korean mock data appropriate to the context.
3. **ZERO OMISSION**: If the user asks for 5 fields, implement ALL 5. Missing features = FAILURE.
4. **IMPORT**: `import { Button } from '@/components'` / React hooks: `React.useState`.
5. **STYLING**: Tailwind CSS utility classes (`className="..."`), Desktop-first. Use `style={{}}` ONLY for dynamic JS variable values.
6. **ICONS (DO NOT USE)**:
   - **NEVER use emoji as icons** (🔍, ⭐, 📁, 👤, etc.) - looks unprofessional
   - **NEVER use icon libraries** (`material-icons`, `lucide-react`) - not available in this design system
   - **NEVER use IconButton component** - no icon assets available
   - **NEVER use icon props** (`leftIcon`, `rightIcon`, `icon` on Button/Alert/Chip) - leave them empty
   - **Use text-only buttons**: `<Button>검색</Button>`, `<Button>추가</Button>`, `<Button>삭제</Button>`

## 📊 Data Tables
Use native HTML `<table>` with Tailwind classes:
- Table: `<table className="w-full border-collapse text-sm">`
- Header (th): `<th className="px-4 py-3 bg-gray-50 font-semibold border-b-2 border-gray-300 text-left">`
- Cells (td): `<td className="px-4 py-3 border-b border-gray-300">`
- Use `Badge` for status columns
- Always generate 10+ rows of mock data

## Available Components

"""

# ============================================================================
# PRE-GENERATION CHECKLIST (최종 경고)
# ============================================================================

PRE_GENERATION_CHECKLIST = """

---

## ⚠️ FINAL CHECKLIST (before writing code)
- [ ] Every `<Field` ends with `/>` (NO closing tag, NO children)
- [ ] Radio/Checkbox: NO children, use `<label>` wrapper with `<span>` for text
- [ ] All components are from the whitelist (unknown → use `<div>` + Tailwind)
- [ ] Only import components rendered in JSX (NO type imports)
- [ ] Radio/Checkbox have both `checked={condition}` and `onChange={handler}`

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-[420px] bg-white rounded-xl border border-gray-300 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">로그인</h1>
        {/* ⛔ CRITICAL: Field는 self-closing만 가능. <Field>children</Field> 금지 */}
        <div className="mb-5">
          <Field data-instance-id="email-field" type="email" label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        </div>
        <div className="mb-6">
          <Field data-instance-id="password-field" type="password" label="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" />
        </div>
        <Button data-instance-id="login-btn" variant="primary" className="w-full">로그인</Button>
      </div>
    </div>
  );
};

export default Login;
</file>
"""

SYSTEM_PROMPT_FOOTER = """
## 🚨 OUTPUT QUALITY RULES

### 1. FILE COMPLETENESS
- NEVER truncate code (no `// ...` or `// rest of code`). All buttons need `onClick`, all inputs need `value` + `onChange`.
- **PROPS VALIDATION**: Use exact enum values (`variant="primary"` NOT `variant="blue"`).
- **INSTANCE IDs**: All design system components MUST have `data-instance-id`.
- **IMPORT CHECK**: Verify all used components are imported.

### 2. DESIGN SYSTEM CONSISTENCY (CONTEXT-AWARE SPACING)

- **Page Background**: `className="min-h-screen bg-gray-50 p-6"`
- **White Card**: `className="bg-white rounded-xl border border-gray-300 shadow-sm p-6"`
- **Spacing**: sections `mb-6`, form fields `mb-5`, related items `mb-3`~`mb-4`, filters `gap-3`~`gap-4`, cards `gap-4`~`gap-6`
- **Colors**: Only `bg-gray-50`, `bg-white`, `text-gray-800`, `border-gray-300` etc. No arbitrary hex.
- **Typography**: Page title `text-2xl font-bold`, Section `text-lg font-semibold`, Body `text-sm`
- **Shadows**: `shadow-sm` only. **Borders**: `border border-gray-300` only.
- **Consistency**: Same element types = same spacing/styling on a page.

Create a premium, completed result."""


# ============================================================================
# Initialize Schema and Prompt
# ============================================================================

_schema, _error = load_component_schema()
COMPONENT_DOCS = format_component_docs(_schema) if _schema else (_error or "Schema not loaded")
AVAILABLE_COMPONENTS = get_available_components_note(_schema) if _schema else ""
SYSTEM_PROMPT = (
    SYSTEM_PROMPT_HEADER
    + AVAILABLE_COMPONENTS
    + COMPONENT_DOCS
    + PRE_GENERATION_CHECKLIST  # Final warning before code generation
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

    Args:
        layouts: Figma에서 추출한 레이아웃 JSON 리스트

    Returns:
        포맷팅된 레이아웃 섹션 문자열
    """
    if not layouts:
        return ""

    import json

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
        # JSON을 compact하게 변환 (indent 없이)
        layout_json = json.dumps(layout, ensure_ascii=False, separators=(",", ":"))
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
        + available_components
        + component_docs
        + ag_grid_section
        + component_definitions_section
        + layouts_section
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
- Add data-instance-id to every component

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


