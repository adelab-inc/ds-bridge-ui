from google.genai._interactions.types import Content
import json
import logging
import re
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.components import (
    generate_system_prompt,
    get_schema,
    get_vision_system_prompt,
)
from app.core.auth import verify_api_key
from app.core.config import get_settings
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    CurrentComposition,
    EnhancePromptRequest,
    EnhancePromptResponse,
    FileContent,
    ImageContent,
    Message,
    ParsedResponse,
    PromptSuggestion,
)
from app.services.ai_provider import get_ai_provider
from app.services.firebase_storage import (
    DEFAULT_AG_GRID_SCHEMA_KEY,
    fetch_ag_grid_tokens_from_storage,
    fetch_all_layouts_from_storage,
    fetch_component_definitions_from_storage,
    fetch_design_tokens_from_storage,
    fetch_image_as_base64,
    fetch_schema_from_storage,
)
from app.services.firestore import (
    FirestoreError,
    RoomNotFoundError,
    create_chat_message,
    get_chat_room,
    get_message_by_id,
    get_messages_by_room,
    get_messages_until,
    get_timestamp_ms,
    update_chat_message,
)

router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


# ============================================================================
# System Prompt Helper
# ============================================================================


def build_instance_edit_context(
    composition: CurrentComposition,
    selected_id: str,
) -> str:
    """
    선택된 인스턴스 편집을 위한 컨텍스트 생성

    Args:
        composition: 현재 렌더링된 컴포넌트 구조
        selected_id: 선택된 인스턴스 ID

    Returns:
        인스턴스 편집 모드 컨텍스트 문자열
    """
    # 선택된 인스턴스 찾기
    selected = None
    for instance in composition.instances:
        if instance.id == selected_id:
            selected = instance
            break

    if not selected:
        return ""

    # composition을 dict로 변환
    composition_dict = {
        "instances": [
            {"id": inst.id, "component": inst.component, "props": inst.props}
            for inst in composition.instances
        ]
    }

    return f"""

## INSTANCE EDIT MODE (인스턴스 편집 모드)

사용자가 특정 컴포넌트 인스턴스를 선택했습니다. 해당 인스턴스만 수정하세요.

### 선택된 인스턴스
- **ID**: {selected.id}
- **Component**: {selected.component}
- **Current Props**:
```json
{json.dumps(selected.props, indent=2, ensure_ascii=False)}
```

### 전체 Composition (현재 화면 상태)
```json
{json.dumps(composition_dict, indent=2, ensure_ascii=False)}
```

### 인스턴스 편집 규칙 (CRITICAL)

1. **수정 범위**: 선택된 인스턴스({selected.id})의 props만 수정
2. **원본 보존**: 컴포넌트 정의(스키마)는 절대 변경 금지
3. **다른 인스턴스**: 다른 인스턴스는 변경하지 않음
4. **응답 형식**: 전체 코드를 다시 생성하되, 선택된 인스턴스의 props만 변경
5. **NO IMPORTS**: import 문을 절대 사용하지 마세요. React.useState, React.useEffect 등 직접 사용

예시) "배경색 파란색으로" 요청 시:
- 변경 전: `<Button data-instance-id="{selected.id}" variant="primary">로그인</Button>`
- 변경 후: `<Button data-instance-id="{selected.id}" variant="primary" className="bg-blue-500">로그인</Button>`

사용자의 요청에 따라 선택된 인스턴스({selected.id})만 수정하세요.
"""


