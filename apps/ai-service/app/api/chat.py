import json
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.components import generate_system_prompt, get_system_prompt
from app.core.auth import verify_api_key
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    FileContent,
    Message,
    ParsedResponse,
)
from app.services.ai_provider import get_ai_provider
from app.services.firebase_storage import fetch_schema_from_storage
from app.services.firestore import create_chat_message

router = APIRouter(dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


# ============================================================================
# System Prompt Helper
# ============================================================================


async def resolve_system_prompt(schema_key: str | None) -> str:
    """
    schema_key 유무에 따라 시스템 프롬프트 반환

    Args:
        schema_key: Firebase Storage 경로 (None이면 로컬 스키마 사용)

    Returns:
        시스템 프롬프트 문자열
    """
    if not schema_key:
        return get_system_prompt()

    try:
        schema = await fetch_schema_from_storage(schema_key)
        return generate_system_prompt(schema)
    except FileNotFoundError:
        logger.warning("Schema not found: %s, using local schema", schema_key)
        return get_system_prompt()
    except Exception as e:
        logger.error("Failed to fetch schema: %s - %s", schema_key, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load schema from storage: {str(e)}"
        ) from e


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

    # <file 태그 감지를 위한 최소 버퍼 크기
    TAG_BUFFER_SIZE = 30

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
                start_match = re.search(r'<file\s+path="([^"]+)">', self.buffer)
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
                end_match = re.search(r"</file>", self.buffer)
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
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "schema_key": "schemas/component-schema.json"
}
```

## 응답 구조
- `message`: AI 원본 응답
- `parsed.conversation`: 한국어 설명
- `parsed.files`: 생성된 코드 파일 목록
- `usage`: 토큰 사용량

## room_id
채팅방 ID (필수). 메시지가 해당 채팅방에 저장됩니다.

## schema_key
Firebase Storage에서 컴포넌트 스키마를 로드합니다. 생략 시 로컬 스키마 사용.
""",
    response_description="AI 응답 및 파싱된 결과",
    responses={
        200: {"description": "성공"},
        400: {"description": "잘못된 요청 (stream=true인 경우)"},
        500: {"description": "AI API 호출 실패"},
    },
)
async def chat(request: ChatRequest):
    """
    AI 채팅 API (Non-streaming)

    디자인 시스템 컴포넌트를 기반으로 React UI 코드를 생성합니다.
    응답의 `parsed` 필드에서 대화 내용과 코드 파일이 분리되어 제공됩니다.

    스트리밍 응답이 필요한 경우 `/stream` 엔드포인트를 사용하세요.

    schema_key가 제공되면 Firebase Storage에서 스키마를 로드합니다.
    """
    try:
        if request.stream:
            raise HTTPException(
                status_code=400,
                detail="Use /stream endpoint for streaming responses",
            )

        question_created_at = datetime.now(timezone.utc).isoformat()

        provider = get_ai_provider()
        system_prompt = await resolve_system_prompt(request.schema_key)
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=request.message),
        ]

        response_message, usage = await provider.chat(messages)
        parsed = parse_ai_response(response_message.content)

        # Firestore에 메시지 저장
        # 1. 텍스트 응답 저장
        if parsed.conversation:
            await create_chat_message(
                room_id=request.room_id,
                msg_type="text",
                text=parsed.conversation,
                question_created_at=question_created_at,
                answer_completed=True,
            )

        # 2. 코드 파일들 저장
        for file in parsed.files:
            await create_chat_message(
                room_id=request.room_id,
                msg_type="code",
                path=file.path,
                content=file.content,
                question_created_at=question_created_at,
                answer_completed=True,
            )

        return ChatResponse(message=response_message, parsed=parsed, usage=usage)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/stream",
    summary="AI 채팅 (Streaming)",
    description="""
SSE(Server-Sent Events)를 통해 실시간 스트리밍 응답을 받습니다.

## 요청 예시
```json
{
  "message": "로그인 페이지 만들어줘",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "schema_key": "schemas/component-schema.json"
}
```

## 이벤트 타입

| 타입 | 설명 | 필드 |
|------|------|------|
| `chat` | 대화 텍스트 (실시간) | `text` |
| `code` | 코드 파일 (완성 후) | `path`, `content` |
| `done` | 스트리밍 완료 | - |
| `error` | 오류 발생 | `error` |

## SSE 응답 예시
```
data: {"type": "chat", "text": "모던한 "}

data: {"type": "chat", "text": "로그인 페이지입니다."}

data: {"type": "code", "path": "src/pages/Login.tsx", "content": "import..."}

data: {"type": "done"}
```

## room_id
채팅방 ID (필수). 스트리밍 완료 후 메시지가 해당 채팅방에 저장됩니다.
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
        500: {"description": "AI API 호출 실패"},
    },
)
async def chat_stream(request: ChatRequest):
    """
    AI 채팅 API (Streaming) - 하이브리드 방식

    - 대화 텍스트는 실시간으로 스트리밍됩니다 (타이핑 효과)
    - 코드 파일은 완성된 후 한 번에 전송됩니다 (파싱 안정성)

    schema_key가 제공되면 Firebase Storage에서 스키마를 로드합니다.
    """
    try:
        question_created_at = datetime.now(timezone.utc).isoformat()

        provider = get_ai_provider()
        system_prompt = await resolve_system_prompt(request.schema_key)
        messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=request.message),
        ]

        async def generate():
            parser = StreamingParser()
            collected_text = ""
            collected_files: list[dict] = []

            async for chunk in provider.chat_stream(messages):
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

            # Firestore에 메시지 저장
            # 1. 텍스트 응답 저장
            if collected_text.strip():
                await create_chat_message(
                    room_id=request.room_id,
                    msg_type="text",
                    text=collected_text.strip(),
                    question_created_at=question_created_at,
                    answer_completed=True,
                )

            # 2. 코드 파일들 저장
            for file_event in collected_files:
                await create_chat_message(
                    room_id=request.room_id,
                    msg_type="code",
                    path=file_event.get("path", ""),
                    content=file_event.get("content", ""),
                    question_created_at=question_created_at,
                    answer_completed=True,
                )

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
