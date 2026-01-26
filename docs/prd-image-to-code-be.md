# PRD: Image-to-Code (Backend)

> UI 디자인 이미지와 프롬프트를 입력받아 React TypeScript 코드를 생성하는 Vision AI 기능

## 1. 개요

### 1.1 기능 설명
UI 디자인 이미지와 프롬프트를 입력받아 React TypeScript 코드를 생성하는 Vision AI 기능

### 1.2 지원 모드
| 모드 | 설명 | AI 동작 |
|------|------|---------|
| **1-Step (Direct)** | 이미지 → 바로 코드 생성 | Vision API 1회 호출 |
| **2-Step (Analyze)** | 이미지 분석 → JSON 반환 → 코드 생성 | Vision API 2회 호출 |

---

## 2. 워크플로우

### 2.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  1. 사용자: 이미지 선택 + 프롬프트 입력 + 모드 선택              │
│                          ↓                                       │
│  2. ChatInput: 이미지 → base64 변환                             │
│                          ↓                                       │
│  3. useVisionChat: POST /api/chat/vision 호출                   │
│                          ↓                                       │
│  4. API Route: AI Server로 프록시                               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                            │
├─────────────────────────────────────────────────────────────────┤
│  5. /chat/vision: 이미지 + 프롬프트 수신                        │
│                          ↓                                       │
│  6. AI Provider: Claude/GPT Vision API 호출                     │
│                          ↓                                       │
│  7. StreamingParser: 응답 파싱 (chat/code/analysis 이벤트)      │
│                          ↓                                       │
│  8. SSE 스트리밍 응답                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  9. useVisionChat: SSE 이벤트 처리                              │
│      - chat → 텍스트 누적 표시                                  │
│      - code → 코드 저장 + 프리뷰                                │
│      - analysis → 분석 결과 표시 (2-Step)                       │
│      - done → 완료 처리                                         │
│                          ↓                                       │
│  10. PreviewSection: 생성된 코드 렌더링                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Backend 내부 처리 흐름

```
POST /chat/vision
       │
       ▼
┌──────────────────┐
│ Request 검증     │ VisionChatRequest 스키마
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Room 조회        │ Firestore에서 schema_key 확인
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ System Prompt    │ Vision용 프롬프트 + 컴포넌트 카탈로그
│ 생성             │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Conversation     │ 기존 대화 히스토리 로드
│ History 구성     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ AI Provider      │ chat_vision_stream() 호출
│ Vision 호출      │ (Anthropic 또는 OpenAI)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ StreamingParser  │ <file> 태그 파싱
│ 응답 파싱        │ chat/code/analysis 이벤트 생성
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ SSE 스트리밍     │ data: {...}\n\n 형식
│ 응답 전송        │
└──────────────────┘
```

### 2.3 1-Step vs 2-Step 분기

```
                    mode?
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
    mode=direct               mode=analyze
         │                         │
         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐
│ Vision API 호출 │     │ Vision API 호출 │
│ (코드 생성)     │     │ (분석만)        │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ chat + code     │     │ analysis 이벤트 │
│ 이벤트 스트리밍 │     │ 스트리밍        │
└─────────────────┘     └─────────────────┘
                              │
                              ▼ (사용자 확인 후)
                        ┌─────────────────┐
                        │ 2차 API 호출    │
                        │ (분석 기반 코드)│
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ chat + code     │
                        │ 이벤트 스트리밍 │
                        └─────────────────┘
```

---

## 3. API 스펙

### 3.1 엔드포인트

**POST /chat/vision**

### 3.2 요청 스키마

```python
class ImageContent(BaseModel):
    """Base64 인코딩된 이미지"""
    type: Literal["image"] = "image"
    media_type: Literal["image/jpeg", "image/png", "image/gif", "image/webp"]
    data: str  # base64 데이터 (data:... prefix 없이)

class VisionChatRequest(BaseModel):
    """Vision 채팅 요청"""
    message: str = Field(..., min_length=1, max_length=10000)
    room_id: str
    images: list[ImageContent] = Field(default_factory=list, max_length=5)
    mode: Literal["direct", "analyze"] = "direct"
    stream: bool = True
```

