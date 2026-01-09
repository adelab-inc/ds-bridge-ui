# Vercel 배포 가이드 (모노레포)

> pnpm workspace 기반 모노레포에서 Next.js 앱을 Vercel에 배포하는 방법

## 1. Vercel 프로젝트 생성

### 1.1 GitHub 연동

1. [Vercel 대시보드](https://vercel.com/dashboard)에 접속
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 Import
   - Organization/User 선택
   - `ds-bridge-ui` 저장소 선택

### 1.2 모노레포 설정 (중요)

**Configure Project** 화면에서:

| 설정 | 값 | 설명 |
|------|-----|------|
| Framework Preset | Next.js | 자동 감지됨 |
| Root Directory | `apps/web` | **필수 설정** |
| Build Command | (자동) | vercel.json에서 오버라이드 |
| Output Directory | `.next` | 기본값 사용 |
| Install Command | `pnpm install` | vercel.json에서 설정 |

> **중요**: Root Directory를 `apps/web`으로 반드시 설정해야 합니다!

## 2. 환경 변수 설정

### 2.1 Firebase 환경 변수

Vercel 대시보드 → Project Settings → Environment Variables

다음 변수들을 **Production**, **Preview**, **Development** 모두에 추가:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCfH4Py-F9w4uJjW5OAn4JJmYuJRpg7Nho
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ds-runtime-hub.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ds-runtime-hub
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ds-runtime-hub.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=233376868812
NEXT_PUBLIC_FIREBASE_APP_ID=1:233376868812:web:d0a8095f8d0f9b864a9569
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-4P38V1B6FN
```

### 2.2 한 번에 추가하기

1. `.env.local` 파일 내용 복사
2. Vercel → Environment Variables → "Paste .env"
3. 환경 선택 (Production, Preview, Development)
4. "Add" 클릭

## 3. 배포 트리거

### 3.1 자동 배포

- `main` 브랜치에 push → Production 배포
- PR 생성 → Preview 배포 자동 생성
- 다른 브랜치 push → Preview 배포

### 3.2 수동 배포

Vercel CLI 사용:

```bash
# Vercel CLI 설치 (글로벌)
pnpm add -g vercel

# 프로젝트 루트에서
cd /path/to/ds-bridge-ui

# 배포 (대화형)
vercel

# Production 배포
vercel --prod
```

## 4. vercel.json 설정 설명

`apps/web/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && pnpm install && pnpm --filter @ds-hub/web build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### 설정 의미

| 필드 | 설명 |
|------|------|
| `buildCommand` | 모노레포 루트로 이동 후 pnpm workspace 필터로 빌드 |
| `installCommand` | pnpm 사용 명시 |
| `framework` | Next.js 프레임워크 지정 |
| `outputDirectory` | Next.js 빌드 결과물 위치 |

## 5. 도메인 설정

### 5.1 Production 도메인

1. Vercel 대시보드 → Settings → Domains
2. "Add" 클릭
3. 도메인 입력 (예: `ds-bridge.com`)
4. DNS 설정 안내에 따라 CNAME 레코드 추가

### 5.2 자동 할당 도메인

- Production: `your-project.vercel.app`
- Preview: `your-project-git-branch.vercel.app`

## 6. 빌드 로그 확인

배포 실패 시:

1. Vercel 대시보드 → Deployments
2. 실패한 배포 클릭
3. "Building" 탭에서 로그 확인
4. 에러 메시지 확인 후 수정

### 자주 발생하는 이슈

| 에러 | 원인 | 해결 |
|------|------|------|
| `Module not found` | 의존성 누락 | `pnpm install` 확인 |
| `Build failed` | TypeScript 에러 | 로컬에서 `pnpm build` 테스트 |
| `Root Directory not found` | 잘못된 Root Directory | `apps/web`로 수정 |

## 7. CI/CD 파이프라인

```
GitHub Push
    ↓
Vercel 자동 감지
    ↓
1. Install (pnpm install)
2. Build (pnpm build)
3. Deploy
    ↓
배포 완료 (URL 생성)
```

## 8. 모니터링

### 8.1 Analytics

Vercel 대시보드 → Analytics에서:
- Page Views
- Unique Visitors
- Top Pages

### 8.2 Logs

Runtime Logs에서 실시간 로그 확인:
- Function 로그
- Edge Network 로그
- 에러 추적

## 참고 링크

- [Vercel Docs - Monorepos](https://vercel.com/docs/monorepos)
- [Vercel Docs - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
