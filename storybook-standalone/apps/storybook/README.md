# A+ World UI Storybook

A+ World UI 컴포넌트 라이브러리를 위한 Storybook 문서화 및 개발 환경입니다.

## 🚀 빠른 시작

### 개발 서버 실행

```bash
# Storybook 개발 서버 시작
pnpm run dev

# 또는
pnpm run storybook
```

개발 서버가 시작되면 다음 주소에서 확인할 수 있습니다:

- **로컬**: http://localhost:6006/
- **네트워크**: http://192.168.1.178:6006/

### 빌드

```bash
# 프로덕션 빌드
pnpm run build

# 또는
pnpm run build-storybook
```

### 프로덕션 서버 시작

```bash
# 프로덕션 빌드 서빙 (포트 6006)
pnpm run start
```

빌드된 정적 파일이 `storybook-static/` 디렉토리에서 서빙됩니다.

## 📁 프로젝트 구조

```
apps/storybook/
├── .storybook/           # Storybook 설정
│   ├── main.ts          # 메인 설정 파일
│   └── preview.ts       # 프리뷰 설정
├── tsconfig.json        # TypeScript 설정
└── package.json         # 패키지 의존성
```

## 🔧 기술 스택

- **Storybook**: 8.6.14
- **Framework**: React with Webpack 5
- **TypeScript**: SWC 컴파일러 사용
- **UI 컴포넌트**: @aplus/ui 패키지

## 📝 컴포넌트 스토리

### Button 컴포넌트

현재 다음 스토리가 포함되어 있습니다:

1. **Primary** - 기본 프라이머리 버튼
2. **Secondary** - 세컨더리 버튼
3. **Small** - 작은 크기 버튼
4. **Medium** - 중간 크기 버튼 (기본값)
5. **Large** - 큰 크기 버튼
6. **Loading** - 로딩 상태 버튼
7. **Disabled** - 비활성화 버튼
8. **WithClick** - 클릭 인터랙션 테스트

### 컴포넌트 Props

- `variant`: 'primary' | 'secondary'
- `size`: 'small' | 'medium' | 'large'
- `loading`: boolean - 로딩 상태
- `disabled`: boolean - 비활성화 상태
- `children`: ReactNode - 버튼 내용

## ⚙️ 설정 세부사항

### TypeScript 지원

- SWC 컴파일러 사용으로 빠른 빌드
- `import type` 구문 완전 지원
- React Docgen TypeScript 자동 생성

### 모노레포 지원

Webpack alias를 통한 패키지 경로 매핑:

```typescript
'@aplus/ui': '../../../packages/ui/src',
'@aplus/shared': '../../../packages/shared/src',
'@aplus/types': '../../../packages/types/src'
```

### 애드온

- **@storybook/addon-essentials**: 필수 애드온 모음
- **@storybook/addon-interactions**: 인터랙션 테스팅
- **@storybook/addon-onboarding**: 온보딩 가이드
- **@storybook/addon-webpack5-compiler-swc**: SWC 컴파일러

## 🔐 보안 설정 (serve.json)

프로덕션 배포 시 다음 보안 헤더가 자동으로 설정됩니다:

### X-Frame-Options: SAMEORIGIN

- **목적**: Storybook iframe 아키텍처 지원
- **설정 이유**:
  - Storybook은 컴포넌트 프리뷰에 iframe을 필수적으로 사용
  - `index.html`이 `iframe.html`을 로드하여 컴포넌트를 격리된 환경에서 렌더링
  - 같은 출처(동일 도메인)에서의 iframe 로딩을 허용해야 정상 작동
  - `DENY`로 설정 시 Storybook UI가 완전히 작동하지 않음

**Storybook 아키텍처:**

```
┌─────────────────────────────────┐
│  Storybook UI (index.html)      │
│  - 컴포넌트 목록 (사이드바)       │
│  - 컨트롤 패널                   │
│  ┌───────────────────────────┐  │
│  │  <iframe src="iframe.html">│  │  ← 컴포넌트 프리뷰 영역
│  │  - 격리된 렌더링 환경      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 기타 보안 헤더

- **X-Content-Type-Options**: `nosniff` - MIME 타입 스니핑 방지
- **X-XSS-Protection**: `1; mode=block` - XSS 공격 차단
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Referrer 정보 보호
- **Cache-Control**: `public, max-age=31536000, immutable` (정적 리소스 1년 캐싱)

## 🐛 트러블슈팅

### TypeScript 컴파일 오류

이 프로젝트는 Babel 대신 SWC를 사용하여 TypeScript 파싱 문제를 해결했습니다.
만약 컴파일 오류가 발생하면:

1. `node_modules` 캐시 정리: `pnpm run clean`
2. 의존성 재설치: `pnpm install`
3. 개발 서버 재시작: `pnpm run dev`

### 모듈 해결 오류

모노레포 패키지 경로 문제가 있다면 `main.ts`의 webpack alias 설정을 확인하세요.

## 📚 추가 정보

- [Storybook 공식 문서](https://storybook.js.org/docs)
- [A+ World UI 패키지](../../../packages/ui/README.md)

## 🔄 개발 워크플로우

1. UI 컴포넌트를 `packages/ui/src/components`에서 개발
2. 해당 컴포넌트의 `.stories.tsx` 파일 작성
3. `pnpm run dev`로 Storybook에서 확인
4. 문서화 및 인터랙션 테스트 추가
5. 빌드 및 배포

## 📚 관련 문서

- [프로덕션 서빙 가이드](../../docs/guides/deployment/production-serve.md)
- [Storybook 가이드](../../docs/guides/development/storybook-guide.md)

---

**Made with ❤️ by A+ World UI Team**
