from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.api.chat import router as chat_router
from app.api.components import router as components_router
from app.api.rooms import router as rooms_router
from app.core.config import get_settings

settings = get_settings()

# ============================================================================
# API Tags Metadata
# ============================================================================

tags_metadata = [
    {
        "name": "health",
        "description": "서버 상태 확인 엔드포인트",
    },
    {
        "name": "rooms",
        "description": "채팅방 관리 API",
    },
    {
        "name": "chats",
        "description": "AI 채팅 API - 디자인 시스템 컴포넌트 기반 React UI 코드 생성",
    },
    {
        "name": "components",
        "description": "컴포넌트 스키마 관리 API",
    },
]

# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="DS Bridge AI Server",
    description="""
## DS Bridge AI Server

디자인 시스템 컴포넌트를 기반으로 React UI 코드를 생성하는 AI 서버입니다.

### 인증

모든 API는 `X-API-Key` 헤더 인증이 필요합니다. (`/health` 제외)
```
X-API-Key: sk-your-secret-key
```

### 주요 기능

- **AI 채팅**: 자연어로 UI를 설명하면 React TSX 코드 생성
- **멀티 프로바이더**: OpenAI, Anthropic, Gemini 지원
- **스트리밍**: SSE 기반 실시간 응답
- **컴포넌트 인식**: 디자인 시스템 스키마 기반 정확한 코드 생성
- **동적 스키마**: Firebase Storage에서 컴포넌트 스키마 로드 지원

### 응답 형식 (Streaming)

```
data: {"type": "conversation", "text": "모던한 로그인 폼입니다."}
data: {"type": "file", "path": "src/pages/Login.tsx", "content": "..."}
data: {"type": "done"}
```
""",
    version="0.1.0",
    openapi_tags=tags_metadata,
    contact={
        "name": "DS Bridge Team",
    },
    license_info={
        "name": "MIT",
    },
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================================================
# CORS Middleware
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Routers
# ============================================================================

app.include_router(rooms_router, prefix="/api/rooms", tags=["rooms"])
app.include_router(chat_router, prefix="/api/chats", tags=["chats"])
app.include_router(components_router, prefix="/api/components", tags=["components"])


# ============================================================================
# Health Check
# ============================================================================


@app.get(
    "/health",
    tags=["health"],
    summary="서버 상태 확인",
    description="서버가 정상적으로 실행 중인지 확인합니다.",
    response_description="서버 상태",
    responses={
        status.HTTP_200_OK: {
            "description": "서버 정상",
            "content": {"application/json": {"example": {"status": "healthy"}}},
        }
    },
)
async def health_check():
    """
    서버 헬스 체크 엔드포인트

    Cloud Run, Kubernetes 등에서 liveness/readiness probe로 사용됩니다.
    """
    return {"status": "healthy"}


# ============================================================================
# Custom OpenAPI Schema
# ============================================================================


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=tags_metadata,
    )

    # Custom logo
    openapi_schema["info"]["x-logo"] = {
        "url": "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"
    }

    # Security scheme for X-API-Key
    openapi_schema["components"]["securitySchemes"] = {
        "X-API-Key": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API 키 인증. Chat API 엔드포인트에 필요합니다.",
        }
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
