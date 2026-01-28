import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import verify_api_key
from app.schemas.chat import ReloadResponse
from app.services.firebase_storage import (
    DEFAULT_AG_GRID_SCHEMA_KEY,
    DEFAULT_AG_GRID_TOKENS_KEY,
    fetch_ag_grid_tokens_from_storage,
    fetch_design_tokens_from_storage,
    fetch_schema_from_storage,
    upload_schema_to_storage,
)
from app.services.firestore import RoomNotFoundError, get_chat_room, update_chat_room

router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)

# 스키마 리로드 시 동시성 보호를 위한 Lock
_reload_lock = asyncio.Lock()


# ============================================================================
# Free Mode System Prompt (No Schema Constraints)
# ============================================================================

FREE_MODE_SYSTEM_PROMPT = """You are a senior frontend engineer creating production-grade UIs.
Always respond in Korean briefly.

**Current Date: {current_date}**

## DESIGN
- **간격**: 섹션 간 marginBottom: 32px, 폼 행 간 marginBottom: 24px
- **폼 레이아웃**: 행 단위 flex (`display:'flex',gap:16`), 한 행에 4개 필드 (`flex:1`씩)
- **boxSizing**: 모든 input에 `boxSizing: 'border-box'` 필수
- 컨테이너: padding 24-32px
- 폰트: 제목(24px, 700), 본문(14-15px), 보조(13px, #64748b)

## RULES
1. DO EXACTLY WHAT IS ASKED
2. COMPLETE - 모든 버튼 동작, 폼 controlled
3. inline styles, React.useState (import 없이), NO emojis
4. **데이터**: 맥락에 맞는 새로운 한국어 이름/회사/금액 생성 (예시 복사 금지)

## FORMAT
1. 간단한 설명 (1-2문장)
2. `<file path="src/...">코드</file>`

### Example:
로그인 폼입니다.

<file path="src/pages/Login.tsx">
const Login = () => {
  const [email, setEmail] = React.useState('');
  return (
    <div style={{ padding: 32, maxWidth: 400 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>로그인</h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>계정에 로그인하세요</p>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>이메일</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' }} />
      </div>
      <button onClick={() => alert('clicked')} style={{ width: '100%', padding: 12, backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>로그인</button>
    </div>
  );
};

export default Login;
</file>"""


