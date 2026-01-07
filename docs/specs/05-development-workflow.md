# 05. 개발 워크플로우

> **대상 독자**: 전체 팀 (PM, 디자이너, FE 개발자, AI 개발자)

## TL;DR

- **모노레포 구조**: `apps/web` (Next.js) + `apps/ai-service` (FastAPI)
- **MVP 4단계**: Setup, Chat/Composition, Export/Tokens, CLI
- **Contract-First**: API 계약 먼저 정의, 이후 병렬 개발
- **브랜치 전략**: `feature/fe-*`, `feature/ai-*` 네임스페이스

---

## 모노레포 개발 환경 설정

### 초기 셋업

```bash
# 1. 저장소 클론
git clone https://github.com/your-org/ds-bridge-ui.git
cd ds-bridge-ui

# 2. pnpm 설치 (없는 경우)
npm install -g pnpm

# 3. 전체 의존성 설치
pnpm install

# 4. 환경 변수 설정
cp apps/web/.env.example apps/web/.env.local
cp apps/ai-service/.env.example apps/ai-service/.env
```

### 환경 변수

**apps/web/.env.local**
```bash
# AI 서비스 URL
AI_SERVICE_URL=http://localhost:8000

# 앱 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**apps/ai-service/.env**
```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# 서버 설정
HOST=0.0.0.0
PORT=8000
```

### 개발 서버 실행

**동시 실행 (권장)**
```bash
# 루트에서 모든 서비스 동시 실행
pnpm dev
```

**개별 실행**
```bash
# 터미널 1: Next.js
cd apps/web
pnpm dev

# 터미널 2: FastAPI
cd apps/ai-service
poetry run uvicorn src.main:app --reload --port 8000
```

### 서비스별 개발

| 서비스 | 디렉토리 | 명령어 | URL |
|--------|----------|--------|-----|
| Web (Next.js) | `apps/web` | `pnpm dev` | http://localhost:3000 |
| AI Service | `apps/ai-service` | `poetry run uvicorn src.main:app --reload` | http://localhost:8000 |
| AI Docs | `apps/ai-service` | `poetry run uvicorn src.main:app --reload` | http://localhost:8000/docs |

---

## MVP 개발 단계

```
Phase 1          Phase 2              Phase 3            Phase 4
기본 셋업        Chat & Compose       Export & Tokens    CLI & 마무리
[1-2주차]        [3-4주차]            [5-6주차]          [7주차+]
    |                |                    |                  |
    v                v                    v                  v
