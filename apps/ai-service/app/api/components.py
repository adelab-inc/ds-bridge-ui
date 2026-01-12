import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import verify_api_key
from app.schemas.chat import ReloadResponse

router = APIRouter(dependencies=[Depends(verify_api_key)])


# ============================================================================
# Schema Loading
# ============================================================================


def load_component_schema():
    """컴포넌트 스키마 JSON 로드"""
    schema_path = Path(__file__).parent.parent.parent / "component-schema.json"
    if not schema_path.exists():
        return None, "No component schema found."

    with open(schema_path, encoding="utf-8") as f:
        return json.load(f), None


# ============================================================================
# Schema → Prompt Formatting
# ============================================================================


def format_prop_type(prop_type, max_values: int = 5) -> str:
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

IMPORTANT RULES:
- NEVER use emojis in your responses (no 👋, 🎉, ✨, etc.)
- You can ONLY use components listed below
- Do NOT create custom components like "UserBadge", "ChatMessage", "MessageBubble", etc.
- Use <div> with inline styles for custom UI elements instead

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
    <div style={{ padding: 24 }}>
      <Field label="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button variant="primary">로그인</Button>
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
❌ <UserBadge>          → ✅ Use <div> with inline styles instead!
❌ <ChatMessage>        → ✅ Use <div> with inline styles instead!
❌ <MessageBubble>      → ✅ Use <div> with inline styles instead!
❌ Custom components    → ✅ ONLY use components from schema above!
```

### 4. NEVER Create Custom Components
- Do NOT define helper components like `const ChatMessage = () => ...`
- Do NOT use components that are not in the schema
- For custom UI elements, use `<div style={{...}}>` directly in JSX
- All UI must be built using schema components + styled divs only

### 5. Design Guidelines
- Use consistent spacing: 8, 16, 24, 32px
- Apply visual hierarchy with proper sizing
- Use subtle shadows and clean typography
- Consider hover/active states for interactive elements
- Images: `https://picsum.photos/WIDTH/HEIGHT?random=N`

### 6. Before Submitting Checklist
- [ ] Code is wrapped in <file path="...">...</file> tags (NOT markdown code blocks!)
- [ ] All components in JSX are imported from '@/components'
- [ ] NO custom components defined (like ChatMessage, UserBadge)
- [ ] All props exist in the schema
- [ ] All prop values match schema types exactly
- [ ] useState imported if used

Create premium, modern UIs. Use ONLY schema components + styled divs. Never create custom components."""


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
    """현재 시스템 프롬프트 반환 (로컬 스키마 기반)"""
    return SYSTEM_PROMPT


def generate_system_prompt(schema: dict) -> str:
    """
    주어진 스키마로 시스템 프롬프트 동적 생성

    Args:
        schema: 컴포넌트 스키마 dict

    Returns:
        생성된 시스템 프롬프트 문자열
    """
    component_docs = format_component_docs(schema)
    available_components = get_available_components_note(schema)

    return (
        SYSTEM_PROMPT_HEADER
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
    "/schema",
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
async def reload_components():
    """
    컴포넌트 스키마 리로드

    서버 재시작 없이 component-schema.json을 다시 로드합니다.
    디자인 시스템 컴포넌트가 추가/변경된 경우 이 엔드포인트를 호출하세요.
    """
    global _schema, _error, COMPONENT_DOCS, AVAILABLE_COMPONENTS, SYSTEM_PROMPT

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
