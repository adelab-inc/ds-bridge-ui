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
    # Navigation
    "Pagination",  # 테이블 하단 페이지네이션
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


# Schema에 누락된 HTML 기반 props 보충 데이터
# 실제 소스: storybook-standalone/packages/ui/src/components/*.tsx
# 모든 컴포넌트가 ...rest spread로 HTML attrs를 전달하므로 이 props는 동작함
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
        "disabled": {"type": "boolean", "required": False},
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

            # props 포맷팅 (children, icon 관련 제외)
            _HIDDEN_PROPS = {"children", "icon", "leftIcon", "rightIcon", "hasIcon"}
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
    lines.append("    <Button variant=\"outline\" size=\"sm\" onClick={() => {")
    lines.append("      setSelectedItem(params.data);")
    lines.append("      setIsDetailOpen(true);")
    lines.append("    }}>")
    lines.append("      상세")
    lines.append("    </Button>")
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
    lines.append("  { field: 'empNo', headerName: '사번', width: 100, pinned: 'left' },")
    lines.append("  { field: 'name', headerName: '성명', width: 120, pinned: 'left' },")
    lines.append("  { field: 'dept', headerName: '[인사] 부서', flex: 1 },")
    lines.append("  { field: 'position', headerName: '[인사] 직급', width: 100 },")
    lines.append("  { field: 'joinDate', headerName: '[인사] 입사일', ...COLUMN_TYPES.dateColumn },")
    lines.append("  { field: 'baseSalary', headerName: '[급여] 기본급', ...COLUMN_TYPES.currencyColumn },")
    lines.append("  { field: 'bonus', headerName: '[급여] 상여금', ...COLUMN_TYPES.currencyColumn },")
    lines.append("  { field: 'status', headerName: '상태', width: 100,")
    lines.append("    valueFormatter: (params) => params.value === 'active' ? '재직' : '퇴직' },")
    lines.append("  // Action button — Button 컴포넌트를 cellRenderer로 직접 사용")
    lines.append("  { headerName: '상세', width: 100, pinned: 'right',")
    lines.append("    cellRenderer: (params: any) => (")
    lines.append("      <Button variant=\"outline\" size=\"sm\" onClick={() => { setSelectedItem(params.data); setIsDetailOpen(true); }}>상세</Button>")
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
    lines.append("- ✅ `cellRenderer: (params) => <Button variant=\"outline\" size=\"sm\">상세</Button>` — 디자인 시스템 Button 직접 사용")
    lines.append("- ✅ `cellRenderer: CheckboxCellRenderer` — Named component from @aplus/ui")
    lines.append("- ✅ `cellRenderer: ImageCellRenderer` — Named component from @aplus/ui")
    lines.append("- ❌ `cellRenderer: ButtonCellRenderer` — 사용 금지 (디자인 시스템 미적용, 파란색 하드코딩)")
    lines.append("- For simple text formatting, use `valueFormatter`: `valueFormatter: (params) => params.value ? '활성' : '비활성'`")
    lines.append("")
    lines.append("**3. pinned — ONLY on top-level columns:**")
    lines.append("- ✅ `{ field: 'name', pinned: 'left' }` — Works on flat column")
    lines.append("- ❌ Pinned inside column group children — GRID DIES")
    lines.append("")
    lines.append("**4. rowData — 반드시 useState 또는 useMemo로 관리:**")
    lines.append("- ❌ `const rowData = [...]` — 리렌더 시 새 배열 생성 → 체크박스 선택 해제, 스크롤 초기화 등 발생")
    lines.append("- ✅ `const [rowData, setRowData] = useState([...])` — 참조 유지되어 그리드 상태 보존")
    lines.append("")

    # 체크박스 선택 패턴
    lines.append("### Checkbox Selection Pattern")
    lines.append("행 선택(체크박스)이 필요한 경우, **반드시 `suppressRowClickSelection`을 함께 사용**해야 합니다.")
    lines.append("그렇지 않으면 행의 아무 곳(버튼, 텍스트 등)을 클릭해도 체크박스가 토글되어 의도치 않은 선택이 발생합니다.")
    lines.append("")
    lines.append("```tsx")
    lines.append("// ⚠️ rowData는 반드시 useState로 — const rowData = [...] 사용 시 체크 즉시 해제됨")
    lines.append("const [rowData] = useState([...initialData]);")
    lines.append("")
    lines.append("const columnDefs: ColDef[] = [")
    lines.append("  { checkboxSelection: true, headerCheckboxSelection: true, width: 50 },  // 체크박스 전용 컬럼")
    lines.append("  { field: 'name', headerName: '이름' },")
    lines.append("  // ... 나머지 컬럼")
    lines.append("];")
    lines.append("")
    lines.append("<DataGrid")
    lines.append("  rowData={rowData}")
    lines.append("  columnDefs={columnDefs}")
    lines.append("  rowSelection=\"multiple\"")
    lines.append("  suppressRowClickSelection={true}  // ← 필수: 체크박스로만 선택 가능하게 함")
    lines.append("/>")
    lines.append("```")
    lines.append("")
    lines.append("- ❌ `rowSelection=\"multiple\"` 만 사용 → 행 아무 곳 클릭해도 선택됨 (버튼 클릭 시에도)")
    lines.append("- ✅ `rowSelection=\"multiple\"` + `suppressRowClickSelection={true}` → 체크박스로만 선택")
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
- variant="primary": 메인 CTA (저장, 생성, 로그인). 페이지당 1-2개
- variant="secondary": 보조 액션 (취소, 뒤로가기)
- variant="outline": 테이블 내 액션, 필터 버튼
- variant="destructive": 삭제, 해지 등 위험한 액션
- ⚠️ **size는 배치 위치에 따라 자동 결정** (SM 일괄 적용 절대 금지):
  - `size="lg"`: 페이지 메인 CTA (로그인, 저장 등 단독 폼 제출 버튼)
  - `size="md"`: 페이지 헤더 액션, Dialog 푸터, 필터 조회/초기화 버튼
  - `size="sm"`: DataGrid 행 내부, 툴바, 컴팩트 UI만 해당
  - ❌ 모든 버튼에 같은 size를 반복하지 말 것

