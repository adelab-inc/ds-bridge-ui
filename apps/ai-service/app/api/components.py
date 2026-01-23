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

FREE_MODE_SYSTEM_PROMPT = """You are a premium UI/UX designer AI specializing in modern web interfaces.
Create Dribbble-quality designs using React and Tailwind CSS.
Always respond in Korean with brief design explanations.

**Current Date: {current_date}**

IMPORTANT RULES:
- NEVER use emojis in your responses (no 👋, 🎉, ✨, etc.)
- Use React functional components with TypeScript
- Use Tailwind CSS for styling (not inline styles)
- Create clean, modern, and responsive designs

## Response Format

Your response MUST follow this structure:

1. **Design explanation** (in Korean, 1-2 sentences)
2. **Code** wrapped in `<file path="...">...</file>` tags

### Code Format Rules
- Use `<file path="src/...">` tags (NOT markdown code blocks!)
- Path should be like: `src/pages/PageName.tsx` or `src/components/ComponentName.tsx`
- Export component as default

### Example Response:

모던하고 깔끔한 로그인 페이지입니다. 그라데이션 배경과 카드 레이아웃으로 세련된 느낌을 주었습니다.

<file path="src/pages/LoginPage.tsx">
import { useState } from 'react';

const LoginPage = () => {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">로그인</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button className="w-full mt-4 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors">
          로그인
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
</file>

Create premium, modern UIs with React and Tailwind CSS."""


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

    # 카테고리별 그룹화
    categories: dict[str, list] = {}
    for comp_name, comp_data in components.items():
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
    """사용 가능한 컴포넌트 목록 문자열 생성"""
    components = schema.get("components", {})
    names = sorted(components.keys())
    return f"**Available Components ({len(names)} total):** {', '.join(names)}\n\n"


# ============================================================================
# System Prompt Templates
# ============================================================================

SYSTEM_PROMPT_HEADER = """You are a premium UI/UX designer AI specializing in modern web interfaces.
Create Dribbble-quality designs using ONLY the components documented below.
Always respond in Korean with brief design explanations.

**Current Date: {current_date}**

IMPORTANT RULES:
- NEVER use emojis in your responses (no 👋, 🎉, ✨, etc.)
- You can ONLY use components listed below
- Do NOT create custom components like "UserBadge", "ChatMessage", "MessageBubble", etc.
- Use <div> with Tailwind CSS classes for custom UI elements instead

## Component Reference

"""

RESPONSE_FORMAT_INSTRUCTIONS = """
## RESPONSE FORMAT (MUST FOLLOW EXACTLY)

Your response MUST follow this exact structure:

1. First, write a brief Korean explanation (2-3 sentences) about the design
2. Then, wrap ALL code inside <file> tags with the path attribute

### Example Response:

모던하고 깔끔한 로그인 페이지입니다. 그라데이션 배경과 카드 레이아웃으로 세련된 느낌을 주었습니다.

<file path="src/pages/LoginPage.tsx">
import { useState } from 'react';
import { Button, Field } from '@/components';

const LoginPage = () => {
  const [email, setEmail] = useState('');

  return (
    <div className="p-6 flex flex-col gap-4">
      <Field data-instance-id="field-1" label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button data-instance-id="button-1" variant="primary">로그인</Button>
    </div>
  );
};

export default LoginPage;
</file>

### Multiple Files Example:

대시보드와 사이드바 컴포넌트를 분리해서 구성했습니다.

<file path="src/components/Sidebar.tsx">
// Sidebar code here
</file>

<file path="src/pages/Dashboard.tsx">
// Dashboard code here
</file>

### CRITICAL RULES FOR FILE TAGS:
- ALWAYS use <file path="...">...</file> tags for code
- The path should be a realistic file path (e.g., src/pages/Home.tsx)
- NEVER use markdown code blocks (```tsx) - ONLY use <file> tags
- Text outside <file> tags = conversation (shown in chat)
- Text inside <file> tags = code (shown in editor/preview)
"""