async def resolve_system_prompt(
    schema_key: str | None,
    current_composition: CurrentComposition | None = None,
    selected_instance_id: str | None = None,
) -> str:
    """
    schema_key 여부에 따라 시스템 프롬프트 반환

    Args:
        schema_key: Firebase Storage 스키마 경로 (None이면 로컬 스키마 사용)
        current_composition: 현재 렌더링된 컴포넌트 구조 (인스턴스 편집용)
        selected_instance_id: 선택된 인스턴스 ID (인스턴스 편집용)

    Returns:
        시스템 프롬프트 문자열
    """
    # 디자인 토큰 로드 (실패 시 기본값 사용)
    design_tokens = await fetch_design_tokens_from_storage()

    # AG Grid 스키마 및 토큰 로드 (실패 시 None, 프롬프트에서 생략됨)
    ag_grid_schema = None
    ag_grid_tokens = None
    try:
        ag_grid_schema = await fetch_schema_from_storage(DEFAULT_AG_GRID_SCHEMA_KEY)
        ag_grid_tokens = await fetch_ag_grid_tokens_from_storage()
    except Exception as e:
        logger.warning("AG Grid data not loaded", extra={"error": str(e)})

    # 컴포넌트 정의 로드 (실패 시 None, 프롬프트에서 생략됨)
    component_definitions = None
    try:
        component_definitions = await fetch_component_definitions_from_storage()
    except Exception as e:
        logger.warning("Component definitions not loaded", extra={"error": str(e)})

    # 레이아웃 로드 (실패 시 빈 리스트, 프롬프트에서 생략됨)
    layouts: list[dict] = []
    try:
        layouts = await fetch_all_layouts_from_storage()
        if layouts:
            logger.info("Layouts loaded", extra={"count": len(layouts)})
    except Exception as e:
        logger.warning("Layouts not loaded", extra={"error": str(e)})

    # 기본 프롬프트 생성
    if not schema_key:
        # 로컬 스키마 사용
        local_schema = get_schema()
        if not local_schema:
            raise HTTPException(
                status_code=500, detail="No schema available. Please upload a schema first."
            )
        base_prompt = generate_system_prompt(
            local_schema, design_tokens, ag_grid_schema, ag_grid_tokens, layouts, component_definitions
        )
    else:
        try:
            schema = await fetch_schema_from_storage(schema_key)
            base_prompt = generate_system_prompt(
                schema, design_tokens, ag_grid_schema, ag_grid_tokens, layouts, component_definitions
            )
        except FileNotFoundError:
            logger.warning("Schema not found, using local", extra={"schema_key": schema_key})
            local_schema = get_schema()
            if not local_schema:
                raise HTTPException(
                    status_code=404, detail=f"Schema not found: {schema_key}"
                )
            base_prompt = generate_system_prompt(
                local_schema, design_tokens, ag_grid_schema, ag_grid_tokens, layouts, component_definitions
            )
        except Exception as e:
            logger.error("Failed to fetch schema", extra={"schema_key": schema_key, "error": str(e)})
            raise HTTPException(
                status_code=500, detail="Failed to load schema from storage. Please try again."
            ) from e

    # 인스턴스 편집 모드면 컨텍스트 추가
    if current_composition and selected_instance_id:
        instance_context = build_instance_edit_context(
            current_composition,
            selected_instance_id,
        )
        base_prompt += instance_context

    return base_prompt


async def build_conversation_history(
    room_id: str,
    system_prompt: str,
    current_message: str,
    from_message_id: str | None = None,
) -> list[Message]:
    """
    이전 대화 내역을 포함한 메시지 리스트 생성

    Args:
        room_id: 채팅방 ID
        system_prompt: 시스템 프롬프트
        current_message: 현재 사용자 메시지
        from_message_id: 특정 메시지의 코드를 기준으로 수정 + 해당 시점까지 컨텍스트 포함

    Returns:
        AI에 전달할 메시지 리스트
    """
    settings = get_settings()
    max_history = settings.max_history_count

    messages = [Message(role="system", content=system_prompt)]

    # 기준 코드 컨텍스트 (from_message_id가 있을 때)
    base_code_context = ""

    # 이전 메시지 조회
    if from_message_id:
        # 롤백 모드: 특정 메시지까지만 조회
        previous_messages = await get_messages_until(
            room_id=room_id,
            until_message_id=from_message_id,
            limit=max_history,
        )
        logger.info(
            "Base code edit mode enabled",
            extra={"room_id": room_id, "from_message_id": from_message_id, "message_count": len(previous_messages)},
        )

        # 기준 메시지의 코드 가져오기
        base_message = await get_message_by_id(from_message_id)
        if base_message is None:
            raise ValueError(f"Message not found: {from_message_id}")

        if base_message.get("content"):
            base_code_context = f'''현재 코드 (이 코드를 기반으로 수정해주세요):
<file path="{base_message.get("path", "src/Component.tsx")}">{base_message["content"]}</file>

요청: '''
            logger.info(
                "Base code context added",
                extra={"from_message_id": from_message_id, "path": base_message.get("path")},
            )
    else:
        # 일반 모드: 최근 N개 조회
        previous_messages = await get_messages_by_room(room_id)
        previous_messages = previous_messages[-max_history:]

    for msg in previous_messages:
        # 사용자 질문
        if msg.get("question"):
            messages.append(Message(role="user", content=msg["question"]))

        # AI 응답 (텍스트 + 코드 결합)
        assistant_content = msg.get("text", "")
        if msg.get("content") and msg.get("path"):
            assistant_content += f'\n\n<file path="{msg["path"]}">{msg["content"]}</file>'

        if assistant_content.strip():
            messages.append(Message(role="assistant", content=assistant_content.strip()))

    # 현재 사용자 메시지 추가 (기준 코드 컨텍스트 포함)
    final_message = base_code_context + current_message
    messages.append(Message(role="user", content=final_message))

    return messages


