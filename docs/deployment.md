# DS-Bridge UI 배포 가이드

## 배포 구조 개요

| 환경 | 브랜치 | Vercel 환경 | URL | 용도 |
|------|--------|-------------|-----|------|
| Production | `main` | Production | Vercel 기본 URL (또는 커스텀 도메인) | 운영 배포 |
| Development | `develop` | Preview | Vercel 자동 생성 URL | 개발계 배포 |
| PR Preview | feature/* 등 | Preview | PR별 자동 생성 URL | PR 리뷰용 임시 배포 |

## 1. 자동 배포 (GitHub Integration)

Vercel GitHub Integration이 연결되어 있어 다음과 같이 자동 배포됩니다:

- **`main` push** → Production 배포
- **`develop` push** → Preview 배포 (개발계)
- **PR 생성** → Preview 배포 (PR별 고유 URL)

### 배포 확인
- Vercel 대시보드: [https://vercel.com](https://vercel.com)
- GitHub PR에 Vercel bot이 배포 URL 코멘트 자동 작성

---

## 2. 환경변수 설정

### 2-1. 로컬 개발

Next.js는 환경에 따라 자동으로 env 파일을 로드합니다:

| 파일 | 로드 시점 | Git 추적 |
|------|-----------|----------|
| `.env.development` | `next dev` | O |
| `.env.production` | `next build` / `next start` | O |
| `.env.local` | 항상 (최우선) | X |

로컬에서는 `.env.local`에 시크릿(Firebase 키 등)을 설정하세요.

### 2-2. Vercel 대시보드 설정

**Settings → Environment Variables** 에서 환경별로 변수를 설정합니다:

| 변수 | Production | Preview | Development |
|------|-----------|---------|-------------|
| `AI_SERVER_URL` | `https://ai-server-233376868812.asia-northeast3.run.app` | `https://ai-server-dev-233376868812.asia-northeast3.run.app` | - |
| `NEXT_PUBLIC_FIREBASE_*` | 동일 값 | 동일 값 | - |
| `FIREBASE_CLIENT_EMAIL` | 설정 필요 | 설정 필요 | - |
| `FIREBASE_PRIVATE_KEY` | 설정 필요 | 설정 필요 | - |
| `X_API_KEY` | 설정 필요 | 설정 필요 | - |
| `FIGMA_ACCESS_TOKEN` | 설정 필요 | 설정 필요 | - |

> **참고**: Vercel에서 변수 추가 시 적용할 환경(Production, Preview, Development)을 선택할 수 있습니다.

---

## 3. 브랜치 전략

```
main (Production)
 └── develop (Development)
      ├── feat/feature-a
      ├── feat/feature-b
      └── fix/bug-fix
```

- 기능 개발: `develop`에서 feature 브랜치 생성 → PR → `develop` 머지
- 운영 배포: `develop` → `main` PR → 머지 시 Production 배포

---

## 4. Vercel CLI 수동 배포

특정 커밋이나 브랜치를 별도 URL로 임시 배포할 때 사용합니다.

### 4-1. 설치 및 로그인

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login
```

### 4-2. 프로젝트 연결 (최초 1회)

```bash
cd apps/web
vercel link
```

프롬프트에서 기존 Vercel 프로젝트를 선택합니다.

### 4-3. Preview 배포 (임시 URL 생성)

```bash
# 현재 상태를 Preview로 배포
vercel

# 특정 브랜치를 checkout 후 배포
git checkout feat/my-feature
vercel
```

배포 완료 시 고유 URL이 출력됩니다:
```
🔗 https://ds-bridge-ui-xxxx-adelab-inc.vercel.app
```

### 4-4. Production 배포 (수동)

```bash
vercel --prod
```

> ⚠️ `--prod`는 실제 운영 환경에 배포하므로 주의하세요.

### 4-5. 환경변수 포함 배포

```bash
# Vercel 대시보드에 설정된 환경변수가 자동 적용됨
# 로컬 환경변수를 추가로 전달하려면:
vercel -e AI_SERVER_URL=https://custom-server.example.com
```

### 4-6. 실용 예시

```bash
# 시나리오: 특정 커밋을 QA팀에 공유
git checkout abc1234
vercel
# → 출력된 URL을 QA팀에 공유

# 시나리오: 현재 작업 브랜치를 디자이너에게 공유
git checkout feat/new-ui
vercel
# → 출력된 URL을 디자이너에게 공유
```

---

## 5. Vercel 대시보드 초기 설정 체크리스트

`develop` 브랜치 기반 개발계를 처음 구성할 때 확인할 항목:

- [ ] **Settings → Git → Production Branch**: `main`으로 설정
- [ ] **Settings → Environment Variables**: 위 표 참고하여 환경별 설정
- [ ] **GitHub 저장소에 `develop` 브랜치 존재 확인**
- [ ] `develop` 브랜치에 push 후 Preview 배포 URL 확인
