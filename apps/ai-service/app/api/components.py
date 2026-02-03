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
# Only these 19 components are both in schema AND available at runtime
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
    "Option",
    "OptionGroup",
    "Radio",
    "Select",
    "ToggleSwitch",
    # Layout
    "Scrollbar",
    "Heading",
    # Data (프리뷰 미지원 - UMD 빌드에서 stub 처리됨)
    "DataGrid",
}


def format_prop_type(prop_type: list | str, max_values: int = 5) -> str:
    """
    prop 타입을 문자열로 포맷
    - list인 경우 enum 값들을 | 로 연결
    - 값이 많으면 축약
    """
    if isinstance(prop_type, list):
        if len(prop_type) > max_values:
            values = " | ".join(f'"{v}"' for v in prop_type[: max_values - 1])
            return f"{values} | ... ({len(prop_type)} options)"
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

    # 주요 색상 추출
    text_primary = colors.get("text-primary", "#212529")
    text_secondary = colors.get("text-secondary", "#495057")
    text_tertiary = colors.get("text-tertiary", "#6c757d")
    text_accent = colors.get("text-accent", "#0033a0")
    border_default = colors.get("border-default", "#dee2e6")
    bg_surface = colors.get("bg-surface", "#ffffff")
    bg_canvas = colors.get("bg-canvas", "#f4f6f8")
    bg_selection = colors.get("bg-selection", "#ecf0fa")

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

    return f"""## 🎨 DESIGN STANDARDS (CRITICAL - USE EXACT VALUES)
- **Typography (MUST FOLLOW EXACT TOKENS)**:
  - Font Family: `'Pretendard', sans-serif`
  - **Page Title (h1)**: `fontSize: {heading_xl[0].replace('px', '')}`, `fontWeight: {heading_xl_weight}`, `color: '{text_primary}'`
  - **Section Title (h2)**: `fontSize: {heading_lg[0].replace('px', '')}`, `fontWeight: {heading_lg_weight}`, `color: '{text_primary}'`
  - **Subsection (h3)**: `fontSize: {heading_md[0].replace('px', '')}`, `fontWeight: {heading_md_weight}`, `color: '{text_primary}'`
  - **Form Label**: `fontSize: {form_label_md[0].replace('px', '')}`, `fontWeight: {form_label_weight}`, `color: '{text_primary}'`
  - **Body Text**: `fontSize: {body_md[0].replace('px', '')}`, `fontWeight: 400`, `color: '{text_primary}'`
  - **Helper Text**: `fontSize: {helper_text[0].replace('px', '')}`, `fontWeight: 400`, `color: '{text_secondary}'`
- **Colors (EXACT HEX - DO NOT CHANGE)**:
  - **Primary Text**: `{text_primary}` (titles, labels, body)
  - **Secondary Text**: `{text_secondary}` (helper text, descriptions)
  - **Tertiary Text**: `{text_tertiary}` (placeholder, caption)
  - **Brand/Accent**: `{text_accent}` (links, selected state)
  - **Border Default**: `{border_default}`
  - **Background Surface**: `{bg_surface}`
  - **Background Canvas**: `{bg_canvas}`
  - **Background Selection**: `{bg_selection}` (selected state only)
- **Visuals**:
  - **Shadows**: `boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)'`
  - **Borders**: `border: '1px solid {border_default}'`
  - **Radius**: `borderRadius: 8px` (inputs, buttons), `12px` (cards)

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
    comp_name = schema.get("componentName") or schema.get("displayName", "DataGrid")
    description = schema.get("description", "")
    props = schema.get("props", {})
    required_imports = schema.get("requiredImports", [])
    theme_config = schema.get("themeConfig", {})

    if not props:
        return ""

    lines = ["## 📊 AG Grid Component (DataGrid)"]
    lines.append("")
    lines.append(f"**{comp_name}** - {description}" if description else f"**{comp_name}**")
    lines.append("")

    # Import 가이드
    if required_imports:
        lines.append("### Required Imports")
        lines.append("```tsx")
        for imp in required_imports:
            imp_name = imp.get("name", "")
            imp_from = imp.get("from", "")
            is_type = imp.get("isTypeOnly", False)
            if is_type:
                lines.append(f"import type {{ {imp_name} }} from '{imp_from}';")
            else:
                lines.append(f"import {{ {imp_name} }} from '{imp_from}';")
        lines.append("```")
        lines.append("")

    # 테마 설정
    if theme_config:
        lines.append("### Theme Configuration")
        lines.append(f"- Always use `theme={{dsRuntimeTheme}}` prop")
        lines.append(f"- Import theme from `{theme_config.get('themeFile', '@/themes/agGridTheme')}`")
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

    # 사용 예시
    lines.append("### Usage Example")
    lines.append("```tsx")
    lines.append("import { AgGridReact } from 'ag-grid-react';")
    lines.append("import { dsRuntimeTheme } from '@/themes/agGridTheme';")
    lines.append("import type { ColDef } from 'ag-grid-community';")
    lines.append("")
    lines.append("const columnDefs: ColDef[] = [")
    lines.append("  { field: 'name', headerName: '이름', flex: 1 },")
    lines.append("  { field: 'email', headerName: '이메일', flex: 2 },")
    lines.append("  { field: 'status', headerName: '상태', width: 100 },")
    lines.append("];")
    lines.append("")
    lines.append("const rowData = [")
    lines.append("  { name: '김민수', email: 'kim@example.com', status: '활성' },")
    lines.append("  { name: '이지은', email: 'lee@example.com', status: '비활성' },")
    lines.append("];")
    lines.append("")
    lines.append("<div style={{ height: 400 }}>")
    lines.append("  <AgGridReact")
    lines.append("    theme={dsRuntimeTheme}")
    lines.append("    rowData={rowData}")
    lines.append("    columnDefs={columnDefs}")
    lines.append("    pagination={true}")
    lines.append("    paginationPageSize={10}")
    lines.append("  />")
    lines.append("</div>")
    lines.append("```")
    lines.append("")

    return "\n".join(lines)


def format_ag_grid_tokens(tokens: dict | None) -> str:
    """
    AG Grid 토큰을 시스템 프롬프트용 문자열로 포맷팅

    Args:
        tokens: AG Grid 토큰 dict 또는 None
                구조: { "agGrid": { "colors": { "accent": { "value": "#xxx" }, ... } } }

    Returns:
        포맷팅된 AG Grid 토큰 문자열
    """
    if not tokens:
        return ""

    # agGrid 키 아래에 토큰이 있음
    grid_tokens = tokens.get("agGrid", tokens)
    if not grid_tokens:
        return ""

    lines = ["### AG Grid Styling Tokens"]
    lines.append("")

    def extract_value(token_data):
        """토큰 데이터에서 값 추출 (nested 구조 처리)"""
        if isinstance(token_data, dict):
            if "value" in token_data:
                return token_data["value"]
            # nested 객체는 첫 번째 레벨만 처리
            return {k: v.get("value", v) if isinstance(v, dict) else v for k, v in token_data.items()}
        return token_data

    # 색상 토큰
    colors = grid_tokens.get("colors", {})
    if colors:
        lines.append("**Colors:**")
        for key, value in list(colors.items())[:8]:
            extracted = extract_value(value)
            if isinstance(extracted, str):
                lines.append(f"  - {key}: `{extracted}`")
            elif isinstance(extracted, dict):
                # nested (e.g., background.chrome)
                for sub_key, sub_val in list(extracted.items())[:3]:
                    lines.append(f"  - {key}.{sub_key}: `{sub_val}`")
        lines.append("")

    # 간격/크기 토큰
    spacing = grid_tokens.get("spacing", {})
    if spacing:
        lines.append("**Spacing:**")
        for key, value in list(spacing.items())[:6]:
            extracted = extract_value(value)
            lines.append(f"  - {key}: `{extracted}`")
        lines.append("")

    # 폰트 토큰
    font = grid_tokens.get("font", {})
    if font:
        lines.append("**Font:**")
        for key, value in list(font.items())[:6]:
            extracted = extract_value(value)
            lines.append(f"  - {key}: `{extracted}`")
        lines.append("")

    return "\n".join(lines) if len(lines) > 2 else ""


# 디자인 토큰을 로드하지 못했을 때 사용할 기본값
DEFAULT_DESIGN_TOKENS_SECTION = """## 🎨 DESIGN STANDARDS (CRITICAL - USE EXACT VALUES)
- **Typography (MUST FOLLOW EXACT TOKENS)**:
  - Font Family: `'Pretendard', sans-serif`
  - **Page Title (h1)**: `fontSize: 28`, `fontWeight: 700`, `color: '#212529'`
  - **Section Title (h2)**: `fontSize: 24`, `fontWeight: 700`, `color: '#212529'`
  - **Subsection (h3)**: `fontSize: 18`, `fontWeight: 600`, `color: '#212529'`
  - **Form Label**: `fontSize: 14`, `fontWeight: 500`, `color: '#212529'`
  - **Body Text**: `fontSize: 16`, `fontWeight: 400`, `color: '#212529'`
  - **Helper Text**: `fontSize: 14`, `fontWeight: 400`, `color: '#495057'`