# ============================================================================
# Response Parsing Utilities
# ============================================================================

FILE_TAG_PATTERN = re.compile(r'<file\s+path="([^"]+)">([\s\S]*?)</file>')


def parse_ai_response(content: str) -> ParsedResponse:
    """
    AI 응답에서 대화 내용과 파일을 분리

    Args:
        content: AI 응답 전체 텍스트

    Returns:
        ParsedResponse with conversation and files separated
    """
    files: list[FileContent] = []

    # <file path="...">...</file> 태그 추출
    for match in FILE_TAG_PATTERN.finditer(content):
        files.append(
            FileContent(
                path=match.group(1),
                content=match.group(2).strip(),
            )
        )

    # 태그 제거한 나머지 = 대화 내용
    conversation = FILE_TAG_PATTERN.sub("", content).strip()

    return ParsedResponse(
        conversation=conversation,
        files=files,
        raw=content,
    )


class StreamingParser:
    """스트리밍 응답에서 실시간으로 텍스트/코드 분리"""

    # 정규식 패턴 (클래스 수준에서 미리 컴파일)
    FILE_START_PATTERN = re.compile(r'<file\s+path="([^"]+)">')
    FILE_END_PATTERN = re.compile(r"</file>")

    def __init__(self):
        self.buffer = ""
        self.inside_file = False
        self.current_file_path: str | None = None
        self.current_file_content = ""

    def process_chunk(self, chunk: str) -> list[dict]:
        """
        청크 처리 후 이벤트 목록 반환

        Returns:
            List of events: {'type': 'chat'|'code', ...}
        """
        self.buffer += chunk
        events: list[dict] = []

        while True:
            if not self.inside_file:
                # 파일 태그 시작 감지
                start_match = self.FILE_START_PATTERN.search(self.buffer)
                if start_match:
                    # 태그 이전 텍스트 = 대화
                    before_tag = self.buffer[: start_match.start()]
                    if before_tag:
                        events.append({"type": "chat", "text": before_tag})

                    # 파일 모드 시작
                    self.inside_file = True
                    self.current_file_path = start_match.group(1)
                    self.current_file_content = ""
                    self.buffer = self.buffer[start_match.end() :]
                else:
                    # < 가 있으면 태그 시작일 수 있으므로 그 이전까지만 전송
                    tag_start = self.buffer.rfind("<")
                    if tag_start > 0:
                        events.append({"type": "chat", "text": self.buffer[:tag_start]})
                        self.buffer = self.buffer[tag_start:]
                    elif tag_start == -1 and self.buffer:
                        # < 가 없으면 전체를 대화로 즉시 전송
                        events.append({"type": "chat", "text": self.buffer})
                        self.buffer = ""
                    break
            else:
                # 파일 태그 종료 감지
                end_match = self.FILE_END_PATTERN.search(self.buffer)
                if end_match:
                    # 파일 내용 완성
                    self.current_file_content += self.buffer[: end_match.start()]
                    events.append(
                        {
                            "type": "code",
                            "path": self.current_file_path,
                            "content": self.current_file_content.strip(),
                        }
                    )

                    # 파일 모드 종료
                    self.inside_file = False
                    self.current_file_path = None
                    self.current_file_content = ""
                    self.buffer = self.buffer[end_match.end() :]
                else:
                    # 파일 내용 계속 버퍼링
                    break

        return events

    def flush(self) -> list[dict]:
        """남은 버퍼 처리 (스트리밍 종료 시 호출)"""
        events: list[dict] = []
        remaining = self.buffer.strip()
        if remaining and not self.inside_file:
            events.append({"type": "chat", "text": remaining})
        return events


# ============================================================================
# API Endpoints
# ============================================================================