def get_free_mode_system_prompt(design_tokens: dict | None = None) -> str:
    """스키마 제약 없는 자유로운 시스템 프롬프트 반환

    Args:
        design_tokens: 디자인 토큰 dict (현재 FREE_MODE에서는 미사용, 추후 확장 가능)
    """
    current_date = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")
    # FREE_MODE는 간소화된 프롬프트 사용 (디자인 토큰 미적용)
    return FREE_MODE_SYSTEM_PROMPT.replace("{current_date}", current_date)


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
    # Data (비활성화 - UMD 빌드에서 ag-grid stub 처리됨)
    # "DataGrid",
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

    Returns:
        포맷팅된 AG Grid 컴포넌트 문서 문자열
    """
    if not schema:
        return ""

    lines = ["## 📊 AG Grid Component (DataGrid)"]
    lines.append("")
    lines.append("Use `DataGrid` for advanced data tables with sorting, filtering, and pagination.")
    lines.append("")

    components = schema.get("components", {})
    if not components:
        return ""

    for comp_name, comp_data in components.items():
        props = comp_data.get("props", {})
        description = comp_data.get("description", "")

        # 컴포넌트 헤더
        header = f"**{comp_name}**"
        if description and len(description) < 80:
            header += f" - {description}"
        lines.append(header)

        # props 포맷팅
        prop_lines = []
        for prop_name, prop_info in props.items():
            if prop_name == "children":
                continue

            prop_type = prop_info.get("type", "any")
            required = prop_info.get("required", False)
            default = prop_info.get("defaultValue")

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

            prop_lines.append(line)

        if prop_lines:
            prop_lines[-1] = prop_lines[-1].replace("├─", "└─")
            lines.extend(prop_lines)

        lines.append("")

    return "\n".join(lines)


def format_ag_grid_tokens(tokens: dict | None) -> str:
    """
    AG Grid 토큰을 시스템 프롬프트용 문자열로 포맷팅

    Args:
        tokens: AG Grid 토큰 dict 또는 None

    Returns:
        포맷팅된 AG Grid 토큰 문자열
    """
    if not tokens:
        return ""

    lines = ["## 📊 AG Grid Styling Tokens"]
    lines.append("")

    # 토큰 구조에 따라 포맷팅 (실제 구조에 맞게 조정 필요)
    grid_tokens = tokens.get("agGridTokens", tokens)

    # 색상 토큰
    colors = grid_tokens.get("colors", {})
    if colors:
        lines.append("**Colors:**")
        for key, value in list(colors.items())[:10]:  # 상위 10개만
            lines.append(f"  - {key}: `{value}`")
        lines.append("")

    # 크기/간격 토큰
    sizing = grid_tokens.get("sizing", grid_tokens.get("spacing", {}))
    if sizing:
        lines.append("**Sizing:**")
        for key, value in list(sizing.items())[:10]:
            lines.append(f"  - {key}: `{value}`")
        lines.append("")

    # 폰트 토큰
    typography = grid_tokens.get("typography", grid_tokens.get("font", {}))
    if typography:
        lines.append("**Typography:**")
        for key, value in list(typography.items())[:10]:
            lines.append(f"  - {key}: `{value}`")
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

## 🧠 THOUGHT PROCESS (MUST EXECUTE INTERNALLY)
Before generating any code, you must:
1. **Review Previous Code**: What features exist? What filters/buttons/state are already there? (PRESERVE ALL)
2. **Analyze Intent**: What is the core feature? What are the key interactions?
3. **Requirement Extraction**: List EVERY field/filter/action requested. (e.g., "Filters: Date, Name, Status, Category").
4. **Component Strategy**: Which design system components fit best? (e.g., Use `Button` vs `IconButton`)
5. **State Management**: What `useState` hooks are needed? (e.g., loading, open/close, input values)
6. **Layout Plan**: How to structure the `div`s for proper spacing and alignment?

{design_tokens_section}## 💎 PREMIUM VISUAL STANDARDS (LOVEABLE QUALITY)
- **Containerization (NO FLOATING TEXT)**:
  - ALL content must be inside a white card: `<div style={{backgroundColor:'#ffffff', borderRadius:12, border:'1px solid #dee2e6', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', padding:24}}>`
  - NEVER place naked text or buttons directly on the gray background.
  - Exception: Page Titles (`h1`) can be outside.
- **Filter + Table Layout (IMPORTANT)**:
  - Filter bar and DataGrid/Table MUST be in the SAME card container.
  - Structure: `<Card> <FilterBar /> <Divider /> <DataGrid /> </Card>`
  - DO NOT separate filters and table into different cards.
- **Status Styling**:
  - Use `Badge` for status. NEVER use plain text.
  - Active: `variant="success"`, Inactive: `variant="neutral"`, Error: `variant="destructive"`.
- **Iconography**:
  - Use `IconButton` for actions (edit, delete) instead of text buttons if space is tight.
  - Add icons to section headers if possible.
- **Empty States**:
  - Use a centered, gray aesthetic for empty states with a helpful message.
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
  - **Rich Detail**: Fill all fields. Don't use "Test 1", "Item 1". Use "프로젝트 알파", "2024년 1분기 보고서".
  - **Context-Aware**: If the user asks for a "Project Dashboard", generate "Project A - In Progress", "Team Meeting - 10:00 AM".
- **Spacing**:
  - **섹션 간**: `marginBottom: 32px`
  - **폼 행 간**: `marginBottom: 24px`
- **Responsive Grid System (STRUCTURED LAYOUT)**:
  - **Form Grid**: Use `display: 'grid'`, `gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'`, `gap: '16px'`.
  - **Why Grid?**: Ensures alignment and prevents unnatural stretching of short inputs.
  - **Alignment**: Use `alignItems: 'end'` to align buttons with inputs.
  - **Example**:
    ```
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

## �🌟 FEW-SHOT EXAMPLES (ACHIEVE THIS LEVEL OF QUALITY)

### Example : User Management Dashboard (Complex State + Layout)
**User Request**: "Create a user list with search and status filters."
**Response**:
<file path="src/components/UserDashboard.tsx">
import { Button, Badge, Divider } from '@/components';

const UserDashboard = () => {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');

  const users = [
    { id: 1, name: '김민준', email: 'minjun@example.com', role: 'Admin', status: 'active' },
    { id: 2, name: '이서연', email: 'seoyeon@example.com', role: 'Editor', status: 'offline' },
    { id: 3, name: '박지호', email: 'jiho@example.com', role: 'Viewer', status: 'active' },
  ];

  const filteredUsers = users.filter(u => 
    (filter === 'all' || u.status === filter) &&
    u.name.includes(search)
  );

  return (
    <div style={{ padding: 32, width: '100%', maxWidth: 1200, margin: '0 auto', fontFamily: '-apple-system, sans-serif' }}>
      {/* Header Section */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.025em', marginBottom: 8 }}>사용자 관리</h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>팀원들의 권한과 상태를 관리하세요.</p>
      </div>

      {/* Controls */}
      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px 16px', alignItems: 'end', marginBottom: 24 }}>
        {/* Search */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>이름 검색</label>
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름을 입력하세요"
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              height: 42
            }}
          />
        </div>

        {/* Filter Buttons (as toggles) */}
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', height: 42 }}>
          {['all', 'active', 'offline'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                flex: 1,
                backgroundColor: filter === status ? '#f3f4f6' : 'white',
                border: 'none',
                borderRight: '1px solid #e5e7eb',
                fontSize: 14,
                fontWeight: 500,
                color: filter === status ? '#111827' : '#6b7280',
                cursor: 'pointer'
              }}
            >
              {status === 'all' ? '전체' : status === 'active' ? '활동' : '부재'}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex' }}>
           <Button data-instance-id="search-btn" variant="primary" style={{ width: '100%', height: 42 }}>검색</Button>
        </div>
      </div>

      {/* Data List */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', padding: '12px 24px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ width: '30%', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>사용자</span>
          <span style={{ width: '40%', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>이메일</span>
          <span style={{ width: '15%', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>상태</span>
          <span style={{ width: '15%', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'right' }}>액션</span>
        </div>
        
        {filteredUsers.map((user, idx) => (
          <div key={user.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: idx !== filteredUsers.length - 1 ? '1px solid #f3f4f6' : 'none', backgroundColor: 'white' }}>
             {/* Avatar + Name */}
            <div style={{ width: '30%', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#4b5563' }}>
                {user.name[0]}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{user.name}</span>
            </div>
            
            <div style={{ width: '40%', fontSize: 14, color: '#6b7280' }}>{user.email}</div>
            
            <div style={{ width: '15%' }}>
              <Badge variant={user.status === 'active' ? 'success' : 'neutral'}>
                {user.status}
              </Badge>
            </div>
            
            <div style={{ width: '15%', textAlign: 'right' }}>
              <Button data-instance-id={`edit-${user.id}`} variant="secondary" size="sm">관리</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
</file>

## 🔨 IMPLEMENTATION RULES
1. **PREMIUM COMPLETION (DEFAULT)**: Assume the user wants a **production-ready, visually stunning UI**. Even for simple requests, wrap input/buttons in a `Card` or `Container` with proper headings and spacing.
2. **RICH MOCK DATA**: **NEVER** return empty data. Always generate 10+ realistic items. If the user asks for a list, show a proper list with scrolling.
3. **PROACTIVE POLISH**: Add "nice-to-have" details (icons, helper text, hover effects) without being asked.
4. **INCREMENTAL UPDATE (CRITICAL)**: When updating code, NEVER remove existing features. Include ALL previous filters, buttons, handlers, and state. Missing code = FAILURE.
5. **ZERO OMISSION POLICY**: If the user asks for 5 filters, implement ALL 5. If previous code had 3 filters and user asks for 2 more, result must have ALL 5.
6. **COMPLETE CODE**: All buttons must work, all inputs must be controlled.
6. **IMPORT**: `import { Button } from '@/components'` / React hooks: `React.useState`.
7. **STYLING**: Inline styles only (`style={{ ... }}`), NO emojis, Desktop-first.

## 📊 Data Tables - USE HTML TABLE (NOT DataGrid)
When user requests a **data table, list, or grid**, use native HTML `<table>` with inline styles.

### Table Style Guide
```tsx
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: 14,
};

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left' as const,
  borderBottom: '2px solid #dee2e6',
  backgroundColor: '#f8f9fa',
  fontWeight: 600,
  color: '#212529',
};

const tdStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid #dee2e6',
  color: '#212529',
};
```

### Example Usage
```tsx
const UserTable = () => {
  const users = [
    { id: 1, name: '김민수', email: 'kim@example.com', status: '활성' },
    { id: 2, name: '이지은', email: 'lee@example.com', status: '비활성' },
  ];

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #dee2e6', backgroundColor: '#f8f9fa', fontWeight: 600 }}>ID</th>
          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #dee2e6', backgroundColor: '#f8f9fa', fontWeight: 600 }}>이름</th>
          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #dee2e6', backgroundColor: '#f8f9fa', fontWeight: 600 }}>이메일</th>
          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #dee2e6', backgroundColor: '#f8f9fa', fontWeight: 600 }}>상태</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} style={{ ':hover': { backgroundColor: '#f8f9fa' } }}>
            <td style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>{user.id}</td>
            <td style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>{user.name}</td>
            <td style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>{user.email}</td>
            <td style={{ padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
              <Badge variant={user.status === '활성' ? 'success' : 'neutral'}>{user.status}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### Table Design Rules
- Header: `backgroundColor: '#f8f9fa'`, `fontWeight: 600`, `borderBottom: '2px solid #dee2e6'`
- Cells: `padding: '12px 16px'`, `borderBottom: '1px solid #dee2e6'`
- Use `Badge` for status columns
- Always generate 10+ rows of mock data

## Available Components

"""