### 3.3 응답 (SSE 스트리밍)

```
data: {"type": "chat", "text": "모던한 "}
data: {"type": "chat", "text": "로그인 페이지입니다."}
data: {"type": "code", "path": "src/pages/Login.tsx", "content": "..."}
data: {"type": "analysis", "data": {"layout": {...}, "components": [...]}}
data: {"type": "done"}
```

### 3.4 에러 응답

```json
{
  "detail": [
    {
      "loc": ["body", "images"],
      "msg": "최대 5개 이미지만 허용됩니다",
      "type": "value_error"
    }
  ]
}
```

---

## 4. 스키마 정의

### 4.1 수정 파일: `app/schemas/chat.py`

```python
from typing import Literal
from pydantic import BaseModel, Field

# ===== 신규 추가 =====

class ImageContent(BaseModel):
    """Base64 인코딩된 이미지"""
    type: Literal["image"] = "image"
    media_type: Literal["image/jpeg", "image/png", "image/gif", "image/webp"] = Field(
        ...,
        description="이미지 MIME 타입",
    )
    data: str = Field(
        ...,
        description="Base64 인코딩된 이미지 데이터 (data: prefix 제외)",
    )


class VisionChatRequest(BaseModel):
    """Vision 채팅 요청"""
    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="사용자 프롬프트",
    )
    room_id: str = Field(..., description="채팅방 ID")
    images: list[ImageContent] = Field(
        default_factory=list,
        max_length=5,
        description="이미지 목록 (최대 5개)",
    )
    mode: Literal["direct", "analyze"] = Field(
        default="direct",
        description="생성 모드: direct(1-Step), analyze(2-Step)",
    )
    stream: bool = Field(default=True, description="스트리밍 여부")


class ImageAnalysis(BaseModel):
    """이미지 분석 결과 (2-Step 모드)"""
    layout: dict = Field(..., description="레이아웃 구조")
    components: list[dict] = Field(..., description="감지된 컴포넌트 목록")
    colors: dict = Field(..., description="색상 팔레트")
    typography: dict = Field(..., description="타이포그래피 정보")


class VisionStreamEvent(BaseModel):
    """Vision SSE 이벤트"""
    type: Literal["chat", "code", "analysis", "done", "error"]
    text: str | None = None
    path: str | None = None
    content: str | None = None
    data: ImageAnalysis | None = None
    error: str | None = None
```

---

## 5. AI Provider 확장

### 5.1 수정 파일: `app/services/ai_provider.py`

