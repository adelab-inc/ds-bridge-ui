from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    """채팅 메시지"""

    role: Literal["user", "assistant", "system"] = Field(
        ...,
        description="메시지 역할",
        json_schema_extra={"example": "user"},
    )
    content: str = Field(
        ...,
        description="메시지 내용",
        json_schema_extra={"example": "로그인 페이지 만들어줘"},
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"role": "user", "content": "로그인 페이지 만들어줘"},
                {
                    "role": "assistant",
                    "content": '모던한 로그인 페이지입니다.\n\n<file path="src/pages/Login.tsx">...</file>',
                },
            ]
        }
    }


class FileContent(BaseModel):
    """생성된 파일 정보"""

    path: str = Field(
        ...,
        description="파일 경로 (예: src/pages/Login.tsx)",
        json_schema_extra={"example": "src/pages/Login.tsx"},
    )
    content: str = Field(
        ...,
        description="파일 내용 (React TSX 코드)",
        json_schema_extra={
            "example": "import { Button } from '@/components';\n\nconst Login = () => {\n  return <Button>로그인</Button>;\n};\n\nexport default Login;"
        },
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "path": "src/pages/Login.tsx",
                    "content": "import { Button, Field } from '@/components';\n\nconst Login = () => {\n  return (\n    <div>\n      <Field label=\"이메일\" />\n      <Button>로그인</Button>\n    </div>\n  );\n};\n\nexport default Login;",
                }
            ]
        }
    }


class ParsedResponse(BaseModel):
    """파싱된 AI 응답 - 대화와 코드 파일 분리"""

    conversation: str = Field(
        ...,
        description="AI의 한국어 설명 (코드 외 텍스트)",
        json_schema_extra={
            "example": "모던하고 깔끔한 로그인 페이지입니다. 그라데이션 배경과 카드 레이아웃을 사용했습니다."
        },
    )
    files: list[FileContent] = Field(
        default_factory=list,
        description="생성된 코드 파일 목록",
    )
    raw: str = Field(
        ...,
        description="AI 원본 응답 (파싱 전)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "conversation": "모던한 로그인 페이지입니다.",
                    "files": [
                        {
                            "path": "src/pages/Login.tsx",
                            "content": "import { Button } from '@/components';\n...",
                        }
                    ],
                    "raw": '모던한 로그인 페이지입니다.\n\n<file path="src/pages/Login.tsx">...</file>',
                }
            ]
        }
    }


class ChatRequest(BaseModel):
    """채팅 요청"""

    message: str = Field(
        ...,
        description="사용자 메시지",
        json_schema_extra={"example": "로그인 페이지 만들어줘"},
    )
    room_id: str = Field(
        ...,
        description="채팅방 ID",
        json_schema_extra={"example": "550e8400-e29b-41d4-a716-446655440000"},
    )
    stream: bool = Field(
        default=False,
        description="스트리밍 응답 여부 (True면 /stream 엔드포인트 사용 권장)",
    )
    schema_key: str | None = Field(
        default=None,
        description="Firebase Storage 내 컴포넌트 스키마 경로 (예: schemas/v1/component-schema.json)",
        json_schema_extra={"example": "schemas/v1/component-schema.json"},
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message": "로그인 페이지 만들어줘",
                    "room_id": "550e8400-e29b-41d4-a716-446655440000",
                },
                {
                    "message": "대시보드 만들어줘",
                    "room_id": "550e8400-e29b-41d4-a716-446655440000",
                    "schema_key": "schemas/v1/component-schema.json",
                },
            ]
        }
    }


class ChatResponse(BaseModel):
    """채팅 응답 (Non-streaming)"""

    message: Message = Field(
        ...,
        description="AI 응답 메시지",
    )
    parsed: ParsedResponse | None = Field(
        default=None,
        description="파싱된 응답 (conversation과 files 분리)",
    )
    usage: dict | None = Field(
        default=None,
        description="토큰 사용량 정보",
        json_schema_extra={
            "example": {
                "prompt_tokens": 1500,
                "completion_tokens": 800,
                "total_tokens": 2300,
            }
        },
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "모던한 로그인 페이지입니다.\n\n<file path=\"src/pages/Login.tsx\">import { Button } from '@/components';\n\nconst Login = () => <Button>로그인</Button>;\n\nexport default Login;</file>",
                    },
                    "parsed": {
                        "conversation": "모던한 로그인 페이지입니다.",
                        "files": [
                            {
                                "path": "src/pages/Login.tsx",
                                "content": "import { Button } from '@/components';\n\nconst Login = () => <Button>로그인</Button>;\n\nexport default Login;",
                            }
                        ],
                        "raw": "...",
                    },
                    "usage": {
                        "prompt_tokens": 1500,
                        "completion_tokens": 800,
                        "total_tokens": 2300,
                    },
                }
            ]
        }
    }