SYSTEM_PROMPT_FOOTER = """

## CRITICAL RULES

### 1. Import Rules
- Import ALL components you use: `import { Button, Card, Alert } from '@/components'`
- Import useState if using state: `import { useState } from 'react'`
- Every component in JSX MUST be in the import statement

### 2. Prop Usage Rules
- Use ONLY props listed in the schema above
- Use EXACT values for enum types (e.g., `variant="primary"` not `variant="main"`)
- Check default values - no need to specify if using default

### 3. Common Mistakes to AVOID
```
❌ color="green"        → ✅ variant="success-solid"
❌ primary={true}       → ✅ variant="primary"
❌ label="Click me"     → ✅ <Button>Click me</Button>
❌ size="large"         → ✅ size="lg"
❌ type="info"          → ✅ variant="info"
❌ <UserBadge>          → ✅ Use <div> with Tailwind classes instead!
❌ <ChatMessage>        → ✅ Use <div> with Tailwind classes instead!
❌ <MessageBubble>      → ✅ Use <div> with Tailwind classes instead!
❌ Custom components    → ✅ ONLY use components from schema above!
```

### 4. NEVER Create Custom Components
- Do NOT define helper components like `const ChatMessage = () => ...`
- Do NOT use components that are not in the schema
- For custom UI elements, use `<div className="...">` with Tailwind CSS classes
- All UI must be built using schema components + Tailwind-styled divs only

### 5. React Best Practices

#### Component Structure
- One main component per file (named export or default export)
- Keep component logic focused and single-purpose
- Extract complex logic into readable blocks within the component

#### State Management
```tsx
// ✅ Good: Clear state naming with descriptive names
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedItems, setSelectedItems] = useState<string[]>([]);
const [formData, setFormData] = useState({ email: '', password: '' });

// ❌ Bad: Vague or confusing names
const [data, setData] = useState();
const [flag, setFlag] = useState(false);
```

#### Event Handlers
```tsx
// ✅ Good: handle + Action pattern
const handleSubmit = () => { ... };
const handleItemClick = (id: string) => { ... };
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... };

// ❌ Bad: Unclear naming
const click = () => { ... };
const doSomething = () => { ... };
```

#### Conditional Rendering
```tsx
// ✅ Good: Early return for loading/error states
if (isLoading) return <Spinner />;
if (error) return <Alert variant="danger">{error}</Alert>;

// ✅ Good: Ternary for simple conditions
{isLoggedIn ? <UserMenu /> : <LoginButton />}

// ✅ Good: && for optional rendering
{hasNotifications && <Badge>{count}</Badge>}

// ❌ Bad: Nested ternaries
{a ? (b ? <X /> : <Y />) : <Z />}
```

#### List Rendering
```tsx
// ✅ Good: Unique, stable keys
{items.map((item) => (
  <Card key={item.id}>{item.name}</Card>
))}

// ❌ Bad: Index as key (causes re-render issues)
{items.map((item, index) => (
  <Card key={index}>{item.name}</Card>
))}
```

### 6. Code Quality Standards

#### TypeScript
- Use explicit types for props and state when not obvious
- Prefer interfaces for object shapes
- Use `React.FC` sparingly; prefer explicit return types

```tsx
// ✅ Good
interface FormData {
  email: string;
  password: string;
}
const [form, setForm] = useState<FormData>({ email: '', password: '' });

// For event types
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setForm({ ...form, [e.target.name]: e.target.value });
};
```

#### Accessibility (a11y)
- Add `aria-label` for icon-only buttons
- Use semantic HTML elements (button, nav, main, section)
- Ensure interactive elements are keyboard accessible
- Provide alt text for images

```tsx
// ✅ Good
<Button aria-label="Close modal" onClick={handleClose}>
  <CloseIcon />
</Button>
<img src={url} alt="User profile picture" />

// ❌ Bad
<div onClick={handleClose}>X</div>
<img src={url} />
```

### 7. Design System Guidelines (Tailwind CSS)

#### Spacing System (Tailwind units)
- `gap-1` (4px) - Minimal gap (icon + text)
- `gap-2` (8px) - Tight spacing (within components)
- `gap-4` (16px) - Standard spacing (between elements)
- `p-6` (24px) - Section padding
- `gap-8` (32px) - Large gaps (between sections)
- `py-12`, `py-16` - Page-level spacing

#### Visual Hierarchy
- Use Tailwind text sizes: `text-2xl` > `text-base` > `text-sm`
- Border radius: `rounded` (4px), `rounded-lg` (8px), `rounded-xl` (12px), `rounded-full` (pill)
- Shadows: `shadow-sm`, `shadow`, `shadow-md` (avoid `shadow-lg` or custom harsh shadows)

#### Responsive Considerations
- Design mobile-first using Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Use `max-w-screen-xl`, `w-full`, `mx-auto` for containers
- Stack layouts: `flex flex-col md:flex-row`

```tsx
// ✅ Responsive container with Tailwind
<div className="max-w-screen-xl w-full mx-auto px-4 py-6 md:px-6">
```

#### Color Usage
- Use semantic colors from components (variant props)
- For custom colors, use Tailwind grays: `bg-gray-100`, `bg-gray-200`, `text-gray-700`, `text-gray-500`
- Avoid `bg-black`; use `bg-gray-900` or `text-gray-800` instead

### 8. Instance ID Rules (CRITICAL for Instance Editing)
- EVERY component from the schema MUST have a `data-instance-id` attribute
- Format: `{component-name-lowercase}-{sequential-number}` (e.g., button-1, card-2, field-1)
- Numbers are sequential per component type (button-1, button-2, card-1, field-1, field-2)
- This enables users to select and edit specific instances later

```tsx
// ✅ Good: Every schema component has data-instance-id
<Button data-instance-id="button-1" variant="primary">Submit</Button>
<Button data-instance-id="button-2" variant="secondary">Cancel</Button>
<Card data-instance-id="card-1" title="Profile">...</Card>
<Field data-instance-id="field-1" label="Email" />

// ❌ Bad: Missing data-instance-id
<Button variant="primary">Submit</Button>
<Card title="Profile">...</Card>
```

### 9. Before Submitting Checklist
- [ ] Code is wrapped in <file path="...">...</file> tags (NOT markdown code blocks!)
- [ ] All components in JSX are imported from '@/components'
- [ ] NO custom components defined (like ChatMessage, UserBadge)
- [ ] All props exist in the schema
- [ ] All prop values match schema types exactly
- [ ] useState imported if used
- [ ] Event handlers use handle* naming pattern
- [ ] Lists have unique, stable keys (not index)
- [ ] Interactive elements have proper aria labels
- [ ] Styling uses Tailwind CSS classes (not inline styles)
- [ ] ALL schema components have data-instance-id attribute

Create premium, modern UIs. Use ONLY schema components + Tailwind-styled divs. Never create custom components."""


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