```python
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.schemas.chat import Message, ImageContent

settings = get_settings()


class AIProvider(ABC):
    """AI 프로바이더 추상 클래스"""

    @abstractmethod
    async def chat(self, messages: list[Message]) -> tuple[Message, dict | None]:
        pass

    @abstractmethod
    async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
        pass

    # ===== 신규 추가 =====
    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
    ) -> AsyncGenerator[str, None]:
        """Vision API 스트리밍 (기본: 미지원)"""
        raise NotImplementedError("Vision not supported by this provider")
        yield  # Generator 타입 힌트용


class AnthropicProvider(AIProvider):
    """Anthropic Claude 프로바이더"""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    # 기존 chat, chat_stream 메서드 유지...

    # ===== 신규 추가 =====
    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
    ) -> AsyncGenerator[str, None]:
        """Claude Vision API 스트리밍"""
        system_message = ""
        chat_messages: list[dict[str, Any]] = []

        for m in messages:
            if m.role == "system":
                system_message = m.content
            elif m.role == "user":
                # 멀티모달 컨텐츠 블록 구성
                content_blocks: list[dict[str, Any]] = []

                # 이미지 추가
                for img in images:
                    content_blocks.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img.media_type,
                            "data": img.data,
                        },
                    })

                # 텍스트 추가
                content_blocks.append({
                    "type": "text",
                    "text": m.content,
                })

                chat_messages.append({
                    "role": "user",
                    "content": content_blocks,
                })
            else:
                chat_messages.append({
                    "role": m.role,
                    "content": m.content,
                })

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=8192,  # 코드 생성을 위해 증가
            system=system_message if system_message else None,
            messages=chat_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text


class OpenAIProvider(AIProvider):
    """OpenAI GPT 프로바이더"""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    # 기존 chat, chat_stream 메서드 유지...

    # ===== 신규 추가 =====
    async def chat_vision_stream(
        self,
        messages: list[Message],
        images: list[ImageContent],
    ) -> AsyncGenerator[str, None]:
        """GPT-4o Vision API 스트리밍"""
        chat_messages: list[dict[str, Any]] = []

        for m in messages:
            if m.role == "user" and images:
                # 멀티모달 컨텐츠 배열
                content: list[dict[str, Any]] = []

                # 이미지 추가
                for img in images:
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{img.media_type};base64,{img.data}",
                            "detail": "high",
                        },
                    })

                # 텍스트 추가
                content.append({
                    "type": "text",
                    "text": m.content,
                })

                chat_messages.append({"role": "user", "content": content})
            else:
                chat_messages.append({"role": m.role, "content": m.content})

        stream = await self.client.chat.completions.create(
            model="gpt-4o",  # Vision 지원 모델
            messages=chat_messages,
            max_tokens=8192,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

---

## 6. Vision 엔드포인트

### 6.1 수정 파일: `app/api/chat.py`

```python
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.auth import verify_api_key
from app.schemas.chat import VisionChatRequest, Message
from app.services.ai_provider import get_ai_provider
from app.services.firestore import get_chat_room
from app.api.components import get_vision_system_prompt, resolve_system_prompt

router = APIRouter(prefix="/chat", tags=["Chat"])


# ===== 신규 추가 =====
@router.post("/vision", dependencies=[Depends(verify_api_key)])
async def chat_vision(request: VisionChatRequest):
    """
    이미지 + 텍스트 → React 코드 생성 (SSE 스트리밍)

    - mode=direct: 바로 코드 생성
    - mode=analyze: 분석 결과 반환 (JSON)
    """
    provider = get_ai_provider()

    # Room에서 schema_key 조회
    room = await get_chat_room(request.room_id)
    schema_key = room.get("schema_key") if room else None

    # Vision 시스템 프롬프트 생성
    system_prompt = await get_vision_system_prompt(schema_key, request.mode)

    # 대화 히스토리 구성
    messages = await build_vision_conversation(
        room_id=request.room_id,
        system_prompt=system_prompt,
        current_message=request.message,
    )

    async def generate():
        parser = StreamingParser()

        try:
            async for chunk in provider.chat_vision_stream(messages, request.images):
                events = parser.process_chunk(chunk)
                for event in events:
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

            # 남은 버퍼 처리
            final_events = parser.flush()
            for event in final_events:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

            yield f'data: {{"type": "done"}}\n\n'

        except Exception as e:
            yield f'data: {{"type": "error", "error": "{str(e)}"}}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


async def build_vision_conversation(
    room_id: str,
    system_prompt: str,
    current_message: str,
) -> list[Message]:
    """Vision 대화 히스토리 구성"""
    messages = [Message(role="system", content=system_prompt)]

    # 기존 대화 히스토리 로드 (이미지 제외, 텍스트만)
    # ... 기존 build_conversation_history 로직 재사용

    messages.append(Message(role="user", content=current_message))
    return messages
```

---

## 7. Vision 시스템 프롬프트

### 7.1 수정 파일: `app/api/components.py`

```python
from datetime import datetime

# ===== 신규 추가 =====

VISION_SYSTEM_PROMPT_HEADER = """You are a premium UI/UX expert AI specializing in converting design images to React code.
Current time: {current_date}

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
- Use Tailwind CSS for styling
- Import components from @/components
- Use <file path="...">...</file> tags for code output
- Generate complete, runnable code (no placeholders)
- Follow React best practices (hooks, functional components)
"""