RESPONSE_FORMAT_INSTRUCTIONS = """

## FORMAT
1. 간단한 한글 설명 (1-2문장)
2. `<file path="src/...">코드</file>` 태그

### Example:
로그인 폼입니다.

<file path="src/pages/Login.tsx">
import { Button } from '@/components';

const Login = () => {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  return (
    <div style={{ padding: 32, maxWidth: 400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>로그인</h1>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>계정에 로그인하세요</p>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>이메일</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' }} />
      </div>
      <Button data-instance-id="button-1" variant="primary" onClick={() => setLoading(true)} style={{ width: '100%' }}>
        {loading ? '처리 중...' : '로그인'}
      </Button>
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
- **INSTANCE IDs**: EVERY component must have `data-instance-id` attribute (e.g., `button-1`, `input-2`).

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


def generate_system_prompt(
    schema: dict,
    design_tokens: dict | None = None,
    ag_grid_schema: dict | None = None,
    ag_grid_tokens: dict | None = None,
) -> str:
    """
    주어진 스키마로 시스템 프롬프트 동적 생성

    Args:
        schema: 컴포넌트 스키마 dict
        design_tokens: 디자인 토큰 dict (Firebase에서 로드, None이면 기본값 사용)
        ag_grid_schema: AG Grid 컴포넌트 스키마 dict (Firebase에서 로드, None이면 미포함)
        ag_grid_tokens: AG Grid 토큰 dict (Firebase에서 로드, None이면 미포함)

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

    return (
        SYSTEM_PROMPT_HEADER.replace("{current_date}", current_date).replace(
            "{design_tokens_section}", design_tokens_section
        )
        + available_components
        + component_docs
        + ag_grid_section
        + RESPONSE_FORMAT_INSTRUCTIONS
        + SYSTEM_PROMPT_FOOTER
    )


