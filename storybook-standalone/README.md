# Storybook Standalone

UI 컴포넌트 라이브러리를 위한 Storybook 기반 모노레포 프로젝트입니다.

## 요구사항

| 도구 | 버전 |
|------|------|
| Node.js | ^20.0.0 |
| pnpm | ^10.0.0 |

## 시작하기

```bash
# 의존성 설치
pnpm install

# Storybook 실행 (빌드 후 서버 실행)
pnpm run start:storybook
```

Storybook이 `http://localhost:6006`에서 실행됩니다.

## 주요 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm install` | 의존성 설치 |
| `pnpm dev:storybook` | Storybook 개발 서버 실행 (HMR 지원) |
| `pnpm start:storybook` | Storybook 빌드 후 정적 서버 실행 |
| `pnpm build` | 전체 패키지 빌드 |
| `pnpm build:storybook` | Storybook만 빌드 |
| `pnpm build:ui` | UI 라이브러리만 빌드 |
| `pnpm test` | 전체 테스트 실행 |
| `pnpm lint` | 린트 검사 |
| `pnpm clean` | 빌드 산출물 및 캐시 정리 |

## 모노레포 구조

```
storybook-standalone/
├── apps/
│   ├── storybook/                 # Storybook 앱
│   └── tools/
│       └── storybook-validator/   # Claude MCP Extension
├── packages/
│   ├── ui/                        # @aplus/ui 컴포넌트 라이브러리
│   ├── eslint-config/             # @aplus/eslint-config
│   └── tsconfig/                  # @aplus/tsconfig
├── package.json                   # 루트 패키지 설정
├── pnpm-workspace.yaml            # pnpm 워크스페이스 설정
└── turbo.json                     # Turborepo 빌드 설정
```

## 패키지 설명

### apps/storybook

UI 컴포넌트 문서화 및 시각적 테스트를 위한 Storybook 앱입니다.

- **포트**: 6006
- **기능**: 컴포넌트 미리보기, 인터랙션 테스트, 접근성 검사

```bash
# 개발 모드
pnpm dev:storybook

# 프로덕션 빌드
pnpm build:storybook
```

### apps/tools/storybook-validator

Claude Desktop MCP Extension으로, Storybook 컴포넌트 스타일을 자연어로 질의할 수 있습니다.

- **기능**: 컴포넌트 스타일 조회, Figma 스펙 추출

```bash
# 빌드
pnpm --filter storybook-validator build

# MCP Inspector 테스트
pnpm --filter storybook-validator inspector
```

### packages/ui

공통 UI 컴포넌트 라이브러리입니다. (@aplus/ui)

- **컴포넌트**: Button, Badge, Alert, Dialog, Select 등
- **스타일**: TailwindCSS 기반 디자인 토큰

```bash
# 빌드
pnpm build:ui

# 테스트
pnpm --filter @aplus/ui test
```

### packages/eslint-config

ESLint 공통 설정 패키지입니다. (@aplus/eslint-config)

- TypeScript, React, Prettier 통합 설정

### packages/tsconfig

TypeScript 공통 설정 패키지입니다. (@aplus/tsconfig)

- base.json: 기본 설정
- react.json: React 프로젝트용
- node.json: Node.js 프로젝트용
- library.json: 라이브러리용

## 기술 스택

- **빌드**: Turborepo, pnpm workspaces
- **프레임워크**: React 18, TypeScript 5
- **스타일**: TailwindCSS 3
- **문서화**: Storybook 8
- **테스트**: Vitest, Playwright