+----------+    +------------+    +--------------+    +----------+
| Project  |    | Chat UI    |    | Copy for AI  |    | CLI      |
| Storybook| -> | Composition| -> | Token Extract| -> | Polish   |
| Parsing  |    | Props Edit |    | Export JSON  |    | Deploy   |
+----------+    +------------+    +--------------+    +----------+
```

---

## Phase 1: 기본 셋업 (1-2주차)

### 목표
- 모노레포 인프라 구축
- Storybook URL 파싱
- 기본 UI 레이아웃
- AI 서비스 기본 셋업

### FE 개발자 태스크 (apps/web)

| 태스크 | 산출물 |
|--------|--------|
| 프로젝트 셋업 | Next.js + TypeScript + Tailwind |
| 레이아웃 | Header, Left Panel, Right Panel |
| URL 입력 | 유효성 검사가 있는 폼 |
| Storybook 파싱 | stories.json / index.json 파싱 |
| 컴포넌트 목록 | 파싱된 컴포넌트 표시 |
| iframe 임베드 | Right Panel에 Storybook 표시 |
| BFF 프록시 설정 | AI 서비스 프록시 라우트 준비 |

### AI 개발자 태스크 (apps/ai-service)

| 태스크 | 산출물 |
|--------|--------|
| FastAPI 프로젝트 셋업 | Poetry + FastAPI + Pydantic |
| Health 엔드포인트 | `GET /health` |
| API contract | Pydantic 스키마 정의 |
| System prompt | 초기 가이드형 프롬프트 설계 |
| Action format | [ACTION:type:payload] 형식 정의 |
| Claude API 연동 | anthropic 패키지 테스트 |

### 공동 태스크 (packages/shared-types)

| 태스크 | 산출물 |
|--------|--------|
| ds.json schema | JSON Schema 정의 (SSOT) |
| TypeScript 타입 | JSON Schema → TS 타입 생성 |
| Pydantic 스키마 | JSON Schema → Pydantic 모델 생성 |
| API types | 공유 타입 정의 |

### Phase 1 체크리스트

**FE 개발자 (apps/web)**
- [ ] `npx create-next-app` with TypeScript, Tailwind
- [ ] pnpm workspace 설정 (`pnpm-workspace.yaml`)
- [ ] 기본 레이아웃 컴포넌트
- [ ] URL 입력 폼
- [ ] `/api/storybook/parse` 엔드포인트
- [ ] Storybook v6/v7 파싱 로직
- [ ] 컴포넌트 목록 UI
- [ ] Storybook iframe 연동
- [ ] AI 서비스 프록시 라우트 (`/api/ai/*`)

**AI 개발자 (apps/ai-service)**
- [ ] Poetry 프로젝트 초기화 (`poetry init`)
- [ ] FastAPI 앱 생성 (`src/main.py`)
- [ ] 환경 변수 설정 (`src/core/config.py`)
- [ ] Health 엔드포인트 구현
- [ ] Claude API 연동 테스트
- [ ] System prompt 초안 작성
- [ ] Action 파싱 로직 설계

**공동 (packages/shared-types)**
- [ ] JSON Schema: `ds-json.schema.json`
- [ ] TypeScript: `ds-json.d.ts`
- [ ] Pydantic: `ds_json.py`

---

## Phase 2: Chat & Composition (3-4주차)

### 목표
- 가이드형 AI 채팅
- 컴포넌트 조합
- Props 편집

### FE 개발자 태스크 (apps/web)

| 태스크 | 산출물 |
|--------|--------|
| Chat UI | 메시지 목록, 입력, 스트리밍 표시 |
| Action 버튼 | 채팅 액션 실행 |
| Composition 관리자 | 컴포넌트 추가/제거/순서 변경 |
| Props 에디터 | PropDefinition 기반 동적 폼 |
| Preview | Right Panel에 Composition 미리보기 |
| BFF 프록시 | `/api/ai/chat` SSE 스트림 전달 |

### AI 개발자 태스크 (apps/ai-service)

| 태스크 | 산출물 |
|--------|--------|
| Chat API | FastAPI SSE streaming `POST /chat` |
| ChatService | Claude API 연동 서비스 클래스 |
| System prompt | ds.json 컨텍스트로 개선된 프롬프트 |
| Action types | 모든 액션 타입 구현 |
| Validation | hallucination 방지 검증 |

### Phase 2 체크리스트

**FE 개발자 (apps/web)**
- [ ] 채팅 메시지 컴포넌트
- [ ] SSE 스트리밍 연동 (`/api/ai/chat` 프록시)
- [ ] Action 버튼 핸들러
- [ ] Composition 상태 (Zustand)
- [ ] 동적 props 폼
- [ ] Composition 미리보기 렌더러

**AI 개발자 (apps/ai-service)**
- [ ] `POST /chat` SSE 스트리밍 엔드포인트
- [ ] `ChatService` 클래스 구현
- [ ] 컴포넌트 목록 포함 System prompt
- [ ] Action 파싱 및 검증
- [ ] 응답 포맷팅 (`text`, `action` 이벤트)

---

## Phase 3: Export & Tokens (5-6주차)

### 목표
- Copy for AI 기능
- 토큰 추출
- Export 기능

### FE 개발자 태스크 (apps/web)

| 태스크 | 산출물 |
|--------|--------|
| Copy for AI | 생성 및 클립보드 복사 |
| 토큰 표시 | 추출된 토큰 표시 |
| Export JSON | ds.json / composition 다운로드 |
| UI 다듬기 | 로딩 상태, 에러 처리 |
| BFF 프록시 | `/api/ai/tokens/extract` 프록시 |

### AI 개발자 태스크 (apps/ai-service)

| 태스크 | 산출물 |
|--------|--------|
| 토큰 추출 API | `POST /tokens/extract` |
| TokenExtractor | Playwright 서비스 클래스 |
| Playwright 셋업 | 브라우저 자동화 환경 |
| Copy 템플릿 | AI 프롬프트 출력 최적화 |
| Validation | 다양한 Storybook으로 테스트 |

### Phase 3 체크리스트

**FE 개발자 (apps/web)**
- [ ] Copy for AI 버튼
- [ ] Clipboard API 연동
- [ ] 토큰 표시 UI
- [ ] Export 버튼 (JSON 다운로드)
- [ ] 로딩 및 에러 상태
- [ ] `/api/ai/tokens/extract` 프록시 라우트

**AI 개발자 (apps/ai-service)**
- [ ] `POST /tokens/extract` 엔드포인트
- [ ] `TokenExtractor` 서비스 클래스
- [ ] Playwright 설치 및 설정
- [ ] Computed styles 추출 로직
- [ ] 토큰 중복 제거 로직
- [ ] Copy for AI 템플릿 최적화

---

## Phase 4: CLI & 마무리 (7주차+)

### 목표
- 로컬 추출용 CLI 도구
- 프로덕션 배포
- 문서화

### 태스크

| 태스크 | 담당 | 산출물 |
|--------|------|--------|
| CLI 패키지 | AI Dev | `ds-hub-cli` npm 패키지 |
| FE 테스팅 | FE Dev | Vitest 유닛 테스트, Playwright E2E |
| AI 테스팅 | AI Dev | pytest 유닛 테스트 |
| 문서화 | 공동 | 사용자 가이드, API 문서 |
| FE 배포 | FE Dev | Vercel 셋업 |
| AI 배포 | AI Dev | Docker + Cloud Run / Railway |
| 모니터링 | 공동 | 에러 트래킹, 분석 |

### 배포 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        프로덕션 환경                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐      ┌─────────────────────────┐   │
│  │   Vercel            │      │   Cloud Run / Railway   │   │
│  │   ───────────────   │      │   ─────────────────────  │   │
│  │   apps/web          │ ──── │   apps/ai-service       │   │
│  │   (Next.js)         │ HTTPS│   (FastAPI + Docker)    │   │
│  └─────────────────────┘      └─────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 브랜치 전략

### 브랜치 네이밍

```
main                           # 프로덕션
|
+-- develop                    # 통합 브랜치
    |
    +-- feature/fe-layout      # FE 기능
    +-- feature/fe-chat-ui     # FE 기능
    +-- feature/ai-prompt      # AI 기능
    +-- feature/ai-tokens      # AI 기능
    +-- fix/fe-iframe-bug      # FE 버그픽스
    +-- fix/ai-parsing         # AI 버그픽스
```

### 브랜치 접두사

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feature/fe-*` | FE 기능 | `feature/fe-composition` |
| `feature/ai-*` | AI 기능 | `feature/ai-streaming` |
| `fix/fe-*` | FE 버그픽스 | `fix/fe-layout-mobile` |
| `fix/ai-*` | AI 버그픽스 | `fix/ai-timeout` |
| `docs/*` | 문서 | `docs/api-update` |

### PR 규칙

**일반 PR**
- 1명 이상 팀원 리뷰
- CI 통과 필수

**타입 정의 PR** (`types/` 변경)
- FE + AI 개발자 모두 승인 필수
- 양쪽 승인 전 머지 금지

---

## 커뮤니케이션

### 정기 회의

| 회의 | 주기 | 참석자 | 목적 |
|------|------|--------|------|
| Daily Standup | 매일 | 전체 | 진행상황, 블로커 |
| Weekly Sync | 주간 | FE + AI | 연동 이슈, API 변경 |
| Sprint Review | 격주 | 전체 + 이해관계자 | 데모, 피드백 |

### 비동기 커뮤니케이션

| 채널 | 목적 |
|------|------|
| `#ds-hub-general` | 일반 논의 |
| `#ds-hub-fe` | FE 전용 |
| `#ds-hub-ai` | AI 전용 |
| `#ds-hub-integration` | 팀 간 이슈 |
| GitHub Issues | 버그 리포트, 기능 요청 |
| GitHub PRs | 코드 리뷰 |

---

## 품질 게이트

### 코드 품질

**apps/web (TypeScript)**

| 검사 | 도구 | 필수 |
|------|------|------|
| Lint | ESLint | 통과 |
| Type check | TypeScript | 통과 |
| Format | Prettier | 통과 |
| Tests | Vitest | 통과 |

**apps/ai-service (Python)**

| 검사 | 도구 | 필수 |
|------|------|------|
| Lint | Ruff | 통과 |
| Type check | mypy | 통과 |
| Format | Black | 통과 |
| Tests | pytest | 통과 |

### CI 파이프라인

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  web:
    name: Web (Next.js)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm --filter @ds-hub/web lint
      - run: pnpm --filter @ds-hub/web typecheck
      - run: pnpm --filter @ds-hub/web test
      - run: pnpm --filter @ds-hub/web build

  ai-service:
    name: AI Service (FastAPI)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install Poetry
        run: pip install poetry
      - name: Install dependencies
        working-directory: apps/ai-service
        run: poetry install
      - name: Lint (Ruff)
        working-directory: apps/ai-service
        run: poetry run ruff check .
      - name: Type check (mypy)
        working-directory: apps/ai-service
        run: poetry run mypy src
      - name: Test (pytest)
        working-directory: apps/ai-service
        run: poetry run pytest
```

### 배포 전 체크리스트

- [ ] 모든 테스트 통과
- [ ] TypeScript 에러 없음
- [ ] ESLint 에러 없음
- [ ] Staging 환경 테스트 완료
- [ ] PM 승인 (프로덕션용)

---

## 리스크 관리

### 예상 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| API contract 변경 | 양 팀 재작업 | Phase 1에서 철저한 설계, JSON Schema SSOT |
| Storybook 파싱 실패 | 핵심 기능 불가 | v6/v7 지원, fallback 처리 |
| AI hallucination | 나쁜 UX | 엄격한 system prompt, 검증 |
| CORS 이슈 | 파싱 실패 | 서버 사이드 fetching (Next.js) |
| Playwright 배포 | 토큰 추출 실패 | Docker 환경, 선택 기능 |
| 서비스 간 통신 실패 | AI 기능 불가 | BFF 프록시, health check, fallback |

### 의존성

```
FE (apps/web)가 AI (apps/ai-service)에 의존:
- Chat API (준비 전까지 mock 사용 가능)
- 토큰 추출 (선택, phase 3)

AI (apps/ai-service)가 공동 스키마에 의존:
- ds.json schema (packages/shared-types)
- Chat request format (packages/shared-types)

공동 (packages/shared-types):
- JSON Schema가 SSOT
- TypeScript, Pydantic 타입 자동 생성
```

---

## 완료 정의

### 기능 완료

- [ ] 구현이 스펙과 일치
- [ ] 유닛 테스트 작성
- [ ] TypeScript 에러 없음
- [ ] ESLint 경고 없음
- [ ] 코드 리뷰 완료
- [ ] 문서 업데이트

### 스프린트 완료

- [ ] 모든 계획된 기능 완료
- [ ] 통합 테스트 완료
- [ ] 데모 가능
- [ ] 치명적 버그 없음

### 릴리스 준비

- [ ] 모든 단계 완료
- [ ] E2E 테스트 통과
- [ ] 성능 acceptable
- [ ] 보안 리뷰 완료
- [ ] 문서 완성
- [ ] 배포 검증 완료

---

## 다음 문서

- [06. 디렉토리 구조](./06-directory-structure.md) - 코드 조직
- [04. API Contract](./04-api-contract.md) - API 스펙