def get_schema() -> dict | None:
    """현재 로컬 스키마 반환"""
    return _schema


# ============================================================================
# API Endpoints
# ============================================================================


@router.get(
    "",
    summary="컴포넌트 스키마 조회",
    description="현재 로드된 디자인 시스템 컴포넌트 스키마를 반환합니다.",
    response_description="컴포넌트 스키마 JSON",
    responses={
        200: {
            "description": "스키마 조회 성공",
            "content": {
                "application/json": {
                    "example": {
                        "version": "1.0.0",
                        "generatedAt": "2026-01-09T10:00:00.000Z",
                        "components": {
                            "Button": {
                                "displayName": "Button",
                                "category": "UI",
                                "props": {
                                    "variant": {
                                        "type": ["primary", "secondary"],
                                        "required": False,
                                    }
                                },
                            }
                        },
                    }
                }
            },
        },
        404: {"description": "스키마 파일을 찾을 수 없음"},
    },
)
async def get_components():
    """
    컴포넌트 스키마 조회

    `component-schema.json` 파일에서 로드된 컴포넌트 정의를 반환합니다.
    이 스키마는 AI가 코드 생성 시 참조하는 컴포넌트 목록입니다.
    """
    schema, error = load_component_schema()
    if error:
        raise HTTPException(status_code=404, detail=error)
    return schema