- **Colors (EXACT HEX - DO NOT CHANGE)**:
  - **Primary Text**: `#212529` (titles, labels, body)
  - **Secondary Text**: `#495057` (helper text, descriptions)
  - **Tertiary Text**: `#6c757d` (placeholder, caption)
  - **Brand/Accent**: `#0033a0` (links, selected state)
  - **Border Default**: `#dee2e6`
  - **Background Surface**: `#ffffff`
  - **Background Canvas**: `#f4f6f8`
  - **Background Selection**: `#ecf0fa` (selected state only)
- **Visuals**:
  - **Shadows**: `boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)'`
  - **Borders**: `border: '1px solid #dee2e6'`
  - **Radius**: `borderRadius: 8px` (inputs, buttons), `12px` (cards)

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

{design_tokens_section}## 💎 PREMIUM VISUAL STANDARDS
- **Containerization (NO FLOATING TEXT)**:
  - ALL content must be inside a white card: `<div style={{backgroundColor:'#ffffff', borderRadius:12, border:'1px solid #dee2e6', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', padding:24}}>`
  - NEVER place naked text or buttons directly on the gray background.
  - Exception: Page Titles (`h1`) can be outside.
- **Filter + Table Layout (IMPORTANT)**:
  - Filter bar and Table MUST be visually grouped together.
  - Structure: Filters above, then table below with proper spacing (`marginBottom: 24`).
  - DO NOT separate filters and table into different cards.
