# @aplus/tsconfig

A+ World UI 프로젝트의 TypeScript 공통 설정 패키지입니다.

## 구조

### 계층형 설정 구조

```
@aplus/tsconfig/
├── base.json     - 최소 공통 설정 (모든 앱/패키지 공통)
├── react.json    - React 앱용 설정 (web, storybook)
├── node.json     - Node.js 서버용 설정 (server)
└── library.json  - 라이브러리용 설정 (packages/*)
```

## 사용법

### React 앱 (apps/web, apps/storybook)
```json
{
  "extends": "@aplus/tsconfig/react.json",
  "compilerOptions": {
    // 앱별 특화 설정 (paths 등)
  }
}
```

### Node.js 서버 (apps/server)
```json
{
  "extends": "@aplus/tsconfig/node.json",
  "compilerOptions": {
    // 서버별 특화 설정
  }
}
```

### 라이브러리 패키지 (packages/ui, packages/shared)
```json
{
  "extends": "@aplus/tsconfig/library.json",
  "compilerOptions": {
    // 패키지별 특화 설정 (jsx 등)
  }
}
```

## 설정별 특징

### base.json (공통 최소 설정)
- 모든 프로젝트에 공통으로 적용되는 최소한의 설정
- strict 모드, 모듈 해결 규칙 등

### react.json (React 앱용)
- DOM 라이브러리 포함
- JSX 변환 설정
- noEmit: true (번들러가 빌드 담당)

### node.json (Node.js 서버용)  
- Node.js 환경 설정
- CommonJS 모듈 시스템
- 빌드 출력 설정

### library.json (라이브러리용)
- declaration 파일 생성
- ES 모듈 출력
- 다른 프로젝트에서 import 가능한 형태

## 아키텍처 원칙

1. **관심사 분리**: 각 설정은 특정 환경에 최적화
2. **계층 구조**: base → 환경별 특화 설정
3. **확장 가능**: 새로운 환경 추가 시 base 확장
4. **일관성**: 모든 프로젝트가 동일한 기본 규칙 준수