from typing import Any, Literal

from pydantic import BaseModel, Field, computed_field, model_validator

from app.core.hashing import content_hash, short_hash


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


class ImageContent(BaseModel):
    """Base64 인코딩된 이미지 (내부 처리용)"""

    media_type: str = Field(
        ...,
        description="이미지 MIME 타입 (image/jpeg, image/png 등)",
    )
    data: str = Field(
        ...,
        description="Base64 인코딩된 이미지 데이터",
    )


class ChatRequest(BaseModel):
    """채팅 요청"""

    message: str = Field(
        ...,
        min_length=1,
        max_length=50000,
        description="사용자 메시지 (최대 50,000자)",
        json_schema_extra={"example": "로그인 페이지 만들어줘"},
    )
    room_id: str = Field(
        ...,
        description="채팅방 ID",
        json_schema_extra={"example": "550e8400-e29b-41d4-a716-446655440000"},
    )
    user_id: str | None = Field(
        default=None,
        description="요청한 사용자 ID (broadcast start 이벤트에 포함)",
        json_schema_extra={"example": "user-uuid-1234"},
    )
    image_urls: list[str] | None = Field(
        default=None,
        max_length=5,
        description="Firebase Storage 이미지 URL 목록 (최대 5개) - Vision 모드 활성화",
        json_schema_extra={"example": ["https://storage.googleapis.com/bucket/user_uploads/room-id/1234_uuid.png"]},
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
    figma_url: str | None = Field(
        default=None,
        description="Figma 디자인 URL (제공 시 Figma 모드로 동작)",
        json_schema_extra={"example": "https://www.figma.com/design/xxx/Design?node-id=123-456"},
    )
    from_message_id: str | None = Field(
        default=None,
        description="특정 메시지의 코드를 기준으로 수정 (해당 메시지까지의 컨텍스트 + 코드 기반 수정)",
        json_schema_extra={"example": "886e7406-55f7-4582-9f4b-7a56ec4562d8"},
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
                {
                    "message": "버튼을 빨간색으로 바꿔줘",
                    "room_id": "550e8400-e29b-41d4-a716-446655440000",
                    "from_message_id": "886e7406-55f7-4582-9f4b-7a56ec4562d8",
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


class BroadcastResponse(BaseModel):
    """Broadcast 방식 chat_stream 응답 (202 Accepted)"""

    message_id: str = Field(..., description="생성된 메시지 ID (broadcast 이벤트로 결과 수신)")


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


class ImageUploadResponse(BaseModel):
    """이미지 업로드 응답"""

    url: str = Field(
        ...,
        description="업로드된 이미지의 Firebase Storage URL",
        json_schema_extra={"example": "https://storage.googleapis.com/bucket/user_uploads/room-id/1234_uuid.png"},
    )
    path: str = Field(
        ...,
        description="Storage 내 파일 경로",
        json_schema_extra={"example": "user_uploads/room-id/1234_uuid.png"},
    )


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


class RoomTransferRequest(BaseModel):
    """방 copy/move 요청 — 대상 유저 지정 (멤버 목록에서 선택한 user_id)."""

    target_user_id: str = Field(
        ...,
        description="대상 사용자 ID (GET /users 멤버 목록에서 선택)",
        json_schema_extra={"example": "550e8400-e29b-41d4-a716-446655440000"},
    )


class UserItem(BaseModel):
    """멤버 목록 항목 (auth.users)."""

    id: str = Field(..., description="사용자 ID (UUID)")
    email: str | None = Field(default=None, description="이메일")
    name: str | None = Field(default=None, description="표시 이름 (없으면 null)")
    avatar_url: str | None = Field(default=None, description="아바타 URL (없으면 null)")


class UserListResponse(BaseModel):
    """전체 멤버 목록 응답 (FE에서 클라이언트 검색)."""

    users: list[UserItem] = Field(default_factory=list)
    total: int = Field(..., description="멤버 수")


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
    question_created_at: int = Field(..., description="질문 생성 시간 (ms timestamp)")
    answer_created_at: int = Field(..., description="응답 생성 시간 (ms timestamp)")
    status: Literal["GENERATING", "DONE", "ERROR"] = Field(..., description="응답 상태")
    code_hash: str | None = Field(
        default=None,
        description=(
            "`content`(React 코드)의 SHA-256 해시(hex, 64자). DB 저장 컬럼(생성 컬럼)에서 옴. "
            "코드가 없으면 null. 코드 변경 시 해시도 바뀌어 전체 diff 없이 변경 탐지 가능. "
            "런타임허브 뱃지는 앞 7자만 표시하면 됨."
        ),
    )

    @model_validator(mode="after")
    def _fill_code_hash(self) -> "MessageDocument":
        """저장 컬럼이 비어있을 때(마이그레이션 적용 전 등)만 content 로 즉석 계산.

        저장값과 동일하므로 마이그레이션 적용 후엔 항상 DB 저장 컬럼을 그대로 사용한다.
        """
        if self.code_hash is None and self.content:
            self.code_hash = content_hash(self.content)
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def code_hash_short(self) -> str | None:
        """`code_hash` 의 git 약식 형태(앞 7자). 화면 뱃지 표시용 — 비교/식별은 풀 해시로."""
        return short_hash(self.code_hash)


class PaginatedMessagesResponse(BaseModel):
    """페이지네이션된 메시지 응답"""

    messages: list[MessageDocument] = Field(..., description="메시지 목록")
    next_cursor: int | None = Field(None, description="다음 페이지 커서 (answer_created_at)")
    has_more: bool = Field(..., description="다음 페이지 존재 여부")
    total_count: int = Field(..., description="총 메시지 수")


# ============================================================================
# Schema Management Schemas
# ============================================================================


class CreateSchemaRequest(BaseModel):
    """스키마 생성 요청"""

    data: dict[str, Any] = Field(
        ...,
        description="컴포넌트 스키마 JSON",
    )


class CreateSchemaResponse(BaseModel):
    """스키마 생성 응답"""

    schema_key: str = Field(description="Firebase Storage 경로")
    component_count: int = Field(description="업로드된 컴포넌트 수")
    uploaded_at: str = Field(description="업로드 시각 (ISO 8601)")


class SchemaResponse(BaseModel):
    """스키마 조회 응답"""

    schema_key: str
    data: dict[str, Any]


class DescribeRequest(BaseModel):
    """화면 기술서 생성 요청"""

    room_id: str = Field(
        ...,
        description="채팅방 ID",
        json_schema_extra={"example": "550e8400-e29b-41d4-a716-446655440000"},
    )


class DescribeResponse(BaseModel):
    """화면 기술서 생성 응답"""

    url: str = Field(
        ...,
        description="생성된 마크다운 파일의 다운로드 URL",
    )
    content: str = Field(
        ...,
        description="생성된 마크다운 원본 텍스트",
    )