VISION_ANALYSIS_PROMPT = """
Analyze this UI design image and return ONLY a valid JSON object.

Required JSON structure:
{
  "layout": {
    "type": "flex" | "grid" | "stack",
    "direction": "row" | "column",
    "gap": "spacing value (e.g., 16px, 1rem)",
    "alignment": "start" | "center" | "end" | "between"
  },
  "components": [
    {
      "type": "component name",
      "props": { "key": "value" },
      "children": "text content or null",
      "position": { "x": 0, "y": 0, "width": 100, "height": 50 }
    }
  ],
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "text": "#hex"
  },
  "typography": {
    "heading": { "size": "24px", "weight": 700 },
    "body": { "size": "16px", "weight": 400 }
  }
}

Do NOT include any explanation. Return ONLY the JSON object.
"""


async def get_vision_system_prompt(schema_key: str | None, mode: str) -> str:
    """Vision 모드용 시스템 프롬프트 생성"""
    current_date = datetime.now().strftime("%Y-%m-%d %H:%M KST")
    base_prompt = VISION_SYSTEM_PROMPT_HEADER.replace("{current_date}", current_date)

    # 컴포넌트 스키마 로드
    if schema_key:
        schema = await fetch_schema_from_storage(schema_key)
        component_docs = format_component_docs(schema)
        available_note = get_available_components_note(schema)
    else:
        component_docs = ""
        available_note = "Use standard React components with Tailwind CSS."

    if mode == "analyze":
        # 2-Step: 분석만 수행
        return base_prompt + "\n" + available_note + "\n" + VISION_ANALYSIS_PROMPT
    else:
        # 1-Step: 바로 코드 생성
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
```

---

## 8. 구현 순서

| Phase | 작업 | 파일 | 우선순위 |
|-------|------|------|----------|
| 1 | ImageContent, VisionChatRequest 스키마 | `app/schemas/chat.py` | HIGH |
| 2 | ImageAnalysis, VisionStreamEvent 스키마 | `app/schemas/chat.py` | HIGH |
| 3 | AIProvider.chat_vision_stream 추상 메서드 | `app/services/ai_provider.py` | HIGH |
| 4 | AnthropicProvider.chat_vision_stream | `app/services/ai_provider.py` | HIGH |
| 5 | OpenAIProvider.chat_vision_stream | `app/services/ai_provider.py` | MEDIUM |
| 6 | Vision 시스템 프롬프트 | `app/api/components.py` | HIGH |
| 7 | POST /chat/vision 엔드포인트 | `app/api/chat.py` | HIGH |
| 8 | main.py 라우터 등록 확인 | `app/main.py` | HIGH |

---

## 9. 환경 변수

```bash
# 기존 키 재사용 (Vision 지원 모델)
ANTHROPIC_MODEL=claude-sonnet-4-5    # Vision 지원
OPENAI_MODEL=gpt-4o                   # Vision 지원

# 신규 (선택)
VISION_MAX_TOKENS=8192
VISION_MAX_IMAGES=5
```

---

## 10. 검증 방법

```bash
# 1. 개발 서버 실행
uv run uvicorn app.main:app --reload --port 8000

# 2. API 테스트 (이미지 base64 준비 필요)
curl -X POST http://localhost:8000/chat/vision \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "message": "이 디자인을 React 코드로 만들어줘",
    "room_id": "test-room",
    "images": [{
      "type": "image",
      "media_type": "image/png",
      "data": "iVBORw0KGgo..."
    }],
    "mode": "direct"
  }'

# 3. SSE 스트리밍 확인
# data: {"type": "chat", "text": "..."}
# data: {"type": "code", "path": "...", "content": "..."}
# data: {"type": "done"}

# 4. OpenAPI 문서 확인
# http://localhost:8000/docs
```

---

## 11. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 대용량 이미지 | 타임아웃, 메모리 | max_tokens 증가, 이미지 크기 제한 |
| Vision API 비용 | 운영 비용 증가 | 이미지 수 제한 (5개), 캐싱 고려 |
| 일관성 없는 출력 | UX 저하 | 상세 시스템 프롬프트, 2-Step 모드 |
| Provider 미지원 | Gemini 등 | NotImplementedError 처리 |