class StreamEvent(BaseModel):
    """SSE 스트리밍 이벤트"""

    type: Literal["chat", "code", "done", "error"] = Field(
        ...,
        description="이벤트 타입: chat(대화), code(코드파일), done(완료), error(오류)",
    )
    text: str | None = Field(
        default=None,
        description="대화 텍스트 (type=chat일 때)",
    )
    path: str | None = Field(
        default=None,
        description="파일 경로 (type=code일 때)",
    )
    content: str | None = Field(
        default=None,
        description="파일 내용 (type=code일 때)",
    )
    error: str | None = Field(
        default=None,
        description="오류 메시지 (type=error일 때)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"type": "chat", "text": "모던한 로그인 페이지입니다."},
                {
                    "type": "code",
                    "path": "src/pages/Login.tsx",
                    "content": "import { Button } from '@/components';...",
                },
                {"type": "done"},
                {"type": "error", "error": "API 요청 실패"},
            ]
        }
    }


class ComponentSchema(BaseModel):
    """컴포넌트 스키마 응답"""

    version: str = Field(
        ...,
        description="스키마 버전",
        json_schema_extra={"example": "1.0.0"},
    )
    generated_at: str = Field(
        ...,
        alias="generatedAt",
        description="스키마 생성 시간 (ISO 8601)",
        json_schema_extra={"example": "2026-01-09T10:00:00.000Z"},
    )
    components: dict = Field(
        ...,
        description="컴포넌트 정의 목록",
    )

    model_config = {"populate_by_name": True}


class PromptResponse(BaseModel):
    """시스템 프롬프트 조회 응답"""

    prompt: str = Field(
        ...,
        description="현재 시스템 프롬프트 전체 내용",
    )
    component_count: int = Field(
        ...,
        description="로드된 컴포넌트 수",
        json_schema_extra={"example": 25},
    )


class ReloadResponse(BaseModel):
    """스키마 리로드 응답"""

    message: str = Field(
        ...,
        description="결과 메시지",
        json_schema_extra={"example": "Schema reloaded successfully"},
    )
    component_count: int = Field(
        ...,
        alias="componentCount",
        serialization_alias="componentCount",
        description="리로드된 컴포넌트 수",
        json_schema_extra={"example": 25},
    )

    model_config = {"populate_by_name": True}


# ============================================================================
# Chat Room Schemas
# ============================================================================


class CreateRoomRequest(BaseModel):
    """채팅방 생성 요청"""

    storybook_url: str = Field(
        ...,
        description="Storybook URL",
        json_schema_extra={"example": "https://storybook.example.com"},
    )
    user_id: str = Field(
        ...,
        description="사용자 ID",
        json_schema_extra={"example": "user-123"},
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "storybook_url": "https://storybook.example.com",
                    "user_id": "user-123",
                }
            ]
        }
    }


class RoomResponse(BaseModel):
    """채팅방 응답"""

    id: str = Field(
        ...,
        description="채팅방 ID (UUID)",
        json_schema_extra={"example": "550e8400-e29b-41d4-a716-446655440000"},
    )
    storybook_url: str = Field(
        ...,
        description="Storybook URL",
        json_schema_extra={"example": "https://storybook.example.com"},
    )
    user_id: str = Field(
        ...,
        description="사용자 ID",
        json_schema_extra={"example": "user-123"},
    )
    created_at: str = Field(
        ...,
        description="생성 시간 (ISO 8601)",
        json_schema_extra={"example": "2026-01-12T10:00:00.000Z"},
    )


class MessageDocument(BaseModel):
    """채팅 메시지 문서"""

    id: str = Field(..., description="메시지 ID (UUID)")
    question: str = Field(
        default="",
        description="사용자 질문",
    )
    text: str = Field(
        default="",
        description="AI 텍스트 응답",
    )
    content: str = Field(
        default="",
        description="React 코드 내용",
    )
    path: str = Field(
        default="",
        description="파일 경로",
    )
    room_id: str = Field(..., description="채팅방 ID")
    question_created_at: str = Field(..., description="질문 생성 시간 (ms timestamp)")
    answer_created_at: str = Field(..., description="응답 생성 시간 (ms timestamp)")
    status: Literal["GENERATING", "DONE", "ERROR"] = Field(..., description="응답 상태")