### Field (⚠️ MUST be self-closing)
- type="text": 일반 텍스트 (이름, 제목)
- type="email": 이메일 (자동 validation)
- type="number": 숫자 (금액, 수량)
- type="date": 날짜 선택 (DatePicker 대신 사용)
- type="password": 비밀번호
- multiline rowsVariant="flexible": 긴 텍스트 (설명, 비고)
- ✅ `<Field type="text" label="이름" />` — ALWAYS self-closing
- ❌ `<Field>children</Field>` — CRASHES (React Error #137)

### Select
- 필터용: placeholder="전체" + options에 "전체" 포함
- 폼 입력용: placeholder="선택하세요" + className="w-full"
- options는 최소 4-6개의 현실적 항목
- ⚠️ className="w-full" 필수 (기본 240px 고정폭 → 오버플로우 방지)
- defaultValue는 option의 value 사용 (label 아님): ✅ `defaultValue="all"` ❌ `defaultValue="전체"`
- ⚠️ onChange 시그니처: `onChange={(value) => setValue(value)}` — value를 직접 받음 (event 아님)
  - ✅ `<Select onChange={(v) => setStatus(v)} />`
  - ❌ `<Select onChange={(e) => setStatus(e.target.value)} />` — e.target.value 없음

### Badge
- type="status" + statusVariant: 상태 표시 전용
  - "success": 정상, 완료, 활성
  - "error": 실패, 해지, 오류
  - "warning": 대기, 심사중, 주의
  - "info": 진행중, 접수
- ❌ NEVER invent hex colors — only use exact values from the COLOR TOKEN TABLE above

### Dialog
- size="sm": 확인/취소 간단 알림
- size="md": 폼 입력 (기본)
- size="lg": 복잡한 폼, 상세 정보
- ⚠️ Dialog 내부 padding은 `p-5` 사용. `p-6` 이상은 마진이 과도해 보임
- Dialog body 내 폼 필드 간격: `gap-4` 또는 `mb-4` (mb-5 이상 금지)

### Tooltip (롤오버 메시지)
- 아이콘이나 텍스트에 마우스 오버 시 설명 표시용
- ✅ `<Tooltip label="설명 텍스트"><span>호버 대상</span></Tooltip>`
- ⚠️ 토스트/알림을 요청받으면 Tooltip과 혼동하지 말 것
- ⚠️ Tooltip만 요청 시 별도 박스/카드 UI를 추가로 생성하지 말 것. Tooltip 컴포넌트만 적용

### Checkbox / Radio / ToggleSwitch
- MUST use `checked` + `onChange` handler for controlled state
- ⚠️ NO `label` prop exists. Use `<label>` wrapper with text:
  - ✅ `<label className="flex items-center gap-2 cursor-pointer"><Radio checked={{v}} onChange={{fn}} /><span className="text-sm">예</span></label>`
  - ❌ `<Radio label="예" />` — `label` prop DOES NOT EXIST
- ✅ `<label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={{isChecked}} onChange={{(e) => setIsChecked(e.target.checked)}} /><span className="text-sm">동의합니다</span></label>`

### Pagination
- 테이블 하단 페이지네이션: `<Pagination currentPage={{page}} totalCount={{100}} pageSize={{10}} onPageChange={{setPage}} />`
- variant="standard" (기본): 첫/이전/숫자/다음/끝 전체 표시
- variant="simple": 이전/현재페이지/다음만 표시

{design_tokens_section}## 💎 VISUAL DESIGN STANDARDS

### Layout
- **Page Background**: `min-h-screen bg-[#f4f6f8] p-8`
- **White Card Container**: `bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6` — ALL content inside cards
  - Exception: Page Titles (h1) can be outside
- **Container**: `w-full max-w-[1920px] mx-auto` (1920x1080 기준)
- **Filter + Table**: MUST be grouped together. DO NOT separate into different cards.
- **Grid System**:
  - 12-column: `grid-cols-12` + `col-span-N` (flexible layouts)
  - Simple: `grid-cols-2`/`grid-cols-3`/`grid-cols-4` (equal divisions)
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

### Images & Icons
- **⛔ ABSOLUTELY NO icon library imports** — lucide-react, material-icons, heroicons, react-icons 등 모두 설치되어 있지 않음. import 시 앱이 크래시남
- **⛔ NEVER `import {{ ... }} from 'lucide-react'`** — THIS WILL CRASH THE APP
- **⛔ NEVER use emoji as icons** (🔍, ⭐, 📁, 👤) — unprofessional
- **⛔ NEVER use IconButton** or icon props (leftIcon, rightIcon, icon on Button/Alert/Chip)
- **⛔ NEVER use inline SVG** (`<svg>`) — 코드가 불필요하게 길어짐
- **⛔ NO ICONS AT ALL** — 이 프로젝트에는 아이콘이 없음. 아이콘 자리에는 반드시 텍스트로 대체
- **✅ 텍스트로만 표현**:
  - 버튼: `<Button>검색</Button>`, `<Button>추가</Button>`, `<Button>삭제</Button>`
  - 브레드크럼 구분자: 텍스트 `>` 또는 `/` 사용
  - 즐겨찾기: 텍스트 버튼 `<button>즐겨찾기</button>`
  - 닫기: 텍스트 `<button>닫기</button>` 또는 `<button>×</button>`
  - 외부링크: 텍스트만 `<Button>이미지시스템</Button>`
  - 이미지 참조 UI에 아이콘이 보이더라도 텍스트로 대체할 것
- **Profile images**: Initial Avatar — colored circle with first character
  - `<div className="w-10 h-10 rounded-full bg-[#0033a0] text-white flex items-center justify-center font-semibold text-sm">{{name.charAt(0)}}</div>`
  - Color by `name.charCodeAt(0) % 6` from design tokens: `['#0033a0','#8b5cf6','#ec4899','#ed6c02','#2e7d32','#0288d1']`
- **Product images**: Use placeholder div, NEVER `<img>` with placeholder URLs
  - `<div className="w-20 h-20 rounded-lg bg-[#eceff3] text-[#9da4ab] flex items-center justify-center text-xs">이미지</div>`
- **Exception**: Only use `<img>` if user explicitly provides a real image URL

## 🔨 IMPLEMENTATION RULES

1. **IMPORT**: `import {{ Button, Field, Select }} from '@/components'`
   - ONLY import components you actually render in JSX
   - ❌ NEVER import types (HTMLInputElement, ChangeEvent, MouseEvent) — define inline
   - ❌ NEVER import Option/OptionGroup (Select uses `options` prop internally)
   - Unused imports = CRASH
2. **REACT**: `React.useState`, `React.useEffect` directly (no import needed)
3. **STYLING**: Tailwind CSS only (`className="..."`). `style={{{{}}}}` ONLY for dynamic JS variable values. No custom CSS.
4. **NO EXTERNAL LIBS**: ⛔ NEVER import lucide-react, heroicons, material-icons, react-icons, framer-motion — NOT INSTALLED, WILL CRASH. No icons — use text only.
5. **ENUM PROPS**: Match context — NEVER use the same size/variant for every component on a page
   - 페이지 헤더 버튼: `size="md"`, 필터 조회 버튼: `size="md"`, DataGrid 내부: `size="sm"`, 폼 제출: `size="lg"`
   - Badge 상태: 성공="success", 실패="error", 대기="warning"
   - ❌ 모든 Button에 동일한 size 적용 금지 — 위치마다 다르게 설정
7. **ZERO OMISSION**: If user asks for 5 fields, implement ALL 5. Missing features = FAILURE.
   - 사용자가 필드를 그룹으로 정의해도 **각 필드를 개별적으로 모두 생성**
   - 예: "직원할인, 해피콜여부, 보험금수령확인 : 라디오(예, 아니오)" → Radio 3개 각각 생성
8. **FILE COMPLETENESS**: NEVER truncate code (no `// ...` or `// rest of code`). All buttons need `onClick`, all inputs need `value` + `onChange`.

### Data Tables (⚠️ MUST use DataGrid)
- **테이블/목록 데이터 → 항상 `<DataGrid>` 사용. HTML `<table>` 절대 금지.**
- ❌ `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>` — 사용 금지
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
- Substitutions: DatePicker → `<Field type="date" />`, Input → `<Field type="text" />`, TextArea → `<Field multiline />`

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
- Tailwind: `grid grid-cols-12 gap-6 px-6`

### 필터/검색 영역 그리드 규칙

- 필터 영역은 col-12 내부에서 독립 그리드 사용
- 내부 Gutter: **12px** (`gap-3`), Padding: **16px** (`p-4`)
- 6그리드 기반: 1컬럼당 col-1 또는 col-2 폭
- 우측 최하단 2컬럼 = 검색/초기화 버튼 위치

### 액션 버튼 정렬 규칙

- 항상 **우측 정렬** (`flex justify-end gap-2`)
- 좌→우 순서: 중립 텍스트(Tertiary) → 중립 보조(Outline) → 보조(Secondary) → 주요(Primary)

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

- 모든 Type은 `grid grid-cols-12 gap-6` 기반

### Row Pattern (세로 흐름 구조)

| 패턴 | 이름 | 구조 | 스크롤 정책 | 용도 |
|------|------|------|------------|------|
| RP-1 | 조회형(기본형) | Title → FilterBar → ActionButtons → Grid | 전체 스크롤 + Grid 내부 스크롤 | 대량 데이터 조회 (계약 리스트, 승인 목록) |
| RP-2 | 단일 상세형 | Title → 상세 정보 영역 | 전체 스크롤 | 단일 객체 조회 (계약 상세, 고객 상세) |
| RP-3 | 입력/수정형 | Title → Form Section → Action(저장/취소) | 전체 스크롤, Form 자동 확장 | 데이터 생성/수정 |
| RP-4 | 요약+Grid형 | Title → 상단 요약 → 하단 Grid | 전체 스크롤, 하단 Grid 내부 스크롤 | 기본 정보 + 관련 데이터 |
| RP-5 | 다중 Grid형 | Title → Grid A → Grid B | 전체 스크롤, 각 Grid 독립 가능 | 성격 다른 데이터 병렬 (승인대기/완료) |
| RP-6 | 탐색형 | Title → Navigation Area + Detail Area | 좌측 독립 스크롤, 우측 전체 스크롤 | 관리성 화면 (코드 관리, 조직 관리) |
| RP-7 | 병렬형 | Title → Section A \\| Section B | 좌우 독립 스크롤 | 변경 전/후 비교, A/B 비교 |
| RP-8 | 상세+탭형 | Title → 상단 기본정보 → Tab → 하단 Grid/Content | 전체 스크롤, 탭 콘텐츠 내부 스크롤 | 상세 + 탭별 관련 데이터 |

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

"""

# ============================================================================
# PRE-GENERATION CHECKLIST (최종 경고)
# ============================================================================

PRE_GENERATION_CHECKLIST = """

---

## ⚠️ FINAL CHECKLIST (코드 생성 전 확인)

1. **Field**: 모든 `<Field`는 `/>` 로 끝나는가? `</Field>` 가 0개인가?
2. **Whitelist**: 사용한 컴포넌트가 모두 Available Components에 있는가?
3. **Import**: JSX에서 사용한 컴포넌트만 import했는가? 타입 import는 없는가?
4. **Complete output**: `...` 이나 `// 나머지 동일` 같은 생략이 없는가?
5. **ENUM variety**: 같은 variant/size를 모든 컴포넌트에 반복하지 않았는가?

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
        {/* ⛔ CRITICAL: Field는 self-closing만 가능. <Field>children</Field> 금지 */}
        <div className="mb-5">
          <Field type="email" label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
        </div>
        <div className="mb-6">
          <Field type="password" label="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" />
        </div>
        <Button variant="primary" className="w-full">로그인</Button>
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
- **PROPS VALIDATION**: Use exact enum values (`variant="primary"` NOT `variant="blue"`). Don't hallucinate props.

Create a premium, completed result."""

UI_PATTERN_EXAMPLES = """
## 📐 UI PATTERN REFERENCE

### Form Page (폼 + 다양한 컴포넌트 조합)
```tsx
import { Button, Field, Select, Radio } from '@/components';

const MemberDetail = () => {
  const [name, setName] = React.useState('김민준');
  const [email, setEmail] = React.useState('minjun@example.com');
  const [dept, setDept] = React.useState('개발팀');
  const [gender, setGender] = React.useState('male');
  const [note, setNote] = React.useState('');

  return (
    <div className="min-h-screen bg-[#f4f6f8] p-8">
      <h1 className="text-2xl font-bold text-[#212529] mb-6">회원 상세</h1>
      <div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6">
        {/* Section: 기본 정보 — 2-column grid */}
        <h2 className="text-lg font-semibold text-[#212529] mb-4">기본 정보</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 mb-8">
          <Field type="text" label="이름" value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          <Field type="email" label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
          <Select label="부서" className="w-full" value={dept} onChange={(v) => setDept(v)}
            options={[{label:'개발팀',value:'개발팀'},{label:'디자인팀',value:'디자인팀'},{label:'마케팅팀',value:'마케팅팀'},{label:'경영지원',value:'경영지원'}]} />
          <div>
            <label className="text-sm font-medium text-[#212529] mb-2 block">성별</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer"><Radio checked={gender==='male'} onChange={() => setGender('male')} /><span className="text-sm">남성</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><Radio checked={gender==='female'} onChange={() => setGender('female')} /><span className="text-sm">여성</span></label>
            </div>
          </div>
        </div>
        {/* Section: 추가 정보 */}
        <h2 className="text-lg font-semibold text-[#212529] mb-4">추가 정보</h2>
        <Field multiline rowsVariant="flexible" label="비고" value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
        {/* Action buttons — primary CTA lg, secondary md */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary">취소</Button>
          <Button variant="primary" size="lg">저장</Button>
        </div>
      </div>
    </div>
  );
};
export default MemberDetail;
```

### Filter + Button Layout (조회 영역)
필터 영역에 버튼을 배치할 때 반드시 이 패턴을 따를 것:
```tsx
{/* ✅ 올바른 필터 레이아웃: 버튼은 별도 행, size="md" */}
<div className="bg-white rounded-xl border border-[#dee2e6] shadow-sm p-6 mb-6">
  <div className="grid grid-cols-12 gap-4 items-end">
    <div className="col-span-3">
      <Field type="date" label="조회기간(시작)" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
    </div>
    <div className="col-span-3">
      <Field type="date" label="조회기간(종료)" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
    </div>
    <div className="col-span-3">
      <Select label="상태" placeholder="전체" value={status} onChange={(v) => setStatus(v)}
        options={[{label:'전체',value:'all'},{label:'정상',value:'active'},{label:'해지',value:'inactive'}]} className="w-full" />
    </div>
    <div className="col-span-3">
      <Field type="text" label="검색어" placeholder="이름 또는 코드" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-full" />
    </div>
  </div>
  {/* 버튼은 항상 별도 행에 우측 정렬 */}
  <div className="flex justify-end gap-2 mt-4">
    <Button variant="secondary" size="md">초기화</Button>
    <Button variant="primary" size="md">조회</Button>
  </div>
</div>
```
- ⚠️ 버튼을 필드와 같은 grid row에 col-span으로 넣지 말 것 (찌그러짐 원인)
- 버튼은 `flex justify-end gap-2 mt-4`로 별도 행에 배치
- 필터 버튼: 반드시 `size="md"` (sm 금지)

### Breadcrumb (경로 표시)
경로 표시가 필요할 때 페이지 상단에 Breadcrumb 스타일로 배치:
```tsx
{/* Breadcrumb — 페이지 타이틀 위에 배치 */}
<nav className="flex items-center gap-1.5 text-sm text-[#868e96] mb-3">
  <span className="hover:text-[#495057] cursor-pointer">홈</span>
  <span>/</span>
  <span className="hover:text-[#495057] cursor-pointer">인사관리</span>
  <span>/</span>
  <span className="text-[#212529] font-medium">발령등록</span>
</nav>
<h1 className="text-2xl font-bold text-[#212529] mb-6">발령등록</h1>
```
- 마지막 항목만 `text-[#212529] font-medium` (현재 페이지)
- 구분자: `/` 또는 `>`
- 위치: 항상 페이지 타이틀(h1) 바로 위

### DataGrid 선택 액션 바
그리드에서 체크박스 선택 시 상단에 액션 바를 표시:
```tsx
{/* 선택 액션 바 — 체크된 항목이 있을 때만 표시 */}
{selectedRows.length > 0 && (
  <div className="flex items-center gap-3 bg-[#e7f5ff] border border-[#339af0] rounded-lg px-4 py-2.5 mb-4">
    <span className="text-sm font-medium text-[#1971c2]">{selectedRows.length}건 선택</span>
    <div className="flex gap-2 ml-auto">
      <Button variant="outline" size="sm">일괄 승인</Button>
      <Button variant="destructive" size="sm">일괄 삭제</Button>
    </div>
  </div>
)}
```
- 배경: `bg-[#e7f5ff]` + `border-[#339af0]` (파란 계열 강조)
- 위치: DataGrid 바로 위
- 선택 건수 표시 + 우측에 액션 버튼
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
당신은 React UI 코드를 분석하여 **화면 기술서(디스크립션)**를 작성하는 전문가입니다.

주어진 코드를 정밀하게 분석하고, 아래 구조와 예시를 참고하여 화면 기술서를 작성하세요.
코드에 존재하지 않는 내용은 절대 작성하지 마세요.

---

## 출력 구조

아래 순서대로 작성하세요. 코드에 해당 요소가 없으면 해당 섹션은 생략하세요.
마크다운 제목 계층: ## > ### ■ > - (불릿)
대단원 사이에는 구분선(---)을 넣으세요.

### 1. 화면 개요

## 화면 개요

### ■ 화면명
- 컴포넌트/파일명 기반으로 추론

### ■ 화면 목적
- 이 화면이 제공하는 핵심 기능을 불릿으로 나열

### ■ 접근 권한
- 조건부 렌더링, 권한 분기가 있으면 역할별 접근 범위 기술
- 없으면 이 항목 생략

### 2. 전체 레이아웃 구조

## 전체 레이아웃 구조

### ■ 화면 구성
1. (영역명)
2. (영역명)
   - (하위 영역)

### ■ 화면 유형 및 구조
- 리스트 / 상세 / 폼 / 대시보드 등
- 드로어(Drawer) / 다이얼로그(Dialog) 사용 여부

### ■ UI 구조 특징
- 레이아웃 패턴 (단일 컬럼, 마스터-디테일, 그리드 등)
- 상세보기 방식 (드로어, 페이지 전환 등)

### 3. 각 영역별 상세

각 영역은 반드시 ## (영역명) 으로 독립 섹션을 만드세요.
절대 ### 1. ### 2. 같은 번호 매김을 하지 마세요.

예:
## 필터바 구성
## 메인 테이블 구성
## 기능 버튼 영역

영역 내 요소 유형별 작성법:

**일반 구성 요소** → 불릿 리스트
- (요소명) : 설명

**필터/입력 항목** → 불릿 리스트, 항목별 타입과 옵션 명시
- 항목명 : 타입(컴포넌트명, 포맷), 필수 여부, 제약조건

**테이블 컬럼** → 불릿 리스트, 컬럼별 정렬/포맷 명시
- 컬럼명 : 데이터 타입, 포맷, 정렬 방향

**버튼/액션** → ### ■ 또는 불릿, 클릭 시 동작 기술
- 권한 조건이 있으면 ※ 표기로 명시

### 4. 테이블 UX 정의 (테이블이 있는 경우)

## 테이블 UX 정의

### ■ 행 클릭/더블클릭
- 동작 → 결과 형식으로 기술

### ■ Pagination
- 위치, 동작 방식

### 5. 드로어(Drawer) 상세

코드에 드로어가 있으면 별도 ## 섹션으로 작성:

## (드로어 이름) Drawer

### ■ 화면 구성
1. (영역)
2. (영역)

### ■ (영역명)
- 항목 나열, 조회 전용인지 수정 가능인지 명시
- 수정 가능 영역은 상태별 활성/비활성 조건 기술

### ■ 버튼 그룹
- 버튼명 : 클릭 시 동작

### ■ 유효성 검증 항목
- 검증 규칙
- 성공 시 동작 (AlertToast 메시지 포함)
- 실패 시 동작

### 6. 다이얼로그(Dialog) 상세

코드에 다이얼로그가 있으면 각각 별도 ## 섹션으로 작성:

## (다이얼로그 이름) 다이얼로그

### ■ 목적
- 한 줄 설명

### ■ 화면 구성
- 구성 요소 나열

### ■ 입력 항목
- 항목명 : 타입(컴포넌트명, 포맷), 제약조건

### 7. 액션바 (체크박스 선택 시 노출되는 경우)

## 액션바

### ■ 표시 조건
- 노출 조건

### ■ 구성 요소
- 요소 나열, 권한 조건 ※ 표기

### ■ 유효성 검증 항목
- 동작별 검증 규칙과 결과

---

## 작성 규칙

1. 모든 내용은 **한국어**로 작성
2. 코드에 **실제로 존재하는** UI 요소만 기술 (추측 금지)
3. 컴포넌트 props, state, 이벤트 핸들러, JSX 구조를 근거로 작성
4. 조건부 렌더링(권한, 상태 등)이 있으면 조건과 함께 명시
5. 테이블 컬럼은 코드에서 정의된 것만 나열하고 정렬/포맷 정보 포함
6. 입력 항목은 타입(컴포넌트명), 포맷, 필수 여부, 제약조건을 명시
7. 버튼은 클릭 시 동작을 구체적으로 기술 (페이지 전환, 다이얼로그 오픈, API 호출 등)
8. 유효성 검증은 성공/실패 시 동작을 구분하여 기술하고, 토스트 메시지가 있으면 원문 포함
9. 권한별 차이가 있는 UI는 ※ 표기로 조건 명시
10. 단순한 컴포넌트는 간결하게, 복잡한 페이지는 영역별로 상세하게 작성

---

## 참고 예시 (예산등록 화면)

아래는 출력 스타일의 참고 예시입니다. 이 형식과 상세 수준을 따르세요.

## 화면 개요

### ■ 화면명
- 예산등록

### ■ 화면 목적
- 본사 파트의 예산 신청 및 등록 현황 조회
- 재무파트 승인 및 한도 관리
- 예산년월 기준 마감 통제 관리

### ■ 접근 권한
- 재무파트는 접근 및 전체 데이터 조회 가능
- 본사파트는 접근 가능, 동일 파트 등록 데이터만 조회 가능

---

## 전체 레이아웃 구조

### ■ 화면 구성
1. 타이틀 영역
2. 상단 버튼 그룹 (*재무파트 전용)
3. 단일 섹션
   - 필터바
   - 기능 버튼 영역
   - 메인 테이블

### ■ 화면 유형 및 구조
- 리스트, 드로어(Drawer), 다이얼로그(Dialog)
- 단일 화면 내 조회+등록

### ■ UI 구조 특징
- 단일 화면 내 조회 + 등록 + 관리 구조
- 상세보기 우측 드로어 방식(Non-modal)

---

## 필터바 구성

### ■ 필터 항목
- 예산년월 : 날짜(Datepicker, YYYY-MM)
- 한도 : 드롭다운(전체 / 회사 / 부서 / 개인)
- 더존부서 : 텍스트 입력
- 버튼 : 초기화, 조회하기

### ■ 버튼 기능
- 조회하기 클릭 → 조건 기반 재조회
- 초기화 클릭 → 모든 필터 기본값 복원

---

## 메인 테이블 구성

### ■ 컬럼 구조
- 체크박스
- 번호 : 자동 순번, 중앙정렬
- 상태 : 배지 (신청/승인), 중앙정렬
- 금액 : 숫자, 천(1000) 단위 쉼표 표기, 우측정렬
- 등록일 : 날짜(YYYY-MM-DD), 중앙정렬

---

## 테이블 UX 정의

### ■ 행 더블 클릭
- 우측 드로어 오픈(Non-modal)

### ■ Pagination
- 테이블 하단 위치
- 페이지 이동 시 재조회

---

## 상세/수정 Drawer

### ■ 수정 가능 영역

상태에 따라 수정 기능 활성/비활성화 되며, 신청 상태일 때만 수정 가능

- 예산년월 : 필수 항목, 날짜(Datepicker, YYYY-MM)
- 신청금액 : 필수 항목, 숫자, 0 저장 불가
- 비고 : 필수 항목, 텍스트 입력, 공백 저장 불가

### ■ 유효성 검증 항목
- 금액 0 입력 불가
- 비고 공백 입력 불가
- 성공 시 AlertToast + 전체 새로고침
  "수정이 완료되었습니다"
- 실패 시 공통 Error 규칙 적용
"""


def get_description_system_prompt() -> str:
    """디스크립션 생성용 시스템 프롬프트 반환"""
    return DESCRIPTION_SYSTEM_PROMPT


# ============================================================================