- **Status Styling**:
  - Use `Badge` for status. NEVER use plain text.
  - Active: `variant="success"`, Inactive: `variant="neutral"`, Error: `variant="destructive"`.
- **Empty States**:
  - Center the message: `textAlign: 'center'`, `padding: 48`, `color: '#6b7280'`
  - Example: `<div style={{textAlign:'center', padding:48, color:'#6b7280'}}>데이터가 없습니다.</div>`
- **Responsive Layouts (NO FIXED WIDTHS)**:
  - **Container**: `width: '100%'`, `maxWidth: '100%'` (Allow grow).
  - **Inner Width**: Use `maxWidth: 1200px` for large screens, but `width: '100%'` always.
  - **Flex**: Use `flex: 1` for fluid columns instead of `width: 200px`.
  - **Mobile-Friendly**: Ensure `flexWrap: 'wrap'` on all horizontal lists.
- **Layout Safety (NO COLLISION)**:
  - **Grid Children**: Direct children of grid MUST have `width: '100%'` and `minWidth: 0` to prevent blowout.
  - **Override Defaults**: The `Select` component has a fixed `240px` width by default. You **MUST** override this:
    - ✅ `<Select style={{ width: '100%' }} ... />` (Allows shrinking/growing)
    - ❌ `<Select ... />` (Causes overflow/overlap)
  - **Inputs**: internal inputs MUST be `width: '100%'`. NEVER use fixed pixels like `width: 300px` inside a grid.
  - **Z-Index**: Dropdowns/Modals must have `zIndex: 50` or higher to float above content.

