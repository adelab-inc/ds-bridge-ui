# 컴포넌트 스키마 JSON Export 계획

> Storybook 스토리 메타데이터와 React 컴포넌트 Props를 결합한 통합 스키마 생성

## 목표

AI 에이전트 및 문서화 도구에서 활용할 수 있는 **완전한 컴포넌트 스키마**를 JSON으로 추출한다.

## 현재 상태

### 1. index.json (Storybook 빌드 산출물)

**위치**: `apps/storybook/storybook-static/index.json`

**포함 정보**:
- 스토리 ID, 이름, 타이틀
- 스토리 파일 경로 (`importPath`)
- 컴포넌트 파일 경로 (`componentPath`)
- 태그 (autodocs, play-fn 등)

**제한 사항**:
- Props 정의 없음
- 타입 정보 없음
- 기본값 없음

```json
{
  "v": 5,
  "entries": {
    "ui-button--primary": {
      "id": "ui-button--primary",
      "title": "UI/Button",
      "name": "Primary",
      "importPath": "../../packages/ui/src/stories/Button.stories.tsx",
      "componentPath": "../../packages/ui/src/components/Button.tsx",
      "tags": ["dev", "test", "autodocs", "play-fn"]
    }
  }
}
```

### 2. react-docgen-typescript (별도 추출 필요)

**도구**: `react-docgen-typescript-cli` 또는 프로그래매틱 API

**포함 정보**:
- 모든 Props 정의
- TypeScript 타입 정보
- 기본값 (defaultProps)
- JSDoc 주석 설명

```json
{
  "displayName": "Button",
  "filePath": "packages/ui/src/components/Button.tsx",
  "props": {
    "variant": {
      "name": "variant",
      "type": { "name": "enum", "value": ["primary", "secondary", "outline"] },
      "required": false,
      "defaultValue": { "value": "primary" },
      "description": "버튼 스타일 변형"
    },
    "size": {
      "name": "size",
      "type": { "name": "enum", "value": ["sm", "md", "lg"] },
      "required": false,
      "defaultValue": { "value": "md" },
      "description": "버튼 크기"
    }
  }
}
```

## 결합 전략

### 매칭 기준

`componentPath` (index.json) ↔ `filePath` (react-docgen-typescript)

```
index.json                    react-docgen-typescript
     │                                  │
     │ componentPath                    │ filePath
     └──────────┬───────────────────────┘
                │
                ▼
         결합 스크립트
                │
                ▼
        combined-schema.json
```

### 결합 결과 스키마

```json
{
  "version": "1.0.0",
  "generatedAt": "2025-01-02T12:00:00Z",
  "components": {
    "Button": {
      "displayName": "Button",
      "filePath": "packages/ui/src/components/Button.tsx",
      "category": "UI",
      "props": {
        "variant": {
          "type": ["primary", "secondary", "outline", "tertiary", "destructive"],
          "required": false,
          "defaultValue": "primary",
          "description": "버튼 스타일 변형"
        },
        "size": {
          "type": ["sm", "md", "lg"],
          "required": false,
          "defaultValue": "md",
          "description": "버튼 크기"
        },
        "disabled": {
          "type": "boolean",
          "required": false,
          "defaultValue": false,
          "description": "비활성화 상태"
        }
      },
      "stories": [
        {
          "id": "ui-button--primary",
          "name": "Primary",
          "tags": ["dev", "test", "autodocs", "play-fn"]
        },
        {
          "id": "ui-button--secondary",
          "name": "Secondary",
          "tags": ["dev", "test", "autodocs", "play-fn"]
        }
      ]
    }
  }
}
```

## 구현 계획

### Phase 1: 스크립트 개발

**파일**: `scripts/extract-component-schema.ts`

```
1. react-docgen-typescript로 컴포넌트 Props 추출
2. storybook-static/index.json 읽기
3. componentPath 기준으로 매칭
4. 결합된 JSON 생성
5. dist/component-schema.json으로 출력
```

### Phase 2: 빌드 통합

**package.json 스크립트 추가**:

```json
{
  "scripts": {
    "schema:extract": "ts-node scripts/extract-component-schema.ts",
    "schema:build": "pnpm build:storybook && pnpm schema:extract"
  }
}
```

### Phase 3: CI/CD 통합 (선택)

- Storybook 빌드 후 자동으로 스키마 추출
- 스키마 파일을 아티팩트로 배포
- 버전 관리 및 변경 감지

## 의존성

```json
{
  "devDependencies": {
    "react-docgen-typescript": "^2.2.2",
    "typescript": "^5.0.0"
  }
}
```

## 활용 사례

| 사용처 | 설명 |
|--------|------|
| **storybook-validator MCP** | 컴포넌트 스타일 질의 시 Props 정보 제공 |
| **문서화 자동 생성** | API 문서 자동 생성 |
| **IDE 자동완성** | 커스텀 플러그인에서 활용 |
| **디자인 시스템 검증** | Figma 스펙과 비교 검증 |

## 체크리스트

- [ ] react-docgen-typescript 의존성 추가
- [ ] 추출 스크립트 개발 (`scripts/extract-component-schema.ts`)
- [ ] index.json 파싱 로직 구현
- [ ] 결합 로직 구현
- [ ] 출력 스키마 검증
- [ ] package.json 스크립트 추가
- [ ] README 문서화
