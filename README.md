# DS-Bridge UI

> 디자인 시스템을 실행·조합·코드 복사까지 한 번에 하는 AI generating UI builder

## 프로젝트 비전

**AI 시대의 디자인 시스템**

- 디자인 시스템을 AI와 사람이 함께 "실행으로 검증"하는 플랫폼
- 핵심 흐름: `Storybook → ds.json → Runtime Hub → Copy for AI → IDE`

## 요구사항

| 도구    | 버전     | 비고                           |
| ------- | -------- | ------------------------------ |
| Node.js | ^24.22.1 | `.nvmrc` 참조                  |
| pnpm    | ^10.0.0  | `packageManager: pnpm@10.15.0` |

```bash
# Node 버전 설정 (nvm 사용 시)
nvm use

# pnpm 설치 (없는 경우)
corepack enable
corepack prepare pnpm@10.15.0 --activate
```

## 시작하기

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev          # http://localhost:3000
```

## 프로젝트 구조

```
ds-bridge-ui/
├── apps/
│   ├── web/                  # Next.js 16 + shadcn (FE)
│   └── ai-service/           # FastAPI AI 서비스 (예정)
│
├── packages/
│   └── shared-types/         # FE ↔ AI 공유 스키마
│       ├── json-schema/      # JSON Schema (원본)
│       ├── typescript/       # TypeScript 타입
│       └── python/           # Pydantic 스키마
│
├── docs/                     # 프로젝트 문서
│   ├── specs/                # 기술 스펙
│   └── hub/                  # 프로젝트 관련 문서
│
└── storybook-standalone/     # 별도 Storybook 모노레포
```

## 스크립트

```bash
pnpm dev          # Next.js 개발 서버
pnpm build        # 프로덕션 빌드
pnpm lint         # 전체 린트
pnpm typecheck    # 타입 체크
```

## 문서

- [01. 프로젝트 개요](./docs/specs/01-project-overview.md) - 비전과 핵심 흐름
- [02. 아키텍처](./docs/specs/02-architecture.md) - 시스템 구조
- [03. 기술 스택](./docs/specs/03-tech-stack.md) - 기술 선택
- [04. API Contract](./docs/specs/04-api-contract.md) - API 스펙
- [05. 개발 워크플로우](./docs/specs/05-development-workflow.md) - MVP 개발 계획
- [06. 디렉토리 구조](./docs/specs/06-directory-structure.md) - 상세 구조

## 기술 스택

### Frontend (apps/web)

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui (Base UI + Tailwind CSS 4)
- **State**: Zustand
- **Language**: TypeScript 5

### AI Service (apps/ai-service) - 예정

- **Framework**: FastAPI
- **LLM**: Claude API (Anthropic)
- **Language**: Python 3.11+

## 아키텍처

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ Storybook │ ──→ │ ds.json  │ ──→ │ Runtime Hub  │ ──→ │ Copy for AI  │
│ (원본 DS) │     │ (프로토콜)│     │ (실행/조합)  │     │ (IDE로 전달) │
└──────────┘     └──────────┘     └──────────────┘     └──────────────┘
```

## 커밋 메시지 컨벤션

프로젝트의 커밋 메시지는 Gitmoji를 사용하여 일관된 형식을 유지합니다. 각 커밋 메시지 타입에 따라 다음과 같은 이모지를 사용합니다.

| 커밋 타입         | 이모지                   | 설명                                                 |
| ----------------- | ------------------------ | ---------------------------------------------------- |
| **Init**          | 🎉 `:tada:`              | 개발 환경 초기 세팅                                  |
| **Feat**          | ✨ `:sparkles:`          | 새로운 기능 추가                                     |
| **Fix**           | 🐛 `:bug:`               | 버그 수정                                            |
| **HotFix**        | 🚑️ `:ambulance:`        | 급하게 치명적인 버그를 고치는 경우                   |
| **Update**        | 🔧 `:wrench:`            | 기능 보완                                            |
| **Modify**        | 🔨 `:hammer:`            | 단순한 코드 수정 (ex. 오타, 문자열 변경 등)          |
| **Refactor**      | ♻️ `:recycle:`           | 코드 리팩토링                                        |
| **Move**          | 🚚 `:truck:`             | 코드나 파일을 이동하는 경우                          |
| **Format**        | 💫 `:dizzy:`             | 코드 스타일, 포매팅 수정                             |
| **Rename**        | ✏️ `:pencil2:`           | 파일 혹은 폴더명을 수정하는 경우                     |
| **Remove**        | ➖ `:heavy_minus_sign:`  | 파일이나 코드를 삭제하는 경우                        |
| **Design**        | 💄 `:lipstick:`          | CSS 수정                                             |
| **Docs**          | 📝 `:memo:`              | 문서(주석) 수정                                      |
| **Test**          | 🧪 `:test_tube:`         | 테스트 코드 추가 및 수정                             |
| **Comment**       | 💡 `:bulb:`              | 필요한 주석 추가 및 변경                             |
| **Chore**         | 📦️ `:package:`          | 패키지 매니저 수정, 그 외 기타 수정 (ex. .gitignore) |
| **WIP**           | 🚧 `:construction:`      | 작업 중                                              |
| **Security**      | 🔒 `:lock:`              | 보안 관련 수정                                       |
| **Performance**   | ⚡ `:zap:`               | 성능 향상 관련 변경                                  |
| **Build**         | 🛠️ `:hammer_and_wrench:` | 빌드 시스템 관련 변경                                |
| **CI**            | 🚀 `:rocket:`            | 지속적 통합(CI) 관련 설정 변경                       |
| **Revert**        | ⏪ `:rewind:`            | 이전 커밋을 되돌리는 경우                            |
| **Deprecation**   | ⚰️ `:coffin:`            | 기능이나 API를 더 이상 사용하지 않기로 결정한 경우   |
| **Accessibility** | ♿️ `:wheelchair:`       | 접근성 향상 관련 변경                                |

## 라이선스

Private