- **Content & Mock Data (MANDATORY)**:
  - **NO EMPTY STATES**: NEVER generate empty tables, lists, or selects.
  - **Rich Volume**: Always provide **at least 10 items** for lists/tables to show scrolling behavior.
  - **Diverse Data**: Use meaningful, varied data. Do NOT repeat "Item 1, Item 2". Use specific names, diverse dates, and unique statuses.
  - **Realistic Korean Data**: Use real-world examples (names: 김민준, 이서연 / companies: 토스, 당근, 쿠팡).
  - **Rich Detail**: Fill all fields. Don't use "Test 1", "Item 1". Use "프로젝트 알파", "1분기 실적 보고서".
  - **Context-Aware**: If the user asks for a "Project Dashboard", generate "Project A - In Progress", "Team Meeting - 10:00 AM".
- **Profile Images (INITIAL AVATAR - NO EMOJI)**:
  - NEVER use emoji (👤, 🧑, 👨) for profile images.
  - Use **Initial Avatar**: A colored circle with the first character of the name.
  - Color palette: `['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6']`
  - Pick color by `name.charCodeAt(0) % colors.length` for consistency.
  - Example:
    ```tsx
    const getInitialAvatar = (name: string) => {
      const colors = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];
      const color = colors[name.charCodeAt(0) % colors.length];
      return (
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          backgroundColor: color, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 600, fontSize: 14
        }}>
          {name.charAt(0)}
        </div>
      );
    };
    ```
  - Use this for: user lists, comments, chat, team members, assignees.
- **Spacing**:
  - **섹션 간**: `marginBottom: 32px`
  - **폼 행 간**: `marginBottom: 24px`
- **Responsive Grid System (STRUCTURED LAYOUT)**:
  - **Form Grid**: Use `display: 'grid'`, `gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'`, `gap: '16px'`.
  - **Why Grid?**: Ensures alignment and prevents unnatural stretching of short inputs.
  - **Alignment**: Use `alignItems: 'end'` to align buttons with inputs.
  - **Example**:
    ```
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'24px 16px', alignItems:'end'}}>
      <div><label>상태</label><Select style={{width:'100%'}} options={...} /></div>
      <div><label>이름</label><input style={{width:'100%'}}/></div>
      <div style={{gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8}}>
        <Button>초기화</Button><Button>조회</Button>
      </div>
    </div>
    ```

## 🌟 FEW-SHOT EXAMPLE (PRODUCTION QUALITY REQUIRED)

> **NOTE**: 아래 예시의 색상/폰트 값은 구조 참고용입니다. 실제 코드 생성 시 위 **DESIGN STANDARDS** 섹션의 디자인 토큰 값을 사용하세요.

### User Management Dashboard
**Request**: "사용자 목록에 검색과 상태 필터 추가해줘"
**Response**:
<file path="src/components/UserDashboard.tsx">
import { Button, Badge } from '@/components';