@router.post(
    "/reload",
    summary="컴포넌트 스키마 리로드",
    description="component-schema.json 파일을 다시 로드하여 시스템 프롬프트를 갱신합니다.",
    response_model=ReloadResponse,
    response_description="리로드 결과",
    responses={
        200: {"description": "리로드 성공"},
        500: {"description": "스키마 파일 로드 실패"},
    },
)
async def reload_components() -> ReloadResponse:
    """
    컴포넌트 스키마 리로드

    서버 재시작 없이 component-schema.json을 다시 로드합니다.
    디자인 시스템 컴포넌트가 추가/변경된 경우 이 엔드포인트를 호출하세요.
    """
    global _schema, _error, COMPONENT_DOCS, AVAILABLE_COMPONENTS, SYSTEM_PROMPT

    async with _reload_lock:
        _schema, _error = load_component_schema()
        if _error:
            raise HTTPException(status_code=500, detail=_error)

        COMPONENT_DOCS = format_component_docs(_schema)
        AVAILABLE_COMPONENTS = get_available_components_note(_schema)
        SYSTEM_PROMPT = (
            SYSTEM_PROMPT_HEADER
            + AVAILABLE_COMPONENTS
            + COMPONENT_DOCS
            + RESPONSE_FORMAT_INSTRUCTIONS
            + SYSTEM_PROMPT_FOOTER
        )

        return ReloadResponse(
            message="Schema reloaded successfully",
            component_count=len(_schema.get("components", {})),
        )


# ============================================================================
# Schema Upload/Download (Firebase Storage)
# ============================================================================


class UploadSchemaRequest(BaseModel):
    """스키마 업로드 요청"""

    room_id: str = Field(
        ...,
        description="채팅방 ID",
    )
    data: dict = Field(
        ...,
        description="컴포넌트 스키마 JSON",
    )


class UploadSchemaResponse(BaseModel):
    """스키마 업로드 응답"""

    schema_key: str = Field(description="Firebase Storage 경로")
    component_count: int = Field(description="업로드된 컴포넌트 수")
    uploaded_at: str = Field(description="업로드 시각 (ISO 8601)")


class SchemaResponse(BaseModel):
    """스키마 조회 응답"""

    schema_key: str
    data: dict


@router.post(
    "/upload",
    response_model=UploadSchemaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="스키마 업로드",
    description="""
클라이언트가 추출한 컴포넌트 스키마를 Firebase Storage에 업로드합니다.

## 사용 흐름
1. `POST /rooms`로 채팅방 생성 → room_id 획득
2. 클라이언트에서 react-docgen-typescript로 스키마 추출
3. 이 API로 스키마 업로드 (room_id 필수)

## 저장 경로
`exports/{room_id}/component-schema.json`
""",
    responses={
        201: {"description": "업로드 성공"},
        400: {"description": "잘못된 요청"},
        500: {"description": "서버 오류"},
    },
)
async def upload_schema(request: UploadSchemaRequest) -> UploadSchemaResponse:
    """컴포넌트 스키마 업로드"""
    try:
        if not request.data.get("components"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Schema must contain 'components' field",
            )

        # Room 존재 여부 먼저 확인 (Storage 업로드 전에 검증)
        room = await get_chat_room(request.room_id)
        if room is None:
            raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {request.room_id}")

        # room_id 기반 schema_key 생성
        schema_key = f"exports/{request.room_id}/component-schema.json"

        # Storage에 업로드
        await upload_schema_to_storage(schema_key, request.data)

        # Room의 schema_key 자동 업데이트 (내부에서 room 존재 여부 검증)
        await update_chat_room(room_id=request.room_id, schema_key=schema_key)

        component_count = len(request.data.get("components", {}))
        uploaded_at = datetime.now(ZoneInfo("Asia/Seoul")).isoformat()

        logger.info(
            "Schema uploaded and room updated: %s (%d components)",
            schema_key,
            component_count,
        )

        return UploadSchemaResponse(
            schema_key=schema_key,
            component_count=component_count,
            uploaded_at=uploaded_at,
        )

    except HTTPException:
        raise
    except RoomNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room not found: {request.room_id}",
        ) from e
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error("Failed to upload schema: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload schema. Please try again.",
        ) from e


@router.get(
    "/storage/{schema_key:path}",
    response_model=SchemaResponse,
    summary="Storage 스키마 조회",
    description="Firebase Storage에서 스키마를 조회합니다.",
    responses={
        200: {"description": "조회 성공"},
        404: {"description": "스키마를 찾을 수 없음"},
    },
)
async def get_storage_schema(schema_key: str) -> SchemaResponse:
    """Storage 스키마 조회"""
    try:
        schema = await fetch_schema_from_storage(schema_key)
        return SchemaResponse(schema_key=schema_key, data=schema)

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schema not found: {schema_key}",
        ) from e
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error("Failed to get schema: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get schema. Please try again.",
        ) from e