@router.post(
    "",
    response_model=ChatResponse,
    summary="AI 채팅 (Non-streaming)",
    description="""
자연어로 UI를 설명하면 React TSX 코드를 생성합니다.

## 요청 예시
```json
{
  "message": "로그인 페이지 만들어줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 응답 구조
- `message`: AI 원본 응답
- `parsed.conversation`: 한국어 설명
- `parsed.files`: 생성된 코드 파일 목록
- `usage`: 토큰 사용량

## room_id
채팅방 ID (필수). 메시지가 해당 채팅방에 저장됩니다.

## 스키마 모드
채팅방의 schema_key가 설정되어 있으면 Firebase Storage에서 컴포넌트 스키마를 로드합니다.
없으면 자유 모드(React + Tailwind CSS)로 동작합니다.

## from_message_id (선택)
특정 메시지의 코드를 기준으로 수정합니다. 해당 메시지까지의 컨텍스트를 사용하고, 그 메시지의 코드를 기반으로 AI가 수정합니다.
```json
{
  "message": "버튼을 빨간색으로 바꿔줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "from_message_id": "886e7406-55f7-4582-9f4b-7a56ec4562d8"
}
```
""",
    response_description="AI 응답 및 파싱된 결과",
    responses={
        200: {"description": "성공"},
        400: {"description": "잘못된 요청 (stream=true인 경우)"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "AI API 호출 실패"},
    },
)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    AI 채팅 API (Non-streaming)

    디자인 시스템 컴포넌트를 기반으로 React UI 코드를 생성합니다.
    응답의 `parsed` 필드에서 대화 내용과 코드 파일이 분리되어 제공됩니다.

    스트리밍 응답이 필요한 경우 `/stream` 엔드포인트를 사용하세요.

    채팅방의 schema_key가 설정되어 있으면 Firebase Storage에서 스키마를 로드합니다.
    """
    try:
        if request.stream:
            raise HTTPException(
                status_code=400,
                detail="Use /stream endpoint for streaming responses",
            )

        # room 조회 및 검증
        room = await get_chat_room(request.room_id)
        if room is None:
            raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {request.room_id}")

        question_created_at = get_timestamp_ms()

        provider = get_ai_provider()
        system_prompt = await resolve_system_prompt(
            schema_key=room.get("schema_key"),
            current_composition=request.current_composition,
            selected_instance_id=request.selected_instance_id,
        )

        # 이전 대화 내역 포함하여 메시지 빌드
        messages = await build_conversation_history(
            room_id=request.room_id,
            system_prompt=system_prompt,
            current_message=request.message,
            from_message_id=request.from_message_id,
        )

        response_message, usage = await provider.chat(messages)
        parsed = parse_ai_response(response_message.content)

        # Firestore에 메시지 저장 (question + text + code 하나의 문서로)
        first_file = parsed.files[0] if parsed.files else None
        await create_chat_message(
            room_id=request.room_id,
            question=request.message,
            text=parsed.conversation,
            content=first_file.content if first_file else "",
            path=first_file.path if first_file else "",
            question_created_at=question_created_at,
            status="DONE",
        )

        return ChatResponse(message=response_message, parsed=parsed, usage=usage)
    except HTTPException:
        raise
    except RoomNotFoundError as e:
        raise HTTPException(status_code=404, detail="Chat room not found.") from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except FirestoreError as e:
        logger.error("Firestore error in chat", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Database error. Please try again.") from e
    except Exception as e:
        logger.error("Unexpected error in chat", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again."
        ) from e


@router.post(
    "/stream",
    summary="AI 채팅 (Streaming)",
    description="""
SSE(Server-Sent Events)를 통해 실시간 스트리밍 응답을 받습니다.
이미지가 포함되면 Vision 모드로 동작합니다.

## 요청 예시 (텍스트만)
```json
{
  "message": "로그인 페이지 만들어줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 요청 예시 (이미지 포함 - Vision 모드)
먼저 `/chat/images`로 이미지를 업로드한 후 URL을 사용합니다.

```json
{
  "message": "이 디자인을 React 코드로 만들어줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "image_urls": [
    "https://storage.googleapis.com/bucket/user_uploads/room-id/1234_uuid.png"
  ]
}
```

## 이벤트 타입

| 타입 | 설명 | 필드 |
|------|------|------|
| `start` | 스트리밍 시작 | `message_id` |
| `chat` | 대화 텍스트 (실시간) | `text` |
| `code` | 코드 파일 (완성 후) | `path`, `content` |
| `done` | 스트리밍 완료 | `message_id` |
| `error` | 오류 발생 | `error` |

## SSE 응답 예시
```
data: {"type": "start", "message_id": "abc-123-def"}

