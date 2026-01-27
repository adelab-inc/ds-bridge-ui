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
- **폼 레이아웃**: `display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:24`
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


def get_free_mode_system_prompt() -> str:
    """스키마 제약 없는 자유로운 시스템 프롬프트 반환"""
    current_date = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")
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


# ============================================================================
# System Prompt Templates
# ============================================================================

SYSTEM_PROMPT_HEADER = """You are an expert Frontend Engineer specializing in building pixel-perfect, production-ready React components.
Your goal is to satisfy the user's request with high-quality, complete, and robust code.
Always respond in Korean.

**Current Date: {current_date}**

## 🧠 THOUGHT PROCESS (MUST EXECUTE INTERNALLY)
Before generating any code, you must:
1. **Analyze Intent**: What is the core feature? What are the key interactions?
2. **Component Strategy**: Which design system components fit best? (e.g., Use `Button` vs `IconButton`)
3. **State Management**: What `useState` hooks are needed? (e.g., loading, open/close, input values)
4. **Layout Plan**: How to structure the `div`s for proper spacing and alignment?

## � DESIGN STANDARDS (CRITICAL)
- **Typography (MUST FOLLOW)**:
  - Font Family: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - **Headings**: `letterSpacing: '-0.025em'` (Use tight tracking), `color: '#111827'`
  - **Body**: `lineHeight: 1.6`, `color: '#374151'` (Never use pure black)
  - **Caption**: `fontSize: 12`, `color: '#6b7280'`
- **Visuals**:
  - **Shadows**: Soft & Layered. `boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)'`
  - **Borders**: Subtle. `border: '1px solid #e5e7eb'`
  - **Radius**: `borderRadius: 8px` (Small components), `12px` (Cards/Containers)
- **Content (다양한 데이터 생성)**:
  - 요청 맥락에 맞는 **새로운 한국어 데이터** 생성 (예시 데이터 그대로 복사 금지)
  - 이름: 다양한 한국 이름 (박준혁, 최수민, 정하은, 강도윤 등 자유롭게)
  - 회사: 맥락에 맞게 (스타트업, 대기업, 기관명 등 다양하게)
  - 숫자: 현실적인 범위 (₩50,000 ~ ₩10,000,000)
  - NEVER: "Lorem ipsum", "테스트", "샘플", "예시" 금지
- **Spacing**:
  - **섹션 간**: `marginBottom: 32px`
  - **폼 행 간**: `marginBottom: 24px`
- **Form Layout (CSS Grid 사용 - 겹침 방지)**:
  - **컨테이너**: `display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24`
  - **필드**: 각 필드는 `<div>` 안에 `<label>` + `<input>` 구조
  - **input/select**: `width: '100%', boxSizing: 'border-box'`
  - **한 행에 최대 4-5개 필드** (넘으면 자동 줄바꿈)
  - **금지**: `position: absolute`, 음수 margin, flex 레이아웃 (폼에서)

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
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto', fontFamily: '-apple-system, sans-serif' }}>
      {/* Header Section */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.025em', marginBottom: 8 }}>사용자 관리</h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>팀원들의 권한과 상태를 관리하세요.</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginBottom: 24 }}>
        <input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 검색..."
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontSize: 14,
            outline: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        />
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {['all', 'active', 'offline'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: '10px 16px',
                backgroundColor: filter === status ? '#f3f4f6' : 'white',
                border: 'none',
                borderRight: '1px solid #e5e7eb',
                fontSize: 14,
                fontWeight: 500,
                color: filter === status ? '#111827' : '#6b7280',
                cursor: 'pointer'
              }}
            >
              {status === 'all' ? '전체' : status === 'active' ? '활동중' : '오프라인'}
            </button>
          ))}
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
1. **DO EXACTLY WHAT IS ASKED**: Focus on the requested feature.
2. **COMPLETE CODE**: All buttons must work, all inputs must be controlled.
3. **IMPORT**: `import { Button } from '@/components'` / React hooks: `React.useState`.
4. **STYLING**: Inline styles only (`style={{ ... }}`), NO emojis, Desktop-first.

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


def generate_system_prompt(schema: dict) -> str:
    """
    주어진 스키마로 시스템 프롬프트 동적 생성

    Args:
        schema: 컴포넌트 스키마 dict

    Returns:
        생성된 시스템 프롬프트 문자열 (현재 날짜 포함)
    """
    component_docs = format_component_docs(schema)
    available_components = get_available_components_note(schema)
    current_date = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y-%m-%d %H:%M KST")

    return (
        SYSTEM_PROMPT_HEADER.replace("{current_date}", current_date)
        + available_components
        + component_docs
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
