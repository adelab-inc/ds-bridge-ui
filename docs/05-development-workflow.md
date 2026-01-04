# 05. 개발 워크플로우

> **대상 독자**: 전체 팀 (PM, 디자이너, FE 개발자, AI 개발자)

## TL;DR

- **MVP 4단계**: Setup, Chat/Composition, Export/Tokens, CLI
- **Contract-First**: API 계약 먼저 정의, 이후 병렬 개발
- **브랜치 전략**: `feature/fe-*`, `feature/ai-*` 네임스페이스

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
- 프로젝트 인프라 구축
- Storybook URL 파싱
- 기본 UI 레이아웃

### FE 개발자 태스크

| 태스크 | 산출물 |
|--------|--------|
| 프로젝트 셋업 | Next.js + TypeScript + Tailwind |
| 레이아웃 | Header, Left Panel, Right Panel |
| URL 입력 | 유효성 검사가 있는 폼 |
| Storybook 파싱 | stories.json / index.json 파싱 |
| 컴포넌트 목록 | 파싱된 컴포넌트 표시 |
| iframe 임베드 | Right Panel에 Storybook 표시 |

### AI 개발자 태스크

| 태스크 | 산출물 |
|--------|--------|
| API contract | Chat API request/response 타입 |
| System prompt | 초기 가이드형 프롬프트 설계 |
| Action format | [ACTION:type:payload] 형식 정의 |

### 공동 태스크

| 태스크 | 산출물 |
|--------|--------|
| ds.json schema | TypeScript interfaces |
| API types | 공유 타입 정의 |

### Phase 1 체크리스트

**FE 개발자**
- [ ] `npx create-next-app` with TypeScript, Tailwind
- [ ] 기본 레이아웃 컴포넌트
- [ ] URL 입력 폼
- [ ] `/api/storybook/parse` 엔드포인트
- [ ] Storybook v6/v7 파싱 로직
- [ ] 컴포넌트 목록 UI
- [ ] Storybook iframe 연동

**AI 개발자**
- [ ] Claude API 연동 테스트
- [ ] System prompt 초안
- [ ] Action 파싱 로직 설계

**공동**
- [ ] `types/ds-json.ts` 완성
- [ ] `types/api.ts` 완성

---

## Phase 2: Chat & Composition (3-4주차)

### 목표
- 가이드형 AI 채팅
- 컴포넌트 조합
- Props 편집

### FE 개발자 태스크

| 태스크 | 산출물 |
|--------|--------|
| Chat UI | 메시지 목록, 입력, 스트리밍 표시 |
| Action 버튼 | 채팅 액션 실행 |
| Composition 관리자 | 컴포넌트 추가/제거/순서 변경 |
| Props 에디터 | PropDefinition 기반 동적 폼 |
| Preview | Right Panel에 Composition 미리보기 |

### AI 개발자 태스크

| 태스크 | 산출물 |
|--------|--------|
| Chat API | SSE streaming `/api/chat` |
| System prompt | ds.json 컨텍스트로 개선된 프롬프트 |
| Action types | 모든 액션 타입 구현 |
| Validation | hallucination 방지 검증 |

### Phase 2 체크리스트

**FE 개발자**
- [ ] 채팅 메시지 컴포넌트
- [ ] SSE 스트리밍 연동
- [ ] Action 버튼 핸들러
- [ ] Composition 상태 (Zustand)
- [ ] 동적 props 폼
- [ ] Composition 미리보기 렌더러

**AI 개발자**
- [ ] SSE 스트리밍 엔드포인트
- [ ] 컴포넌트 목록 포함 System prompt
- [ ] Action 파싱 및 검증
- [ ] 응답 포맷팅

---

## Phase 3: Export & Tokens (5-6주차)

### 목표
- Copy for AI 기능
- 토큰 추출
- Export 기능

### FE 개발자 태스크

| 태스크 | 산출물 |
|--------|--------|
| Copy for AI | 생성 및 클립보드 복사 |
| 토큰 표시 | 추출된 토큰 표시 |
| Export JSON | ds.json / composition 다운로드 |
| UI 다듬기 | 로딩 상태, 에러 처리 |

### AI 개발자 태스크

| 태스크 | 산출물 |
|--------|--------|
| 토큰 추출 | Puppeteer/Playwright 연동 |
| Copy 템플릿 | AI 프롬프트 출력 최적화 |
| Validation | 다양한 Storybook으로 테스트 |

### Phase 3 체크리스트

**FE 개발자**
- [ ] Copy for AI 버튼
- [ ] Clipboard API 연동
- [ ] 토큰 표시 UI
- [ ] Export 버튼 (JSON 다운로드)
- [ ] 로딩 및 에러 상태

**AI 개발자**
- [ ] `/api/tokens/extract` 엔드포인트
- [ ] Computed styles 추출
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
| 테스팅 | 공동 | E2E 테스트, 유닛 테스트 |
| 문서화 | 공동 | 사용자 가이드, API 문서 |
| 배포 | FE Dev | Vercel / Docker 셋업 |
| 모니터링 | FE Dev | 에러 트래킹, 분석 |

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

| 검사 | 도구 | 필수 |
|------|------|------|
| Lint | ESLint | 통과 |
| Type check | TypeScript | 통과 |
| Format | Prettier | 통과 |
| Tests | Vitest | 통과 |

### CI 파이프라인

```yaml
# 모든 PR에서 실행
- pnpm install
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
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
| API contract 변경 | 양 팀 재작업 | Phase 1에서 철저한 설계 |
| Storybook 파싱 실패 | 핵심 기능 불가 | v6/v7 지원, fallback 처리 |
| AI hallucination | 나쁜 UX | 엄격한 system prompt, 검증 |
| CORS 이슈 | 파싱 실패 | 서버 사이드 fetching |
| Puppeteer 배포 | 토큰 추출 실패 | 선택 기능, 외부 서비스 |

### 의존성

```
FE가 AI에 의존:
- Chat API (준비 전까지 mock 사용 가능)
- 토큰 추출 (선택, phase 3)

AI가 FE에 의존:
- ds.json schema (phase 1에서 정의)
- Chat request format (phase 1에서 정의)
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
