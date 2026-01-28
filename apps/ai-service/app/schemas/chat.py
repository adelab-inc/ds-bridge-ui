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


class ComponentInstance(BaseModel):
    """컴포넌트 인스턴스 정보"""

    id: str = Field(
        ...,
        description="인스턴스 ID (예: button-1, card-2)",
        json_schema_extra={"example": "button-1"},
    )
    component: str = Field(
        ...,
        description="컴포넌트 이름",
        json_schema_extra={"example": "Button"},
    )
    props: dict = Field(
        default_factory=dict,
        description="현재 props 값들",
        json_schema_extra={"example": {"variant": "primary", "children": "로그인"}},
    )


class CurrentComposition(BaseModel):
    """현재 렌더링된 컴포넌트 구조"""

    instances: list[ComponentInstance] = Field(
        default_factory=list,
        description="렌더링된 컴포넌트 인스턴스 목록",
    )


class ChatRequest(BaseModel):
    """채팅 요청"""

    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="사용자 메시지 (최대 10,000자)",
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
    current_composition: CurrentComposition | None = Field(
        default=None,
        description="현재 렌더링된 컴포넌트 구조 (인스턴스 편집 모드용)",
    )
    selected_instance_id: str | None = Field(
        default=None,
        description="사용자가 선택한 컴포넌트 인스턴스 ID (예: button-1)",
        json_schema_extra={"example": "button-1"},
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
                },
                {
                    "message": "배경색을 파란색으로 바꿔줘",
                    "room_id": "550e8400-e29b-41d4-a716-446655440000",
                    "current_composition": {
                        "instances": [
                            {"id": "button-1", "component": "Button", "props": {"variant": "primary"}}
                        ]
                    },
                    "selected_instance_id": "button-1",
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

    user_id: str = Field(
        ...,
        description="사용자 ID",
        json_schema_extra={"example": "user-123"},
    )
    storybook_url: str | None = Field(
        default=None,
        description="Storybook URL (참고용)",
        json_schema_extra={"example": "https://storybook.example.com"},
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "user_id": "user-123",
                    "storybook_url": "https://storybook.example.com",
                }
            ]
        }
    }


class UpdateRoomRequest(BaseModel):
    """채팅방 업데이트 요청"""

    storybook_url: str | None = Field(
        default=None,
        description="Storybook URL (참고용)",
        json_schema_extra={"example": "https://storybook.example.com"},
    )
    schema_key: str | None = Field(
        default=None,
        description="Firebase Storage 스키마 경로 변경",
        json_schema_extra={"example": "schemas/aplus-ui.json"},
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "storybook_url": "https://new-storybook.example.com",
                    "schema_key": "schemas/aplus-ui.json",
                },
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
    storybook_url: str | None = Field(
        default=None,
        description="Storybook URL (참고용)",
        json_schema_extra={"example": "https://storybook.example.com"},
    )
    schema_key: str | None = Field(
        default=None,
        description="Firebase Storage 스키마 경로. None이면 자유 모드.",
        json_schema_extra={"example": "schemas/aplus-ui.json"},
    )
    user_id: str = Field(
        ...,
        description="사용자 ID",
        json_schema_extra={"example": "user-123"},
    )
    created_at: int = Field(
        ...,
        description="생성 시간 (ms timestamp)",
        json_schema_extra={"example": 1736654400000},
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


# ============================================================================
# Vision (Image-to-Code) Schemas
# ============================================================================


class ImageContent(BaseModel):
    """Base64 인코딩된 이미지"""

    type: Literal["image"] = Field(
        default="image",
        description="컨텐츠 타입",
    )
    media_type: Literal["image/jpeg", "image/png", "image/gif", "image/webp"] = Field(
        ...,
        description="이미지 MIME 타입",
    )
    data: str = Field(
        ...,
        description="Base64 인코딩된 이미지 데이터 (data: prefix 제외)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "type": "image",
                    "media_type": "image/png",
                    "data": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
                }
            ]
        }
    }


class VisionChatRequest(BaseModel):
    """Vision 채팅 요청"""

    message: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="사용자 프롬프트",
        json_schema_extra={"example": "이 디자인을 React 코드로 만들어줘"},
    )
    room_id: str = Field(
        ...,
        description="채팅방 ID",
        json_schema_extra={"example": "550e8400-e29b-41d4-a716-446655440000"},
    )
    images: list[ImageContent] = Field(
        default_factory=list,
        max_length=5,
        description="이미지 목록 (최대 5개)",
    )
    mode: Literal["direct", "analyze"] = Field(
        default="direct",
        description="생성 모드: direct(1-Step 바로 코드 생성), analyze(2-Step 분석 후 코드 생성)",
    )
    stream: bool = Field(
        default=True,
        description="스트리밍 응답 여부",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message": "이 디자인을 React 코드로 만들어줘",
                    "room_id": "550e8400-e29b-41d4-a716-446655440000",
                    "images": [
                        {
                            "type": "image",
                            "media_type": "image/png",
                            "data": "iVBORw0KGgo...",
                        }
                    ],
                    "mode": "direct",
                    "stream": True,
                }
            ]
        }
    }


class ImageAnalysis(BaseModel):
    """이미지 분석 결과 (2-Step 모드)"""

    layout: dict = Field(
        ...,
        description="레이아웃 구조 (type, direction, gap, alignment)",
    )
    components: list[dict] = Field(
        ...,
        description="감지된 컴포넌트 목록 (type, props, children, position)",
    )
    colors: dict = Field(
        ...,
        description="색상 팔레트 (primary, secondary, background, text)",
    )
    typography: dict = Field(
        ...,
        description="타이포그래피 정보 (heading, body)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "layout": {
                        "type": "flex",
                        "direction": "column",
                        "gap": "16px",
                        "alignment": "center",
                    },
                    "components": [
                        {
                            "type": "Button",
                            "props": {"variant": "primary"},
                            "children": "로그인",
                        }
                    ],
                    "colors": {
                        "primary": "#0033A0",
                        "background": "#FFFFFF",
                        "text": "#212529",
                    },
                    "typography": {
                        "heading": {"size": "24px", "weight": 700},
                        "body": {"size": "16px", "weight": 400},
                    },
                }
            ]
        }
    }


class VisionStreamEvent(BaseModel):
    """Vision SSE 스트리밍 이벤트"""

    type: Literal["chat", "code", "analysis", "done", "error"] = Field(
        ...,
        description="이벤트 타입: chat(대화), code(코드파일), analysis(분석결과), done(완료), error(오류)",
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
    data: ImageAnalysis | None = Field(
        default=None,
        description="분석 결과 (type=analysis일 때)",
    )
    error: str | None = Field(
        default=None,
        description="오류 메시지 (type=error일 때)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"type": "chat", "text": "이미지를 분석하여 React 코드를 생성합니다."},
                {
                    "type": "code",
                    "path": "src/pages/Login.tsx",
                    "content": "import { Button } from '@/components';...",
                },
                {
                    "type": "analysis",
                    "data": {
                        "layout": {"type": "flex", "direction": "column"},
                        "components": [{"type": "Button", "props": {}}],
                        "colors": {"primary": "#0033A0"},
                        "typography": {"heading": {"size": "24px"}},
                    },
                },
                {"type": "done"},
                {"type": "error", "error": "이미지 처리 실패"},
            ]
        }
    }