data: {"type": "chat", "text": "모던한 "}

data: {"type": "chat", "text": "로그인 페이지입니다."}

data: {"type": "code", "path": "src/pages/Login.tsx", "content": "import..."}

data: {"type": "done", "message_id": "abc-123-def"}
```

## 제한 (Vision 모드)
- 최대 5개 이미지
- 지원 형식: JPEG, PNG, GIF, WebP

## from_message_id (선택)
특정 메시지의 코드를 기준으로 수정합니다. 해당 메시지까지의 컨텍스트를 사용하고, 그 메시지의 코드를 기반으로 AI가 수정합니다.
```json
{
  "message": "버튼을 빨간색으로 바꿔줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "from_message_id": "886e7406-55f7-4582-9f4b-7a56ec4562d8"
}
```
""",
    response_description="SSE 스트림",
    responses={
        200: {
            "description": "SSE 스트림",
            "content": {
                "text/event-stream": {
                    "example": 'data: {"type": "chat", "text": "모던한 로그인"}\n\ndata: {"type": "done"}\n\n'
                }
            },
        },
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "AI API 호출 실패"},
    },
)
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """
    AI 채팅 API (Streaming) - 하이브리드 방식

    - 대화 텍스트는 실시간으로 스트리밍됩니다 (타이핑 효과)
    - 코드 파일은 완성된 후 한 번에 전송됩니다 (파싱 안정성)
    - 이미지가 포함되면 Vision 모드로 동작합니다

    채팅방의 schema_key가 설정되어 있으면 Firebase Storage에서 스키마를 로드합니다.
    """
    try:
        # Vision 모드 여부 판단
        is_vision_mode = bool(request.image_urls and len(request.image_urls) > 0)

        # 이미지 URL에서 base64로 변환 (Vision 모드인 경우)
        images: list[ImageContent] = []
        if is_vision_mode:
            for url in request.image_urls:  # type: ignore
                try:
                    base64_data, media_type = await fetch_image_as_base64(url)
                    images.append(ImageContent(media_type=media_type, data=base64_data))
                except Exception as e:
                    logger.warning("Failed to fetch image", extra={"url": url, "error": str(e)})
                    # 실패한 이미지는 건너뛰고 계속 진행

            # 모든 이미지 로드 실패 시 일반 모드로 전환
            if not images:
                is_vision_mode = False
                logger.warning("All images failed, falling back to normal mode", extra={"room_id": request.room_id})

        # 1. room 조회 및 검증
        room = await get_chat_room(request.room_id)
        if room is None:
            raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {request.room_id}")

        question_created_at = get_timestamp_ms()

        # 2. GENERATING 상태로 메시지 먼저 생성
        question_text = request.message
        if is_vision_mode:
            question_text = f"[이미지 {len(images)}개] {request.message}"

        message_data = await create_chat_message(
            room_id=request.room_id,
            question=question_text,
            question_created_at=question_created_at,
            status="GENERATING",
            image_urls=request.image_urls if is_vision_mode else None,
        )
        message_id = message_data["id"]

        # 3. AI Provider 초기화
        provider = get_ai_provider()

        # 4. 시스템 프롬프트 생성 (Vision/일반 모드에 따라 분기)
        if is_vision_mode:
            # Vision 모드에서도 컴포넌트 정의 로드
            vision_component_definitions = None
            try:
                vision_component_definitions = await fetch_component_definitions_from_storage()
            except Exception as e:
                logger.warning("Component definitions not loaded for vision", extra={"error": str(e)})

            system_prompt = await get_vision_system_prompt(
                schema_key=room.get("schema_key"),
                image_urls=request.image_urls,
                component_definitions=vision_component_definitions,
            )
        else:
            system_prompt = await resolve_system_prompt(
                schema_key=room.get("schema_key"),
                current_composition=request.current_composition,
                selected_instance_id=request.selected_instance_id,
            )

        # 5. 이전 대화 내역 포함하여 메시지 빌드
        messages = await build_conversation_history(
            room_id=request.room_id,
            system_prompt=system_prompt,
            current_message=request.message,
            from_message_id=request.from_message_id,
        )

        async def generate() -> AsyncGenerator[str, None]:
            parser = StreamingParser()
            collected_text = ""
            collected_files: list[dict] = []

            # 스트리밍 시작 시 message_id 전송
            yield f"data: {json.dumps({'type': 'start', 'message_id': message_id}, ensure_ascii=False)}\n\n"

            try:
                # Vision/일반 모드에 따라 스트리밍 호출
                if is_vision_mode:
                    stream = provider.chat_vision_stream(messages, images)
                else:
                    stream = provider.chat_stream(messages)

                async for chunk in stream:
                    events = parser.process_chunk(chunk)
                    for event in events:
                        # 이벤트 수집
                        if event["type"] == "chat":
                            collected_text += event.get("text", "")
                        elif event["type"] == "code":
                            collected_files.append(event)

                        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

                # 남은 버퍼 처리
                final_events = parser.flush()
                for event in final_events:
                    if event["type"] == "chat":
                        collected_text += event.get("text", "")
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

                # 완료 시 DONE으로 업데이트
                first_file = collected_files[0] if collected_files else None
                await update_chat_message(
                    message_id=message_id,
                    text=collected_text.strip(),
                    content=first_file.get("content", "") if first_file else "",
                    path=first_file.get("path", "") if first_file else "",
                    status="DONE",
                )

                yield f"data: {json.dumps({'type': 'done', 'message_id': message_id}, ensure_ascii=False)}\n\n"

            except NotImplementedError:
                # Vision 미지원 Provider
                logger.error("Vision not supported", extra={"room_id": request.room_id, "provider": get_settings().ai_provider})
                await update_chat_message(message_id=message_id, status="ERROR")
                error_event = {
                    "type": "error",
                    "error": "현재 AI 프로바이더는 Vision 기능을 지원하지 않습니다.",
                }
                yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
            except Exception as e:
                # 에러 시 ERROR로 업데이트
                logger.error("Streaming error", extra={"room_id": request.room_id, "message_id": message_id, "error": str(e)})
                await update_chat_message(message_id=message_id, status="ERROR")
                error_event = {
                    "type": "error",
                    "error": "An error occurred during streaming. Please try again.",
                }
                yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except RoomNotFoundError as e:
        raise HTTPException(status_code=404, detail="Chat room not found.") from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except FirestoreError as e:
        logger.error("Firestore error in chat_stream", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Database error. Please try again.") from e
    except Exception as e:
        logger.error("Unexpected error in chat_stream", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again."
        ) from e


# ============================================================================
# Prompt Enhancement
# ============================================================================


@router.post(
    "/enhance-prompt",
    response_model=EnhancePromptResponse,
    summary="프롬프트 변환 (기획자 → 개발자용)",
    description="""
기획자가 입력한 짧은 프롬프트를 디자인 시스템 용어로 구체화합니다.

## 사용 사례
- 기획자: "로그인 페이지" (짧고 추상적)
- 변환 후: "Button(variant=primary), Field(type=email) 컴포넌트를 사용한 로그인 페이지..." (구체적)

## 상세도 수준
- `low`: 간단한 설명 추가
- `medium`: 컴포넌트와 기본 레이아웃 제안
- `high`: 매우 구체적 (props, 상태, 에러 처리 등)

## 요청 예시
```json
{
  "message": "로그인 페이지",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "detail_level": "medium"
}
```

## 응답 예시
```json
{
  "original": "로그인 페이지",
  "enhanced": "모던한 로그인 페이지를 만들어주세요...",
  "suggestions": [
    {"text": "소셜 로그인 버튼 추가", "priority": "medium"}
  ],
  "components_used": ["Button", "Field"]
}
```
""",
    responses={
        200: {"description": "변환 성공"},
        404: {"description": "채팅방을 찾을 수 없음"},
        500: {"description": "AI API 호출 실패"},
    },
)
async def enhance_prompt(request: EnhancePromptRequest) -> EnhancePromptResponse:
    """
    기획자 프롬프트를 디자인 시스템 용어로 변환

    AI를 사용하여 짧은 프롬프트를 컴포넌트 스키마 기반으로 구체화합니다.
    """
    try:
        # room 조회 및 검증
        room = await get_chat_room(request.room_id)
        if room is None:
            raise RoomNotFoundError(f"채팅방을 찾을 수 없습니다: {request.room_id}")

        provider = get_ai_provider()

        # 컴포넌트 정의 로드
        component_definitions = None
        try:
            component_definitions = await fetch_component_definitions_from_storage()
        except Exception as e:
            logger.warning("Component definitions not loaded", extra={"error": str(e)})

        # 프롬프트 변환용 시스템 프롬프트 생성
        enhancement_system_prompt = await build_enhancement_system_prompt(
            room.get("schema_key"),
            request.detail_level,
            component_definitions,
        )

        # AI에게 프롬프트 변환 요청
        messages = [
            Message(role="system", content=enhancement_system_prompt),
            Message(role="user", content=request.message),
        ]

        response_message, _ = await provider.chat(messages)

        # 응답 파싱
        enhanced_response = parse_enhancement_response(
            original=request.message,
            ai_response=response_message.content,
        )

        return enhanced_response

    except HTTPException:
        raise
    except RoomNotFoundError as e:
        raise HTTPException(status_code=404, detail="Chat room not found.") from e
    except Exception as e:
        logger.error("Unexpected error in enhance_prompt", extra={"room_id": request.room_id, "error": str(e)})
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred. Please try again."
        ) from e


async def build_enhancement_system_prompt(
    schema_key: str | None,
    detail_level: str,
    component_definitions: dict | None = None,
) -> str:
    """
    프롬프트 변환용 시스템 프롬프트 생성

    Args:
        schema_key: Firebase Storage 스키마 경로
        detail_level: 상세도 수준 (low, medium, high)
        component_definitions: 컴포넌트 정의 JSON

    Returns:
        시스템 프롬프트 문자열
    """
    # 컴포넌트 상세 정보 생성
    components_info = ""
    if component_definitions:
        components_info = format_component_info(component_definitions, max_components=15)
    else:
        # 폴백: 기본 컴포넌트 정보
        components_info = """**Button**
  - variants: primary, secondary, tertiary
  - sizes: small, medium, large
  - optional: onClick, disabled, children

**Field**
  - optional: label, placeholder, error, onChange

**Card**
  - optional: title, children

**Table**
  - required: columns, data
  - optional: onRowClick

**Select**
  - required: options
  - optional: label, placeholder, onChange"""

    # 상세도별 지침
    detail_instructions = {
        "low": "간단하고 핵심적인 설명만 추가하세요.",
        "medium": "컴포넌트와 기본 레이아웃을 제안하세요. 주요 props를 명시하세요.",
        "high": "매우 구체적으로 작성하세요. props, variant, 상태, 에러 처리, 반응형 디자인까지 포함하세요.",
    }

    prompt = f"""당신은 UI/UX 기획 전문가입니다. 기획자가 입력한 짧은 프롬프트를 개발자가 바로 사용할 수 있는 구체적인 프롬프트로 변환하세요.

## 디자인 시스템 컴포넌트

{components_info}

## 변환 규칙

1. **컴포넌트 명시**: 어떤 컴포넌트를 사용할지 구체적으로 제안
2. **디자인 시스템 용어 사용**: variant, size 같은 props 포함
3. **레이아웃 설명**: 배치와 구조 명확히
4. **상세도**: {detail_instructions.get(detail_level, detail_instructions["medium"])}

## 응답 형식 (JSON)
{{
  "enhanced": "구체화된 프롬프트 (마크다운 형식)",
  "suggestions": [
    {{"text": "추가 제안 1", "priority": "high|medium|low"}},
    {{"text": "추가 제안 2", "priority": "medium"}}
  ],
  "components_used": ["Button", "Field"]
}}

## 예시

입력: "로그인 페이지"

출력:
{{
  "enhanced": "모던한 로그인 페이지를 만들어주세요.\\n\\n**사용할 컴포넌트:**\\n- Field (label='이메일', placeholder='example@email.com', type='email')\\n- Field (label='비밀번호', type='password')\\n- Button (variant='primary', children='로그인')\\n- Link (href='/forgot-password', children='비밀번호를 잊으셨나요?')\\n\\n**레이아웃:**\\n- Card 컴포넌트로 폼 영역 감싸기\\n- 중앙 정렬 (max-width: 400px)\\n- 모바일 반응형 적용\\n\\n**상호작용:**\\n- Field onChange로 실시간 유효성 검사\\n- Button onClick으로 로그인 처리\\n- 로딩 중에는 Button disabled 상태",
  "suggestions": [
    {{"text": "소셜 로그인 버튼 추가 (IconButton 사용)", "priority": "medium"}},
    {{"text": "비밀번호 표시/숨김 토글", "priority": "medium"}},
    {{"text": "로그인 유지 Checkbox", "priority": "low"}}
  ],
  "components_used": ["Button", "Field", "Card", "Link"]
}}

이제 사용자의 짧은 프롬프트를 구체화하세요. 반드시 JSON 형식으로만 응답하세요."""

    return prompt


def parse_enhancement_response(
    original: str,
    ai_response: str,
) -> EnhancePromptResponse:
    """
    AI 응답을 EnhancePromptResponse로 파싱

    Args:
        original: 원본 프롬프트
        ai_response: AI의 JSON 응답

    Returns:
        EnhancePromptResponse 객체
    """
    try:
        # JSON 추출 (코드 블록 제거)
        json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', ai_response)
        if json_match:
            json_str = json_match.group(1)
        else:
            # 코드 블록 없이 바로 JSON인 경우
            json_str = ai_response.strip()

        data = json.loads(json_str)

        # PromptSuggestion 객체로 변환
        suggestions = [
            PromptSuggestion(
                text=s.get("text", ""),
                priority=s.get("priority", "medium"),
            )
            for s in data.get("suggestions", [])
        ]

        return EnhancePromptResponse(
            original=original,
            enhanced=data.get("enhanced", ""),
            suggestions=suggestions,
            components_used=data.get("components_used", []),
        )

    except Exception as e:
        logger.error("Failed to parse enhancement response", extra={"error": str(e), "response": ai_response})
        # 파싱 실패 시 기본 응답
        return EnhancePromptResponse(
            original=original,
            enhanced=f"**{original}**에 대한 UI를 만들어주세요.\n\n디자인 시스템의 컴포넌트를 활용하여 구현해주세요.",
            suggestions=[],
            components_used=[],
        )


def format_component_info(component_definitions: dict, max_components: int = 15) -> str:
    """
    컴포넌트 정의를 읽기 쉬운 형식으로 변환

    Args:
        component_definitions: 컴포넌트 정의 JSON
        max_components: 최대 표시할 컴포넌트 수

    Returns:
        포맷팅된 컴포넌트 정보 문자열
    """
    components = component_definitions.get("components", {})

    # 주요 컴포넌트 우선 순위
    priority_components = [
        "Button", "Field", "Card", "Table", "Select",
        "Checkbox", "Radio", "IconButton", "Link", "Badge"
    ]

    # 우선 순위 컴포넌트 먼저, 나머지는 알파벳 순
    sorted_names = []
    for name in priority_components:
        if name in components:
            sorted_names.append(name)

    for name in sorted(components.keys()):
        if name not in sorted_names:
            sorted_names.append(name)

    # 제한된 수만큼만 선택
    selected_names = sorted_names[:max_components]

    result = []
    for name in selected_names:
        comp = components[name]
        props = comp.get("props", {})

        # variant 정보 추출
        variants = []
        sizes = []
        required_props = []
        optional_props = []

        for prop_name, prop_info in props.items():
            prop_type = prop_info.get("type")
            is_required = prop_info.get("required", False)

            # variant 옵션 추출
            if prop_name == "variant" and isinstance(prop_type, list):
                variants = prop_type
            elif prop_name == "size" and isinstance(prop_type, list):
                sizes = prop_type
            elif is_required:
                required_props.append(prop_name)
            else:
                # 주요 선택 props만 포함
                if prop_name in ["onClick", "onChange", "disabled", "placeholder", "label", "error", "children"]:
                    optional_props.append(prop_name)

        # 컴포넌트 정보 포맷팅
        comp_info = [f"**{name}**"]

        if variants:
            comp_info.append(f"  - variants: {', '.join(variants)}")
        if sizes:
            comp_info.append(f"  - sizes: {', '.join(sizes)}")
        if required_props:
            comp_info.append(f"  - required: {', '.join(required_props)}")
        if optional_props:
            comp_info.append(f"  - optional: {', '.join(optional_props[:5])}")  # 최대 5개

        result.append("\n".join(comp_info))

    return "\n\n".join(result)


