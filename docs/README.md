# DS-Runtime Hub - 기술 문서

> 디자인 시스템을 실행·조합·코드 복사까지 한 번에 하는 플랫폼

## 핵심 흐름

```
Storybook → ds.json → Runtime Hub → Copy for AI → IDE
```

---

## 문서 목차

| 문서 | 설명 | 주요 독자 |
|------|------|----------|
| [01. 프로젝트 개요](./specs/01-project-overview.md) | 프로젝트 비전, 핵심 가치, 사용 시나리오 | 전체 팀 |
| [02. 시스템 아키텍처](./specs/02-architecture.md) | 전체 시스템 구조와 데이터 흐름 | 개발자, PM |
| [03. 기술 스택](./specs/03-tech-stack.md) | 선정된 기술과 선정 이유 | 개발자 |
| [04. API 계약](./specs/04-api-contract.md) | 6개 핵심 API 엔드포인트 정의 | FE, AI 개발자 |
| [05. 개발 워크플로우](./specs/05-development-workflow.md) | MVP 4단계, 협업 방식 | 전체 팀 |
| [06. 디렉토리 구조](./specs/06-directory-structure.md) | 코드베이스 구조 가이드 | 개발자 |

### 참고 문서

| 문서 | 설명 |
|------|------|
| [ds-runtime-hub-summary.md](./ds-runtime-hub-summary.md) | PM 작성 프로젝트 요약 |
| [ds-runtime-hub-claude-code-prd.md](./specs/ds-runtime-hub-claude-code-prd.md) | 상세 PRD 및 스키마 정의 |

---

## 빠른 시작

### 프로젝트 설치

```bash
# 저장소 클론
git clone <repository-url>
cd ds-bridge-ui

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev
```

### 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 실행 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm lint` | 코드 린트 검사 |
| `pnpm test` | 테스트 실행 |

---

## 서비스 핵심 가치

### 우리가 하는 것

| ⭕ 하는 것 | ❌ 안 하는 것 |
|-----------|-------------|
| 기존 DS 실행/조합 | AI가 코드를 자유 생성 |
| 가이드형 채팅 (네비게이터) | Lovable식 생성 채팅 |
| Copy for AI → 외부 IDE | 내장 코드 에디터 |
| 실행 기반 검증 | 문서/설명 기반 공유 |

### 타겟 사용자

| 사용자 | 사용 방식 |
|--------|----------|
| 백엔드 개발자, 기획자 | Storybook URL 붙여넣기 → 30초 체험 |
| 디자이너 + FE 개발자 | `npx ds-hub extract` → 내 DS 등록 |
| 혼자 만드는 개발자 | 조합 → Copy for AI → Vibe Coding |

---

## 팀 역할

| 역할 | 담당 영역 |
|------|----------|
| **FE 개발자** | UI 컴포넌트, Storybook 파싱, 채팅 UI, Composition 관리 |
| **AI 개발자** | Claude 통합, 가이드형 프롬프트 설계, 토큰 추출 |
| **PM** | 요구사항 정의, 우선순위 조율, 이해관계자 관리 |
| **디자이너** | UI/UX 설계, 사용자 플로우, 인터랙션 |

---

## 문서 업데이트 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2025-01-04 | v0.2.0 | DS-Runtime Hub 기준 문서 재작성 |
| 2025-01-03 | v0.1.0 | 초기 문서 작성 |
