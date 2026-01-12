# DS-Bridge AI Service

> FastAPI 기반 AI 채팅 서버 - 디자인 시스템 컴포넌트로 UI 생성

## 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| Python | 3.12+ | 런타임 |
| FastAPI | 0.115+ | API 프레임워크 |
| Pydantic | 2.10+ | 스키마 검증 |
| OpenAI SDK | 1.59+ | GPT API |
| Anthropic SDK | 0.43+ | Claude API |
| Google GenAI | 1.0+ | Gemini API |
| Firebase Admin | 6.6+ | Storage 접근 |
| uvicorn | 0.34+ | ASGI 서버 |

## 디렉토리 구조

```
apps/ai-service/
├── app/
│   ├── api/                  # API 라우터
│   │   ├── chat.py           # 채팅 엔드포인트
│   │   └── components.py     # 컴포넌트 스키마 관리
│   │
│   ├── core/                 # 핵심 설정
│   │   ├── config.py         # 환경 변수 관리
│   │   └── auth.py           # API 키 인증
│   │
│   ├── schemas/              # Pydantic 모델
│   │   └── chat.py           # 요청/응답 스키마
│   │
│   ├── services/             # 비즈니스 로직
│   │   ├── ai_provider.py    # AI 프로바이더 추상화
│   │   └── firebase_storage.py # Firebase Storage 클라이언트
│   │
│   └── main.py               # FastAPI 앱 진입점
│
├── scripts/
│   └── deploy.sh             # Cloud Run 배포 스크립트
│
├── Dockerfile                # 멀티스테이지 Docker 빌드
├── component-schema.json     # 컴포넌트 정의 (로컬 폴백)
├── pyproject.toml            # 의존성 관리
└── .env                      # 환경 변수
```

## 코드 컨벤션

### 파일 명명

| 타입 | 규칙 | 예시 |
|------|------|------|
| 모듈 | snake_case | `ai_provider.py` |
| 클래스 | PascalCase | `AIProvider` |
| 함수 | snake_case | `get_ai_provider()` |
| 상수 | UPPER_CASE | `SYSTEM_PROMPT` |

### Python 스타일

```python
# Pydantic 모델
class ChatRequest(BaseModel):
    message: str                    # 사용자 메시지
    stream: bool = False
    schema_key: str | None = None   # Firebase Storage 경로

# 의존성 주입 패턴
def get_ai_provider() -> AIProvider:
    if settings.ai_provider == "anthropic":
        return AnthropicProvider()
    return OpenAIProvider()

# 비동기 API
@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    provider = get_ai_provider()
    system_prompt = await resolve_system_prompt(request.schema_key)
    response, usage = await provider.chat(messages)
    return ChatResponse(message=response, parsed=parsed, usage=usage)
```

### 타입 힌트

```python
# 제네릭 타입
from collections.abc import AsyncGenerator

async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
    async for chunk in stream:
        yield chunk
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 체크 |
| POST | `/rooms` | 채팅방 생성 |
| GET | `/rooms/{room_id}` | 채팅방 조회 |
| POST | `/chat` | 채팅 (non-streaming) |
| POST | `/chat/stream` | 채팅 (SSE streaming) |
| GET | `/components` | 컴포넌트 스키마 조회 |
| POST | `/components/reload` | 스키마 리로드 |

**인증**: `X-API-Key` 헤더 필요 (`/health` 제외)

## 스트리밍 응답 형식

하이브리드 스트리밍 방식:
- **chat**: 실시간 청크 단위 스트리밍
- **code**: 완성 후 한 번에 전송

```
data: {"type": "chat", "text": "모던한 "}
data: {"type": "chat", "text": "로그인 페이지입니다."}
data: {"type": "code", "path": "src/pages/Login.tsx", "content": "..."}
data: {"type": "done"}
```

## 환경 변수

```bash
# AI 프로바이더 선택
AI_PROVIDER=openai  # openai | anthropic | gemini

# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4.1

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-sonnet-4-5

# Gemini
GEMINI_API_KEY=AIzaxxx
GEMINI_MODEL=gemini-2.5-flash

# API 인증 (비어있으면 비활성화)
X_API_KEY=sk-your-secret-key

CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Firebase
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
# 로컬 개발: service-account.json 파일을 apps/ai-service/ 폴더에 위치
```

## 개발 명령어

```bash
# 의존성 설치
uv sync

# 개발 서버 (localhost:8000)
uv run uvicorn app.main:app --reload --port 8000

# 타입 체크
uv run mypy app

# 린트/포맷
uv run ruff check app
uv run ruff format app

# 테스트
uv run pytest
```

## 배포

```bash
# Cloud Run 배포 (빌드 + 푸시 + 배포)
./scripts/deploy.sh all

# 개별 명령어
./scripts/deploy.sh build         # Docker 이미지 빌드
./scripts/deploy.sh push          # Artifact Registry 푸시
./scripts/deploy.sh deploy-simple # Cloud Run 배포
./scripts/deploy.sh logs          # 로그 조회
```

## AI 프로바이더 추상화

```python
class AIProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[Message]) -> tuple[Message, dict | None]:
        pass

    @abstractmethod
    async def chat_stream(self, messages: list[Message]) -> AsyncGenerator[str, None]:
        pass
```

- `OpenAIProvider`: GPT-4.1 기반
- `AnthropicProvider`: Claude 기반
- `GeminiProvider`: Gemini 기반
- 환경 변수로 전환 가능

## Firebase Storage 연동

`schema_key` 파라미터로 Firebase Storage에서 동적 스키마 로딩:

```json
{
  "message": "로그인 페이지 만들어줘",
  "schema_key": "schemas/v1/component-schema.json"
}
```

- `schema_key` 없으면 로컬 `component-schema.json` 사용
- 스키마 메모리 캐싱 지원

## 시스템 프롬프트

`component-schema.json`을 기반으로 동적 프롬프트 생성:

1. 컴포넌트 목록 및 props 포맷팅
2. `<file path="...">...</file>` 태그 형식 응답 규칙
3. 사용 규칙 및 제약 조건
4. 코드 생성 가이드라인