const UserDashboard = () => {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [isLoading, setIsLoading] = React.useState(false);

  const avatarColors = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];
  const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

  const users = [
    { id: 1, name: '김민준', email: 'minjun@company.com', status: 'active' },
    { id: 2, name: '이서연', email: 'seoyeon@company.com', status: 'offline' },
    { id: 3, name: '박지호', email: 'jiho@company.com', status: 'active' },
    { id: 4, name: '최수빈', email: 'subin@company.com', status: 'active' },
    { id: 5, name: '정예은', email: 'yeeun@company.com', status: 'offline' },
    { id: 6, name: '강태현', email: 'taehyun@company.com', status: 'active' },
    { id: 7, name: '윤하늘', email: 'haneul@company.com', status: 'active' },
    { id: 8, name: '임도윤', email: 'doyun@company.com', status: 'offline' },
    { id: 9, name: '한소희', email: 'sohee@company.com', status: 'active' },
    { id: 10, name: '오준서', email: 'junseo@company.com', status: 'active' },
  ];

  const filteredUsers = users.filter(u =>
    (filter === 'all' || u.status === filter) &&
    u.name.includes(search)
  );

  const handleSearch = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  };

  return (
    <div style={{ padding: 32, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#212529', marginBottom: 8 }}>사용자 관리</h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>팀원들의 권한과 상태를 관리하세요.</p>

      {/* Card Container */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #dee2e6', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: 24 }}>
        {/* Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, alignItems: 'end', marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#212529', marginBottom: 6 }}>이름 검색</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름을 입력하세요" style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid #dee2e6', fontSize: 14, boxSizing: 'border-box', height: 42 }} />
          </div>
          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #dee2e6', overflow: 'hidden', height: 42 }}>
            {['all', 'active', 'offline'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{ flex: 1, backgroundColor: filter === s ? '#f8f9fa' : 'white', border: 'none', borderRight: '1px solid #dee2e6', fontSize: 14, fontWeight: 500, color: filter === s ? '#212529' : '#6b7280', cursor: 'pointer' }}>
                {s === 'all' ? '전체' : s === 'active' ? '활동' : '부재'}
              </button>
            ))}
          </div>
          <Button data-instance-id="search-btn" variant="primary" onClick={handleSearch} disabled={isLoading} style={{ width: '100%', height: 42 }}>
            {isLoading ? '검색 중...' : '검색'}
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>데이터를 불러오는 중...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>검색 결과가 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f9fa', fontWeight: 600, borderBottom: '2px solid #dee2e6' }}>사용자</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f9fa', fontWeight: 600, borderBottom: '2px solid #dee2e6' }}>이메일</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f9fa', fontWeight: 600, borderBottom: '2px solid #dee2e6' }}>상태</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', backgroundColor: '#f8f9fa', fontWeight: 600, borderBottom: '2px solid #dee2e6' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: getAvatarColor(user.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#ffffff' }}>{user.name[0]}</div>
                      <span style={{ fontWeight: 500, color: '#212529' }}>{user.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6', color: '#6b7280' }}>{user.email}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
                    <Badge variant={user.status === 'active' ? 'success' : 'neutral'}>{user.status === 'active' ? '활동' : '부재'}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6', textAlign: 'right' }}>
                    <Button data-instance-id={`edit-${user.id}`} variant="secondary" size="sm">관리</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
</file>

## 🔨 IMPLEMENTATION RULES
1. **PREMIUM COMPLETION**: Assume the user wants a **production-ready UI**. Wrap content in proper containers with headings and spacing.
2. **RICH MOCK DATA**: **NEVER** return empty data. Always generate 10+ realistic Korean items.
3. **ZERO OMISSION**: If the user asks for 5 filters, implement ALL 5. Missing features = FAILURE.
4. **IMPORT**: `import { Button } from '@/components'` / React hooks: `React.useState`.
5. **STYLING**: Inline styles only (`style={{ ... }}`), NO emojis, Desktop-first.

## 📊 Data Tables
Use native HTML `<table>` with inline styles:
- Table: `width: '100%'`, `borderCollapse: 'collapse'`, `fontSize: 14`
- Header (th): `padding: '12px 16px'`, `backgroundColor: '#f8f9fa'`, `fontWeight: 600`, `borderBottom: '2px solid #dee2e6'`
- Cells (td): `padding: '12px 16px'`, `borderBottom: '1px solid #dee2e6'`
- Use `Badge` for status columns
- Always generate 10+ rows of mock data

## Available Components

"""

RESPONSE_FORMAT_INSTRUCTIONS = """

## FORMAT
1. 간단한 한글 설명 (1-2문장)
2. `<file path="src/...">코드</file>` 태그

### Example (구조 참고용 - 색상은 DESIGN STANDARDS 사용):
로그인 폼입니다.

<file path="src/pages/Login.tsx">
import { Button } from '@/components';

const Login = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #dee2e6', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#212529', marginBottom: 8 }}>로그인</h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>계정에 로그인하세요</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#212529', marginBottom: 8 }}>이메일</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" style={{ width: '100%', padding: 12, border: '1px solid #dee2e6', borderRadius: 8, boxSizing: 'border-box', fontSize: 14 }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#212529', marginBottom: 8 }}>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 입력" style={{ width: '100%', padding: 12, border: '1px solid #dee2e6', borderRadius: 8, boxSizing: 'border-box', fontSize: 14 }} />
        </div>
        <Button data-instance-id="login-btn" variant="primary" onClick={() => setLoading(true)} style={{ width: '100%', height: 44 }}>
          {loading ? '로그인 중...' : '로그인'}
        </Button>
      </div>
    </div>
  );
};

export default Login;
</file>
"""

SYSTEM_PROMPT_FOOTER = """
## 🚨 CRITICAL RULES - VIOLATION = FAILURE

### 1. FILE COMPLETENESS
- **NEVER TRUNCATE CODE**: Do not use `// ...` or `// rest of code`.
- **FULL FUNCTIONALITY**: All buttons must have `onClick` handlers. All inputs must be controlled (`value` + `onChange`).
- **NO PLACEHOLDERS**: Do not say "Add logic here". Implement the logic.

### 2. COMPONENT USAGE
- **STRICT WHITELIST**: You must ONLY use the components listed above.
- **NO CUSTOM COMPONENTS**: Do not create new components like `function Card() {...}`. Use `div` with styles.
- **PROPS VALIDATION**: Use exact enum values (e.g., `variant="primary"`, NOT `variant="blue"`).
- **INSTANCE IDs**: Design system components (`Button`, `Badge`, `Select`, etc.) MUST have `data-instance-id` attribute (e.g., `<Button data-instance-id="submit-btn">`).

### 3. TECHNICAL CONSTRAINTS
- **INLINE STYLES ONLY**: Do not create CSS classes. Use `style={{ ... }}`.
- **NO EXTERNAL LIBS**: Do not import `lucide-react` or `framer-motion` unless explicitly allowed.
- **REACT HOOKS**: Use `React.useState`, `React.useEffect` directly (do not import).

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
    + RESPONSE_FORMAT_INSTRUCTIONS
    + SYSTEM_PROMPT_FOOTER
)


def get_system_prompt() -> str:
    """현재 시스템 프롬프트 반환 (로컬 스키마 기반, 현재 날짜/시간 포함)"""
    current_date = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")
    return SYSTEM_PROMPT.replace("{current_date}", current_date)


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
) -> str:
    """
    주어진 스키마로 시스템 프롬프트 동적 생성

    Args:
        schema: 컴포넌트 스키마 dict
        design_tokens: 디자인 토큰 dict (Firebase에서 로드, None이면 기본값 사용)
        ag_grid_schema: AG Grid 컴포넌트 스키마 dict (Firebase에서 로드, None이면 미포함)
        ag_grid_tokens: AG Grid 토큰 dict (Firebase에서 로드, None이면 미포함)
        layouts: Figma 레이아웃 JSON 리스트 (Firebase에서 로드, None이면 미포함)

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

    # 레이아웃 섹션
    layouts_section = format_layouts(layouts) if layouts else ""

    return (
        SYSTEM_PROMPT_HEADER.replace("{current_date}", current_date).replace(
            "{design_tokens_section}", design_tokens_section
        )
        + available_components
        + component_docs
        + ag_grid_section
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
- Use inline styles (style={{ ... }})
- Import components from @/components
- Use <file path="...">...</file> tags for code output
- Generate complete, runnable code (no placeholders)
- Follow React best practices (hooks, functional components)
- Use React.useState, React.useEffect directly (no imports)
- Add data-instance-id to every component

{design_tokens_section}
"""

async def get_vision_system_prompt(schema_key: str | None) -> str:
    """
    Vision 모드용 시스템 프롬프트 생성

    Args:
        schema_key: Firebase Storage 스키마 경로 (None이면 기본 컴포넌트만)

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

    return (
        base_prompt
        + "\n## Available Components\n"
        + available_note
        + "\n"
        + component_docs
        + "\n"
        + RESPONSE_FORMAT_INSTRUCTIONS
        + "\n"
        + SYSTEM_PROMPT_FOOTER
    )


# ============================================================================


