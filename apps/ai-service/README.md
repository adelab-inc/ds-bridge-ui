# AI Service

> DS Bridge AI Server - Chat-based UI Builder API powered by FastAPI

A FastAPI-based AI backend service that generates React UI code using design system components. The AI understands your component library schema and creates production-ready TSX code through natural language conversations.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [AI Providers](#ai-providers)
- [Streaming Response](#streaming-response)
- [Firebase Storage Integration](#firebase-storage-integration)
- [Deployment](#deployment)
- [Development](#development)

## Features

- **Multi-Provider AI Support**: Switch between OpenAI (GPT-4.1), Anthropic (Claude), and Google (Gemini) with a single environment variable
- **Hybrid Streaming**: Real-time conversation streaming with complete code files via SSE
- **Component-Aware Generation**: AI generates valid, type-safe code based on your component schema
- **Dynamic Schema Loading**: Load component schemas from Firebase Storage at runtime
- **Hot Reload Schema**: Reload component definitions at runtime without server restart
- **Cloud Run Ready**: Docker containerized with deployment scripts included

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.12+ | Runtime |
| FastAPI | 0.115+ | Web framework |
| Pydantic | 2.10+ | Data validation & settings |
| OpenAI SDK | 1.59+ | GPT API integration |
| Anthropic SDK | 0.43+ | Claude API integration |
| Google GenAI | 1.0+ | Gemini API integration |
| Firebase Admin | 6.6+ | Firebase Storage access |
| uvicorn | 0.34+ | ASGI server |
| httpx | 0.28+ | Async HTTP client |

## Quick Start

### Prerequisites

- Python 3.12 or higher
- [uv](https://github.com/astral-sh/uv) (recommended) or pip
- API key for at least one AI provider (OpenAI, Anthropic, or Google)

### Installation

```bash
# Navigate to the service directory
cd apps/ai-service

# Install dependencies with uv
uv sync

# Or with pip
pip install -e .
```

### Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your API keys
# At minimum, set one AI provider's API key
```

### Running the Server

```bash
# Development server with hot reload
uv run uvicorn app.main:app --reload --port 8000

# Production
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`. API docs at `/docs`.

## Project Structure

```
apps/ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entry point
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── chat.py              # Chat API routes
│   │   │                        # - POST /api/chats (non-streaming)
│   │   │                        # - POST /api/chats/stream (SSE streaming)
│   │   │
│   │   └── components.py        # Component schema management
│   │                            # - GET /api/components
│   │                            # - GET /api/components/prompt
│   │                            # - POST /api/components/reload
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py            # Application settings
│   │   └── auth.py              # API key authentication
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── chat.py              # Pydantic models
│   │
│   └── services/
│       ├── __init__.py
│       ├── ai_provider.py       # AI provider abstraction
│       └── firebase_storage.py  # Firebase Storage client
│
├── scripts/
│   └── deploy.sh                # Cloud Run deployment script
│
├── Dockerfile                   # Multi-stage Docker build
├── .dockerignore
├── component-schema.json        # Component definitions (local fallback)
├── pyproject.toml               # Project dependencies
├── uv.lock                      # Locked dependencies
├── .env.example                 # Environment template
└── .env                         # Local environment (git-ignored)
```

## API Reference

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy"
}
```

---

### Chat (Non-Streaming)

```http
POST /api/chats
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Create a login form",
  "schema_key": "schemas/v1/component-schema.json"
}
```

**Response:**
```json
{
  "message": {
    "role": "assistant",
    "content": "모던한 로그인 폼입니다.\n\n<file path=\"src/pages/Login.tsx\">...</file>"
  },
  "parsed": {
    "conversation": "모던한 로그인 폼입니다.",
    "files": [
      {
        "path": "src/pages/Login.tsx",
        "content": "import { Button, Field } from '@/components';..."
      }
    ],
    "raw": "..."
  },
  "usage": {
    "prompt_tokens": 1234,
    "completion_tokens": 567,
    "total_tokens": 1801
  }
}
```

---

### Chat (Streaming)

```http
POST /api/chats/stream
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Create a dashboard",
  "schema_key": "schemas/v1/component-schema.json"
}
```

**Response:** Server-Sent Events (SSE) stream

```
data: {"type": "chat", "text": "모던한 "}

data: {"type": "chat", "text": "대시보드입니다."}

data: {"type": "code", "path": "src/pages/Dashboard.tsx", "content": "import..."}

data: {"type": "done"}
```

---

### Get Component Schema

```http
GET /api/components
```

**Response:**
```json
{
  "version": "1.0.0",
  "generatedAt": "2026-01-09T10:00:00.000Z",
  "components": {
    "Button": {
      "displayName": "Button",
      "category": "UI",
      "props": {
        "variant": {
          "type": ["primary", "secondary"],
          "required": false
        }
      }
    }
  }
}
```

---

### Reload Component Schema

```http
POST /api/components/reload
```

**Response:**
```json
{
  "message": "Schema reloaded successfully",
  "componentCount": 25
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | AI provider: `openai`, `anthropic`, or `gemini` |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4.1` | OpenAI model identifier |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model identifier |
| `GEMINI_API_KEY` | - | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model identifier |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server port |
| `DEBUG` | `false` | Debug mode |
| `X_API_KEY` | - | API key for authentication (empty = disabled) |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Allowed CORS origins |
| `FIREBASE_STORAGE_BUCKET` | - | Firebase Storage bucket name |
| `GOOGLE_APPLICATION_CREDENTIALS` | - | Service account JSON path (local only) |

### Example `.env` File

```bash
# AI Provider Selection
AI_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxxx
OPENAI_MODEL=gpt-4.1

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Gemini Configuration
GEMINI_API_KEY=AIzaxxxxx
GEMINI_MODEL=gemini-2.5-flash

# Server Settings
HOST=0.0.0.0
PORT=8000
DEBUG=false

# API Authentication (leave empty to disable)
X_API_KEY=sk-your-secret-key

# CORS Settings
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Firebase Settings
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

## AI Providers

The service supports three AI providers through a unified abstraction layer:

### OpenAI Provider
- **Model**: GPT-4.1 (default)
- **Features**: Full streaming support, token usage tracking

### Anthropic Provider
- **Model**: Claude Sonnet 4 (default)
- **Features**: Full streaming support, separate system message handling
- **Max Tokens**: 4096 per response

### Gemini Provider
- **Model**: Gemini 2.5 Flash (default)
- **Features**: Full streaming support, system instruction support

### Switching Providers

```bash
AI_PROVIDER=openai    # Use OpenAI
AI_PROVIDER=anthropic # Use Anthropic
AI_PROVIDER=gemini    # Use Gemini
```

## Streaming Response

The streaming API uses a hybrid approach:

- **Conversation text**: Streamed in real-time (chunk by chunk)
- **Code files**: Buffered until complete, then sent as a single event

### Event Types

| Type | Description | Fields |
|------|-------------|--------|
| `chat` | Real-time chat text | `text` |
| `code` | Complete code file | `path`, `content` |
| `done` | Stream complete | - |
| `error` | Error occurred | `error` |

## Firebase Storage Integration

Component schemas can be loaded dynamically from Firebase Storage:

### Setup

1. Create a Firebase project and enable Storage
2. Upload your `component-schema.json` to Storage
3. Configure environment variables:
   ```bash
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   ```

### Usage

Pass `schema_key` in the request to load schema from Firebase Storage:

```json
{
  "message": "로그인 페이지 만들어줘",
  "schema_key": "schemas/v1/component-schema.json"
}
```

If `schema_key` is not provided, the local `component-schema.json` is used as fallback.

### Caching

Schemas are cached in memory after first download to reduce latency.

## Deployment

### Cloud Run Deployment

```bash
cd apps/ai-service

# Build, push, and deploy
./scripts/deploy.sh all
```

### Deployment Commands

| Command | Description |
|---------|-------------|
| `./scripts/deploy.sh build` | Build Docker image |
| `./scripts/deploy.sh push` | Push to Artifact Registry |
| `./scripts/deploy.sh deploy-simple` | Deploy with env vars |
| `./scripts/deploy.sh all` | Build + Push + Deploy |
| `./scripts/deploy.sh logs` | View recent logs |

### Production URL

```
https://ai-server-233376868812.asia-northeast3.run.app
```

- Health check: `/health`
- API docs: `/docs`
- Swagger UI: `/docs`
- ReDoc: `/redoc`

## Development

### Commands

```bash
# Install dependencies
uv sync

# Run development server
uv run uvicorn app.main:app --reload --port 8000

# Type checking
uv run mypy app

# Linting
uv run ruff check app

# Format code
uv run ruff format app

# Run tests
uv run pytest
```

### Code Style

- **Line Length**: 100 characters
- **Python Version**: 3.12+
- **Type Hints**: Required (strict mypy)
- **Quote Style**: Double quotes
- **Linting**: Ruff with E, F, I, N, W, B, UP rules

## License

MIT
